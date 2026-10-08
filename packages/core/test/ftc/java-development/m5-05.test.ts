import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { createHash } from "node:crypto"
import { FtcJava } from "@opencode-ai/schema/ftc-java"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { FtcEnvironment } from "@opencode-ai/schema/ftc-environment"
import { Info } from "@opencode-ai/schema/location"
import { Project } from "@opencode-ai/schema/project"
import { WorkspaceID } from "@opencode-ai/schema/workspace-id"
import { AbsolutePath } from "@opencode-ai/schema/schema"
import { Cause, Deferred, Effect, Exit, Fiber, Schema, Scope, Stream } from "effect"
import { JavaBuild } from "../../../src/ftc/java/build"
import { JavaDocuments } from "../../../src/ftc/java/documents"
import { Java } from "../../../src/ftc/java"
import { tmpdir } from "../../fixture/tmpdir"

const context = (root: string) =>
  FtcProject.ProjectContext.make({
    projectID: Project.ID.make(`project:${root}`),
    canonicalRoot: AbsolutePath.make(root),
    location: new Info({
      directory: AbsolutePath.make(root),
      project: { id: Project.ID.global, directory: AbsolutePath.make(path.parse(root).root) },
    }),
  })
const descriptor = (root: string) =>
  FtcEnvironment.ToolchainDescriptor.make({
    profileID: "owned-fixture",
    buildJdk: AbsolutePath.make("/fixture/build-jdk"),
    editorJdk: AbsolutePath.make("/fixture/editor-jdk"),
    androidSdk: AbsolutePath.make("/fixture/sdk"),
    adb: AbsolutePath.make("/fixture/adb"),
    gradleWrapper: AbsolutePath.make(path.join(root, "gradlew")),
    versions: {
      buildJdk: "17",
      editorJdk: "21",
      androidSdk: "fixture",
      adb: "fixture",
      gradleWrapper: "fixture",
      ftcSdk: "fixture",
      androidGradlePlugin: "fixture",
    },
  })
const gate = () => Effect.runSync(Deferred.make<void>())
const open = (value: Deferred.Deferred<void>) => Deferred.succeed(value, undefined)
const failure = (code: FtcJava.BuildError["code"]) => Effect.fail({ code } satisfies FtcJava.BuildError)
const run = <A, E>(effect: Effect.Effect<A, E, Scope.Scope>) => Effect.runPromise(Effect.scoped(effect))

// This fixture consumes exactly the declared root files, excluding only its build/cache directories.
// It is not a Gradle inventory or an OS adapter. Every fixture mutation is serialized and increments
// the trusted complete interval generation; reading endpoint hashes alone cannot establish that interval.
async function fixture(root: string) {
  const project = context(root)
  const toolchain = descriptor(root)
  const inventory = new Set([
    "Main.java",
    "Unopened.java",
    "gradlew",
    "build.gradle",
    "settings.gradle",
    "resource.xml",
    "configuration.json",
  ])
  await Promise.all(
    [...inventory].map((name) => Bun.write(path.join(root, name), name === "Main.java" ? "saved" : `fixture ${name}`)),
  )
  const started = gate()
  const acquired = gate()
  const finish = gate()
  const outputFinish = gate()
  const firstOutput = gate()
  const processCleanup = gate()
  const leaseCleanup = gate()
  const state = {
    generation: 0,
    configurationRevision: "config-1",
    authorized: project,
    acquisitions: 0,
    starts: 0,
    processesClosed: 0,
    leasesClosed: 0,
    cancellations: 0,
    revalidations: 0,
    acquisition: Effect.void as Effect.Effect<void, FtcJava.BuildError>,
    start: Effect.void as Effect.Effect<void, FtcJava.BuildError>,
    processRelease: Effect.void as Effect.Effect<void, FtcJava.BuildError>,
    leaseRelease: Effect.void as Effect.Effect<void, FtcJava.BuildError>,
    revalidation: Effect.void as Effect.Effect<void, FtcJava.BuildError>,
    exclusions: Effect.succeed([]) as Effect.Effect<readonly FtcJava.BuildExclusion[]>,
    termination: { exitCode: 0 } as JavaBuild.Termination,
    exitFailure: Effect.void as Effect.Effect<void, FtcJava.BuildError>,
    basisMutation: (_basis: JavaBuild.SavedInputBasis) => {},
    validationMutation: (_validation: JavaBuild.InputValidation) => {},
    log: { sequence: 0, stream: "stdout" as const, text: "actual stdout\n" },
    output: undefined as Stream.Stream<FtcJava.BuildLog, FtcJava.BuildError> | undefined,
    seen: [] as { lease: JavaBuild.SavedInputLease; toolchain: FtcEnvironment.ToolchainDescriptor }[],
  }
  const snapshot = () =>
    Effect.promise(async () => {
      const entries = await Promise.all(
        [...inventory].sort().map(async (name) => [name, await Bun.file(path.join(root, name)).text()] as const),
      )
      return {
        bytes: Object.fromEntries(entries),
        sourceRevision: createHash("sha256").update(JSON.stringify(entries)).digest("hex"),
      }
    })
  const validation = () =>
    Effect.gen(function* () {
      const saved = yield* snapshot()
      const value = {
        project: state.authorized,
        toolchain,
        sourceRevision: saved.sourceRevision,
        configurationRevision: state.configurationRevision,
        generation: String(state.generation),
        exclusions: yield* state.exclusions,
      }
      state.validationMutation(value)
      return value
    })
  const ports: JavaBuild.Ports = {
    projects: { resolve: () => Effect.succeed(state.authorized) },
    inputs: {
      acquire: (input) =>
        Effect.gen(function* () {
          state.acquisitions++
          expect(input.project).toEqual(project)
          expect(input.toolchain).toEqual(toolchain)
          const saved = yield* snapshot()
          const basis: JavaBuild.SavedInputBasis = {
            project,
            toolchain,
            sourceRevision: saved.sourceRevision,
            configurationRevision: state.configurationRevision,
            generation: String(state.generation),
            scope: "complete",
            mode: "immutable",
            recipe: {
              identity: "owned-complete-fixture",
              wrapper: toolchain.gradleWrapper,
              buildJdk: toolchain.buildJdk,
              androidSdk: toolchain.androidSdk,
            },
            exclusions: yield* state.exclusions,
          }
          state.basisMutation(basis)
          const released: { observation?: JavaBuild.InputValidation } = {}
          const release = Effect.gen(function* () {
            if (released.observation) return released.observation
            yield* open(leaseCleanup)
            yield* state.leaseRelease
            released.observation = yield* validation()
            state.leasesClosed++
            return released.observation
          })
          yield* Effect.addFinalizer(() => release.pipe(Effect.orDie, Effect.asVoid))
          yield* open(acquired)
          yield* state.acquisition
          return {
            basis,
            execution: Object.freeze({ bytes: Object.freeze(saved.bytes) }),
            release,
            revalidate: () =>
              Effect.gen(function* () {
                state.revalidations++
                yield* state.revalidation
                return yield* validation()
              }),
          }
        }),
    },
    process: {
      start: (input) =>
        Effect.gen(function* () {
          state.starts++
          state.seen.push(input)
          yield* state.start
          const closed = { value: false }
          const release = Effect.gen(function* () {
            if (closed.value) return
            yield* open(processCleanup)
            yield* state.processRelease
            closed.value = true
            state.processesClosed++
          })
          yield* Effect.addFinalizer(() => release.pipe(Effect.orDie))
          yield* open(started)
          return {
            output:
              state.output ??
              Stream.make(state.log).pipe(
                Stream.tap(() => open(firstOutput)),
                Stream.concat(
                  Stream.fromEffect(
                    Deferred.await(outputFinish).pipe(
                      Effect.as({ sequence: 1, stream: "stderr" as const, text: "actual stderr\n" }),
                    ),
                  ),
                ),
              ),
            termination: Deferred.await(finish).pipe(
              Effect.andThen(state.exitFailure),
              Effect.map(() => state.termination),
            ),
            cancelAndJoin: Effect.gen(function* () {
              state.cancellations++
              yield* open(finish)
              yield* open(outputFinish)
              return state.termination
            }),
            release,
          }
        }),
    },
  }
  const request = { project, toolchain, configurationRevision: "config-1" }
  const complete = open(finish).pipe(Effect.andThen(open(outputFinish)))
  const write = (name: string, bytes: string) =>
    Effect.promise(async () => {
      inventory.add(name)
      await Bun.write(path.join(root, name), bytes)
      state.generation++
    })
  return {
    project,
    toolchain,
    state,
    ports,
    request,
    inventory,
    write,
    snapshot,
    validation,
    started,
    acquired,
    finish,
    outputFinish,
    firstOutput,
    processCleanup,
    leaseCleanup,
    complete,
  }
}

async function isolated<A, E>(
  body: (owner: JavaBuild.Interface, supplied: Awaited<ReturnType<typeof fixture>>) => Effect.Effect<A, E, Scope.Scope>,
) {
  await using tmp = await tmpdir()
  const supplied = await fixture(tmp.path)
  return await run(
    Effect.gen(function* () {
      const owner = yield* JavaBuild.make(supplied.ports)
      return yield* body(owner, supplied)
    }),
  )
}

// Removing the owner's interval comparison makes this assertion fail after a real saved edit.
test("source change during build makes evidence outdated", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const admitted = yield* owner.startBuild(f.request)
      yield* Deferred.await(f.started)
      const original = yield* f.snapshot()
      yield* f.write("Main.java", "changed")
      yield* f.complete
      const changed = yield* admitted.result
      expect(changed.status).toBe("outdated")
      expect(changed.inputChanged).toBe(true)
      expect(changed.sourceRevision).toBe(original.sourceRevision)
      expect(f.state.seen[0].lease.execution).toEqual({ bytes: { ...original.bytes } })
      const second = yield* owner.startBuild(f.request)
      const cancelled = yield* second.cancel
      expect(cancelled.status).toBe("cancelled")
    }),
  ))

test("stable saved execution retains actual ordered output, exit and one immutable owner record", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const admitted = yield* owner.startBuild(f.request)
      expect(yield* owner.readBuild({ projectID: f.project.projectID, buildID: admitted.buildID })).toEqual({
        state: "running",
        projectID: f.project.projectID,
        buildID: admitted.buildID,
      })
      yield* f.complete
      const evidence = yield* admitted.result
      expect(evidence).toMatchObject({
        status: "succeeded",
        inputChanged: false,
        exitCode: 0,
        outputComplete: true,
        savedInputsOnly: true,
        logs: [
          { sequence: 0, stream: "stdout", text: "actual stdout\n" },
          { sequence: 1, stream: "stderr", text: "actual stderr\n" },
        ],
        errors: [],
        exclusions: { initial: [], settlement: [] },
      })
      expect("artifact" in evidence).toBe(false)
      expect(Object.isFrozen(evidence.logs)).toBe(true)
      expect(Object.isFrozen(evidence.logs[0])).toBe(true)
      expect(yield* admitted.result).toBe(evidence)
      expect(yield* admitted.cancel).toBe(evidence)
      const record = yield* owner.readBuild({ projectID: f.project.projectID, buildID: admitted.buildID })
      expect(record.state).toBe("settled")
      if (record.state === "settled") expect(record.evidence).toBe(evidence)
      expect(f.state.processesClosed).toBe(1)
      expect(f.state.leasesClosed).toBe(1)
    }),
  ))

test.each([
  "Unopened.java",
  "gradlew",
  "build.gradle",
  "settings.gradle",
  "resource.xml",
  "configuration.json",
  "Added.java",
])("complete fixture input change invalidates saved currency: %s", (name) =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const admitted = yield* owner.startBuild(f.request)
      yield* Deferred.await(f.started)
      yield* f.write(name, "new saved bytes")
      yield* f.complete
      expect(yield* admitted.result).toMatchObject({ status: "outdated", inputChanged: true })
    }),
  ),
)

test.each(["delete", "rename"])("complete fixture %s changes invalidate the input inventory", (action) =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const admitted = yield* owner.startBuild(f.request)
      yield* Deferred.await(f.started)
      yield* Effect.promise(async () => {
        f.inventory.delete("Unopened.java")
        if (action === "delete") await fs.rm(path.join(f.project.canonicalRoot, "Unopened.java"))
        if (action === "rename") {
          f.inventory.add("Renamed.java")
          await fs.rename(
            path.join(f.project.canonicalRoot, "Unopened.java"),
            path.join(f.project.canonicalRoot, "Renamed.java"),
          )
        }
        f.state.generation++
      })
      yield* f.complete
      expect(yield* admitted.result).toMatchObject({ status: "outdated", inputChanged: true })
    }),
  ),
)

test("output/cache writes alone do not invalidate the fixture's complete consumed input scope", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const admitted = yield* owner.startBuild(f.request)
      yield* Deferred.await(f.started)
      yield* Effect.promise(async () => {
        await fs.mkdir(path.join(f.project.canonicalRoot, "build"))
        await fs.mkdir(path.join(f.project.canonicalRoot, "cache"))
        await Bun.write(path.join(f.project.canonicalRoot, "build/output"), "output")
        await Bun.write(path.join(f.project.canonicalRoot, "cache/data"), "cache")
      })
      yield* f.complete
      expect(yield* admitted.result).toMatchObject({ status: "succeeded", inputChanged: false })
    }),
  ))

test("configuration-only and A-B-A interval changes outrank a nonzero observed exit", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const first = yield* owner.startBuild(f.request)
      yield* Deferred.await(f.started)
      f.state.configurationRevision = "config-2"
      f.state.generation++
      f.state.termination = { exitCode: 7 }
      yield* f.complete
      expect(yield* first.result).toMatchObject({
        status: "outdated",
        inputChanged: true,
        configurationRevision: "config-1",
        exitCode: 7,
      })
      const second = yield* owner.startBuild({ ...f.request, configurationRevision: "config-2" })
      yield* Effect.yieldNow
      yield* f.write("Main.java", "B")
      yield* f.write("Main.java", "saved")
      const evidence = yield* second.result
      expect(evidence.status).toBe("outdated")
      expect(evidence.sourceRevision).toBe((yield* f.snapshot()).sourceRevision)
      expect(evidence.inputChanged).toBe(true)
    }),
  ))

test.each([{ exitCode: 9 }, { signal: "SIGTERM" }, {}])(
  "actual non-success termination is retained without invented exits: %j",
  (termination) =>
    isolated((owner, f) =>
      Effect.gen(function* () {
        f.state.termination = termination
        yield* f.complete
        const evidence = yield* owner.build(f.request)
        expect(evidence.status).toBe("failed")
        expect(evidence.exitCode).toBe(termination.exitCode)
        expect(evidence.signal).toBe(termination.signal)
        expect("exitCode" in evidence).toBe("exitCode" in termination)
      }),
    ),
)

test("stale configuration and incomplete leases are rejected before process launch", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      expect(yield* owner.startBuild({ ...f.request, configurationRevision: "stale" }).pipe(Effect.flip)).toEqual({
        code: "stale_configuration",
      })
      f.state.basisMutation = (basis) => {
        Object.assign(basis, { scope: "incomplete" })
      }
      expect(yield* owner.startBuild(f.request).pipe(Effect.flip)).toEqual({ code: "incomplete_inputs" })
      expect(f.state.starts).toBe(0)
      expect(f.state.leasesClosed).toBe(2)
    }),
  ))

test.each(["project", "location", "workspace", "host", "wrapper", "buildJdk", "sdk", "descriptor"])(
  "lease identity mismatch is rejected before process launch: %s",
  (field) =>
    isolated((owner, f) =>
      Effect.gen(function* () {
        f.state.basisMutation = (basis) => {
          if (field === "project")
            Object.assign(basis, { project: { ...basis.project, projectID: Project.ID.make("foreign") } })
          if (field === "location")
            Object.assign(basis, {
              project: {
                ...basis.project,
                location: new Info({
                  directory: AbsolutePath.make("/foreign"),

                  project: basis.project.location.project,
                }),
              },
            })
          if (field === "workspace")
            Object.assign(basis, {
              project: {
                ...basis.project,
                location: new Info({
                  directory: basis.project.location.directory,
                  workspaceID: WorkspaceID.make("wrk_foreign"),
                  project: basis.project.location.project,
                }),
              },
            })
          if (field === "host")
            Object.assign(basis, {
              project: {
                ...basis.project,
                location: new Info({
                  directory: basis.project.location.directory,

                  project: { id: Project.ID.make("foreign"), directory: AbsolutePath.make("/foreign") },
                }),
              },
            })
          if (field === "descriptor") Object.assign(basis, { toolchain: { ...basis.toolchain, profileID: "foreign" } })
          if (field === "wrapper") Object.assign(basis, { recipe: { ...basis.recipe, wrapper: "/foreign/gradlew" } })
          if (field === "buildJdk")
            Object.assign(basis, { recipe: { ...basis.recipe, buildJdk: basis.toolchain.editorJdk } })
          if (field === "sdk") Object.assign(basis, { recipe: { ...basis.recipe, androidSdk: "/foreign/sdk" } })
        }
        expect((yield* owner.startBuild(f.request).pipe(Effect.flip)).code).toBe("lease_mismatch")
        expect(f.state.starts).toBe(0)
        expect(f.state.leasesClosed).toBe(1)
      }),
    ),
)

test("caller project/Location spoofing never acquires saved inputs", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      for (const project of [
        { ...f.project, canonicalRoot: AbsolutePath.make("/foreign") },
        {
          ...f.project,
          location: new Info({
            directory: AbsolutePath.make("/foreign"),

            project: f.project.location.project,
          }),
        },
        {
          ...f.project,
          location: new Info({
            directory: f.project.location.directory,

            project: { id: Project.ID.make("foreign"), directory: AbsolutePath.make("/foreign") },
          }),
        },
      ])
        expect((yield* owner.startBuild({ ...f.request, project }).pipe(Effect.flip)).code).toBe("project_unauthorized")
      expect(f.state.acquisitions).toBe(0)
      expect(f.state.starts).toBe(0)
    }),
  ))

test("strict model-facing request rejects command, capability, output selectors and malformed fields", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      for (const extra of [
        { command: "gradle" },
        { task: "assemble" },
        { env: {} },
        { output: "/foreign" },
        { artifact: {} },
        { execution: {} },
        { configurationRevision: "" },
      ]) {
        expect((yield* owner.startBuild(Object.assign({}, f.request, extra)).pipe(Effect.flip)).code).toBe(
          "invalid_build_input",
        )
      }
      expect(f.state.acquisitions).toBe(0)
    }),
  ))

test("authority revoked during acquisition prevents execution and releases its lease", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const held = gate()
      f.state.acquisition = Deferred.await(held)
      const acquiring = yield* owner.startBuild(f.request).pipe(Effect.forkScoped)
      yield* Deferred.await(f.acquired)
      f.state.authorized = context("/foreign")
      yield* open(held)
      expect((yield* Fiber.join(acquiring).pipe(Effect.flip)).code).toBe("project_unauthorized")
      expect(f.state.starts).toBe(0)
      expect(f.state.leasesClosed).toBe(1)
    }),
  ))

test("execution and query boundaries refresh full project authority", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const admitted = yield* owner.startBuild(f.request)
      yield* Deferred.await(f.started)
      f.state.authorized = {
        ...f.project,
        location: new Info({
          directory: AbsolutePath.make("/replaced"),

          project: f.project.location.project,
        }),
      }
      expect(
        (yield* owner.readBuild({ projectID: f.project.projectID, buildID: admitted.buildID }).pipe(Effect.flip)).code,
      ).toBe("project_unauthorized")
      yield* f.complete
      const evidence = yield* admitted.result
      expect(evidence.status).toBe("failed")
      expect(evidence.errors.map((error) => error.code)).toContain("project_unauthorized")
    }),
  ))

test.each(["acquisition", "start", "revalidation", "exitFailure", "processRelease", "leaseRelease"])(
  "typed %s failure never produces successful evidence",
  (phase) =>
    isolated((owner, f) =>
      Effect.gen(function* () {
        const code =
          phase === "acquisition"
            ? "inputs_unavailable"
            : phase === "start"
              ? "process_start_failed"
              : phase === "revalidation"
                ? "input_verification_failed"
                : phase === "exitFailure"
                  ? "termination_failed"
                  : "cleanup_failed"
        f.state[phase] = failure(code)
        yield* f.complete
        if (phase === "acquisition") {
          expect((yield* owner.startBuild(f.request).pipe(Effect.flip)).code).toBe(code)
          expect(f.state.starts).toBe(0)
          return
        }
        const admitted = yield* owner.startBuild(f.request)
        const evidence = yield* admitted.result.pipe(Effect.exit)
        const record = yield* owner.readBuild({ projectID: f.project.projectID, buildID: admitted.buildID })
        expect(record.state).toBe("settled")
        if (record.state !== "settled") return
        expect(record.evidence.status).toBe("failed")
        expect(record.evidence.inputChanged).toBe(false)
        expect(record.evidence.errors.map((error) => error.code)).toContain(code)
        if (phase === "start") expect("exitCode" in record.evidence).toBe(false)
        // A defect in a scoped fallback remains a defect at the caller result boundary.
        if (Exit.isFailure(evidence)) expect(Cause.hasDies(evidence.cause)).toBe(true)
      }),
    ),
)

test("output failure preserves partial actual text and joins the owned process", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      f.state.output = Stream.make({ sequence: 0, stream: "stderr", text: "actual partial" }).pipe(
        Stream.concat(Stream.fromEffect(failure("output_failed"))),
      )
      const evidence = yield* owner.build(f.request)
      expect(evidence).toMatchObject({
        status: "failed",
        outputComplete: false,
        logs: [{ sequence: 0, stream: "stderr", text: "actual partial" }],
      })
      expect(evidence.errors.map((error) => error.code)).toContain("output_failed")
      expect(f.state.cancellations).toBe(1)
      expect(f.state.processesClosed).toBe(1)
    }),
  ))

test("revalidation inability does not invent inputChanged or authorize unchanged success", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const admitted = yield* owner.startBuild(f.request)
      yield* Deferred.await(f.started)
      f.state.revalidation = failure("input_verification_failed")
      f.state.leaseRelease = failure("cleanup_failed")
      yield* f.complete
      const recordResult = yield* admitted.result.pipe(Effect.exit)
      const record = yield* owner.readBuild({ projectID: f.project.projectID, buildID: admitted.buildID })
      expect(record.state).toBe("settled")
      if (record.state === "settled")
        expect(record.evidence).toMatchObject({ status: "failed", inputChanged: false, exitCode: 0 })
      expect(Exit.isFailure(recordResult)).toBe(true)
    }),
  ))

test("mutating caller/lease/output records cannot rewrite the admitted execution or returned history", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const held = gate()
      f.state.acquisition = Deferred.await(held)
      const input = structuredClone(f.request)
      const acquiring = yield* owner.startBuild(input).pipe(Effect.forkScoped)
      yield* Deferred.await(f.acquired)
      input.configurationRevision = "forged"
      Object.assign(input.toolchain, { buildJdk: AbsolutePath.make("/forged") })
      Object.assign(input.toolchain.versions, { buildJdk: "forged" })
      Object.assign(input.project.location.project, { id: Project.ID.make("forged") })
      yield* open(held)
      const admitted = yield* Fiber.join(acquiring)
      yield* Deferred.await(f.firstOutput)
      yield* Effect.yieldNow
      f.state.log.text = "rewritten"
      yield* f.complete
      const evidence = yield* admitted.result
      expect(evidence.configurationRevision).toBe("config-1")
      expect(evidence.logs[0].text).toBe("actual stdout\n")
      expect(f.state.seen[0].toolchain.buildJdk).toBe("/fixture/build-jdk")
      expect(Object.isFrozen(f.state.seen[0].lease.basis.toolchain.versions)).toBe(true)
      expect(Object.isFrozen(f.state.seen[0].lease.basis.project.location.project)).toBe(true)
    }),
  ))

const documentFilesystem: JavaDocuments.Filesystem = {
  realpath: (value) =>
    Effect.tryPromise({ try: () => fs.realpath(value), catch: () => ({ code: "file_unavailable" as const }) }),
  readText: (value) =>
    Effect.tryPromise({ try: () => Bun.file(value).text(), catch: () => ({ code: "file_unavailable" as const }) }),
}

test.each(["before", "during"])("dirty real document %s execution remains untouched and excluded", async (timing) => {
  await using tmp = await tmpdir()
  const f = await fixture(tmp.path)
  await run(
    Effect.gen(function* () {
      const documents = yield* JavaDocuments.make({
        filesystem: documentFilesystem,
        projects: { resolve: () => Effect.succeed(f.project) },
      })
      const opened = yield* documents.openDocument({ project: f.project, path: "Main.java" })
      f.state.exclusions = documents.readDocument({ projectID: f.project.projectID, path: "Main.java" }).pipe(
        Effect.orDie,
        Effect.map((document) =>
          document.dirty
            ? [
                {
                  path: "Main.java",
                  documentID: document.documentID,
                  bufferRevision: document.bufferRevision,
                  diskRevision: document.diskRevision,
                },
              ]
            : [],
        ),
      )
      const change = documents.changeDocument({ path: opened.path, expectedRevision: 0, text: "unsaved" })
      if (timing === "before") yield* change
      const owner = yield* JavaBuild.make(f.ports)
      const admitted = yield* owner.startBuild(f.request)
      yield* Deferred.await(f.started)
      if (timing === "during") yield* change
      yield* f.complete
      const evidence = yield* admitted.result
      const untouched = yield* documents.readDocument({ projectID: f.project.projectID, path: "Main.java" })
      expect(untouched).toMatchObject({ text: "unsaved", dirty: true, bufferRevision: 1, diskRevision: 0 })
      expect(yield* Effect.promise(() => Bun.file(opened.path).text())).toBe("saved")
      expect(evidence).toMatchObject({ status: "succeeded", inputChanged: false, savedInputsOnly: true })
      expect(evidence.exclusions.initial).toHaveLength(timing === "before" ? 1 : 0)
      expect(evidence.exclusions.settlement).toEqual([
        { path: "Main.java", documentID: opened.documentID, bufferRevision: 1, diskRevision: 0 },
      ])
      expect(JSON.stringify(evidence)).not.toContain("unsaved")
      expect(f.state.seen[0].lease.execution).toMatchObject({ bytes: { "Main.java": "saved" } })
    }),
  )
})

test("explicit cancellation retains observed output, waits for async cleanup, and wins publication races", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const held = gate()
      f.state.processRelease = Deferred.await(held)
      const admitted = yield* owner.startBuild(f.request)
      yield* Deferred.await(f.firstOutput)
      const cancelling = yield* admitted.cancel.pipe(Effect.forkScoped)
      yield* Deferred.await(f.processCleanup)
      expect(cancelling.pollUnsafe()).toBeUndefined()
      expect((yield* owner.readBuild({ projectID: f.project.projectID, buildID: admitted.buildID })).state).toBe(
        "running",
      )
      yield* f.write("Main.java", "changed during cleanup")
      yield* open(held)
      const cancelled = yield* Fiber.join(cancelling)
      expect(cancelled).toMatchObject({
        status: "cancelled",
        inputChanged: true,
        logs: [{ sequence: 0, stream: "stdout", text: "actual stdout\n" }],
      })
      expect(yield* admitted.cancel).toBe(cancelled)
      expect(yield* admitted.result).toBe(cancelled)
      const record = yield* owner.readBuild({ projectID: f.project.projectID, buildID: admitted.buildID })
      if (record.state === "settled") expect(record.evidence).toBe(cancelled)
      expect(f.state.cancellations).toBe(1)
      expect(f.state.leasesClosed).toBe(1)
    }),
  ))

test("interrupting a result waiter preserves interruption and public cancellation settles queryable evidence", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const admitted = yield* owner.startBuild(f.request)
      const waiting = yield* admitted.result.pipe(Effect.forkScoped)
      yield* Deferred.await(f.started)
      yield* Fiber.interrupt(waiting)
      const exit = yield* Fiber.await(waiting)
      expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true)
      expect((yield* owner.readBuild({ projectID: f.project.projectID, buildID: admitted.buildID })).state).toBe(
        "running",
      )
      const cancelled = yield* admitted.cancel
      expect(cancelled.status).toBe("cancelled")
      expect((yield* owner.readBuild({ projectID: f.project.projectID, buildID: admitted.buildID })).state).toBe(
        "settled",
      )
    }),
  ))

test("convenience build interruption joins cleanup and preserves caller interruption", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const held = gate()
      f.state.leaseRelease = Deferred.await(held)
      const building = yield* owner.build(f.request).pipe(Effect.forkScoped)
      yield* Deferred.await(f.started)
      const stopping = yield* Fiber.interrupt(building).pipe(Effect.forkScoped)
      yield* Deferred.await(f.leaseCleanup)
      expect(stopping.pollUnsafe()).toBeUndefined()
      yield* open(held)
      yield* Fiber.join(stopping)
      const exit = yield* Fiber.await(building)
      expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true)
      expect(f.state.processesClosed).toBe(1)
      expect(f.state.leasesClosed).toBe(1)
      expect((yield* (yield* owner.startBuild(f.request)).cancel).status).toBe("cancelled")
    }),
  ))

test("caller interruption during long acquisition releases provisional lease without launching", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      f.state.acquisition = Effect.never
      const acquiring = yield* owner.startBuild(f.request).pipe(Effect.forkScoped)
      yield* Deferred.await(f.acquired)
      yield* Fiber.interrupt(acquiring)
      expect(f.state.starts).toBe(0)
      expect(f.state.leasesClosed).toBe(1)
    }),
  ))

test("unknown, foreign and fresh-owner queries cannot adopt supplied successful evidence", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const admitted = yield* owner.startBuild(f.request)
      expect(
        (yield* owner
          .readBuild({ projectID: f.project.projectID, buildID: FtcJava.BuildID.create() })
          .pipe(Effect.flip)).code,
      ).toBe("build_unknown")
      expect(
        (yield* owner.readBuild({ projectID: Project.ID.make("foreign"), buildID: admitted.buildID }).pipe(Effect.flip))
          .code,
      ).toBe("build_unknown")
      const fresh = yield* JavaBuild.make(f.ports)
      expect(
        (yield* fresh.readBuild({ projectID: f.project.projectID, buildID: admitted.buildID }).pipe(Effect.flip)).code,
      ).toBe("build_unknown")
      expect(
        (yield* owner
          .readBuild(
            Object.assign(
              { projectID: f.project.projectID, buildID: admitted.buildID },
              { evidence: { status: "succeeded" } },
            ),
          )
          .pipe(Effect.flip)).code,
      ).toBe("invalid_build_input")
      yield* admitted.cancel
    }),
  ))

test("same-root alias admissions reject busy while different roots run independently", async () => {
  await using one = await tmpdir()
  await using two = await tmpdir()
  const a = await fixture(one.path)
  const b = await fixture(two.path)
  const ports: JavaBuild.Ports = {
    projects: {
      resolve: (id) =>
        Effect.succeed(
          id === a.project.projectID
            ? a.project
            : id === b.project.projectID
              ? b.project
              : { ...a.project, projectID: id },
        ),
    },
    inputs: {
      acquire: (input) =>
        input.project.canonicalRoot === a.project.canonicalRoot
          ? a.ports.inputs.acquire(input)
          : b.ports.inputs.acquire(input),
    },
    process: {
      start: (input) =>
        input.lease.basis.project.canonicalRoot === a.project.canonicalRoot
          ? a.ports.process.start(input)
          : b.ports.process.start(input),
    },
  }
  await run(
    Effect.gen(function* () {
      const owner = yield* JavaBuild.make(ports)
      const first = yield* owner.startBuild(a.request)
      expect((yield* owner.startBuild(a.request).pipe(Effect.flip)).code).toBe("busy")
      const alias = { ...a.project, projectID: Project.ID.make("alias") }
      expect((yield* owner.startBuild({ ...a.request, project: alias }).pipe(Effect.flip)).code).toBe("busy")
      const second = yield* owner.startBuild(b.request)
      yield* Deferred.await(b.started)
      yield* b.complete
      expect((yield* second.result).projectID).toBe(b.project.projectID)
      expect((yield* owner.readBuild({ projectID: a.project.projectID, buildID: first.buildID })).state).toBe("running")
      yield* first.cancel
    }),
  )
})

test("public owner disposal and repeated cancellation join held async cleanup without losing observers", async () => {
  await using tmp = await tmpdir()
  const f = await fixture(tmp.path)
  await Effect.runPromise(
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const held = gate()
      f.state.leaseRelease = Deferred.await(held)
      const owner = yield* JavaBuild.make(f.ports).pipe(Scope.provide(scope))
      const admitted = yield* owner.startBuild(f.request)
      yield* Deferred.await(f.started)
      const first = yield* admitted.cancel.pipe(Effect.forkChild)
      const second = yield* admitted.cancel.pipe(Effect.forkChild)
      const closing = yield* Scope.close(scope, Exit.void).pipe(Effect.forkChild)
      yield* Deferred.await(f.leaseCleanup)
      expect(closing.pollUnsafe()).toBeUndefined()
      yield* open(held)
      const results = yield* Effect.all([Fiber.join(first), Fiber.join(second)], { concurrency: "unbounded" })
      yield* Fiber.join(closing)
      expect(results[0]).toBe(results[1])
      expect(results[0].status).toBe("cancelled")
      expect(f.state.processesClosed).toBe(1)
      expect(f.state.leasesClosed).toBe(1)
      expect(
        (yield* owner.readBuild({ projectID: f.project.projectID, buildID: admitted.buildID }).pipe(Effect.flip)).code,
      ).toBe("owner_closed")
      expect((yield* owner.startBuild(f.request).pipe(Effect.flip)).code).toBe("owner_closed")
    }),
  )
}, 2000)

test("owner close interrupts pending acquisition, releases resources and prevents late admission", async () => {
  await using tmp = await tmpdir()
  const f = await fixture(tmp.path)
  await Effect.runPromise(
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      f.state.acquisition = Effect.never
      const held = gate()
      f.state.leaseRelease = Deferred.await(held)
      const owner = yield* JavaBuild.make(f.ports).pipe(Scope.provide(scope))
      const pending = yield* owner.startBuild(f.request).pipe(Effect.forkChild)
      yield* Deferred.await(f.acquired)
      const closing = yield* Scope.close(scope, Exit.void).pipe(Effect.forkChild)
      yield* Deferred.await(f.leaseCleanup)
      expect(closing.pollUnsafe()).toBeUndefined()
      yield* open(held)
      yield* Fiber.join(closing)
      const exit = yield* Fiber.await(pending)
      expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true)
      expect(f.state.leasesClosed).toBe(1)
      expect(f.state.starts).toBe(0)
    }),
  )
}, 2000)

test("document-only facade stays usable and build-enabled construction launches no work", async () => {
  await using tmp = await tmpdir()
  const f = await fixture(tmp.path)
  const documents = { filesystem: documentFilesystem, projects: { resolve: () => Effect.succeed(f.project) } }
  await run(
    Effect.gen(function* () {
      const java = yield* Java.Service
      expect((yield* java.openDocument({ project: f.project, path: "Main.java" })).text).toBe("saved")
      expect((yield* java.build(f.request).pipe(Effect.flip)).code).toBe("build_unavailable")
      expect((yield* java.startBuild(f.request).pipe(Effect.flip)).code).toBe("build_unavailable")
      expect(
        (yield* java.readBuild({ projectID: f.project.projectID, buildID: FtcJava.BuildID.create() }).pipe(Effect.flip))
          .code,
      ).toBe("build_unavailable")
    }).pipe(Effect.provide(Java.layer(documents))),
  )
  await run(
    Effect.gen(function* () {
      const java = yield* Java.Service
      expect(f.state.acquisitions).toBe(0)
      expect(f.state.starts).toBe(0)
      yield* f.complete
      expect((yield* java.build(f.request)).status).toBe("succeeded")
      expect(
        (yield* java.readDocument({ projectID: f.project.projectID, path: "Main.java" }).pipe(Effect.flip)).code,
      ).toBe("document_not_open")
    }).pipe(Effect.provide(Java.layerWithBuilds({ documents, builds: f.ports }))),
  )
  for (const name of [
    "BuildID",
    "BuildRequest",
    "BuildExclusion",
    "BuildLog",
    "BuildEvidence",
    "BuildError",
    "BuildQuery",
    "BuildRecord",
  ] as const)
    expect(Java[name]).toBe(FtcJava[name])
})

test("interruption at admission handoff cancels the undelivered run and joins its resources", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const held = gate()
      f.state.acquisition = Deferred.await(held)
      const acquire = f.ports.inputs.acquire
      Object.assign(f.ports.inputs, {
        acquire: (input: Parameters<JavaBuild.Ports["inputs"]["acquire"]>[0]) =>
          acquire(input).pipe(
            Effect.map((lease) => ({
              ...lease,
              revalidate: () =>
                Effect.succeed({
                  project: lease.basis.project,
                  toolchain: lease.basis.toolchain,
                  sourceRevision: lease.basis.sourceRevision,
                  configurationRevision: lease.basis.configurationRevision,
                  generation: lease.basis.generation,
                  exclusions: lease.basis.exclusions,
                }),
            })),
          ),
      })
      const acquiring = yield* owner.startBuild(f.request).pipe(Effect.forkScoped)
      yield* Deferred.await(f.acquired)
      f.state.start = Effect.sync(() => acquiring.interruptUnsafe())
      yield* open(held)
      const exit = yield* Fiber.await(acquiring)
      expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true)
      expect(f.state.processesClosed).toBe(1)
      expect(f.state.leasesClosed).toBe(1)
    }),
  ))

test("unordered process output is a typed output failure, retaining only ordered observations", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      f.state.output = Stream.make(
        { sequence: 1, stream: "stdout", text: "first" },
        { sequence: 0, stream: "stderr", text: "late" },
      )
      const evidence = yield* owner.build(f.request)
      expect(evidence).toMatchObject({
        status: "failed",
        outputComplete: false,
        logs: [{ sequence: 1, stream: "stdout", text: "first" }],
        errors: [{ code: "output_failed" }],
      })
    }),
  ))

test("settlement observes saved and dirty changes during held lease cleanup", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const held = gate()
      f.state.leaseRelease = Deferred.await(held)
      const admitted = yield* owner.startBuild(f.request)
      yield* f.complete
      yield* Deferred.await(f.leaseCleanup)
      expect((yield* owner.readBuild({ projectID: f.project.projectID, buildID: admitted.buildID })).state).toBe(
        "running",
      )
      yield* f.write("Unopened.java", "changed while lease closing")
      f.state.exclusions = Effect.succeed([
        { path: "Main.java", documentID: FtcJava.DocumentID.make("doc_fixture"), bufferRevision: 1, diskRevision: 0 },
      ])
      yield* open(held)
      const evidence = yield* admitted.result
      expect(evidence).toMatchObject({
        status: "outdated",
        inputChanged: true,
        exclusions: {
          initial: [],
          settlement: [{ path: "Main.java", documentID: "doc_fixture", bufferRevision: 1, diskRevision: 0 }],
        },
      })
    }),
  ))

test("a malformed revalidation identity cannot prove saved-input currency", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const admitted = yield* owner.startBuild(f.request)
      yield* Deferred.await(f.started)
      f.state.validationMutation = (validation) => Object.assign(validation, { generation: "" })
      yield* f.complete
      expect(yield* admitted.result).toMatchObject({ status: "failed", inputChanged: false })
    }),
  ))

test("a port defect stays a defect for the caller while the owner settles honest failed evidence", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      f.state.start = Effect.die("owned fixture defect")
      const admitted = yield* owner.startBuild(f.request)
      const exit = yield* admitted.result.pipe(Effect.exit)
      expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true)
      const record = yield* owner.readBuild({ projectID: f.project.projectID, buildID: admitted.buildID })
      expect(record.state).toBe("settled")
      if (record.state === "settled")
        expect(record.evidence).toMatchObject({ status: "failed", errors: [{ code: "execution_defect" }] })
    }),
  ))

test("cancelling a harmless test-owned child joins its actual exit and stdout reader", async () => {
  await using tmp = await tmpdir()
  const f = await fixture(tmp.path)
  const observed = gate()
  const handles: Bun.Subprocess<"ignore", "pipe", "ignore">[] = []
  const childPort: JavaBuild.Ports["process"] = {
    start: () =>
      Effect.gen(function* () {
        // This fixture runs only its own harmless script. It proves direct-child/pipe cleanup here,
        // not Gradle, descendant isolation, production authority or Windows process behavior.
        const child = Bun.spawn(
          [
            "/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun",
            "-e",
            'console.log("owned child ready"); setInterval(() => {}, 1000)',
          ],
          { stdin: "ignore", stdout: "pipe", stderr: "ignore" },
        )
        handles.push(child)
        const termination = Effect.promise(async () => {
          await child.exited
          return {
            ...(child.exitCode !== null ? { exitCode: child.exitCode } : {}),
            ...(child.signalCode ? { signal: child.signalCode } : {}),
          }
        })
        const cancelAndJoin = Effect.sync(() => {
          if (child.exitCode === null) child.kill("SIGTERM")
        }).pipe(Effect.andThen(termination))
        const release = Effect.tryPromise({
          try: async () => {
            await child.exited
            await child.stdout.cancel()
          },
          catch: () => ({ code: "cleanup_failed" as const }),
        })
        yield* Effect.addFinalizer(() => cancelAndJoin.pipe(Effect.andThen(release), Effect.orDie))
        return {
          output: Stream.fromReadableStream({
            evaluate: () => child.stdout,
            releaseLockOnEnd: true,
            onError: () => ({ code: "output_failed" as const }),
          }).pipe(
            Stream.map((bytes) => ({ sequence: 0, stream: "stdout" as const, text: new TextDecoder().decode(bytes) })),
            Stream.tap(() => open(observed)),
          ),
          termination,
          cancelAndJoin,
          release,
        }
      }),
  }
  Object.assign(f.ports.process, childPort)
  await run(
    Effect.gen(function* () {
      const owner = yield* JavaBuild.make(f.ports)
      const admitted = yield* owner.startBuild(f.request)
      yield* Deferred.await(observed)
      yield* Effect.yieldNow
      const cancelled = yield* admitted.cancel
      expect(cancelled.status).toBe("cancelled")
      expect(cancelled.logs.map((log) => log.text).join("")).toBe("owned child ready\n")
      expect(handles[0].signalCode).toBe("SIGTERM")
      expect(cancelled.exitCode).toBe(handles[0].exitCode ?? undefined)
      expect(cancelled.signal).toBe(handles[0].signalCode ?? undefined)
      expect(handles[0].stdout.locked).toBe(false)
    }),
  )
})

test("raw lease and process-handle mutation cannot replace retained execution/cleanup fields", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const rawBasis: JavaBuild.SavedInputBasis[] = []
      const rawProcesses: JavaBuild.BuildProcess[] = []
      f.state.basisMutation = (basis) => {
        rawBasis.push(basis)
      }
      const start = f.ports.process.start
      Object.assign(f.ports.process, {
        start: (input: Parameters<JavaBuild.Ports["process"]["start"]>[0]) =>
          start(input).pipe(
            Effect.tap((process) =>
              Effect.sync(() => {
                rawProcesses.push(process)
              }),
            ),
          ),
      })
      const admitted = yield* owner.startBuild(f.request)
      yield* Deferred.await(f.firstOutput)
      Object.assign(rawBasis[0], { sourceRevision: "forged", configurationRevision: "forged" })
      Object.assign(rawBasis[0].recipe, { identity: "forged" })
      Object.assign(rawProcesses[0], { release: Effect.never, cancelAndJoin: Effect.never })
      yield* f.complete
      const evidence = yield* admitted.result
      expect(evidence.status).toBe("succeeded")
      expect(evidence.configurationRevision).toBe("config-1")
      expect(evidence.sourceRevision).not.toBe("forged")
      expect(f.state.seen[0].lease.basis.recipe.identity).toBe("owned-complete-fixture")
      expect(f.state.processesClosed).toBe(1)
    }),
  ))

test("retained typed failures are immutable and unavailable settlement exclusions remain absent", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const held = gate()
      const error: FtcJava.BuildError = { code: "process_start_failed" }
      f.state.start = Effect.fail(error)
      f.state.leaseRelease = Deferred.await(held).pipe(Effect.andThen(failure("cleanup_failed")))
      const admitted = yield* owner.startBuild(f.request)
      yield* Deferred.await(f.leaseCleanup)
      Object.assign(error, { code: "build_unknown" })
      yield* open(held)
      const record = yield* admitted.result.pipe(
        Effect.exit,
        Effect.andThen(owner.readBuild({ projectID: f.project.projectID, buildID: admitted.buildID })),
      )
      expect(record.state).toBe("settled")
      if (record.state !== "settled") return
      expect(record.evidence.errors[0]).toEqual({ code: "process_start_failed" })
      expect(Object.isFrozen(record.evidence.errors[0])).toBe(true)
      expect("settlement" in record.evidence.exclusions).toBe(false)
    }),
  ))

test("accepted cancellation during successful cleanup wins the final publication race", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const held = gate()
      f.state.processRelease = Deferred.await(held)
      const admitted = yield* owner.startBuild(f.request)
      yield* f.complete
      yield* Deferred.await(f.processCleanup)
      const cancelling = yield* admitted.cancel.pipe(Effect.forkScoped)
      yield* Effect.yieldNow
      expect(cancelling.pollUnsafe()).toBeUndefined()
      yield* open(held)
      const evidence = yield* Fiber.join(cancelling)
      expect(evidence).toMatchObject({ status: "cancelled", exitCode: 0, outputComplete: true })
      expect(evidence.logs).toHaveLength(2)
      expect(yield* admitted.result).toBe(evidence)
    }),
  ))

test("cancellation cleanup without a new exit cannot erase an already observed real exit", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const exited = gate()
      const failOutput = gate()
      const start = f.ports.process.start
      f.state.termination = { exitCode: 5 }
      f.state.output = Stream.make({ sequence: 0, stream: "stdout", text: "partial" }).pipe(
        Stream.concat(Stream.fromEffect(Deferred.await(failOutput).pipe(Effect.andThen(failure("output_failed"))))),
      )
      Object.assign(f.ports.process, {
        start: (input: Parameters<JavaBuild.Ports["process"]["start"]>[0]) =>
          start(input).pipe(
            Effect.map((process) => ({
              ...process,
              termination: process.termination.pipe(Effect.tap(() => open(exited))),
              cancelAndJoin: Effect.succeed({}),
            })),
          ),
      })
      const admitted = yield* owner.startBuild(f.request)
      yield* open(f.finish)
      yield* Deferred.await(exited)
      yield* Effect.yieldNow
      yield* open(failOutput)
      expect(yield* admitted.result).toMatchObject({
        status: "failed",
        exitCode: 5,
        logs: [{ sequence: 0, stream: "stdout", text: "partial" }],
      })
    }),
  ))

test("real internal Location.Service shape projects canonically without weakening strict public request decoding", async () => {
  await using tmp = await tmpdir()
  const f = await fixture(tmp.path)
  // Service.of is the real constructor; no boundNode/layer/Project runtime is started.
  const { Location } = await import("../../../src/location")
  const supplied = Location.Service.of({
    directory: f.project.canonicalRoot,
    workspaceID: undefined,
    project: f.project.location.project,
    vcs: { type: "git", store: f.project.canonicalRoot },
  })
  expect(Object.hasOwn(supplied, "workspaceID")).toBe(true)
  expect(supplied.workspaceID).toBeUndefined()
  f.state.authorized = { ...f.project, location: supplied }
  const request = { ...f.request, project: f.state.authorized }
  expect(() => Schema.decodeUnknownSync(FtcJava.BuildRequest, { onExcessProperty: "error" })(request)).toThrow()
  await run(
    Effect.gen(function* () {
      const java = yield* Java.Service
      yield* f.complete
      const evidence = yield* java.build(request)
      expect(evidence.status).toBe("succeeded")
      const record = yield* java.readBuild({ projectID: request.project.projectID, buildID: evidence.buildID })
      expect(record.state).toBe("settled")
      expect(f.state.seen[0].lease.basis.project.location).toEqual(f.project.location)
      expect("vcs" in f.state.seen[0].lease.basis.project.location).toBe(false)
      expect("workspaceID" in f.state.seen[0].lease.basis.project.location).toBe(false)
    }).pipe(
      Effect.provide(
        Java.layerWithBuilds({
          documents: {
            filesystem: documentFilesystem,
            projects: { resolve: () => Effect.succeed(f.state.authorized) },
          },
          builds: f.ports,
        }),
      ),
    ),
  )
})

test("internal location projection still rejects unknown request/project/location and malformed known fields", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const requests = [
        Object.assign({}, f.request, { execution: {} }),
        { ...f.request, project: Object.assign({}, f.project, { execution: {} }) },
        { ...f.request, project: { ...f.project, location: Object.assign({}, f.project.location, { execution: {} }) } },
        {
          ...f.request,
          project: { ...f.project, location: Object.assign({}, f.project.location, { workspaceID: "foreign" }) },
        },
        { ...f.request, project: { ...f.project, location: Object.assign({}, f.project.location, { vcs: "git" }) } },
        {
          ...f.request,
          project: {
            ...f.project,
            location: Object.assign({}, f.project.location, { vcs: { type: "git", store: 17 } }),
          },
        },
        { ...f.request, project: Object.assign({}, f.project, { canonicalRoot: 17 }) },
      ]
      for (const request of requests)
        expect((yield* owner.startBuild(request).pipe(Effect.flip)).code).toBe("invalid_build_input")
      expect(f.state.acquisitions).toBe(0)
      expect(f.state.starts).toBe(0)
    }),
  ))

test("trusted lease/validation location projection accepts only the documented internal optional representation", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const local = {
        directory: f.project.canonicalRoot,
        project: f.project.location.project,
        workspaceID: undefined,
        vcs: undefined,
      }
      f.state.basisMutation = (basis) => {
        Object.assign(basis, { project: { ...basis.project, location: local } })
      }
      f.state.validationMutation = (value) => {
        Object.assign(value, { project: { ...value.project, location: local } })
      }
      yield* f.complete
      expect((yield* owner.build(f.request)).status).toBe("succeeded")
      f.state.basisMutation = (basis) => {
        Object.assign(basis, { execution: {} })
      }
      expect((yield* owner.startBuild(f.request).pipe(Effect.flip)).code).toBe("lease_mismatch")
    }),
  ))
