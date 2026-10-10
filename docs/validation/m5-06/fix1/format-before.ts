import { expect, test } from "bun:test"
import path from "node:path"
import { readFileSync } from "node:fs"
import { FtcJava } from "@opencode-ai/schema/ftc-java"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { FtcEnvironment } from "@opencode-ai/schema/ftc-environment"
import { Project } from "@opencode-ai/schema/project"
import { Info } from "@opencode-ai/schema/location"
import { AbsolutePath } from "@opencode-ai/schema/schema"
import { Cause, Context, Deferred, Effect, Exit, Fiber, Layer, Scope, Stream } from "effect"
import { JavaBuild } from "../../../src/ftc/java/build"
import { Java } from "../../../src/ftc/java"
import { tmpdir } from "../../fixture/tmpdir"

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
    readCleanup: Effect.void,
    currentCleanup: Effect.void,
    authorizationHeld: false,
    authorization: Effect.void,
    contentProof: true,
    currentProof: true,
    confirmationDefect: false,
    metadata: (ref: FtcJava.ArtifactRef) => ref,
  }
  const entered = {
    capture: gate(),
    read: gate(),
    current: gate(),
    cleanup: gate(),
    queryCleanup: gate(),
    process: gate(),
    readCleanup: gate(),
    currentCleanup: gate(),
    authorization: gate(),
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
  // Fixture-only synchronous authority: its declared inventory and writes are serialized.
  // This is not a protected production filesystem/input continuity adapter.
  const confirmValidation = () => ({
    project: state.authorized,
    toolchain,
    sourceRevision: readFileSync(path.join(root, "Main.java"), "utf8"),
    configurationRevision: state.configurationRevision,
    generation: state.generation,
    exclusions: state.dirty ? [{ path: "Main.java" }] : [],
  })
  const output = Object.freeze({})
  const executions = new WeakMap<object, object>()
  const ports = {
    projects: {
      resolve: () =>
        Effect.gen(function* () {
          if (state.authorizationHeld) {
            yield* open(entered.authorization)
            yield* state.authorization
          }
          return state.authorized
        }),
    },
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
                    Effect.andThen(open(entered.readCleanup)),
                    Effect.andThen(state.readCleanup),
                    Effect.andThen(
                      Effect.sync(() => {
                        state.queryCleanups++
                      }),
                    ),
                  ),
                )
                yield* open(entered.read)
                yield* state.read
                const bytes = state.missingBytes
                  ? undefined
                  : yield* Effect.promise(() => Bun.file(path.join(root, "owned.apk")).bytes())
                return {
                  bytes,
                  confirm: () => {
                    if (state.confirmationDefect) throw new Error("confirmation defect")
                    return state.contentProof
                      ? !state.missingBytes &&
                          bytes !== undefined &&
                          readFileSync(path.join(root, "owned.apk")).equals(bytes)
                      : undefined
                  },
                }
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
              Effect.andThen(open(entered.currentCleanup)),
              Effect.andThen(state.currentCleanup),
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
          return {
            validation: yield* validation(),
            confirm: () => (state.currentProof ? confirmValidation() : undefined),
          }
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

// A successful real owner must capture while its process and execution lease are live.
// This callable build boundary is behavioral RED even before artifact methods exist.
test("successful build provisionally captures its exact live output before retirement", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const evidence = yield* owner.build(f.request)
      expect(evidence.status).toBe("succeeded")
      expect(f.state.captures).toBe(1)
      expect(f.state.releasedLease).toBe(true)
      expect(f.state.releasedProcess).toBe(true)
    }),
  ))

const abcDigest = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"

// Removing the protected digest or generation comparison allows tampered/stale authorization.
test("failed or changed artifacts cannot authorize deployment", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      f.state.exitCode = 1
      const failed = yield* owner.build(f.request)
      const failedArtifact = yield* owner.artifact({ buildID: failed.buildID })
      expect(failedArtifact).toBeUndefined()
      f.state.exitCode = 0
      const evidence = yield* owner.build(f.request)
      const ref = (yield* owner.artifact({ buildID: evidence.buildID }))!
      expect(ref).toEqual({
        buildID: evidence.buildID,
        projectID: f.project.projectID,
        sourceRevision: "saved",
        configurationRevision: "config-1",
        digest: abcDigest,
        path: AbsolutePath.make(path.join(f.project.canonicalRoot, "owned.apk")),
      })
      expect(Object.isFrozen(ref)).toBe(true)
      yield* Effect.promise(() => Bun.write(ref.path, "changed"))
      const tampered = yield* owner.verifyArtifact({ ref, currentProject: f.project })
      expect(tampered.valid).toBe(false)
      yield* Effect.promise(() => Bun.write(ref.path, "abc"))
      const second = yield* owner.build(f.request)
      const secondRef = (yield* owner.artifact({ buildID: second.buildID }))!
      f.state.generation = "2"
      const stale = yield* owner.verifyArtifact({ ref: secondRef, currentProject: f.project })
      expect(stale.valid).toBe(false)
      expect((yield* owner.artifact({ buildID: evidence.buildID }).pipe(Effect.flip)).code).toBe("artifact_invalid")
      expect(ref.digest).toBe(abcDigest)
    }),
  ))

test("identical bytes bind distinct builds and repeat queries freshly read and observe current", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const first = yield* owner.build(f.request)
      const second = yield* owner.build(f.request)
      const a = (yield* owner.artifact({ buildID: first.buildID }))!
      const b = (yield* owner.artifact({ buildID: second.buildID }))!
      expect(a.buildID).not.toBe(b.buildID)
      expect(a.digest).toBe(b.digest)
      expect(yield* owner.artifact({ buildID: first.buildID })).toBe(a)
      expect(yield* owner.verifyArtifact({ ref: a, currentProject: f.project })).toEqual({ valid: true })
      expect(f.state.reads).toBe(4)
      expect(f.state.currents).toBe(4)
    }),
  ))

for (const kind of ["source", "configuration", "generation", "dirty"] as const)
  test(`current ${kind} changes permanently invalidate historical identity`, () =>
    isolated((owner, f) =>
      Effect.gen(function* () {
        const evidence = yield* owner.build(f.request)
        const ref = (yield* owner.artifact({ buildID: evidence.buildID }))!
        if (kind === "source") yield* f.write("changed")
        if (kind === "configuration") f.state.configurationRevision = "config-2"
        if (kind === "generation") f.state.generation = "2"
        if (kind === "dirty") f.state.dirty = true
        expect((yield* owner.verifyArtifact({ ref, currentProject: f.project })).valid).toBe(false)
        yield* f.write("saved")
        f.state.configurationRevision = "config-1"
        f.state.generation = "0"
        f.state.dirty = false
        expect((yield* owner.artifact({ buildID: evidence.buildID }).pipe(Effect.flip)).code).toBe("artifact_invalid")
        expect((yield* owner.verifyArtifact({ ref, currentProject: f.project })).valid).toBe(false)
      }),
    ))

for (const kind of ["dirty", "outdated", "cancelled", "no-output", "unobserved"] as const)
  test(`known ${kind} builds do not issue references`, () =>
    isolated((owner, f) =>
      Effect.gen(function* () {
        if (kind === "dirty") f.state.dirty = true
        if (kind === "no-output") f.state.noOutput = true
        if (kind === "outdated" || kind === "cancelled") f.state.processHeld = true
        if (kind === "unobserved") f.state.unobserved = true
        const admitted = yield* owner.startBuild(f.request)
        if (kind === "outdated") {
          yield* Deferred.await(f.entered.process)
          f.state.generation = "1"
          yield* open(f.finish)
        }
        if (kind === "cancelled") yield* admitted.cancel
        const evidence = yield* admitted.result
        expect(yield* owner.artifact({ buildID: evidence.buildID })).toBeUndefined()
        if (kind === "dirty" || kind === "no-output") expect(evidence.status).toBe("succeeded")
        if (kind === "dirty" || kind === "unobserved") expect(f.state.releases).toBe(1)
      }),
    ))

for (const field of ["buildID", "projectID", "sourceRevision", "configurationRevision", "digest", "path"] as const)
  test(`forged ${field} never reads a caller locator`, () =>
    isolated((owner, f) =>
      Effect.gen(function* () {
        const evidence = yield* owner.build(f.request)
        const ref = (yield* owner.artifact({ buildID: evidence.buildID }))!
        const forged = {
          ...ref,
          [field]:
            field === "digest"
              ? "f".repeat(64)
              : field === "path"
                ? "/caller/forged.apk"
                : field === "projectID"
                  ? Project.ID.make("foreign")
                  : field === "buildID"
                    ? FtcJava.BuildID.create()
                    : "foreign",
        }
        expect(yield* owner.verifyArtifact({ ref: forged, currentProject: f.project })).toEqual({
          valid: false,
          reason: field === "buildID" ? "unknown" : "identity",
        })
        expect(f.state.reads).toBe(1)
      }),
    ))

test("unknown and fresh owners cannot adopt references; running and unissued claims stay absent", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const unknown = FtcJava.BuildID.create()
      expect((yield* owner.artifact({ buildID: unknown }).pipe(Effect.flip)).code).toBe("artifact_unknown")
      f.state.processHeld = true
      const admitted = yield* owner.startBuild(f.request)
      expect(yield* owner.artifact({ buildID: admitted.buildID })).toBeUndefined()
      yield* open(f.finish)
      yield* admitted.result
      const claim = {
        buildID: admitted.buildID,
        projectID: f.project.projectID,
        sourceRevision: "saved",
        configurationRevision: "config-1",
        digest: abcDigest,
        path: AbsolutePath.make("/claim.apk"),
      }
      expect(yield* owner.verifyArtifact({ ref: claim, currentProject: f.project })).toEqual({
        valid: false,
        reason: "unknown",
      })
      const ref = (yield* owner.artifact({ buildID: admitted.buildID }))!
      const fresh = yield* JavaBuild.make(f.ports)
      expect(yield* fresh.verifyArtifact({ ref, currentProject: f.project })).toEqual({
        valid: false,
        reason: "unknown",
      })
      expect(f.state.reads).toBe(1)
    }),
  ))

for (const kind of ["capture", "read", "current"] as const)
  test(`${kind} infrastructure failure remains typed and compilation remains truthful`, () =>
    isolated((owner, f) =>
      Effect.gen(function* () {
        const codes = {
          capture: "artifact_capture_failed",
          read: "artifact_read_failed",
          current: "artifact_current_failed",
        } as const
        f.state[kind] = Effect.fail({ code: codes[kind] })
        const evidence = yield* owner.build(f.request)
        expect(evidence.status).toBe("succeeded")
        expect(evidence.errors).toEqual([])
        expect((yield* owner.artifact({ buildID: evidence.buildID }).pipe(Effect.flip)).code).toBe(codes[kind])
      }),
    ))

test("capture metadata mismatch is provenance failure, never an empty APK", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      f.state.metadata = (ref) => ({ ...ref, sourceRevision: "other" })
      const evidence = yield* owner.build(f.request)
      expect(evidence.status).toBe("succeeded")
      expect((yield* owner.artifact({ buildID: evidence.buildID }).pipe(Effect.flip)).code).toBe("artifact_provenance")
      expect(f.state.reads).toBe(0)
      expect(f.state.releases).toBe(1)
    }),
  ))

test("missing retained bytes invalidate an issued artifact", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const evidence = yield* owner.build(f.request)
      const ref = (yield* owner.artifact({ buildID: evidence.buildID }))!
      f.state.missingBytes = true
      expect(yield* owner.verifyArtifact({ ref, currentProject: f.project })).toEqual({
        valid: false,
        reason: "content",
      })
    }),
  ))

test("authorization failures and invalid input remain errors before protected reads", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const evidence = yield* owner.build(f.request)
      const ref = (yield* owner.artifact({ buildID: evidence.buildID }))!
      f.state.authorized = { ...f.project, canonicalRoot: AbsolutePath.make("/foreign") }
      expect((yield* owner.verifyArtifact({ ref, currentProject: f.project }).pipe(Effect.flip)).code).toBe(
        "project_unauthorized",
      )
      expect(f.state.reads).toBe(1)
      expect(
        (yield* owner.artifact(Object.assign({ buildID: evidence.buildID }, { path: "/caller" })).pipe(Effect.flip))
          .code,
      ).toBe("invalid_artifact_input")
    }),
  ))

test("old build ports and document-only facade report typed artifact unavailability without work", async () => {
  await using tmp = await tmpdir()
  const f = await fixture(tmp.path)
  await run(
    Effect.gen(function* () {
      const owner = yield* JavaBuild.make({
        projects: f.ports.projects,
        inputs: f.ports.inputs,
        process: f.ports.process,
      })
      const evidence = yield* owner.build(f.request)
      expect((yield* owner.artifact({ buildID: evidence.buildID }).pipe(Effect.flip)).code).toBe("artifact_unavailable")
      const java = yield* Java.Service
      expect((yield* java.artifact({ buildID: evidence.buildID }).pipe(Effect.flip)).code).toBe("artifact_unavailable")
      expect(f.state.captures).toBe(0)
    }).pipe(
      Effect.provide(
        Java.layer({
          projects: { resolve: () => Effect.succeed(f.project) },
          filesystem: { realpath: (value) => Effect.succeed(value), readText: () => Effect.succeed("saved") },
        }),
      ),
    ),
  )
})

const documents = (f: Awaited<ReturnType<typeof fixture>>) => ({
  projects: { resolve: () => Effect.succeed(f.project) },
  filesystem: { realpath: (value: string) => Effect.succeed(value), readText: () => Effect.succeed("saved") },
})

for (const phase of ["capture", "read", "current"] as const)
  for (const facade of [false, true])
    test(`${facade ? "Java facade" : "JavaBuild"} public Scope closure joins held ${phase} cleanup and prevents late publication`, async () => {
      await using tmp = await tmpdir()
      const f = await fixture(tmp.path)
      await Effect.runPromise(
        Effect.gen(function* () {
          const scope = yield* Scope.make()
          const held = gate()
          const owner = facade
            ? Context.get(
                yield* Layer.build(Java.layerWithBuilds({ documents: documents(f), builds: f.ports })).pipe(
                  Scope.provide(scope),
                ),
                Java.Service,
              )
            : yield* JavaBuild.make(f.ports).pipe(Scope.provide(scope))
          f.state[phase] = Effect.never
          if (phase === "capture") f.state.cleanup = Deferred.await(held)
          if (phase !== "capture") f.state.queryCleanup = Deferred.await(held)
          const pending = yield* (
            phase === "capture"
              ? owner.build(f.request)
              : Effect.gen(function* () {
                  const evidence = yield* owner.build(f.request)
                  return yield* owner.artifact({ buildID: evidence.buildID })
                })
          ).pipe(Effect.forkChild)
          yield* Deferred.await(f.entered[phase])
          const closing = yield* Scope.close(scope, Exit.void).pipe(Effect.forkChild)
          yield* Deferred.await(phase === "capture" ? f.entered.cleanup : f.entered.queryCleanup)
          expect(closing.pollUnsafe()).toBeUndefined()
          yield* open(held)
          yield* Fiber.join(closing)
          const exit = yield* Fiber.await(pending)
          if (phase !== "capture") expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true)
          expect(f.state.releases).toBe(1)
          expect(f.state.releasedLease).toBe(true)
          expect(f.state.releasedProcess).toBe(true)
          expect((yield* owner.artifact({ buildID: FtcJava.BuildID.create() }).pipe(Effect.flip)).code).toBe(
            "owner_closed",
          )
        }),
      )
    }, 2000)

for (const phase of ["capture", "read", "current"] as const)
  test(
    `caller interruption joins held ${phase} cleanup`,
    () =>
      isolated((owner, f) =>
        Effect.gen(function* () {
          const held = gate()
          f.state[phase] = Effect.never
          if (phase === "capture") f.state.cleanup = Deferred.await(held)
          if (phase !== "capture") f.state.queryCleanup = Deferred.await(held)
          const pending = yield* (
            phase === "capture"
              ? owner.build(f.request)
              : Effect.gen(function* () {
                  const evidence = yield* owner.build(f.request)
                  return yield* owner.artifact({ buildID: evidence.buildID })
                })
          ).pipe(Effect.forkScoped)
          yield* Deferred.await(f.entered[phase])
          pending.interruptUnsafe()
          yield* Deferred.await(phase === "capture" ? f.entered.cleanup : f.entered.queryCleanup)
          expect(pending.pollUnsafe()).toBeUndefined()
          yield* open(held)
          const exit = yield* Fiber.await(pending)
          expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true)
          if (phase === "capture") expect(f.state.releases).toBe(1)
        }),
      ),
    2000,
  )

test("an output from another execution fails capture provenance", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      f.state.wrongOutput = true
      const evidence = yield* owner.build(f.request)
      expect(evidence.status).toBe("succeeded")
      expect((yield* owner.artifact({ buildID: evidence.buildID }).pipe(Effect.flip)).code).toBe("artifact_provenance")
    }),
  ))

test("revoked authority while current is held prevents artifact publication", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const evidence = yield* owner.build(f.request)
      const held = gate()
      f.state.current = Deferred.await(held)
      const pending = yield* owner.artifact({ buildID: evidence.buildID }).pipe(Effect.forkScoped)
      yield* Deferred.await(f.entered.current)
      f.state.authorized = { ...f.project, canonicalRoot: AbsolutePath.make("/foreign") }
      yield* open(held)
      expect((yield* Fiber.join(pending).pipe(Effect.flip)).code).toBe("artifact_current_failed")
    }),
  ))

test(
  "cancellation accepted during provisional retention discard wins terminal publication",
  () =>
    isolated((owner, f) =>
      Effect.gen(function* () {
        f.state.dirty = true
        const held = gate()
        f.state.cleanup = Deferred.await(held)
        const admitted = yield* owner.startBuild(f.request)
        yield* Deferred.await(f.entered.cleanup)
        const cancelling = yield* admitted.cancel.pipe(Effect.forkScoped)
        yield* Effect.yieldNow
        expect(cancelling.pollUnsafe()).toBeUndefined()
        yield* open(held)
        expect((yield* Fiber.join(cancelling)).status).toBe("cancelled")
        expect(f.state.releases).toBe(1)
      }),
    ),
  2000,
)

for (const target of ["capture", "current"] as const)
  test(`malformed ${target} observations remain typed failures`, async () => {
    await using tmp = await tmpdir()
    const f = await fixture(tmp.path)
    Object.assign(f.ports.artifacts, { [target]: () => Effect.succeed(null) })
    await run(
      Effect.gen(function* () {
        const owner = yield* JavaBuild.make(f.ports)
        const evidence = yield* owner.build(f.request)
        expect(evidence.status).toBe("succeeded")
        expect((yield* owner.artifact({ buildID: evidence.buildID }).pipe(Effect.flip)).code).toBe(
          target === "capture" ? "artifact_provenance" : "artifact_current_failed",
        )
      }),
    )
  })

// Decoding must capture callers before the asynchronous authorization boundary.
test("mutable verification requests cannot change their identity while authority is held", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const evidence = yield* owner.build(f.request)
      const ref = (yield* owner.artifact({ buildID: evidence.buildID }))!
      f.entered.read = gate()
      const input = { ref: { ...ref }, currentProject: f.project }
      const held = gate()
      f.state.read = Deferred.await(held)
      const pending = yield* owner.verifyArtifact(input).pipe(Effect.forkScoped)
      yield* Deferred.await(f.entered.read)
      input.ref.path = AbsolutePath.make("/caller/changed.apk")
      yield* open(held)
      expect(yield* Fiber.join(pending)).toEqual({ valid: true })
    }),
  ))

test("Java facade reexports exact canonical artifact schema identities", () => {
  for (const name of [
    "ArtifactRef",
    "ArtifactQuery",
    "ArtifactVerificationRequest",
    "ArtifactVerificationResult",
    "ArtifactError",
  ] as const)
    expect(Java[name]).toBe(FtcJava[name])
})

for (const phase of ["capture", "read", "current"] as const)
  test(`${phase} port defects stay defects`, () =>
    isolated((owner, f) =>
      Effect.gen(function* () {
        f.state[phase] = Effect.die("owned adapter defect")
        const evidence = yield* owner.build(f.request)
        expect(evidence.status).toBe("succeeded")
        const exit = yield* owner.artifact({ buildID: evidence.buildID }).pipe(Effect.exit)
        expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true)
      }),
    ))

test("foreign current toolchain is a failure rather than proven source change", async () => {
  await using tmp = await tmpdir()
  const f = await fixture(tmp.path)
  Object.assign(f.ports.artifacts, {
    current: () =>
      Effect.succeed({
        validation: {
          project: f.project,
          toolchain: { ...f.toolchain, profileID: "foreign" },
          sourceRevision: "saved",
          configurationRevision: "config-1",
          generation: "0",
          exclusions: [],
        },
        confirm: () => undefined,
      }),
  })
  await run(
    Effect.gen(function* () {
      const owner = yield* JavaBuild.make(f.ports)
      const evidence = yield* owner.build(f.request)
      expect((yield* owner.artifact({ buildID: evidence.buildID }).pipe(Effect.flip)).code).toBe(
        "artifact_current_failed",
      )
    }),
  )
})

test("real saved A-B-A after lease retirement invalidates the original generation", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const evidence = yield* owner.build(f.request)
      const ref = (yield* owner.artifact({ buildID: evidence.buildID }))!
      yield* f.write("B")
      yield* f.write("saved")
      expect(yield* owner.verifyArtifact({ ref, currentProject: f.project })).toEqual({ valid: false, reason: "stale" })
      expect(f.state.releasedLease).toBe(true)
    }),
  ))

test("unsupported generation continuity remains a typed failure", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const evidence = yield* owner.build(f.request)
      const ref = (yield* owner.artifact({ buildID: evidence.buildID }))!
      f.state.current = Effect.fail({ code: "artifact_current_failed" })
      expect((yield* owner.verifyArtifact({ ref, currentProject: f.project }).pipe(Effect.flip)).code).toBe(
        "artifact_current_failed",
      )
    }),
  ))

test("discard cleanup failure preserves ineligible saved-compilation evidence", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      f.state.dirty = true
      f.state.cleanup = Effect.fail({ code: "artifact_cleanup_failed" })
      const evidence = yield* owner.build(f.request)
      expect(evidence.status).toBe("succeeded")
      expect(evidence.errors).toEqual([])
      expect(yield* owner.artifact({ buildID: evidence.buildID })).toBeUndefined()
    }),
  ))

test("null verification request is a typed invalid-input failure", () =>
  isolated((owner) =>
    Effect.gen(function* () {
      // @ts-expect-error Untrusted null must fail at the runtime owner boundary.
      const invalid = owner.verifyArtifact(null)
      expect((yield* invalid.pipe(Effect.flip)).code).toBe("invalid_artifact_input")
    }),
  ))

test(
  "an interrupted query cannot issue an identity before joined query cleanup",
  () =>
    isolated((owner, f) =>
      Effect.gen(function* () {
        const evidence = yield* owner.build(f.request)
        const held = gate()
        f.state.queryCleanup = Deferred.await(held)
        const pending = yield* owner.artifact({ buildID: evidence.buildID }).pipe(Effect.forkScoped)
        yield* Deferred.await(f.entered.queryCleanup)
        pending.interruptUnsafe()
        yield* open(held)
        const exit = yield* Fiber.await(pending)
        expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true)
        f.state.queryCleanup = Effect.void
        const claim = {
          buildID: evidence.buildID,
          projectID: f.project.projectID,
          sourceRevision: "saved",
          configurationRevision: "config-1",
          digest: abcDigest,
          path: AbsolutePath.make(path.join(f.project.canonicalRoot, "owned.apk")),
        }
        expect(yield* owner.verifyArtifact({ ref: claim, currentProject: f.project })).toEqual({
          valid: false,
          reason: "unknown",
        })
      }),
    ),
  2000,
)

test("cancelled provisional capture leaves no artifact without storing interruption as query failure", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      f.state.capture = Effect.never
      const admitted = yield* owner.startBuild(f.request)
      yield* Deferred.await(f.entered.capture)
      expect((yield* admitted.cancel).status).toBe("cancelled")
      expect(yield* owner.artifact({ buildID: admitted.buildID })).toBeUndefined()
      expect(f.state.releases).toBe(1)
    }),
  ))

test("eligible capture cleanup failure remains a typed artifact failure", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      f.state.capture = Effect.fail({ code: "artifact_cleanup_failed" })
      const evidence = yield* owner.build(f.request)
      expect(evidence.status).toBe("succeeded")
      expect((yield* owner.artifact({ buildID: evidence.buildID }).pipe(Effect.flip)).code).toBe(
        "artifact_cleanup_failed",
      )
    }),
  ))

// Exact independent reviewer scenarios/assertions, with the existing trusted fixture.
for (const operation of ["artifact", "verify"] as const)
  test(
    `publication observes generation changes during held cleanup: ${operation}`,
    () =>
      isolated((owner, f) =>
        Effect.gen(function* () {
          const evidence = yield* owner.build(f.request)
          const ref = operation === "verify" ? (yield* owner.artifact({ buildID: evidence.buildID }))! : undefined
          f.entered.queryCleanup = gate()
          const held = gate()
          f.state.queryCleanup = Deferred.await(held)
          const pending = yield* (
            ref
              ? owner.verifyArtifact({ ref, currentProject: f.project })
              : owner.artifact({ buildID: evidence.buildID }).pipe(Effect.map(() => undefined))
          ).pipe(Effect.exit, Effect.forkScoped)
          yield* Deferred.await(f.entered.queryCleanup)
          f.state.generation = "1"
          yield* open(held)
          const result = yield* Fiber.join(pending)
          if (operation === "artifact") {
            expect(Exit.isFailure(result)).toBe(true)
            if (Exit.isFailure(result))
              expect(result.cause.reasons.filter(Cause.isFailReason).map((reason) => reason.error)).toEqual([
                { code: "artifact_invalid" },
              ])
          }
          if (operation === "verify") {
            expect(Exit.isSuccess(result) && result.value?.valid === false).toBe(true)
            if (Exit.isSuccess(result)) expect(result.value?.reason).toBe("stale")
          }
        }),
      ),
    2000,
  )

for (const phase of ["current", "queryCleanup"] as const)
  test(
    `verification observes protected content changes during held ${phase}`,
    () =>
      isolated((owner, f) =>
        Effect.gen(function* () {
          const evidence = yield* owner.build(f.request)
          const ref = (yield* owner.artifact({ buildID: evidence.buildID }))!
          f.entered[phase] = gate()
          const held = gate()
          f.state[phase] = Deferred.await(held)
          const pending = yield* owner.verifyArtifact({ ref, currentProject: f.project }).pipe(Effect.forkScoped)
          yield* Deferred.await(f.entered[phase])
          yield* Effect.promise(() => Bun.write(path.join(f.project.canonicalRoot, "owned.apk"), "changed"))
          yield* open(held)
          const result = yield* Fiber.join(pending)
          expect(result.valid).toBe(false)
          expect(result.reason).toBe("content")
        }),
      ),
    2000,
  )

for (const operation of ["artifact", "verify"] as const)
  for (const phase of ["readCleanup", "currentCleanup", "authorization"] as const)
    for (const change of ["source", "configuration", "generation", "dirty", "content"] as const)
      test(
        `${operation} rejects ${change} change during final ${phase}`,
        () =>
          isolated((owner, f) =>
            Effect.gen(function* () {
              const evidence = yield* owner.build(f.request)
              const ref = operation === "verify" ? (yield* owner.artifact({ buildID: evidence.buildID }))! : undefined
              f.entered[phase] = gate()
              const held = gate()
              if (phase !== "authorization") f.state[phase] = Deferred.await(held)
              if (phase === "authorization") {
                f.state.authorization = Deferred.await(held)
                f.state.queryCleanup = Effect.sync(() => {
                  f.state.authorizationHeld = true
                })
              }
              const pending = yield* (
                ref
                  ? owner.verifyArtifact({ ref, currentProject: f.project })
                  : owner.artifact({ buildID: evidence.buildID }).pipe(Effect.map(() => undefined))
              ).pipe(Effect.exit, Effect.forkScoped)
              yield* Deferred.await(f.entered[phase])
              if (change === "source") yield* f.write("changed")
              if (change === "configuration") f.state.configurationRevision = "config-2"
              if (change === "generation") f.state.generation = "1"
              if (change === "dirty") f.state.dirty = true
              if (change === "content")
                yield* Effect.promise(() => Bun.write(path.join(f.project.canonicalRoot, "owned.apk"), "changed"))
              yield* open(held)
              const result = yield* Fiber.join(pending)
              if (operation === "artifact") {
                expect(Exit.isFailure(result)).toBe(true)
                if (Exit.isFailure(result))
                  expect(result.cause.reasons.filter(Cause.isFailReason).map((reason) => reason.error)).toEqual([
                    { code: "artifact_invalid" },
                  ])
              }
              if (operation === "verify") {
                expect(Exit.isSuccess(result) && result.value?.valid === false).toBe(true)
                if (Exit.isSuccess(result))
                  expect(result.value?.reason).toBe(
                    change === "content" ? "content" : change === "dirty" ? "dirty" : "stale",
                  )
              }
            }),
          ),
        2000,
      )

for (const proof of ["contentProof", "currentProof"] as const)
  for (const operation of ["artifact", "verify"] as const)
    test(`${operation} cannot publish when ${proof} is unavailable`, () =>
      isolated((owner, f) =>
        Effect.gen(function* () {
          const evidence = yield* owner.build(f.request)
          const ref = operation === "verify" ? (yield* owner.artifact({ buildID: evidence.buildID }))! : undefined
          f.state[proof] = false
          const error = yield* (
            ref
              ? owner.verifyArtifact({ ref, currentProject: f.project })
              : owner.artifact({ buildID: evidence.buildID }).pipe(Effect.map(() => undefined))
          ).pipe(Effect.flip)
          expect(error.code).toBe("artifact_unavailable")
          if (!ref) {
            f.state[proof] = true
            const claim = {
              buildID: evidence.buildID,
              projectID: f.project.projectID,
              sourceRevision: "saved",
              configurationRevision: "config-1",
              digest: abcDigest,
              path: AbsolutePath.make(path.join(f.project.canonicalRoot, "owned.apk")),
            }
            expect(yield* owner.verifyArtifact({ ref: claim, currentProject: f.project })).toEqual({
              valid: false,
              reason: "unknown",
            })
          }
        }),
      ))

test("confirmation defects remain observable rather than established invalidity", () =>
  isolated((owner, f) =>
    Effect.gen(function* () {
      const evidence = yield* owner.build(f.request)
      f.state.confirmationDefect = true
      const exit = yield* owner.artifact({ buildID: evidence.buildID }).pipe(Effect.exit)
      expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true)
    }),
  ))

for (const malformed of [
  "missing-current-handle",
  "missing-byte-handle",
  "async-current",
  "async-content",
  "bad-content",
  "bad-current",
] as const)
  test(`malformed confirmation fails typed: ${malformed}`, async () => {
    await using tmp = await tmpdir()
    const f = await fixture(tmp.path)
    if (malformed.includes("current")) {
      const current = f.ports.artifacts.current
      Object.assign(f.ports.artifacts, {
        current: (input: Parameters<typeof current>[0]) =>
          current(input).pipe(
            Effect.map((observation) => ({
              ...observation,
              confirm:
                malformed === "missing-current-handle"
                  ? undefined
                  : malformed === "async-current"
                    ? () => Promise.resolve(observation.validation)
                    : () => ({ ...observation.validation, generation: 7 }),
            })),
          ),
      })
    }
    if (!malformed.includes("current")) {
      const capture = f.ports.artifacts.capture
      Object.assign(f.ports.artifacts, {
        capture: (input: Parameters<typeof capture>[0]) =>
          capture(input).pipe(
            Effect.map(
              (retained) =>
                retained && {
                  ...retained,
                  read: () =>
                    retained
                      .read()
                      .pipe(
                        Effect.map((observation) => ({
                          ...observation,
                          confirm:
                            malformed === "missing-byte-handle"
                              ? undefined
                              : malformed === "async-content"
                                ? () => Promise.resolve(true)
                                : () => "true",
                        })),
                      ),
                },
            ),
          ),
      })
    }
    await run(
      Effect.gen(function* () {
        const owner = yield* JavaBuild.make(f.ports)
        const evidence = yield* owner.build(f.request)
        const error = yield* owner.artifact({ buildID: evidence.buildID }).pipe(Effect.flip)
        expect(error.code).toBe(
          malformed.startsWith("missing")
            ? "artifact_unavailable"
            : malformed.includes("current")
              ? "artifact_current_failed"
              : "artifact_read_failed",
        )
      }),
    )
  })

for (const facade of [false, true])
  test(`${facade ? "Java" : "JavaBuild"} owner close during final authorization cannot publish`, async () => {
    await using tmp = await tmpdir()
    const f = await fixture(tmp.path)
    await Effect.runPromise(
      Effect.gen(function* () {
        const scope = yield* Scope.make()
        const owner = facade
          ? Context.get(
              yield* Layer.build(Java.layerWithBuilds({ documents: documents(f), builds: f.ports })).pipe(
                Scope.provide(scope),
              ),
              Java.Service,
            )
          : yield* JavaBuild.make(f.ports).pipe(Scope.provide(scope))
        const evidence = yield* owner.build(f.request)
        f.state.authorization = Effect.never
        f.state.queryCleanup = Effect.sync(() => {
          f.state.authorizationHeld = true
        })
        const pending = yield* owner.artifact({ buildID: evidence.buildID }).pipe(Effect.forkChild)
        yield* Deferred.await(f.entered.authorization)
        yield* Scope.close(scope, Exit.void)
        const exit = yield* Fiber.await(pending)
        expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true)
        expect(f.state.releases).toBe(1)
        expect((yield* owner.artifact({ buildID: evidence.buildID }).pipe(Effect.flip)).code).toBe("owner_closed")
      }),
    )
  }, 2000)

test(
  "caller interruption during final authorization cannot issue a reference",
  () =>
    isolated((owner, f) =>
      Effect.gen(function* () {
        const evidence = yield* owner.build(f.request)
        f.state.authorization = Effect.never
        f.state.queryCleanup = Effect.sync(() => {
          f.state.authorizationHeld = true
        })
        const pending = yield* owner.artifact({ buildID: evidence.buildID }).pipe(Effect.forkScoped)
        yield* Deferred.await(f.entered.authorization)
        pending.interruptUnsafe()
        const exit = yield* Fiber.await(pending)
        expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true)
        f.state.authorizationHeld = false
        const claim = {
          buildID: evidence.buildID,
          projectID: f.project.projectID,
          sourceRevision: "saved",
          configurationRevision: "config-1",
          digest: abcDigest,
          path: AbsolutePath.make(path.join(f.project.canonicalRoot, "owned.apk")),
        }
        expect(yield* owner.verifyArtifact({ ref: claim, currentProject: f.project })).toEqual({
          valid: false,
          reason: "unknown",
        })
      }),
    ),
  2000,
)
