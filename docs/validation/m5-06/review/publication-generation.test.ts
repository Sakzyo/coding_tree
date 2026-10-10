import { expect, test } from "bun:test"
import path from "node:path"
import { FtcJava } from "/Users/dylanxu/coding_tree/packages/schema/src/ftc-java"
import { FtcProject } from "/Users/dylanxu/coding_tree/packages/schema/src/ftc-project"
import { FtcEnvironment } from "/Users/dylanxu/coding_tree/packages/schema/src/ftc-environment"
import { Project } from "/Users/dylanxu/coding_tree/packages/schema/src/project"
import { Info } from "/Users/dylanxu/coding_tree/packages/schema/src/location"
import { AbsolutePath } from "/Users/dylanxu/coding_tree/packages/schema/src/schema"
import { Cause, Context, Deferred, Effect, Exit, Fiber, Layer, Scope, Stream } from "/Users/dylanxu/coding_tree/packages/core/node_modules/effect/dist/index.js"
import { JavaBuild } from "/Users/dylanxu/coding_tree/packages/core/src/ftc/java/build"
import { Java } from "/Users/dylanxu/coding_tree/packages/core/src/ftc/java"
import { tmpdir } from "/Users/dylanxu/coding_tree/packages/core/test/fixture/tmpdir"

const gate = () => Effect.runSync(Deferred.make<void>())
const open = (value: Deferred.Deferred<void>) => Deferred.succeed(value, undefined)
const run = <A, E>(effect: Effect.Effect<A, E, Scope.Scope>) => Effect.runPromise(Effect.scoped(effect))

async function fixture(root: string) {
  const project = FtcProject.ProjectContext.make({
    projectID: Project.ID.make(`project:${root}`),
    canonicalRoot: AbsolutePath.make(root),
    location: new Info({
      directory: AbsolutePath.make(root),
      project: { id: Project.ID.global, directory: AbsolutePath.make("/") },
    }),
  })
  const toolchain = FtcEnvironment.ToolchainDescriptor.make({
    profileID: "artifact-fixture",
    buildJdk: AbsolutePath.make("/fixture/jdk"),
    editorJdk: AbsolutePath.make("/fixture/editor"),
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
  await Bun.write(path.join(root, "Main.java"), "saved")
  await Bun.write(path.join(root, "owned.apk"), "abc")
  const state = {
    generation: "0",
    configurationRevision: "config-1",
    authorized: project,
    dirty: false,
    captures: 0,
    reads: 0,
    currents: 0,
    releases: 0,
    unobserved: false,
    missingBytes: false,
    wrongOutput: false,
    queryCleanups: 0,
    noOutput: false,
    exitCode: 0,
    processHeld: false,
    releasedLease: false,
    releasedProcess: false,
    capture: Effect.void as Effect.Effect<void, FtcJava.ArtifactError>,
    read: Effect.void as Effect.Effect<void, FtcJava.ArtifactError>,
    current: Effect.void as Effect.Effect<void, FtcJava.ArtifactError>,
    cleanup: Effect.void as Effect.Effect<void, FtcJava.ArtifactError>,
    queryCleanup: Effect.void,
    metadata: (ref: FtcJava.ArtifactRef) => ref,
  }
  const entered = {
    capture: gate(),
    read: gate(),
    current: gate(),
    cleanup: gate(),
    queryCleanup: gate(),
    process: gate(),
  }
  const finish = gate()
  const validation = () =>
    Effect.promise(async () => ({
      project: state.authorized,
      toolchain,
      sourceRevision: await Bun.file(path.join(root, "Main.java")).text(),
      configurationRevision: state.configurationRevision,
      generation: state.generation,
      exclusions: state.dirty ? [{ path: "Main.java" }] : [],
    }))
  const output = Object.freeze({})
  const executions = new WeakMap<object, object>()
  const ports = {
    projects: { resolve: () => Effect.succeed(state.authorized) },
    inputs: {
      acquire: () =>
        Effect.gen(function* () {
          const observed = yield* validation()
          const execution = Object.freeze({})
          const basis = {
            ...observed,
            scope: "complete" as const,
            mode: "immutable" as const,
            recipe: {
              identity: "fixed",
              wrapper: toolchain.gradleWrapper,
              buildJdk: toolchain.buildJdk,
              androidSdk: toolchain.androidSdk,
            },
          }
          state.releasedLease = false
          const release = Effect.sync(() => {
            state.releasedLease = true
          }).pipe(Effect.andThen(validation()))
          yield* Effect.addFinalizer(() => release.pipe(Effect.asVoid))
          return {
            basis,
            execution,
            revalidate: () => (state.releasedLease ? Effect.die("released lease reused") : validation()),
            release: state.unobserved ? Effect.fail({ code: "cleanup_failed" as const }) : release,
          }
        }),
    },
    process: {
      start: (input: { lease: JavaBuild.SavedInputLease }) =>
        Effect.gen(function* () {
          executions.set(output, input.lease.execution)
          state.releasedProcess = false
          const release = Effect.sync(() => {
            state.releasedProcess = true
          })
          yield* Effect.addFinalizer(() => release)
          yield* open(entered.process)
          return {
            apk: state.wrongOutput ? Object.freeze({}) : output,
            output: Stream.empty,
            termination: (state.processHeld ? Deferred.await(finish) : Effect.void).pipe(
              Effect.as({ exitCode: state.exitCode }),
            ),
            cancelAndJoin: open(finish).pipe(Effect.as({ signal: "cancelled" })),
            release,
          }
        }),
    },
    artifacts: {
      capture: (input: {
        buildID: FtcJava.BuildID
        basis: JavaBuild.SavedInputBasis
        execution: object
        output?: object
      }) =>
        Effect.gen(function* () {
          state.captures++
          if (state.releasedLease || state.releasedProcess || executions.get(input.output!) !== input.execution)
            return yield* Effect.fail({ code: "artifact_provenance" as const })
          const closed = { value: false }
          const release = Effect.gen(function* () {
            if (closed.value) return
            closed.value = true
            yield* open(entered.cleanup)
            yield* state.cleanup
            state.releases++
          })
          yield* Effect.addFinalizer(() => release.pipe(Effect.orDie))
          yield* open(entered.capture)
          yield* state.capture
          if (state.noOutput) return undefined
          const ref = state.metadata({
            buildID: input.buildID,
            projectID: input.basis.project.projectID,
            sourceRevision: input.basis.sourceRevision,
            configurationRevision: input.basis.configurationRevision,
            path: AbsolutePath.make(path.join(root, "owned.apk")),
            digest: "",
          })
          const metadata = {
            buildID: ref.buildID,
            projectID: ref.projectID,
            sourceRevision: ref.sourceRevision,
            configurationRevision: ref.configurationRevision,
            path: ref.path,
          }
          return {
            metadata,
            read: () =>
              Effect.gen(function* () {
                state.reads++
                yield* Effect.addFinalizer(() =>
                  open(entered.queryCleanup).pipe(
                    Effect.andThen(state.queryCleanup),
                    Effect.andThen(
                      Effect.sync(() => {
                        state.queryCleanups++
                      }),
                    ),
                  ),
                )
                yield* open(entered.read)
                yield* state.read
                return state.missingBytes
                  ? undefined
                  : yield* Effect.promise(() => Bun.file(path.join(root, "owned.apk")).bytes())
              }),
            release,
          }
        }),
      current: (input: { basis: JavaBuild.SavedInputBasis }) =>
        Effect.gen(function* () {
          state.currents++
          yield* Effect.addFinalizer(() =>
            open(entered.queryCleanup).pipe(
              Effect.andThen(state.queryCleanup),
              Effect.andThen(
                Effect.sync(() => {
                  state.queryCleanups++
                }),
              ),
            ),
          )
          expect(input.basis.generation).toBe("0")
          yield* open(entered.current)
          yield* state.current
          return yield* validation()
        }),
    },
  }
  return {
    project,
    toolchain,
    ports,
    state,
    entered,
    finish,
    request: { project, toolchain, configurationRevision: "config-1" },
    write: (text: string) =>
      Effect.promise(async () => {
        await Bun.write(path.join(root, "Main.java"), text)
        state.generation = String(Number(state.generation) + 1)
      }),
  }
}
async function isolated<A, E>(
  body: (owner: JavaBuild.Interface, f: Awaited<ReturnType<typeof fixture>>) => Effect.Effect<A, E, Scope.Scope>,
) {
  await using tmp = await tmpdir()
  const f = await fixture(tmp.path)
  return await run(
    Effect.gen(function* () {
      const owner = yield* JavaBuild.make(f.ports)
      return yield* body(owner, f)
    }),
  )
}


for (const operation of ["artifact", "verify"] as const)
  test(`publication observes generation changes during held cleanup: ${operation}`, () =>
    isolated((owner, f) =>
      Effect.gen(function* () {
        const evidence = yield* owner.build(f.request)
        const ref = operation === "verify" ? (yield* owner.artifact({buildID: evidence.buildID}))! : undefined
        f.entered.queryCleanup = gate()
        const held = gate()
        f.state.queryCleanup = Deferred.await(held)
        const pending = yield* (ref ? owner.verifyArtifact({ref, currentProject: f.project}) : owner.artifact({buildID: evidence.buildID})).pipe(Effect.exit, Effect.forkScoped)
        yield* Deferred.await(f.entered.queryCleanup)
        f.state.generation = "1"
        yield* open(held)
        const result = yield* Fiber.join(pending)
        console.log(operation, JSON.stringify(result))
        if (operation === "artifact") expect(Exit.isFailure(result)).toBe(true)
        if (operation === "verify") expect(Exit.isSuccess(result) && result.value?.valid === false).toBe(true)
      }),
    ), 2000)
