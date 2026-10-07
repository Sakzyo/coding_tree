import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { FtcJava } from "@opencode-ai/schema/ftc-java"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { Location } from "@opencode-ai/schema/location"
import { Project } from "@opencode-ai/schema/project"
import { AbsolutePath } from "@opencode-ai/schema/schema"
import { Deferred, Effect, Exit, Fiber, Schema, Scope, Stream } from "effect"
import { Java } from "../../../src/ftc/java"
import { JavaDocuments } from "../../../src/ftc/java/documents"
import { tmpdir } from "../../fixture/tmpdir"

const project = (root: string) =>
  FtcProject.ProjectContext.make({
    projectID: Project.ID.make(`project:${root}`),
    canonicalRoot: AbsolutePath.make(root),
    location: new Location.Info({
      directory: AbsolutePath.make(root),
      project: { id: Project.ID.global, directory: AbsolutePath.make(path.parse(root).root) },
    }),
  })
const unavailable = (value: string): FtcJava.DocumentError => ({ code: "file_unavailable", path: value })
const filesystem = {
  realpath: (value: string) => Effect.tryPromise({ try: () => fs.realpath(value), catch: () => unavailable(value) }),
  readText: (value: string) =>
    Effect.tryPromise({ try: () => Bun.file(value).text(), catch: () => unavailable(value) }),
  readBytes: (value: string) => Effect.tryPromise({ try: () => fs.readFile(value), catch: () => unavailable(value) }),
  writeIfUnchanged: (input: { path: string; root: string; expected: Uint8Array; replacement: Uint8Array }) =>
    Effect.gen(function* () {
      const canonical = yield* filesystem.realpath(input.path)
      const root = yield* filesystem.realpath(input.root)
      if (root !== input.root || canonical !== input.path || path.relative(root, canonical).startsWith(".."))
        return yield* Effect.fail({ code: "path_outside_project", path: input.path } satisfies FtcJava.DocumentError)
      const current = yield* filesystem.readBytes(input.path)
      if (!Buffer.from(current).equals(Buffer.from(input.expected))) return "conflict" as const
      yield* Effect.tryPromise({
        try: () => fs.writeFile(input.path, input.replacement),
        catch: () => unavailable(input.path),
      })
      return "written" as const
    }),
}
const token = Object.freeze({})
const revision = (snapshot: FtcJava.DocumentSnapshot) => ({
  documentID: snapshot.documentID,
  bufferRevision: snapshot.bufferRevision,
  diskRevision: snapshot.diskRevision,
})
const proposal = (context: FtcProject.ProjectContext, snapshot: FtcJava.DocumentSnapshot, replacement = "agent") => ({
  projectID: context.projectID,
  edits: [{ path: snapshot.path, expectedRevision: revision(snapshot), replacement }],
  explanation: "Update Java source",
})
const run = <A, E>(
  context: FtcProject.ProjectContext,
  body: (java: Java.Interface) => Effect.Effect<A, E, Scope.Scope>,
  options: Partial<Java.Ports> = {},
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const java = yield* Java.Service
      return yield* body(java)
    }).pipe(
      Effect.provide(
        Java.layer({
          filesystem,
          projects: { resolve: () => Effect.succeed(context) },
          codeChanges: {
            check: (input) =>
              input.authorization === token
                ? Effect.succeed({
                    projectID: context.projectID,
                    canonicalRoot: context.canonicalRoot,
                    paths: input.proposal.edits.map((edit) =>
                      AbsolutePath.make(path.resolve(context.canonicalRoot, edit.path)),
                    ),
                  })
                : Effect.fail({ code: "edit_unauthorized" }),
          },
          ...options,
        }),
      ),
      Effect.scoped,
    ),
  )

test("dirty or externally changed files reject stale edits", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  const filename = path.join(tmp.path, "Main.java")
  await fs.writeFile(filename, "saved")
  await run(context, (java) =>
    Effect.gen(function* () {
      expect(typeof java.applyEdits).toBe("function")
      const opened = yield* java.openDocument({ project: context, path: "Main.java" })
      yield* java.changeDocument({ path: opened.path, expectedRevision: 0, text: "unsaved" })
      yield* Effect.promise(() => fs.writeFile(filename, "external"))
      const requested = proposal(context, opened)
      const result = yield* java.applyEdits({ proposal: requested, authorization: token })
      expect(result.kind).toBe("conflict")
      expect((yield* java.readDocument({ projectID: context.projectID, path: filename })).text).toBe("unsaved")
      expect(yield* filesystem.readText(filename)).toBe("external")
      expect(result.proposal).toEqual(requested)
      if (result.kind === "conflict") {
        expect(result.conflicts[0].current?.text).toBe("unsaved")
        expect(result.conflicts[0].diskText).toBe("external")
        expect(result.conflicts[0].choices).toEqual(["save", "merge", "defer"])
      }
    }),
  )
})

test("saving the current dirty buffer advances only disk revision and preserves BOM and CRLF", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  const filename = path.join(tmp.path, "Main.java")
  await fs.writeFile(filename, "\ufeffclass Main {}\r\n")
  await run(context, (java) =>
    Effect.gen(function* () {
      const opened = yield* java.openDocument({ project: context, path: filename })
      expect(opened.text).toBe("\ufeffclass Main {}\r\n")
      const changed = yield* java.changeDocument({
        path: filename,
        expectedRevision: 0,
        text: "\ufeffclass Main { }\r\n",
      })
      const saved = yield* java.saveDocument({
        projectID: context.projectID,
        path: filename,
        expectedRevision: revision(changed),
      })
      expect(saved).toMatchObject({ text: changed.text, bufferRevision: 1, diskRevision: 1, dirty: false })
      expect(Buffer.from(yield* filesystem.readBytes(filename))).toEqual(Buffer.from(changed.text))
      expect(
        yield* java.saveDocument({ projectID: context.projectID, path: filename, expectedRevision: revision(saved) }),
      ).toEqual(saved)
    }),
  )
})

test("save rejects external changes and stale buffer or disk revision without losing either version", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  const filename = path.join(tmp.path, "Main.java")
  await fs.writeFile(filename, "saved")
  await run(context, (java) =>
    Effect.gen(function* () {
      const opened = yield* java.openDocument({ project: context, path: filename })
      const changed = yield* java.changeDocument({
        path: filename,
        expectedRevision: opened.bufferRevision,
        text: "unsaved",
      })
      expect(
        (yield* java
          .saveDocument({ projectID: context.projectID, path: filename, expectedRevision: revision(opened) })
          .pipe(Effect.flip)).code,
      ).toBe("revision_conflict")
      expect(
        (yield* java
          .saveDocument({
            projectID: context.projectID,
            path: filename,
            expectedRevision: { ...revision(changed), diskRevision: 99 },
          })
          .pipe(Effect.flip)).code,
      ).toBe("revision_conflict")
      yield* Effect.promise(() => fs.writeFile(filename, "external"))
      const failed = yield* java
        .saveDocument({ projectID: context.projectID, path: filename, expectedRevision: revision(changed) })
        .pipe(Effect.flip)
      expect(failed.code).toBe("revision_conflict")
      expect(failed.conflict?.current?.text).toBe("unsaved")
      expect(failed.conflict?.diskText).toBe("external")
      expect(yield* java.readDocument({ projectID: context.projectID, path: filename })).toMatchObject({
        text: "unsaved",
        bufferRevision: changed.bufferRevision,
        diskRevision: 1,
      })
    }),
  )
  expect(await fs.readFile(filename, "utf8")).toBe("external")
})

test("authorized clean edits save immutable snapshots and publish confirmed saved events", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  const filename = path.join(tmp.path, "Main.java")
  await fs.writeFile(filename, "saved")
  await run(context, (java) =>
    Effect.gen(function* () {
      const observed: FtcJava.DocumentEvent[] = []
      const savedEvent = yield* Deferred.make<void>()
      yield* java.events.pipe(
        Stream.runForEach((event) =>
          Effect.sync(() => observed.push(event)).pipe(
            Effect.andThen(event.type === "saved" ? Deferred.succeed(savedEvent, undefined) : Effect.void),
          ),
        ),
        Effect.forkScoped,
      )
      yield* Effect.yieldNow
      const opened = yield* java.openDocument({ project: context, path: filename })
      const result = yield* java.applyEdits({ proposal: proposal(context, opened), authorization: token })
      expect(result.kind).toBe("applied")
      expect(result.applied).toHaveLength(1)
      expect(result.applied[0]).toMatchObject({ text: "agent", bufferRevision: 1, diskRevision: 1, dirty: false })
      expect(Object.isFrozen(result.applied[0])).toBe(true)
      yield* Deferred.await(savedEvent)
      expect(observed).toEqual([
        { type: "opened", snapshot: opened },
        { type: "saved", snapshot: result.applied[0] },
      ])
      expect(yield* java.readDocument({ projectID: context.projectID, path: filename })).toEqual(result.applied[0])
    }),
  )
  expect(await fs.readFile(filename, "utf8")).toBe("agent")
})

test("preflight rejects the whole multifile proposal when a later file is dirty", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  await fs.writeFile(path.join(tmp.path, "One.java"), "one")
  await fs.writeFile(path.join(tmp.path, "Two.java"), "two")
  await run(context, (java) =>
    Effect.gen(function* () {
      const one = yield* java.openDocument({ project: context, path: "One.java" })
      const two = yield* java.openDocument({ project: context, path: "Two.java" })
      const dirty = yield* java.changeDocument({ path: two.path, expectedRevision: 0, text: "unsaved" })
      const requested = {
        ...proposal(context, one),
        edits: [
          ...proposal(context, one).edits,
          { path: two.path, expectedRevision: revision(dirty), replacement: "agent-two" },
        ],
      }
      const result = yield* java.applyEdits({ proposal: requested, authorization: token })
      expect(result.kind).toBe("conflict")
      expect(result.applied).toEqual([])
      expect(yield* filesystem.readText(one.path)).toBe("one")
      expect(yield* filesystem.readText(two.path)).toBe("two")
    }),
  )
})

test("a conditional-write race preserves the external bytes and the dirty buffer", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  const filename = path.join(tmp.path, "Main.java")
  await fs.writeFile(filename, "saved")
  await run(
    context,
    (java) =>
      Effect.gen(function* () {
        const opened = yield* java.openDocument({ project: context, path: filename })
        const changed = yield* java.changeDocument({
          path: filename,
          expectedRevision: opened.bufferRevision,
          text: "unsaved",
        })
        const failure = yield* java
          .saveDocument({ projectID: context.projectID, path: filename, expectedRevision: revision(changed) })
          .pipe(Effect.flip)
        expect(failure.code).toBe("revision_conflict")
        expect((yield* java.readDocument({ projectID: context.projectID, path: filename })).text).toBe("unsaved")
      }),
    {
      filesystem: {
        ...filesystem,
        writeIfUnchanged: (input) =>
          Effect.promise(() => fs.writeFile(filename, "external")).pipe(
            Effect.andThen(filesystem.writeIfUnchanged(input)),
          ),
      },
    },
  )
  expect(await fs.readFile(filename, "utf8")).toBe("external")
})

test("partial filesystem failure reports committed files and an uncertain failed write without rollback", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  await fs.writeFile(path.join(tmp.path, "One.java"), "one")
  await fs.writeFile(path.join(tmp.path, "Two.java"), "two")
  await run(
    context,
    (java) =>
      Effect.gen(function* () {
        const one = yield* java.openDocument({ project: context, path: "One.java" })
        const two = yield* java.openDocument({ project: context, path: "Two.java" })
        const requested = {
          ...proposal(context, one),
          edits: [
            ...proposal(context, one).edits,
            { path: two.path, expectedRevision: revision(two), replacement: "agent-two" },
          ],
        }
        const result = yield* java.applyEdits({ proposal: requested, authorization: token })
        expect(result.kind).toBe("failed")
        expect(result.applied.map((document) => document.path)).toEqual([one.path])
        if (result.kind === "failed") {
          expect(result.error.code).toBe("file_unavailable")
          expect(result.uncertainPaths).toEqual([two.path])
        }
        expect(yield* filesystem.readText(one.path)).toBe("agent")
        expect(yield* filesystem.readText(two.path)).toBe("partial")
        expect((yield* java.readDocument({ projectID: context.projectID, path: two.path })).text).toBe("two")
      }),
    {
      filesystem: {
        ...filesystem,
        writeIfUnchanged: (input) =>
          input.path.endsWith("Two.java")
            ? Effect.promise(() => fs.writeFile(input.path, "partial")).pipe(
                Effect.andThen(Effect.fail(unavailable(input.path))),
              )
            : filesystem.writeIfUnchanged(input),
      },
    },
  )
})

test("forged authorization and a trusted grant for the wrong file cannot mutate source", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  const filename = path.join(tmp.path, "Main.java")
  await fs.writeFile(filename, "saved")
  await run(context, (java) =>
    Effect.gen(function* () {
      const opened = yield* java.openDocument({ project: context, path: filename })
      const failure = yield* java
        .applyEdits({ proposal: proposal(context, opened), authorization: { approved: true } })
        .pipe(Effect.flip)
      expect(failure.code).toBe("edit_unauthorized")
    }),
  )
  await run(
    context,
    (java) =>
      Effect.gen(function* () {
        const opened = yield* java.openDocument({ project: context, path: filename })
        expect(
          (yield* java.applyEdits({ proposal: proposal(context, opened), authorization: token }).pipe(Effect.flip))
            .code,
        ).toBe("edit_unauthorized")
      }),
    {
      codeChanges: {
        check: () =>
          Effect.succeed({
            projectID: context.projectID,
            canonicalRoot: context.canonicalRoot,
            paths: [AbsolutePath.make(path.join(tmp.path, "Other.java"))],
          }),
      },
    },
  )
  expect(await fs.readFile(filename, "utf8")).toBe("saved")
})

test("a fresh owner rejects save and proposals carrying the previous document identity", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  await fs.writeFile(path.join(tmp.path, "Main.java"), "saved")
  const previous = await run(context, (java) => java.openDocument({ project: context, path: "Main.java" }))
  await run(context, (java) =>
    Effect.gen(function* () {
      const current = yield* java.openDocument({ project: context, path: "Main.java" })
      expect(current.documentID).not.toBe(previous.documentID)
      expect(
        (yield* java
          .saveDocument({ projectID: context.projectID, path: current.path, expectedRevision: revision(previous) })
          .pipe(Effect.flip)).code,
      ).toBe("revision_conflict")
      expect((yield* java.applyEdits({ proposal: proposal(context, previous), authorization: token })).kind).toBe(
        "conflict",
      )
    }),
  )
})

test("duplicate canonical aliases and unopened/new-file edits are rejected before writing", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  const filename = path.join(tmp.path, "Main.java")
  await fs.writeFile(filename, "saved")
  await fs.symlink("Main.java", path.join(tmp.path, "Alias.java"))
  await run(context, (java) =>
    Effect.gen(function* () {
      const opened = yield* java.openDocument({ project: context, path: filename })
      const requested = proposal(context, opened)
      expect(
        (yield* java
          .applyEdits({
            proposal: { ...requested, edits: [...requested.edits, { ...requested.edits[0], path: "Alias.java" }] },
            authorization: token,
          })
          .pipe(Effect.flip)).code,
      ).toBe("invalid_document_input")
      expect(
        (yield* java
          .applyEdits({
            proposal: { ...requested, edits: [{ ...requested.edits[0], path: "New.java" }] },
            authorization: token,
          })
          .pipe(Effect.flip)).code,
      ).toBe("file_unavailable")
    }),
  )
  expect(await fs.readFile(filename, "utf8")).toBe("saved")
  expect(await Bun.file(path.join(tmp.path, "New.java")).exists()).toBe(false)
})

test("save and apply independently reject symlink escape after the document opened", async () => {
  await using tmp = await tmpdir()
  const root = path.join(tmp.path, "team")
  await fs.mkdir(root)
  const context = project(root)
  const filename = path.join(root, "Main.java")
  const outside = path.join(tmp.path, "Outside.java")
  await fs.writeFile(filename, "saved")
  await fs.writeFile(outside, "outside")
  await run(context, (java) =>
    Effect.gen(function* () {
      const opened = yield* java.openDocument({ project: context, path: filename })
      yield* Effect.promise(async () => {
        await fs.unlink(filename)
        await fs.symlink(outside, filename)
      })
      expect(
        (yield* java
          .saveDocument({ projectID: context.projectID, path: filename, expectedRevision: revision(opened) })
          .pipe(Effect.flip)).code,
      ).toBe("path_outside_project")
      expect(
        (yield* java.applyEdits({ proposal: proposal(context, opened), authorization: token }).pipe(Effect.flip)).code,
      ).toBe("path_outside_project")
    }),
  )
  expect(await fs.readFile(outside, "utf8")).toBe("outside")
})

test("authorization revoked after preflight prevents the first mutation", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  const filename = path.join(tmp.path, "Main.java")
  await fs.writeFile(filename, "saved")
  let checks = 0
  await run(
    context,
    (java) =>
      Effect.gen(function* () {
        const opened = yield* java.openDocument({ project: context, path: filename })
        expect(
          (yield* java.applyEdits({ proposal: proposal(context, opened), authorization: token }).pipe(Effect.flip))
            .code,
        ).toBe("edit_unauthorized")
      }),
    {
      codeChanges: {
        check: () =>
          Effect.suspend(() =>
            ++checks === 1
              ? Effect.succeed({
                  projectID: context.projectID,
                  canonicalRoot: context.canonicalRoot,
                  paths: [AbsolutePath.make(filename)],
                })
              : Effect.fail({ code: "edit_unauthorized" }),
          ),
      },
    },
  )
  expect(await fs.readFile(filename, "utf8")).toBe("saved")
})

test("proposal input is captured before the asynchronous trusted authorization boundary", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  const filename = path.join(tmp.path, "Main.java")
  await fs.writeFile(filename, "saved")
  const waiting = Deferred.makeUnsafe<void>()
  const release = Deferred.makeUnsafe<void>()
  await run(
    context,
    (java) =>
      Effect.gen(function* () {
        const opened = yield* java.openDocument({ project: context, path: filename })
        const requested = proposal(context, opened)
        const pending = yield* java.applyEdits({ proposal: requested, authorization: token }).pipe(Effect.forkChild)
        yield* Deferred.await(waiting)
        requested.edits[0].replacement = "substituted"
        yield* Deferred.succeed(release, undefined)
        const result = yield* Fiber.join(pending)
        expect(result.applied[0].text).toBe("agent")
        expect(result.proposal.edits[0].replacement).toBe("agent")
      }),
    {
      codeChanges: {
        check: (input) =>
          Deferred.succeed(waiting, undefined).pipe(
            Effect.andThen(Deferred.await(release)),
            Effect.as({
              projectID: context.projectID,
              canonicalRoot: context.canonicalRoot,
              paths: input.proposal.edits.map((edit) => AbsolutePath.make(edit.path)),
            }),
          ),
      },
    },
  )
  expect(await fs.readFile(filename, "utf8")).toBe("agent")
})

test("caller cancellation during save preflight releases the read and admits no write", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  const filename = path.join(tmp.path, "Main.java")
  await fs.writeFile(filename, "saved")
  const started = Deferred.makeUnsafe<void>()
  const resources = new Set<object>()
  let held = false
  await run(
    context,
    (java) =>
      Effect.gen(function* () {
        const opened = yield* java.openDocument({ project: context, path: filename })
        const changed = yield* java.changeDocument({
          path: filename,
          expectedRevision: opened.bufferRevision,
          text: "unsaved",
        })
        held = true
        const pending = yield* java
          .saveDocument({ projectID: context.projectID, path: filename, expectedRevision: revision(changed) })
          .pipe(Effect.forkChild)
        yield* Deferred.await(started)
        expect(resources.size).toBe(1)
        yield* Fiber.interrupt(pending)
        expect(resources.size).toBe(0)
        held = false
        expect(yield* java.readDocument({ projectID: context.projectID, path: filename })).toEqual(changed)
      }),
    {
      filesystem: {
        ...filesystem,
        readBytes: (value) =>
          Effect.suspend(() =>
            held
              ? Effect.acquireRelease(
                  Effect.sync(() => {
                    const resource = {}
                    resources.add(resource)
                    return resource
                  }),
                  (resource) => Effect.sync(() => resources.delete(resource)),
                ).pipe(Effect.andThen(Deferred.succeed(started, undefined)), Effect.andThen(Effect.never))
              : filesystem.readBytes(value),
          ),
      },
    },
  )
  expect(await fs.readFile(filename, "utf8")).toBe("saved")
})

test("closed owners reject escaped save and edit APIs", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  await fs.writeFile(path.join(tmp.path, "Main.java"), "saved")
  const escaped = await run(context, (java) =>
    Effect.gen(function* () {
      return { java, opened: yield* java.openDocument({ project: context, path: "Main.java" }) }
    }),
  )
  expect(
    (
      await Effect.runPromise(
        escaped.java
          .saveDocument({
            projectID: context.projectID,
            path: escaped.opened.path,
            expectedRevision: revision(escaped.opened),
          })
          .pipe(Effect.flip),
      )
    ).code,
  ).toBe("owner_closed")
  expect(
    (
      await Effect.runPromise(
        escaped.java
          .applyEdits({ proposal: proposal(context, escaped.opened), authorization: token })
          .pipe(Effect.flip),
      )
    ).code,
  ).toBe("owner_closed")
})

test("observed disk conflict permits explicit merge or save with the returned fresh pair", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  const filename = path.join(tmp.path, "Main.java")
  await fs.writeFile(filename, "saved")
  await run(context, (java) =>
    Effect.gen(function* () {
      const opened = yield* java.openDocument({ project: context, path: filename })
      yield* java.changeDocument({ path: filename, expectedRevision: 0, text: "unsaved" })
      yield* Effect.promise(() => fs.writeFile(filename, "external"))
      const result = yield* java.applyEdits({ proposal: proposal(context, opened), authorization: token })
      expect(result.kind).toBe("conflict")
      if (result.kind !== "conflict") return
      expect(result.conflicts[0].current).toMatchObject({
        text: "unsaved",
        bufferRevision: 1,
        diskRevision: 1,
        dirty: true,
      })
      const merged = yield* java.changeDocument({
        path: filename,
        expectedRevision: result.conflicts[0].current.bufferRevision,
        text: "unsaved + external",
      })
      const saved = yield* java.saveDocument({
        projectID: context.projectID,
        path: filename,
        expectedRevision: revision(merged),
      })
      expect(saved).toMatchObject({ text: "unsaved + external", bufferRevision: 2, diskRevision: 2, dirty: false })
    }),
  )
  expect(await fs.readFile(filename, "utf8")).toBe("unsaved + external")
})

test("agent replacements retain an existing BOM without normalizing supplied line endings", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  const filename = path.join(tmp.path, "Main.java")
  await fs.writeFile(filename, "\ufeffclass Main {}\r\n")
  await run(context, (java) =>
    Effect.gen(function* () {
      const opened = yield* java.openDocument({ project: context, path: filename })
      const result = yield* java.applyEdits({
        proposal: proposal(context, opened, "class Main { }\r\n"),
        authorization: token,
      })
      expect(result.kind).toBe("applied")
      expect(result.applied[0].text).toBe("\ufeffclass Main { }\r\n")
    }),
  )
  expect(await fs.readFile(filename)).toEqual(Buffer.from("\ufeffclass Main { }\r\n"))
})

test("missing mutation capabilities fail visibly and never synthesize original bytes", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  const filename = path.join(tmp.path, "Main.java")
  await fs.writeFile(filename, "saved")
  await run(
    context,
    (java) =>
      Effect.gen(function* () {
        const opened = yield* java.openDocument({ project: context, path: filename })
        const changed = yield* java.changeDocument({
          path: filename,
          expectedRevision: opened.bufferRevision,
          text: "unsaved",
        })
        expect(
          (yield* java
            .saveDocument({ projectID: context.projectID, path: filename, expectedRevision: revision(changed) })
            .pipe(Effect.flip)).code,
        ).toBe("file_unavailable")
        expect(
          (yield* java.applyEdits({ proposal: proposal(context, opened), authorization: token }).pipe(Effect.flip))
            .code,
        ).toBe("file_unavailable")
      }),
    { filesystem: { realpath: filesystem.realpath, readText: filesystem.readText } },
  )
  expect(await fs.readFile(filename, "utf8")).toBe("saved")
})

test("owner disposal interrupts pending trusted authorization and releases its resource", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  const filename = path.join(tmp.path, "Main.java")
  await fs.writeFile(filename, "saved")
  const started = Deferred.makeUnsafe<void>()
  const active = new Set<object>()
  await Effect.runPromise(
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const java = yield* JavaDocuments.make({
        filesystem,
        projects: { resolve: () => Effect.succeed(context) },
        codeChanges: {
          check: () =>
            Effect.acquireRelease(
              Effect.sync(() => {
                const resource = {}
                active.add(resource)
                return resource
              }),
              (resource) => Effect.sync(() => active.delete(resource)),
            ).pipe(Effect.andThen(Deferred.succeed(started, undefined)), Effect.andThen(Effect.never)),
        },
      }).pipe(Scope.provide(scope))
      const opened = yield* java.openDocument({ project: context, path: filename })
      const pending = yield* java
        .applyEdits({ proposal: proposal(context, opened), authorization: token })
        .pipe(Effect.forkChild)
      yield* Deferred.await(started)
      expect(active.size).toBe(1)
      yield* Scope.close(scope, Exit.succeed(undefined))
      expect(active.size).toBe(0)
      expect(Exit.isFailure(yield* Fiber.await(pending))).toBe(true)
    }),
  )
  expect(await fs.readFile(filename, "utf8")).toBe("saved")
})

test("canonical edit facade is the exact Schema contract identity", () => {
  expect(Java.Revision).toBe(FtcJava.Revision)
  expect(Java.SaveRequest).toBe(FtcJava.SaveRequest)
  expect(Java.EditProposal).toBe(FtcJava.EditProposal)
  expect(Java.EditConflict).toBe(FtcJava.EditConflict)
  expect(Java.EditResult).toBe(FtcJava.EditResult)
  expect(Schema.is(FtcJava.EditProposal)({ projectID: Project.ID.global, edits: [], explanation: "empty" })).toBe(false)
})

test("a later conditional conflict reports earlier commits and preserves the external second file", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  await fs.writeFile(path.join(tmp.path, "One.java"), "one")
  await fs.writeFile(path.join(tmp.path, "Two.java"), "two")
  await run(
    context,
    (java) =>
      Effect.gen(function* () {
        const one = yield* java.openDocument({ project: context, path: "One.java" })
        const two = yield* java.openDocument({ project: context, path: "Two.java" })
        const result = yield* java.applyEdits({
          proposal: {
            ...proposal(context, one),
            edits: [
              ...proposal(context, one).edits,
              { path: two.path, expectedRevision: revision(two), replacement: "agent-two" },
            ],
          },
          authorization: token,
        })
        expect(result.kind).toBe("conflict")
        expect(result.applied.map((snapshot) => snapshot.path)).toEqual([one.path])
        if (result.kind === "conflict")
          expect(result.conflicts[0]).toMatchObject({
            diskText: "external",
            current: { text: "two", diskRevision: 1, dirty: true },
          })
        expect(yield* filesystem.readText(one.path)).toBe("agent")
        expect(yield* filesystem.readText(two.path)).toBe("external")
      }),
    {
      filesystem: {
        ...filesystem,
        writeIfUnchanged: (input) =>
          input.path.endsWith("Two.java")
            ? Effect.promise(() => fs.writeFile(input.path, "external")).pipe(
                Effect.andThen(filesystem.writeIfUnchanged(input)),
              )
            : filesystem.writeIfUnchanged(input),
      },
    },
  )
})

test("concurrent proposals at one revision admit exactly one application", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  await fs.writeFile(path.join(tmp.path, "Main.java"), "saved")
  await run(context, (java) =>
    Effect.gen(function* () {
      const opened = yield* java.openDocument({ project: context, path: "Main.java" })
      const results = yield* Effect.all(
        ["one", "two"].map((text) =>
          java.applyEdits({ proposal: proposal(context, opened, text), authorization: token }),
        ),
        { concurrency: "unbounded" },
      )
      expect(results.filter((result) => result.kind === "applied")).toHaveLength(1)
      expect(results.filter((result) => result.kind === "conflict")).toHaveLength(1)
      const current = yield* java.readDocument({ projectID: context.projectID, path: opened.path })
      expect(current).toMatchObject({ bufferRevision: 1, diskRevision: 1, dirty: false })
      expect(yield* filesystem.readText(opened.path)).toBe(current.text)
    }),
  )
})

test("an unchanged buffer with externally changed disk rejects edits and publishes the observed revision", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  const filename = path.join(tmp.path, "Main.java")
  await fs.writeFile(filename, "saved")
  await run(context, (java) =>
    Effect.gen(function* () {
      const observed: FtcJava.DocumentEvent[] = []
      const changedEvent = yield* Deferred.make<void>()
      yield* java.events.pipe(
        Stream.runForEach((event) =>
          Effect.sync(() => observed.push(event)).pipe(
            Effect.andThen(event.type === "disk_changed" ? Deferred.succeed(changedEvent, undefined) : Effect.void),
          ),
        ),
        Effect.forkScoped,
      )
      yield* Effect.yieldNow
      const opened = yield* java.openDocument({ project: context, path: filename })
      yield* Effect.promise(() => fs.writeFile(filename, "external"))
      const result = yield* java.applyEdits({ proposal: proposal(context, opened), authorization: token })
      expect(result.kind).toBe("conflict")
      if (result.kind !== "conflict") return
      expect(result.conflicts[0].current).toMatchObject({
        text: "saved",
        bufferRevision: 0,
        diskRevision: 1,
        dirty: true,
      })
      yield* Deferred.await(changedEvent)
      expect(observed).toEqual([
        { type: "opened", snapshot: opened },
        { type: "disk_changed", snapshot: result.conflicts[0].current },
      ])
    }),
  )
  expect(await fs.readFile(filename, "utf8")).toBe("external")
})

test("save write failures retain the dirty buffer and identify unknown disk outcome", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  const filename = path.join(tmp.path, "Main.java")
  await fs.writeFile(filename, "saved")
  await run(
    context,
    (java) =>
      Effect.gen(function* () {
        const opened = yield* java.openDocument({ project: context, path: filename })
        const changed = yield* java.changeDocument({
          path: filename,
          expectedRevision: opened.bufferRevision,
          text: "unsaved",
        })
        const failure = yield* java
          .saveDocument({ projectID: context.projectID, path: filename, expectedRevision: revision(changed) })
          .pipe(Effect.flip)
        expect(failure).toMatchObject({ code: "file_unavailable", outcome: "unknown" })
        expect(yield* java.readDocument({ projectID: context.projectID, path: filename })).toEqual(changed)
      }),
    { filesystem: { ...filesystem, writeIfUnchanged: (input) => Effect.fail(unavailable(input.path)) } },
  )
  expect(await fs.readFile(filename, "utf8")).toBe("saved")
})

test("cancellation at a confirmed commit boundary keeps disk and owner snapshot consistent", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  const filename = path.join(tmp.path, "Main.java")
  await fs.writeFile(filename, "saved")
  const committed = Deferred.makeUnsafe<void>()
  const release = Deferred.makeUnsafe<void>()
  await run(
    context,
    (java) =>
      Effect.gen(function* () {
        const opened = yield* java.openDocument({ project: context, path: filename })
        const changed = yield* java.changeDocument({
          path: filename,
          expectedRevision: opened.bufferRevision,
          text: "unsaved",
        })
        const pending = yield* java
          .saveDocument({ projectID: context.projectID, path: filename, expectedRevision: revision(changed) })
          .pipe(Effect.forkChild)
        yield* Deferred.await(committed)
        const cancellation = yield* Fiber.interrupt(pending).pipe(Effect.forkChild)
        yield* Effect.yieldNow
        yield* Deferred.succeed(release, undefined)
        yield* Fiber.join(cancellation)
        expect(yield* java.readDocument({ projectID: context.projectID, path: filename })).toMatchObject({
          text: "unsaved",
          dirty: false,
          diskRevision: 1,
        })
        expect(yield* filesystem.readText(filename)).toBe("unsaved")
      }),
    {
      filesystem: {
        ...filesystem,
        writeIfUnchanged: (input) =>
          filesystem.writeIfUnchanged(input).pipe(
            Effect.tap(() => Deferred.succeed(committed, undefined)),
            Effect.tap(() => Deferred.await(release)),
          ),
      },
    },
  )
})

test("invalid UTF8 source bytes are rejected without decoding and rewriting them", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  const filename = path.join(tmp.path, "Main.java")
  const bytes = Buffer.from([0xff, 0xfe, 0x41])
  await fs.writeFile(filename, bytes)
  await run(context, (java) =>
    java.openDocument({ project: context, path: filename }).pipe(
      Effect.flip,
      Effect.tap((error) => Effect.sync(() => expect(error.code).toBe("file_unavailable"))),
    ),
  )
  expect(await fs.readFile(filename)).toEqual(bytes)
})

test("authorization revoked during the final disk read is rechecked before writing", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  const filename = path.join(tmp.path, "Main.java")
  await fs.writeFile(filename, "saved")
  let reads = 0
  let revoked = false
  await run(
    context,
    (java) =>
      Effect.gen(function* () {
        const opened = yield* java.openDocument({ project: context, path: filename })
        const result = yield* java
          .applyEdits({ proposal: proposal(context, opened), authorization: token })
          .pipe(Effect.result)
        expect(result._tag).toBe("Failure")
        if (result._tag === "Failure") expect(result.failure.code).toBe("edit_unauthorized")
        expect(yield* filesystem.readText(filename)).toBe("saved")
      }),
    {
      filesystem: {
        ...filesystem,
        readBytes: (value) =>
          filesystem.readBytes(value).pipe(
            Effect.tap(() =>
              Effect.sync(() => {
                if (++reads === 3) revoked = true
              }),
            ),
          ),
      },
      codeChanges: {
        check: () =>
          Effect.suspend(() =>
            revoked
              ? Effect.fail({ code: "edit_unauthorized" })
              : Effect.succeed({
                  projectID: context.projectID,
                  canonicalRoot: context.canonicalRoot,
                  paths: [AbsolutePath.make(filename)],
                }),
          ),
      },
    },
  )
})

test("unpaired Unicode cannot be silently encoded as different source bytes", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  const filename = path.join(tmp.path, "Main.java")
  await fs.writeFile(filename, "saved")
  await run(context, (java) =>
    Effect.gen(function* () {
      const opened = yield* java.openDocument({ project: context, path: filename })
      const failure = yield* java
        .applyEdits({ proposal: proposal(context, opened, "\ud800"), authorization: token })
        .pipe(Effect.flip)
      expect(failure.code).toBe("invalid_document_input")
      expect(yield* filesystem.readText(filename)).toBe("saved")
      expect(yield* java.readDocument({ projectID: context.projectID, path: filename })).toEqual(opened)
    }),
  )
})

test.each([0, 1])(
  "revocation during final scope resolution stops file %s before its conditional write",
  async (blocked) => {
    await using tmp = await tmpdir()
    const context = project(tmp.path)
    const filenames = [path.join(tmp.path, "One.java"), path.join(tmp.path, "Two.java")]
    await Promise.all(filenames.map((filename) => fs.writeFile(filename, "saved")))
    const writes: string[] = []
    let reads = 0
    let finalScopes = 0
    let revoked = false
    await run(
      context,
      (java) =>
        Effect.gen(function* () {
          const opened = yield* Effect.forEach(filenames, (filename) =>
            java.openDocument({ project: context, path: filename }),
          )
          const requested = {
            projectID: context.projectID,
            edits: opened.map((snapshot) => ({
              path: snapshot.path,
              expectedRevision: revision(snapshot),
              replacement: "agent",
            })),
            explanation: "Update sources",
          }
          const result = yield* java.applyEdits({ proposal: requested, authorization: token }).pipe(Effect.result)
          expect(revoked).toBe(true)
          expect(writes).toEqual(filenames.slice(0, blocked))
          if (blocked === 0) {
            expect(result._tag).toBe("Failure")
            if (result._tag === "Failure") expect(result.failure.code).toBe("edit_unauthorized")
          }
          if (blocked === 1) {
            expect(result._tag).toBe("Success")
            if (result._tag === "Success") {
              expect(result.success.kind).toBe("failed")
              expect(result.success.applied.map((snapshot) => snapshot.path)).toEqual([opened[0].path])
              if (result.success.kind === "failed") {
                expect(result.success.error.code).toBe("edit_unauthorized")
                expect(result.success.uncertainPaths).toEqual([])
              }
            }
          }
          expect(yield* filesystem.readText(filenames[blocked])).toBe("saved")
          expect(yield* java.readDocument({ projectID: context.projectID, path: filenames[blocked] })).toEqual(
            opened[blocked],
          )
        }),
      {
        filesystem: {
          ...filesystem,
          readBytes: (filename) =>
            filesystem.readBytes(filename).pipe(
              Effect.tap(() =>
                Effect.sync(() => {
                  if (filename === filenames[blocked]) reads++
                }),
              ),
            ),
          realpath: (filename) =>
            filesystem.realpath(filename).pipe(
              Effect.tap(() =>
                Effect.sync(() => {
                  // Observe validates scope once after its disk read; the next root resolution is the final scope check.
                  if (filename === context.canonicalRoot && reads === 3 && ++finalScopes === 2) revoked = true
                }),
              ),
            ),
          writeIfUnchanged: (input) =>
            Effect.sync(() => writes.push(input.path)).pipe(Effect.andThen(filesystem.writeIfUnchanged(input))),
        },
        codeChanges: {
          check: () =>
            Effect.suspend(() =>
              revoked
                ? Effect.fail({ code: "edit_unauthorized" })
                : Effect.succeed({
                    projectID: context.projectID,
                    canonicalRoot: context.canonicalRoot,
                    paths: filenames.map((filename) => AbsolutePath.make(filename)),
                  }),
            ),
        },
      },
    )
  },
)
