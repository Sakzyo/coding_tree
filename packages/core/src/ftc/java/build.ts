export * as JavaBuild from "./build"

import { FtcJava } from "@opencode-ai/schema/ftc-java"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { FtcEnvironment } from "@opencode-ai/schema/ftc-environment"
import { Project } from "@opencode-ai/schema/project"
import { Location } from "@opencode-ai/schema/location"
import { WorkspaceID } from "@opencode-ai/schema/workspace-id"
import { createHash } from "node:crypto"
import { ProjectSchema } from "../../project/schema"
import { Cause, Deferred, Effect, Exit, Fiber, Option, Schema, Scope, Stream } from "effect"

export interface SavedInputBasis {
  readonly project: FtcProject.ProjectContext
  readonly toolchain: FtcEnvironment.ToolchainDescriptor
  readonly sourceRevision: string
  readonly configurationRevision: string
  readonly generation: string
  readonly scope: "complete"
  readonly mode: "immutable"
  readonly recipe: {
    readonly identity: string
    readonly wrapper: string
    readonly buildJdk: string
    readonly androidSdk: string
  }
  readonly exclusions: readonly FtcJava.BuildExclusion[]
}

export interface InputValidation {
  readonly project: FtcProject.ProjectContext
  readonly toolchain: FtcEnvironment.ToolchainDescriptor
  readonly sourceRevision: string
  readonly configurationRevision: string
  readonly generation: string
  readonly exclusions: readonly FtcJava.BuildExclusion[]
}

export interface SavedInputLease {
  readonly basis: SavedInputBasis
  // The trusted adapter binds this capability to the complete immutable snapshot and fixed recipe.
  readonly execution: object
  // The producer covers complete live inputs/configuration and intervening changes, including A-B-A.
  // It rechecks actual root/Location/tool authority, not just endpoint digest equality.
  readonly revalidate: () => Effect.Effect<InputValidation, FtcJava.BuildError>
  // Closes every lease resource and observes that same interval/authority through cleanup.
  // Scope fallback release is idempotent and cannot silently hide an incomplete observation.
  readonly release: Effect.Effect<InputValidation, FtcJava.BuildError>
}

export interface Termination {
  readonly exitCode?: number
  readonly signal?: string
}

export interface ArtifactBytesObservation {
  readonly bytes: Uint8Array | undefined
  // Exact retention/observed-byte-bound, side-effect-free synchronous continuity proof.
  // Remains callable after query cleanup and final async authorization. False proves change;
  // undefined means unavailable proof. It must cover the immediately following synchronous
  // publication; producers without protected continuity cannot implement it as constant true.
  readonly confirm: () => boolean | undefined
}

export interface ArtifactCurrentObservation {
  readonly validation: InputValidation
  // Exact owner/original-basis-bound complete authority, generation and dirty confirmation.
  // Side-effect-free, synchronous and usable after all query cleanup; no released execution
  // lease. Return undefined if complete/recipe/interval continuity cannot be established.
  readonly confirm: () => InputValidation | undefined
}

export interface RetainedArtifact {
  readonly metadata: Omit<FtcJava.ArtifactRef, "digest">
  // Protected owner bytes; undefined establishes that the retained content is missing.
  readonly read: () => Effect.Effect<ArtifactBytesObservation, FtcJava.ArtifactError, Scope.Scope>
  readonly release: Effect.Effect<void, FtcJava.ArtifactError>
}

export interface BuildProcess {
  // Opaque capability for the exact execution's identified APK, never a query/log pathname.
  readonly apk?: object
  // Normal end guarantees complete ordered output. Capture failures/truncation fail the stream.
  readonly output: Stream.Stream<FtcJava.BuildLog, FtcJava.BuildError>
  readonly termination: Effect.Effect<Termination, FtcJava.BuildError>
  // The adapter cancels/reaps only its owned child/descendants and joins their pipes.
  readonly cancelAndJoin: Effect.Effect<Termination, FtcJava.BuildError>
  // Reports normal process/pipe cleanup before publication; fallback release is idempotent.
  readonly release: Effect.Effect<void, FtcJava.BuildError>
}

export interface Ports {
  readonly artifacts?: {
    // Verify exact execution/output/full basis/recipe, and register idempotent retention cleanup
    // in this separate artifact Scope before waiting. No output is an explicit observation.
    readonly capture: (input: {
      readonly buildID: FtcJava.BuildID
      readonly basis: SavedInputBasis
      readonly execution: object
      readonly output?: object
    }) => Effect.Effect<RetainedArtifact | undefined, FtcJava.ArtifactError, Scope.Scope>
    // Fresh complete authority, dirty exclusions and comparable continuity anchored to basis.generation
    // across lease retirement, including A-B-A. Unsupported continuity fails, never endpoint inference.
    readonly current: (input: {
      readonly basis: SavedInputBasis
    }) => Effect.Effect<ArtifactCurrentObservation, FtcJava.ArtifactError, Scope.Scope>
  }
  readonly projects: {
    readonly resolve: (projectID: Project.ID) => Effect.Effect<FtcProject.ProjectContext, FtcJava.BuildError>
  }
  // Both ports must register idempotent fallback cleanup in the supplied Scope; release reports cleanup before publication.
  readonly inputs: {
    readonly acquire: (input: {
      readonly project: FtcProject.ProjectContext
      readonly toolchain: FtcEnvironment.ToolchainDescriptor
    }) => Effect.Effect<SavedInputLease, FtcJava.BuildError, Scope.Scope>
  }
  readonly process: {
    readonly start: (input: {
      readonly lease: SavedInputLease
      readonly toolchain: FtcEnvironment.ToolchainDescriptor
    }) => Effect.Effect<BuildProcess, FtcJava.BuildError, Scope.Scope>
  }
}

export interface BuildRun {
  readonly buildID: FtcJava.BuildID
  readonly result: Effect.Effect<FtcJava.BuildEvidence>
  readonly cancel: Effect.Effect<FtcJava.BuildEvidence>
}

export interface Interface {
  readonly artifact: (
    input: FtcJava.ArtifactQuery,
  ) => Effect.Effect<FtcJava.ArtifactRef | undefined, FtcJava.ArtifactError>
  readonly verifyArtifact: (
    input: FtcJava.ArtifactVerificationRequest,
  ) => Effect.Effect<FtcJava.ArtifactVerificationResult, FtcJava.ArtifactError>
  readonly build: (input: FtcJava.BuildRequest) => Effect.Effect<FtcJava.BuildEvidence, FtcJava.BuildError>
  readonly startBuild: (input: FtcJava.BuildRequest) => Effect.Effect<BuildRun, FtcJava.BuildError>
  readonly readBuild: (input: FtcJava.BuildQuery) => Effect.Effect<FtcJava.BuildRecord, FtcJava.BuildError>
}

// The existing internal Location.Service carries explicit undefined workspace/vcs fields.
// Accept only that documented local representation, then project canonical wire fields.
const RuntimeProject = Schema.Struct({
  ...FtcProject.ProjectContext.fields,
  location: Schema.Struct({
    ...Location.Info.fields,
    workspaceID: Schema.optional(WorkspaceID),
    vcs: Schema.optional(ProjectSchema.Vcs),
  }),
})

const Text = Schema.String.check(Schema.isMinLength(1))
const Recipe = Schema.Struct({ identity: Text, wrapper: Text, buildJdk: Text, androidSdk: Text })
const Basis = Schema.Struct({
  project: FtcProject.ProjectContext,
  toolchain: FtcEnvironment.ToolchainDescriptor,
  sourceRevision: Text,
  configurationRevision: Text,
  generation: Text,
  scope: Schema.Literal("complete"),
  mode: Schema.Literal("immutable"),
  recipe: Recipe,
  exclusions: Schema.Array(FtcJava.BuildExclusion),
})
const Validation = Schema.Struct({
  project: FtcProject.ProjectContext,
  toolchain: FtcEnvironment.ToolchainDescriptor,
  sourceRevision: Text,
  configurationRevision: Text,
  generation: Text,
  exclusions: Schema.Array(FtcJava.BuildExclusion),
})
const RuntimeValidation = Schema.Struct({ ...Validation.fields, project: RuntimeProject })
const ArtifactMetadata = Schema.Struct({
  buildID: FtcJava.BuildID,
  projectID: Project.ID,
  sourceRevision: Text,
  configurationRevision: Text,
  path: FtcJava.ArtifactRef.fields.path,
})
type ArtifactState =
  | {
      readonly retained: RetainedArtifact
      readonly scope: Scope.Closeable
      ref?: FtcJava.ArtifactRef
      invalid?: FtcJava.ArtifactVerificationResult["reason"]
    }
  | { readonly error: Cause.Cause<FtcJava.ArtifactError> }

type ArtifactCheck = {
  readonly ref?: FtcJava.ArtifactRef
  readonly reason?: FtcJava.ArtifactVerificationResult["reason"]
  readonly confirmContent?: ArtifactBytesObservation["confirm"]
  readonly confirmCurrent?: ArtifactCurrentObservation["confirm"]
}

const ObservedTermination = Schema.Struct({
  exitCode: Schema.optionalKey(Schema.Int),
  signal: Schema.optionalKey(Text),
})

export const make = (ports: Ports): Effect.Effect<Interface, never, Scope.Scope> =>
  Effect.gen(function* () {
    const lifetime = yield* Scope.make()
    const fibers = new Set<Fiber.Fiber<unknown, unknown>>()
    const roots = new Set<string>()
    const artifactScopes = new Set<Scope.Closeable>()
    const artifactPorts =
      ports.artifacts && typeof ports.artifacts.capture === "function" && typeof ports.artifacts.current === "function"
        ? Object.freeze({ capture: ports.artifacts.capture, current: ports.artifacts.current })
        : undefined
    const records = new Map<
      FtcJava.BuildID,
      {
        readonly request: FtcJava.BuildRequest
        readonly basis: SavedInputBasis
        readonly done: Deferred.Deferred<FtcJava.BuildEvidence>
        cancelled: boolean
        evidence?: FtcJava.BuildEvidence
        defect?: Cause.Cause<never>
        fiber?: Fiber.Fiber<void>
        artifact?: ArtifactState
      }
    >()
    let closed = false
    const active = () =>
      Effect.suspend(() => (closed ? Effect.fail({ code: "owner_closed" } satisfies FtcJava.BuildError) : Effect.void))
    const fork = <A, E>(effect: Effect.Effect<A, E>) =>
      Effect.gen(function* () {
        const fiber = yield* Effect.forkIn(effect, lifetime, { uninterruptible: false, startImmediately: true })
        fibers.add(fiber)
        fiber.addObserver(() => fibers.delete(fiber))
        return fiber
      })
    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        closed = true
        records.forEach((state) => {
          if (!state.evidence) state.cancelled = true
        })
        yield* Effect.forEach([...fibers], (fiber) => interrupt(fiber), { concurrency: "unbounded" })
        yield* Scope.close(lifetime, Exit.void)
        yield* Effect.forEach([...artifactScopes], (scope) => Scope.close(scope, Exit.void), {
          concurrency: "unbounded",
        })
        artifactScopes.clear()
        records.clear()
        roots.clear()
      }),
    )
    const authorize = (project: FtcProject.ProjectContext) =>
      Effect.gen(function* () {
        yield* active()
        const actual = yield* ports.projects
          .resolve(project.projectID)
          .pipe(Effect.flatMap((value) => captureProject(value, "project_unauthorized")))
        if (
          !sameProject(actual, project) ||
          !absolute(actual.canonicalRoot) ||
          actual.location.directory !== actual.canonicalRoot
        )
          return yield* Effect.fail({ code: "project_unauthorized" } satisfies FtcJava.BuildError)
        yield* active()
        return actual
      })
    const startBuild = (input: FtcJava.BuildRequest) =>
      Effect.gen(function* () {
        // Capture before the first asynchronous authority/acquisition boundary.
        const project = yield* captureProject(input.project, "invalid_build_input")
        const request = yield* copy(FtcJava.BuildRequest, { ...input, project }, "invalid_build_input")
        yield* active()
        const delivered: { run?: BuildRun } = {}
        return yield* Effect.acquireUseRelease(
          fork(
            Effect.uninterruptibleMask((restore) =>
              Effect.gen(function* () {
                const resourceScope = yield* Scope.make()
                const transfer = { admitted: false, reserved: false }
                return yield* Effect.gen(function* () {
                  yield* restore(authorize(request.project))
                  yield* active()
                  if (roots.has(request.project.canonicalRoot))
                    return yield* Effect.fail({ code: "busy" } satisfies FtcJava.BuildError)
                  roots.add(request.project.canonicalRoot)
                  transfer.reserved = true
                  const raw = yield* restore(
                    ports.inputs
                      .acquire({ project: request.project, toolchain: request.toolchain })
                      .pipe(Scope.provide(resourceScope)),
                  )
                  if (raw.basis?.scope !== "complete")
                    return yield* Effect.fail({ code: "incomplete_inputs" } satisfies FtcJava.BuildError)
                  const leaseProject = yield* captureProject(raw.basis.project, "lease_mismatch")
                  const basis = yield* copy(Basis, { ...raw.basis, project: leaseProject }, "lease_mismatch")
                  if (
                    !sameProject(basis.project, request.project) ||
                    !sameToolchain(basis.toolchain, request.toolchain) ||
                    basis.recipe.wrapper !== request.toolchain.gradleWrapper ||
                    basis.recipe.buildJdk !== request.toolchain.buildJdk ||
                    basis.recipe.androidSdk !== request.toolchain.androidSdk ||
                    !inside(request.project.canonicalRoot, basis.recipe.wrapper) ||
                    !raw.execution ||
                    typeof raw.execution !== "object" ||
                    typeof raw.revalidate !== "function" ||
                    !Effect.isEffect(raw.release)
                  )
                    return yield* Effect.fail({ code: "lease_mismatch" } satisfies FtcJava.BuildError)
                  if (basis.configurationRevision !== request.configurationRevision)
                    return yield* Effect.fail({ code: "stale_configuration" } satisfies FtcJava.BuildError)
                  yield* restore(authorize(request.project))
                  yield* active()
                  const lease: SavedInputLease = Object.freeze({
                    basis,
                    execution: raw.execution,
                    revalidate: raw.revalidate,
                    release: raw.release,
                  })
                  const buildID = FtcJava.BuildID.create()
                  const state = {
                    request,
                    basis,
                    done: yield* Deferred.make<FtcJava.BuildEvidence>(),
                    cancelled: false,
                    evidence: undefined as FtcJava.BuildEvidence | undefined,
                    defect: undefined as Cause.Cause<never> | undefined,
                    fiber: undefined as Fiber.Fiber<void> | undefined,
                    artifact: undefined as ArtifactState | undefined,
                  }
                  const worker = Effect.uninterruptibleMask((resume) =>
                    Effect.gen(function* () {
                      const logs: FtcJava.BuildLog[] = []
                      const errors: FtcJava.BuildError[] = []
                      const observed: {
                        process?: BuildProcess
                        termination?: Termination
                        outputComplete: boolean
                        validation?: InputValidation
                        settlement?: InputValidation
                        inputChanged: boolean
                      } = { outputComplete: false, inputChanged: false }
                      const note = (cause: Cause.Cause<FtcJava.BuildError>, fallback: FtcJava.BuildError["code"]) =>
                        Effect.gen(function* () {
                          const failures = cause.reasons.filter(Cause.isFailReason).map((reason) => reason.error)
                          const captured = yield* Effect.forEach(failures, (error) =>
                            copy(FtcJava.BuildError, error, fallback).pipe(
                              Effect.catch(() => Effect.succeed({ code: fallback } satisfies FtcJava.BuildError)),
                            ),
                          )
                          errors.push(
                            ...(captured.length
                              ? captured
                              : Cause.hasInterruptsOnly(cause)
                                ? []
                                : [{ code: fallback }]),
                          )
                          const defects = cause.reasons.filter(Cause.isDieReason)
                          if (defects.length) state.defect = Cause.fromReasons(defects)
                        })
                      const validate = (value: InputValidation) =>
                        Effect.gen(function* () {
                          const project = yield* captureProject(value.project, "input_verification_failed")
                          const validation = yield* copy(Validation, { ...value, project }, "input_verification_failed")
                          if (
                            !sameProject(validation.project, request.project) ||
                            !sameToolchain(validation.toolchain, request.toolchain)
                          )
                            return yield* Effect.fail({
                              code: "input_verification_failed",
                            } satisfies FtcJava.BuildError)
                          observed.validation = validation
                          if (
                            validation.sourceRevision !== basis.sourceRevision ||
                            validation.configurationRevision !== basis.configurationRevision ||
                            validation.generation !== basis.generation
                          )
                            observed.inputChanged = true
                          return yield* Effect.void
                        })
                      const execution = yield* resume(
                        Effect.gen(function* () {
                          yield* authorize(request.project)
                          yield* lease.revalidate().pipe(Effect.flatMap(validate))
                          yield* authorize(request.project)
                          const rawProcess = yield* ports.process
                            .start({ lease, toolchain: request.toolchain })
                            .pipe(Scope.provide(resourceScope))
                          if (
                            !rawProcess ||
                            !Stream.isStream(rawProcess.output) ||
                            !Effect.isEffect(rawProcess.termination) ||
                            !Effect.isEffect(rawProcess.cancelAndJoin) ||
                            !Effect.isEffect(rawProcess.release)
                          )
                            return yield* Effect.fail({ code: "process_start_failed" } satisfies FtcJava.BuildError)
                          const process: BuildProcess = Object.freeze({
                            output: rawProcess.output,
                            termination: rawProcess.termination,
                            cancelAndJoin: rawProcess.cancelAndJoin,
                            release: rawProcess.release,
                            apk: rawProcess.apk,
                          })
                          observed.process = process
                          yield* Effect.all(
                            [
                              process.output.pipe(
                                Stream.runForEach((value) =>
                                  copy(FtcJava.BuildLog, value, "output_failed").pipe(
                                    Effect.flatMap((log) =>
                                      logs.length && log.sequence <= logs[logs.length - 1].sequence
                                        ? Effect.fail({ code: "output_failed" } satisfies FtcJava.BuildError)
                                        : Effect.sync(() => {
                                            logs.push(log)
                                          }),
                                    ),
                                  ),
                                ),
                                Effect.andThen(
                                  Effect.sync(() => {
                                    observed.outputComplete = true
                                  }),
                                ),
                              ),
                              process.termination.pipe(
                                Effect.flatMap((value) => copy(ObservedTermination, value, "termination_failed")),
                                Effect.tap((value) =>
                                  Effect.sync(() => {
                                    observed.termination = value
                                  }),
                                ),
                              ),
                            ],
                            { concurrency: "unbounded" },
                          )
                          return yield* Effect.void
                        }),
                      ).pipe(Effect.exit)
                      if (Exit.isFailure(execution)) {
                        if (Cause.hasInterrupts(execution.cause)) state.cancelled = true
                        yield* note(execution.cause, "execution_defect")
                      }
                      // Retain provisionally while the execution capability is still live. Artifact
                      // failures do not rewrite truthful saved-compilation observations.
                      if (
                        artifactPorts &&
                        observed.process &&
                        Exit.isSuccess(execution) &&
                        observed.termination?.exitCode === 0 &&
                        !observed.termination.signal &&
                        observed.outputComplete
                      ) {
                        const artifactScope = yield* Scope.make()
                        artifactScopes.add(artifactScope)
                        const captured = yield* resume(
                          Effect.gen(function* () {
                            const raw = yield* artifactPorts
                              .capture({ buildID, basis, execution: lease.execution, output: observed.process!.apk })
                              .pipe(Scope.provide(artifactScope))
                            if (raw === undefined) return undefined
                            if (!raw || typeof raw !== "object")
                              return yield* Effect.fail({ code: "artifact_provenance" } satisfies FtcJava.ArtifactError)
                            // Capture all returned metadata and methods before the next async boundary.
                            const read = raw.read
                            const release = raw.release
                            const metadata = yield* artifactCopy(ArtifactMetadata, raw.metadata, "artifact_provenance")
                            if (
                              typeof read !== "function" ||
                              !Effect.isEffect(release) ||
                              metadata.buildID !== buildID ||
                              metadata.projectID !== basis.project.projectID ||
                              metadata.sourceRevision !== basis.sourceRevision ||
                              metadata.configurationRevision !== basis.configurationRevision
                            )
                              return yield* Effect.fail({ code: "artifact_provenance" } satisfies FtcJava.ArtifactError)
                            return Object.freeze({ metadata, read, release })
                          }),
                        ).pipe(Effect.exit)
                        if (Exit.isFailure(captured)) {
                          if (Cause.hasInterrupts(captured.cause)) state.cancelled = true
                          state.artifact = Cause.hasInterruptsOnly(captured.cause)
                            ? undefined
                            : { error: captured.cause }
                        }
                        if (Exit.isSuccess(captured) && captured.value)
                          state.artifact = { retained: captured.value, scope: artifactScope }
                        if (!state.artifact || "error" in state.artifact) {
                          const closed = yield* Effect.exit(Scope.close(artifactScope, Exit.void))
                          artifactScopes.delete(artifactScope)
                          if (Exit.isFailure(closed)) state.artifact = { error: closed.cause }
                        }
                      }
                      if (observed.process) {
                        if (state.cancelled || Exit.isFailure(execution)) {
                          const cancelled = yield* observed.process.cancelAndJoin.pipe(
                            Effect.flatMap((value) => copy(ObservedTermination, value, "termination_failed")),
                            Effect.exit,
                          )
                          if (Exit.isSuccess(cancelled))
                            observed.termination = { ...observed.termination, ...cancelled.value }
                          if (Exit.isFailure(cancelled)) yield* note(cancelled.cause, "cleanup_failed")
                        }
                        const released = yield* Effect.exit(observed.process.release)
                        if (Exit.isFailure(released)) yield* note(released.cause, "cleanup_failed")
                      }
                      // Authorization and interval observations are refreshed after process/pipe cleanup.
                      const current = yield* Effect.exit(
                        authorize(request.project).pipe(Effect.andThen(lease.revalidate()), Effect.flatMap(validate)),
                      )
                      if (Exit.isFailure(current)) yield* note(current.cause, "input_verification_failed")
                      const released = yield* Effect.exit(
                        lease.release.pipe(
                          Effect.flatMap(validate),
                          Effect.tap(() =>
                            Effect.sync(() => {
                              observed.settlement = observed.validation
                            }),
                          ),
                        ),
                      )
                      if (Exit.isFailure(released)) yield* note(released.cause, "cleanup_failed")
                      const cleaned = yield* Effect.exit(Scope.close(resourceScope, Exit.void))
                      if (Exit.isFailure(cleaned)) yield* note(cleaned.cause, "cleanup_failed")
                      if (
                        state.artifact &&
                        "retained" in state.artifact &&
                        (state.cancelled ||
                          observed.inputChanged ||
                          observed.termination?.exitCode !== 0 ||
                          !!observed.termination.signal ||
                          !observed.outputComplete ||
                          errors.length > 0 ||
                          basis.exclusions.length > 0 ||
                          observed.settlement === undefined ||
                          observed.settlement.exclusions.length > 0)
                      ) {
                        const discarded = yield* Effect.exit(
                          state.artifact.retained.release.pipe(
                            Effect.ensuring(Scope.close(state.artifact.scope, Exit.void)),
                          ),
                        )
                        artifactScopes.delete(state.artifact.scope)
                        state.artifact = Exit.isFailure(discarded) ? { error: discarded.cause } : undefined
                      }
                      const evidence = freeze(
                        FtcJava.BuildEvidence.make({
                          buildID,
                          projectID: request.project.projectID,
                          sourceRevision: basis.sourceRevision,
                          configurationRevision: basis.configurationRevision,
                          inputChanged: observed.inputChanged,
                          ...observed.termination,
                          status: state.cancelled
                            ? "cancelled"
                            : observed.inputChanged
                              ? "outdated"
                              : observed.termination?.exitCode === 0 &&
                                  !observed.termination.signal &&
                                  observed.outputComplete &&
                                  !errors.length
                                ? "succeeded"
                                : "failed",
                          logs: [...logs],
                          outputComplete: observed.outputComplete,
                          savedInputsOnly: true,
                          exclusions: {
                            initial: basis.exclusions,
                            ...(observed.settlement ? { settlement: observed.settlement.exclusions } : {}),
                          },
                          errors,
                        }),
                      )
                      state.evidence = evidence
                      roots.delete(request.project.canonicalRoot)
                      yield* Deferred.succeed(state.done, evidence)
                    }),
                  )
                  records.set(buildID, state)
                  state.fiber = yield* fork(worker)
                  transfer.admitted = true
                  const result = Deferred.await(state.done).pipe(
                    Effect.flatMap((evidence) =>
                      state.defect ? Effect.failCause(state.defect) : Effect.succeed(evidence),
                    ),
                  )
                  const cancel = Effect.uninterruptible(
                    Effect.gen(function* () {
                      if (!state.evidence) {
                        state.cancelled = true
                        if (state.fiber) yield* interrupt(state.fiber)
                      }
                      return state.evidence ?? (yield* Deferred.await(state.done))
                    }),
                  )
                  delivered.run = Object.freeze({ buildID, result, cancel })
                  return delivered.run
                }).pipe(
                  Effect.onExit(() =>
                    transfer.admitted
                      ? Effect.void
                      : Scope.close(resourceScope, Exit.void).pipe(
                          Effect.ensuring(
                            Effect.sync(() => {
                              if (transfer.reserved) roots.delete(request.project.canonicalRoot)
                            }),
                          ),
                        ),
                  ),
                )
              }),
            ),
          ),
          join,
          interrupt,
        ).pipe(Effect.onInterrupt(() => (delivered.run ? delivered.run.cancel.pipe(Effect.asVoid) : Effect.void)))
      })
    const build = (input: FtcJava.BuildRequest) =>
      Effect.uninterruptibleMask((restore) =>
        Effect.gen(function* () {
          const run = yield* restore(startBuild(input))
          return yield* restore(run.result).pipe(Effect.onInterrupt(() => run.cancel.pipe(Effect.asVoid)))
        }),
      )
    const readBuild = (input: FtcJava.BuildQuery) =>
      Effect.gen(function* () {
        yield* active()
        const query = yield* copy(FtcJava.BuildQuery, input, "invalid_build_input")
        const state = records.get(query.buildID)
        if (!state || state.request.project.projectID !== query.projectID)
          return yield* Effect.fail({ code: "build_unknown" } satisfies FtcJava.BuildError)
        yield* authorize(state.request.project)
        return freeze(
          state.evidence
            ? {
                state: "settled" as const,
                buildID: query.buildID,
                projectID: query.projectID,
                evidence: state.evidence,
              }
            : { state: "running" as const, buildID: query.buildID, projectID: query.projectID },
        )
      })
    const artifactActive = () =>
      active().pipe(
        Effect.mapError(
          (error): FtcJava.ArtifactError => ({
            code: error.code === "owner_closed" ? "owner_closed" : "project_unauthorized",
          }),
        ),
      )
    const artifactAuthorize = (project: FtcProject.ProjectContext) =>
      authorize(project).pipe(
        Effect.mapError((): FtcJava.ArtifactError => ({ code: closed ? "owner_closed" : "project_unauthorized" })),
      )
    const query = <A>(effect: Effect.Effect<A, FtcJava.ArtifactError>) =>
      Effect.acquireUseRelease(fork(effect), join, interrupt)
    const recheck = (state: {
      readonly basis: SavedInputBasis
      artifact?: ArtifactState
    }): Effect.Effect<ArtifactCheck, FtcJava.ArtifactError, Scope.Scope> =>
      Effect.gen(function* () {
        const artifact = state.artifact
        if (!artifact) return {}
        if ("error" in artifact) return yield* Effect.failCause(artifact.error)
        if (artifact.invalid) return { reason: artifact.invalid }
        const content = yield* artifact.retained.read()
        if (!content || typeof content !== "object" || !Object.hasOwn(content, "bytes"))
          return yield* Effect.fail({ code: "artifact_read_failed" } satisfies FtcJava.ArtifactError)
        const confirmContent = content.confirm
        if (confirmContent === undefined)
          return yield* Effect.fail({ code: "artifact_unavailable" } satisfies FtcJava.ArtifactError)
        if (typeof confirmContent !== "function")
          return yield* Effect.fail({ code: "artifact_read_failed" } satisfies FtcJava.ArtifactError)
        const bytes = content.bytes
        if (bytes !== undefined && !(bytes instanceof Uint8Array))
          return yield* Effect.fail({ code: "artifact_read_failed" } satisfies FtcJava.ArtifactError)
        const digest = bytes === undefined ? undefined : createHash("sha256").update(bytes).digest("hex")
        if (!digest || (artifact.ref && artifact.ref.digest !== digest)) {
          artifact.invalid = "content"
          return { reason: artifact.invalid }
        }
        const observation = yield* artifactPorts!.current({ basis: state.basis })
        if (!observation || typeof observation !== "object")
          return yield* Effect.fail({ code: "artifact_current_failed" } satisfies FtcJava.ArtifactError)
        const confirmCurrent = observation.confirm
        if (confirmCurrent === undefined)
          return yield* Effect.fail({ code: "artifact_unavailable" } satisfies FtcJava.ArtifactError)
        if (typeof confirmCurrent !== "function")
          return yield* Effect.fail({ code: "artifact_current_failed" } satisfies FtcJava.ArtifactError)
        const raw = observation.validation
        const project = yield* captureProject(raw?.project, "input_verification_failed").pipe(
          Effect.mapError((): FtcJava.ArtifactError => ({ code: "artifact_current_failed" })),
        )
        const current = yield* artifactCopy(Validation, { ...raw, project }, "artifact_current_failed")
        if (
          !sameProject(current.project, state.basis.project) ||
          !sameToolchain(current.toolchain, state.basis.toolchain)
        )
          return yield* Effect.fail({ code: "artifact_current_failed" } satisfies FtcJava.ArtifactError)
        if (
          current.sourceRevision !== state.basis.sourceRevision ||
          current.configurationRevision !== state.basis.configurationRevision ||
          current.generation !== state.basis.generation
        )
          artifact.invalid = "stale"
        if (current.exclusions.length) artifact.invalid = "dirty"
        yield* artifactAuthorize(state.basis.project)
        yield* artifactActive()
        if (artifact.invalid) return { reason: artifact.invalid }
        return {
          ref: artifact.ref ?? freeze(FtcJava.ArtifactRef.make({ ...artifact.retained.metadata, digest })),
          confirmContent,
          confirmCurrent,
        }
      })
    const confirm = (basis: SavedInputBasis, artifact: ArtifactState | undefined, checked: ArtifactCheck) => {
      if (closed) return { error: { code: "owner_closed" } satisfies FtcJava.ArtifactError }
      if (!artifact || "error" in artifact) return {}
      if (artifact.invalid || checked.reason) return { reason: artifact.invalid ?? checked.reason }
      if (!checked.ref) return {}
      if (!checked.confirmCurrent || !checked.confirmContent)
        return { error: { code: "artifact_unavailable" } satisfies FtcJava.ArtifactError }
      const raw = checked.confirmCurrent()
      if (raw === undefined) return { error: { code: "artifact_unavailable" } satisfies FtcJava.ArtifactError }
      const current = Schema.decodeUnknownOption(RuntimeValidation, { onExcessProperty: "error" })(raw)
      if (
        Option.isNone(current) ||
        !sameProject(current.value.project, basis.project) ||
        !sameToolchain(current.value.toolchain, basis.toolchain)
      )
        return { error: { code: "artifact_current_failed" } satisfies FtcJava.ArtifactError }
      if (
        current.value.sourceRevision !== basis.sourceRevision ||
        current.value.configurationRevision !== basis.configurationRevision ||
        current.value.generation !== basis.generation
      )
        artifact.invalid = "stale"
      if (current.value.exclusions.length) artifact.invalid = "dirty"
      if (artifact.invalid) return { reason: artifact.invalid }
      const content = checked.confirmContent()
      if (content === undefined) return { error: { code: "artifact_unavailable" } satisfies FtcJava.ArtifactError }
      if (typeof content !== "boolean")
        return { error: { code: "artifact_read_failed" } satisfies FtcJava.ArtifactError }
      if (!content || (artifact.ref && artifact.ref.digest !== checked.ref.digest)) artifact.invalid = "content"
      return artifact.invalid ? { reason: artifact.invalid } : { ref: checked.ref }
    }
    const artifact = (input: FtcJava.ArtifactQuery) =>
      query(
        Effect.gen(function* () {
          const captured = yield* artifactCopy(FtcJava.ArtifactQuery, input, "invalid_artifact_input")
          yield* artifactActive()
          const state = records.get(captured.buildID)
          if (!state) return yield* Effect.fail({ code: "artifact_unknown" } satisfies FtcJava.ArtifactError)
          yield* artifactAuthorize(state.basis.project)
          if (!artifactPorts)
            return yield* Effect.fail({ code: "artifact_unavailable" } satisfies FtcJava.ArtifactError)
          if (!state.evidence || !eligible(state.evidence)) return undefined
          if (state.artifact && "error" in state.artifact) return yield* Effect.failCause(state.artifact.error)
          const checked = yield* Effect.scoped(recheck(state))
          yield* artifactAuthorize(state.basis.project)
          yield* artifactActive()
          const published = yield* Effect.sync(() => {
            // Both trusted confirmations and publication share one synchronous boundary.
            const settled = confirm(state.basis, state.artifact, checked)
            if (settled.error) return { error: settled.error }
            if (settled.reason) return { error: { code: "artifact_invalid" } satisfies FtcJava.ArtifactError }
            if (!state.artifact || "error" in state.artifact || !settled.ref) return {}
            state.artifact.ref ??= settled.ref
            return { ref: state.artifact.ref }
          })
          if (published.error) return yield* Effect.fail(published.error)
          return published.ref
        }),
      )
    const verifyArtifact = (input: FtcJava.ArtifactVerificationRequest) =>
      query(
        Effect.gen(function* () {
          const project = yield* captureProject(input?.currentProject, "invalid_build_input").pipe(
            Effect.mapError((): FtcJava.ArtifactError => ({ code: "invalid_artifact_input" })),
          )
          const request = yield* artifactCopy(
            FtcJava.ArtifactVerificationRequest,
            { ...input, currentProject: project },
            "invalid_artifact_input",
          )
          yield* artifactAuthorize(request.currentProject)
          if (!artifactPorts)
            return yield* Effect.fail({ code: "artifact_unavailable" } satisfies FtcJava.ArtifactError)
          const state = records.get(request.ref.buildID)
          if (!state || !state.artifact || "error" in state.artifact || !state.artifact.ref)
            return freeze({ valid: false, reason: "unknown" as const })
          const issued = state.artifact.ref
          if (
            !sameProject(request.currentProject, state.basis.project) ||
            request.ref.buildID !== issued.buildID ||
            request.ref.projectID !== issued.projectID ||
            request.ref.sourceRevision !== issued.sourceRevision ||
            request.ref.configurationRevision !== issued.configurationRevision ||
            request.ref.digest !== issued.digest ||
            request.ref.path !== issued.path
          )
            return freeze({ valid: false, reason: "identity" as const })
          const checked = yield* Effect.scoped(recheck(state))
          yield* artifactAuthorize(state.basis.project)
          yield* artifactActive()
          const published = yield* Effect.sync(() => {
            const settled = confirm(state.basis, state.artifact, checked)
            if (settled.error) return { error: settled.error }
            return { result: freeze(settled.reason ? { valid: false, reason: settled.reason } : { valid: true }) }
          })
          if (published.error) return yield* Effect.fail(published.error)
          return published.result
        }),
      )
    return { build, startBuild, readBuild, artifact, verifyArtifact }
  })

function captureProject(value: unknown, code: FtcJava.BuildError["code"]) {
  return Effect.try({
    try: () => {
      const project = Schema.decodeUnknownSync(RuntimeProject, { onExcessProperty: "error" })(structuredClone(value))
      return freeze(
        FtcProject.ProjectContext.make({
          projectID: project.projectID,
          canonicalRoot: project.canonicalRoot,
          location: new Location.Info({
            directory: project.location.directory,
            ...(project.location.workspaceID !== undefined ? { workspaceID: project.location.workspaceID } : {}),
            project: project.location.project,
          }),
        }),
      )
    },
    catch: (): FtcJava.BuildError => ({ code }),
  })
}

function copy<A>(schema: Schema.Decoder<A>, value: unknown, code: FtcJava.BuildError["code"]) {
  return Effect.try({
    try: () => freeze(Schema.decodeUnknownSync(schema, { onExcessProperty: "error" })(structuredClone(value))),
    catch: (): FtcJava.BuildError => ({ code }),
  })
}

function freeze<A>(value: A): A {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

function sameProject(left: FtcProject.ProjectContext, right: FtcProject.ProjectContext) {
  return (
    left.projectID === right.projectID &&
    left.canonicalRoot === right.canonicalRoot &&
    left.location.directory === right.location.directory &&
    left.location.workspaceID === right.location.workspaceID &&
    left.location.project.id === right.location.project.id &&
    left.location.project.directory === right.location.project.directory
  )
}

function sameToolchain(left: FtcEnvironment.ToolchainDescriptor, right: FtcEnvironment.ToolchainDescriptor) {
  return (
    JSON.stringify(Schema.encodeSync(FtcEnvironment.ToolchainDescriptor)(left)) ===
    JSON.stringify(Schema.encodeSync(FtcEnvironment.ToolchainDescriptor)(right))
  )
}

function absolute(value: string) {
  return /^(?:\/|[a-zA-Z]:[\\/]|\\\\)/.test(value)
}
function inside(root: string, value: string) {
  return value.replaceAll("\\", "/").startsWith(root.replaceAll("\\", "/").replace(/\/$/, "") + "/")
}

// beta.83 notifies a mutable observer array. Removing a completed observer can skip
// another owner-close waiter; remove only cancelled waits, never during completion.
function awaitFiber<A, E>(fiber: Fiber.Fiber<A, E>) {
  return Effect.callback<Exit.Exit<A, E>>((resume) => {
    const remove = fiber.addObserver((exit) => resume(Effect.succeed(exit)))
    return Effect.sync(() => {
      if (!fiber.pollUnsafe()) remove()
    })
  })
}

function join<A, E>(fiber: Fiber.Fiber<A, E>) {
  return awaitFiber(fiber).pipe(
    Effect.flatMap((exit) => (Exit.isSuccess(exit) ? Effect.succeed(exit.value) : Effect.failCause(exit.cause))),
  )
}

function interrupt<A, E>(fiber: Fiber.Fiber<A, E>) {
  return Effect.sync(() => fiber.interruptUnsafe()).pipe(Effect.andThen(awaitFiber(fiber)), Effect.asVoid)
}

function eligible(evidence: FtcJava.BuildEvidence) {
  return (
    evidence.status === "succeeded" &&
    !evidence.exclusions.initial.length &&
    evidence.exclusions.settlement !== undefined &&
    !evidence.exclusions.settlement.length
  )
}

function artifactCopy<A>(schema: Schema.Decoder<A>, value: unknown, code: FtcJava.ArtifactError["code"]) {
  return Effect.try({
    try: () => freeze(Schema.decodeUnknownSync(schema, { onExcessProperty: "error" })(structuredClone(value))),
    catch: (): FtcJava.ArtifactError => ({ code }),
  })
}
