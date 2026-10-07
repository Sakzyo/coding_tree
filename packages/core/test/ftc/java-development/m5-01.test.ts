import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { Location } from "@opencode-ai/schema/location"
import { Project } from "@opencode-ai/schema/project"
import { AbsolutePath } from "@opencode-ai/schema/schema"
import { Deferred, Effect, Exit, Fiber, Schema, Scope, Stream } from "effect"
import { JavaDocuments } from "../../../src/ftc/java/documents"
import { Java } from "../../../src/ftc/java"
import { FtcJava } from "@opencode-ai/schema/ftc-java"
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

const filesystem = {
  realpath: (value: string) =>
    Effect.tryPromise({
      try: () => fs.realpath(value),
      catch: (): { code: "file_unavailable"; path: string } => ({ code: "file_unavailable", path: value }),
    }),
  readText: (value: string) =>
    Effect.tryPromise({
      try: () => Bun.file(value).text(),
      catch: (): { code: "file_unavailable"; path: string } => ({ code: "file_unavailable", path: value }),
    }),
}

test("detaching a view preserves dirty buffer", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  const filename = path.join(tmp.path, "Main.java")
  await Bun.write(filename, "saved")
  await Effect.runPromise(
    Effect.gen(function* () {
      const java = yield* Java.Service
      // A view's scope can end while the Location's document owner stays alive.
      yield* Effect.scoped(
        Effect.gen(function* () {
          const opened = yield* java.openDocument({ project: context, path: "Main.java" })
          yield* java.changeDocument({ path: opened.path, expectedRevision: opened.bufferRevision, text: "unsaved" })
        }),
      )
      const reopened = yield* java.openDocument({ project: context, path: "Main.java" })
      const diskText = yield* filesystem.readText(filename)
      expect(reopened.text).toBe("unsaved")
      expect(reopened.dirty).toBe(true)
      expect(diskText).toBe("saved")
      expect(reopened.bufferRevision).toBe(1)
      expect(reopened.diskRevision).toBe(0)
      expect(yield* java.readDocument({ projectID: context.projectID, path: "Main.java" })).toEqual(reopened)
    }).pipe(
      Effect.provide(Java.layer({ filesystem, projects: { resolve: () => Effect.succeed(context) } })),
      Effect.scoped,
    ),
  )
})

const run = async <A, E>(
  context: FtcProject.ProjectContext,
  effect: (java: Java.Interface) => Effect.Effect<A, E, import("effect").Scope.Scope>,
  ports: Java.Filesystem = filesystem,
  authorized = context,
) => {
  return Effect.runPromise(
    Effect.gen(function* () {
      const java = yield* Java.Service
      return yield* effect(java)
    }).pipe(
      Effect.provide(Java.layer({ filesystem: ports, projects: { resolve: () => Effect.succeed(authorized) } })),
      Effect.scoped,
    ),
  )
}

test("canonical file aliases share a buffer and concurrent opens share one identity", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  await Bun.write(path.join(tmp.path, "Main.java"), "saved")
  await fs.symlink("Main.java", path.join(tmp.path, "Alias.java"))
  await run(context, (java) =>
    Effect.gen(function* () {
      const opened = yield* Effect.all(
        ["Main.java", "Alias.java", "./Main.java"].map((value) => java.openDocument({ project: context, path: value })),
        { concurrency: "unbounded" },
      )
      expect(new Set(opened.map((document) => document.documentID)).size).toBe(1)
      expect(opened[0].path).toBe(AbsolutePath.make(path.join(tmp.path, "Main.java")))
      const changed = yield* java.changeDocument({ path: opened[0].path, expectedRevision: 0, text: "unsaved" })
      expect(yield* java.readDocument({ projectID: context.projectID, path: "Alias.java" })).toEqual(changed)
    }),
  )
})

test("stale edits cannot replace the buffer, while reverting text keeps revisions monotonic", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  await Bun.write(path.join(tmp.path, "Main.java"), "saved")
  await run(context, (java) =>
    Effect.gen(function* () {
      const opened = yield* java.openDocument({ project: context, path: "Main.java" })
      const changed = yield* java.changeDocument({ path: opened.path, expectedRevision: 0, text: "one" })
      const stale = yield* java
        .changeDocument({ path: opened.path, expectedRevision: 0, text: "stale" })
        .pipe(Effect.flip)
      expect(stale.code).toBe("revision_conflict")
      expect(yield* java.readDocument({ projectID: context.projectID, path: opened.path })).toEqual(changed)
      expect(yield* java.changeDocument({ path: opened.path, expectedRevision: 1, text: "one" })).toEqual(changed)
      const restored = yield* java.changeDocument({ path: opened.path, expectedRevision: 1, text: "saved" })
      expect(restored).toMatchObject({ text: "saved", bufferRevision: 2, diskRevision: 0, dirty: false })
      expect(opened.text).toBe("saved")
      expect(changed.text).toBe("one")
      expect(Object.isFrozen(changed)).toBe(true)
    }),
  )
})

test("revisioned events describe exactly the committed document snapshots", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  await Bun.write(path.join(tmp.path, "Main.java"), "saved")
  await run(context, (java) =>
    Effect.gen(function* () {
      const observed: FtcJava.DocumentEvent[] = []
      const changedEvent = yield* Deferred.make<void>()
      yield* java.events.pipe(
        Stream.runForEach((event) =>
          Effect.sync(() => observed.push(event)).pipe(
            Effect.andThen(event.type === "changed" ? Deferred.succeed(changedEvent, undefined) : Effect.void),
          ),
        ),
        Effect.forkScoped,
      )
      yield* Effect.yieldNow
      const opened = yield* java.openDocument({ project: context, path: "Main.java" })
      const changed = yield* java.changeDocument({ path: opened.path, expectedRevision: 0, text: "unsaved" })
      yield* java.openDocument({ project: context, path: "Main.java" })
      yield* java.changeDocument({ path: opened.path, expectedRevision: 1, text: "unsaved" })
      yield* java.changeDocument({ path: opened.path, expectedRevision: 0, text: "stale" }).pipe(Effect.flip)
      yield* Deferred.await(changedEvent)
      yield* Effect.yieldNow
      const events = observed
      expect(events).toEqual([
        { type: "opened", snapshot: opened },
        { type: "changed", snapshot: changed },
      ])
      expect(events[1].snapshot.bufferRevision).toBe(1)
      expect(events[1].snapshot.diskRevision).toBe(0)
    }),
  )
})

test.each(["../Outside.java", "escape/Outside.java", "escaped.java"])(
  "rejects traversal or symlink escape: %s",
  async (value) => {
    await using tmp = await tmpdir()
    const root = path.join(tmp.path, "team")
    await fs.mkdir(root)
    await Bun.write(path.join(tmp.path, "Outside.java"), "outside")
    await fs.symlink(tmp.path, path.join(root, "escape"))
    await fs.symlink(path.join(tmp.path, "Outside.java"), path.join(root, "escaped.java"))
    const context = project(root)
    await run(context, (java) =>
      Effect.gen(function* () {
        const failure = yield* java.openDocument({ project: context, path: value }).pipe(Effect.flip)
        expect(failure.code).toBe("path_outside_project")
      }),
    )
    expect(await Bun.file(path.join(tmp.path, "Outside.java")).text()).toBe("outside")
  },
)

test("substituted project context and project ID cannot adopt an authorized document", async () => {
  await using tmp = await tmpdir()
  const root = path.join(tmp.path, "team")
  const other = path.join(tmp.path, "other")
  await fs.mkdir(root)
  await fs.mkdir(other)
  await Bun.write(path.join(root, "Main.java"), "saved")
  await Bun.write(path.join(other, "Main.java"), "other")
  const context = project(root)
  await run(context, (java) =>
    Effect.gen(function* () {
      expect(
        (yield* java
          .openDocument({ project: { ...project(other), projectID: context.projectID }, path: "Main.java" })
          .pipe(Effect.flip)).code,
      ).toBe("project_unauthorized")
      const opened = yield* java.openDocument({ project: context, path: "Main.java" })
      expect(
        (yield* java.readDocument({ projectID: project(other).projectID, path: opened.path }).pipe(Effect.flip)).code,
      ).toBe("project_unauthorized")
    }),
  )
})

test("reopening does not erase a dirty buffer after an external disk edit", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  const filename = path.join(tmp.path, "Main.java")
  await Bun.write(filename, "saved")
  await run(context, (java) =>
    Effect.gen(function* () {
      const opened = yield* java.openDocument({ project: context, path: "Main.java" })
      const changed = yield* java.changeDocument({ path: opened.path, expectedRevision: 0, text: "unsaved" })
      yield* Effect.promise(() => Bun.write(filename, "external"))
      expect(yield* java.openDocument({ project: context, path: "Main.java" })).toEqual(changed)
    }),
  )
  expect(await Bun.file(filename).text()).toBe("external")
})

test("retargeting an opened file outside the root rejects subsequent queries and edits", async () => {
  await using tmp = await tmpdir()
  const root = path.join(tmp.path, "team")
  await fs.mkdir(root)
  const filename = path.join(root, "Main.java")
  await Bun.write(filename, "saved")
  await Bun.write(path.join(tmp.path, "Outside.java"), "outside")
  const context = project(root)
  await run(context, (java) =>
    Effect.gen(function* () {
      const opened = yield* java.openDocument({ project: context, path: "Main.java" })
      yield* Effect.promise(async () => {
        await fs.unlink(filename)
        await fs.symlink(path.join(tmp.path, "Outside.java"), filename)
      })
      expect(
        (yield* java.readDocument({ projectID: context.projectID, path: opened.path }).pipe(Effect.flip)).code,
      ).toBe("path_outside_project")
      expect(
        (yield* java.changeDocument({ path: opened.path, expectedRevision: 0, text: "escaped" }).pipe(Effect.flip))
          .code,
      ).toBe("path_outside_project")
    }),
  )
})

test("owner disposal rejects escaped services and a fresh owner reads saved bytes", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  await Bun.write(path.join(tmp.path, "Main.java"), "saved")
  const escaped = await run(context, (java) =>
    Effect.gen(function* () {
      const opened = yield* java.openDocument({ project: context, path: "Main.java" })
      yield* java.changeDocument({ path: opened.path, expectedRevision: 0, text: "unsaved" })
      return java
    }),
  )
  expect(
    (
      await Effect.runPromise(
        escaped.readDocument({ projectID: context.projectID, path: "Main.java" }).pipe(Effect.flip),
      )
    ).code,
  ).toBe("owner_closed")
  await run(context, (java) =>
    java
      .openDocument({ project: context, path: "Main.java" })
      .pipe(
        Effect.tap((snapshot) =>
          Effect.sync(() => expect(snapshot).toMatchObject({ text: "saved", dirty: false, bufferRevision: 0 })),
        ),
      ),
  )
})

test("cancelling a file read releases resources without admitting a partial document", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  await Bun.write(path.join(tmp.path, "Main.java"), "saved")
  const started = Deferred.makeUnsafe<void>()
  const active = new Set<object>()
  let held = true
  await run(
    context,
    (java) =>
      Effect.gen(function* () {
        const fiber = yield* java.openDocument({ project: context, path: "Main.java" }).pipe(Effect.forkChild)
        yield* Deferred.await(started)
        expect(active.size).toBe(1)
        yield* Fiber.interrupt(fiber)
        expect(active.size).toBe(0)
        expect(
          (yield* java.readDocument({ projectID: context.projectID, path: "Main.java" }).pipe(Effect.flip)).code,
        ).toBe("document_not_open")
        held = false
        expect((yield* java.openDocument({ project: context, path: "Main.java" })).text).toBe("saved")
      }),
    {
      ...filesystem,
      readText: (filename) =>
        Effect.suspend(() =>
          held
            ? Effect.acquireRelease(
                Effect.sync(() => {
                  const token = {}
                  active.add(token)
                  return token
                }),
                (token) => Effect.sync(() => active.delete(token)),
              ).pipe(Effect.andThen(Deferred.succeed(started, undefined)), Effect.andThen(Effect.never))
            : filesystem.readText(filename),
        ),
    },
  )
  expect(active.size).toBe(0)
})

test("facade preserves canonical serializable document contracts", async () => {
  expect(Java.DocumentSnapshot).toBe(FtcJava.DocumentSnapshot)
  expect(Java.DocumentEvent).toBe(FtcJava.DocumentEvent)
  expect(Java.DocumentError).toBe(FtcJava.DocumentError)
  const error = { code: "revision_conflict" as const, path: "Main.java", expectedRevision: 0, actualRevision: 1 }
  expect(Schema.decodeUnknownSync(FtcJava.DocumentError)(error)).toEqual(error)
  expect(Schema.encodeSync(FtcJava.DocumentError)({ ...error, projectID: undefined })).toEqual(error)
  expect(() => Schema.decodeUnknownSync(FtcJava.DocumentError)({ code: "success" })).toThrow()
  expect(() =>
    Schema.decodeUnknownSync(FtcJava.DocumentSnapshot)({
      documentID: "not_doc",
      projectID: Project.ID.global,
      path: "/Main.java",
      bufferRevision: -1,
      diskRevision: 0,
      text: "",
      dirty: false,
    }),
  ).toThrow()
})

test("concurrent changes with the same revision admit exactly one update", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  await Bun.write(path.join(tmp.path, "Main.java"), "saved")
  await run(context, (java) =>
    Effect.gen(function* () {
      const opened = yield* java.openDocument({ project: context, path: "Main.java" })
      const results = yield* Effect.all(
        ["one", "two"].map((text) =>
          java.changeDocument({ path: opened.path, expectedRevision: 0, text }).pipe(Effect.result),
        ),
        { concurrency: "unbounded" },
      )
      expect(results.filter((result) => result._tag === "Success")).toHaveLength(1)
      expect(results.filter((result) => result._tag === "Failure")).toHaveLength(1)
      const snapshot = yield* java.readDocument({ projectID: context.projectID, path: opened.path })
      expect(snapshot.bufferRevision).toBe(1)
      expect(["one", "two"]).toContain(snapshot.text)
    }),
  )
})

test("independent owners and projects cannot leak dirty buffers", async () => {
  await using tmp = await tmpdir()
  const roots = [path.join(tmp.path, "one"), path.join(tmp.path, "two")]
  await Promise.all(
    roots.map(async (root) => {
      await fs.mkdir(root)
      await Bun.write(path.join(root, "Main.java"), "saved")
    }),
  )
  const contexts = roots.map(project)
  await Effect.runPromise(
    Effect.gen(function* () {
      const first = yield* JavaDocuments.make({
        filesystem,
        projects: { resolve: (id) => Effect.succeed(contexts.find((context) => context.projectID === id)!) },
      })
      const second = yield* JavaDocuments.make({ filesystem, projects: { resolve: () => Effect.succeed(contexts[0]) } })
      const opened = yield* first.openDocument({ project: contexts[0], path: "Main.java" })
      yield* first.changeDocument({ path: opened.path, expectedRevision: 0, text: "unsaved" })
      expect((yield* first.openDocument({ project: contexts[1], path: "Main.java" })).text).toBe("saved")
      expect((yield* second.openDocument({ project: contexts[0], path: "Main.java" })).text).toBe("saved")
      const sameRoot = { ...contexts[0], projectID: contexts[1].projectID }
      const conflicting = yield* JavaDocuments.make({
        filesystem,
        projects: { resolve: () => Effect.succeed(sameRoot) },
      })
      // This owner is fresh; project authority, rather than a global document registry, grants membership.
      expect((yield* conflicting.openDocument({ project: sameRoot, path: "Main.java" })).text).toBe("saved")
    }).pipe(Effect.scoped),
  )
})

test("one owner rejects two project identities claiming the same canonical file", async () => {
  await using tmp = await tmpdir()
  const first = project(tmp.path)
  const second = { ...first, projectID: Project.ID.make("other-project") }
  await Bun.write(path.join(tmp.path, "Main.java"), "saved")
  await Effect.runPromise(
    Effect.gen(function* () {
      const java = yield* JavaDocuments.make({
        filesystem,
        projects: { resolve: (id) => Effect.succeed(id === first.projectID ? first : second) },
      })
      const opened = yield* java.openDocument({ project: first, path: "Main.java" })
      expect((yield* java.openDocument({ project: second, path: "Main.java" }).pipe(Effect.flip)).code).toBe(
        "project_unauthorized",
      )
      expect(
        (yield* java.readDocument({ projectID: second.projectID, path: "Main.java" }).pipe(Effect.flip)).code,
      ).toBe("project_unauthorized")
      expect((yield* java.readDocument({ projectID: first.projectID, path: "Main.java" })).documentID).toBe(
        opened.documentID,
      )
    }).pipe(Effect.scoped),
  )
})

test("owner shutdown ends event subscriptions and rejects every escaped command", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  await Bun.write(path.join(tmp.path, "Main.java"), "saved")
  await Effect.runPromise(
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const java = yield* JavaDocuments.make({ filesystem, projects: { resolve: () => Effect.succeed(context) } }).pipe(
        Scope.provide(scope),
      )
      const subscriber = yield* java.events.pipe(Stream.runCollect, Effect.forkChild)
      yield* Effect.yieldNow
      const opened = yield* java.openDocument({ project: context, path: "Main.java" })
      yield* Scope.close(scope, Exit.succeed(undefined))
      const commands = [
        java.openDocument({ project: context, path: "Main.java" }),
        java.readDocument({ projectID: context.projectID, path: "Main.java" }),
        java.changeDocument({ path: opened.path, expectedRevision: 0, text: "unsaved" }),
      ]
      for (const command of commands) expect((yield* command.pipe(Effect.flip)).code).toBe("owner_closed")
      const subscription = yield* Fiber.await(subscriber)
      expect(Exit.isSuccess(subscription)).toBe(true)
      if (Exit.isSuccess(subscription)) expect(subscription.value).toEqual([{ type: "opened", snapshot: opened }])
    }),
  )
})

test("absolute sibling paths sharing the root prefix remain outside project scope", async () => {
  await using tmp = await tmpdir()
  const root = path.join(tmp.path, "team")
  const sibling = path.join(tmp.path, "team-other")
  await fs.mkdir(root)
  await fs.mkdir(sibling)
  await Bun.write(path.join(sibling, "Main.java"), "outside")
  const context = project(root)
  await run(context, (java) =>
    java.openDocument({ project: context, path: path.join(sibling, "Main.java") }).pipe(
      Effect.flip,
      Effect.tap((error) => Effect.sync(() => expect(error.code).toBe("path_outside_project"))),
    ),
  )
})

test("missing files and invalid revisions fail without replacing owned buffers", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  await Bun.write(path.join(tmp.path, "Main.java"), "saved")
  await run(context, (java) =>
    Effect.gen(function* () {
      expect((yield* java.openDocument({ project: context, path: "missing.java" }).pipe(Effect.flip)).code).toBe(
        "file_unavailable",
      )
      const opened = yield* java.openDocument({ project: context, path: "Main.java" })
      for (const revision of [-1, 0.5, Number.NaN]) {
        expect(
          (yield* java
            .changeDocument({ path: opened.path, expectedRevision: revision, text: "invalid" })
            .pipe(Effect.flip)).code,
        ).toBe("invalid_document_input")
      }
      expect(yield* java.readDocument({ projectID: context.projectID, path: "Main.java" })).toEqual(opened)
    }),
  )
})

test("disposing the document owner interrupts a pending read and releases its resource", async () => {
  await using tmp = await tmpdir()
  const context = project(tmp.path)
  await Bun.write(path.join(tmp.path, "Main.java"), "saved")
  const active = new Set<object>()
  const started = Deferred.makeUnsafe<void>()
  await Effect.runPromise(
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const java = yield* JavaDocuments.make({
        projects: { resolve: () => Effect.succeed(context) },
        filesystem: {
          ...filesystem,
          readText: () =>
            Effect.acquireRelease(
              Effect.sync(() => {
                const token = {}
                active.add(token)
                return token
              }),
              (token) => Effect.sync(() => active.delete(token)),
            ).pipe(Effect.andThen(Deferred.succeed(started, undefined)), Effect.andThen(Effect.never)),
        },
      }).pipe(Scope.provide(scope))
      const pending = yield* java.openDocument({ project: context, path: "Main.java" }).pipe(Effect.forkChild)
      yield* Deferred.await(started)
      expect(active.size).toBe(1)
      yield* Scope.close(scope, Exit.succeed(undefined))
      expect(active.size).toBe(0)
      expect(Exit.isFailure(yield* Fiber.await(pending))).toBe(true)
    }),
  )
})
