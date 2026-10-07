export * as Environment from "./environment"

import { FtcEnvironment } from "@opencode-ai/schema/ftc-environment"
import {
  Cause,
  Context,
  Deferred,
  Effect,
  Exit,
  Fiber,
  Layer,
  Option,
  PubSub,
  Schema,
  Scope,
  Semaphore,
  Stream,
} from "effect"
import { win32 } from "node:path"
import { EnvironmentAdapters } from "./environment/adapters"
import { FtcEnvironmentCatalog } from "./environment/catalog"

export { Readiness, ToolchainDescriptor } from "@opencode-ai/schema/ftc-environment"

export interface Interface {
  readonly inspectEnvironment: (input: unknown) => Effect.Effect<FtcEnvironment.Readiness>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/FtcEnvironment") {}

export const layer = (ports: EnvironmentAdapters.Ports) =>
  Layer.succeed(Service, { inspectEnvironment: (input) => inspectEnvironment(input, ports) })

// Pure snapshot evaluation: never discovers assets, opens stores, or starts sibling modules.
export function offlineReadiness(input: unknown): FtcEnvironment.Readiness {
  const decoded = Schema.decodeUnknownOption(FtcEnvironment.OfflineRequest, { onExcessProperty: "error" })(input)
  if (Option.isNone(decoded))
    return {
      state: "failed",
      steps: [{ id: "offline", state: "failed", cause: "invalid_input", recovery: "review_project" }],
      missingAssets: [],
      availableFeatures: [],
    }
  const categories = ["tools", "dependencies", "models", "content"] as const
  const assets = categories.flatMap((category) => decoded.value[category])
  if (assets.length === 0)
    return {
      state: "missing",
      steps: [{ id: "offline", state: "manual", cause: "requirements_unknown", recovery: "review_project" }],
      missingAssets: [],
      availableFeatures: [],
    }
  const missing = assets.filter((asset) => !asset.available)
  return {
    state: missing.length === 0 ? "ready" : "missing",
    steps: categories.map((category): FtcEnvironment.ReadinessStep => {
      const available = decoded.value[category].every((asset) => asset.available)
      return {
        id: `offline_${category}`,
        state: available ? "ready" : "missing",
        cause: available ? "available" : "asset_missing",
        recovery: available ? "reuse" : "prepare_offline",
      }
    }),
    missingAssets: missing.map((asset) => asset.id),
    availableFeatures: [...new Set(assets.flatMap((asset) => asset.features))].filter(
      (feature) => !missing.some((asset) => asset.features.includes(feature)),
    ),
  }
}

export function inspectEnvironment(
  input: unknown,
  ports: EnvironmentAdapters.Ports,
): Effect.Effect<FtcEnvironment.Readiness> {
  return inspectEnvironmentResult(input, ports).pipe(Effect.map((result) => result.readiness))
}

function inspectEnvironmentResult(
  input: unknown,
  ports: EnvironmentAdapters.Ports,
): Effect.Effect<{ readiness: FtcEnvironment.Readiness; profile?: FtcEnvironment.Profile }> {
  return Effect.scoped(
    Effect.gen(function* () {
      const decoded = Schema.decodeUnknownOption(FtcEnvironment.InspectRequest, { onExcessProperty: "error" })(input)
      if (Option.isNone(decoded))
        return {
          readiness: {
            state: "failed" as const,
            steps: [
              {
                id: "project" as const,
                state: "failed" as const,
                cause: "invalid_input" as const,
                recovery: "review_project" as const,
              },
            ],
            missingAssets: [],
          },
        }
      const request = decoded.value
      const dependencies = yield* ports.dependencies
        .read(request.project)
        .pipe(Effect.match({ onFailure: (error) => ({ error }), onSuccess: (value) => ({ value }) }))
      const versions =
        "value" in dependencies
          ? Schema.decodeUnknownOption(FtcEnvironment.ProjectVersions, { onExcessProperty: "error" })(
              dependencies.value,
            )
          : Option.none()
      const resolved = Option.isSome(versions)
        ? FtcEnvironmentCatalog.resolveProfile({
            host: request.host,
            projectVersions: versions.value,
            catalog: request.catalog,
          })
        : undefined
      const profile = resolved?.kind === "matched" ? resolved.profile : undefined
      const known =
        Option.isSome(versions) &&
        (["ftcSdk", "androidGradlePlugin", "androidSdk", "gradleWrapper"] as const).every(
          (component) => versions.value[component] !== undefined,
        )
      const projectStep: FtcEnvironment.ReadinessStep =
        "error" in dependencies
          ? errorStep("project", dependencies.error)
          : Option.isNone(versions)
            ? { id: "project", state: "failed", cause: "invalid_response", recovery: "review_project" }
            : known
              ? { id: "project", state: "ready", cause: "available", recovery: "reuse" }
              : { id: "project", state: "manual", cause: "requirements_unknown", recovery: "review_project" }
      const tools = yield* Effect.forEach(
        ["buildJdk", "editorJdk", "androidSdk", "adb", "gradleWrapper"] as const,
        (component) =>
          Effect.gen(function* () {
            const response = yield* ports.probes
              .inspect({
                component,
                host: request.host,
                project: request.project,
                ...(profile ? { expectedVersion: profile[component].version } : {}),
              })
              .pipe(Effect.match({ onFailure: (error) => ({ error }), onSuccess: (value) => ({ value }) }))
            if ("error" in response) return { component, step: errorStep(component, response.error) }
            const result = Schema.decodeUnknownOption(FtcEnvironment.ProbeResult, { onExcessProperty: "error" })(
              response.value,
            )
            if (Option.isNone(result))
              return {
                component,
                step: {
                  id: component,
                  state: "failed" as const,
                  cause: "invalid_response" as const,
                  recovery: "retry_probe" as const,
                },
              }
            if (result.value.state !== "available")
              return {
                component,
                step: errorStep(component, {
                  code:
                    result.value.state === "missing"
                      ? "binary_missing"
                      : result.value.state === "denied"
                        ? "permission_denied"
                        : result.value.state === "manual"
                          ? "manual_required"
                          : "probe_failed",
                  ...(result.value.detail ? { detail: result.value.detail } : {}),
                }),
              }
            const found = result.value
            const wrapper =
              request.host.os === "windows"
                ? win32.join(request.project.root, "gradlew.bat")
                : `${request.project.root.replace(/[\\/]+$/, "")}/gradlew`
            if (
              component === "gradleWrapper" &&
              (request.host.os === "windows" ? win32.relative(wrapper, found.path) !== "" : found.path !== wrapper)
            )
              return {
                component,
                step: {
                  id: component,
                  state: "failed" as const,
                  cause: "invalid_response" as const,
                  recovery: "review_project" as const,
                },
              }
            if (profile && found.version !== profile[component].version)
              return {
                component,
                step: {
                  id: component,
                  state: "incompatible" as const,
                  cause: "version_mismatch" as const,
                  recovery: "manual_setup" as const,
                },
              }
            return {
              component,
              found,
              step: { id: component, state: "ready" as const, cause: "available" as const, recovery: "reuse" as const },
            }
          }),
      )
      const paths = Object.fromEntries(
        tools.filter((tool) => tool.found !== undefined).map((tool) => [tool.component, tool.found.path]),
      )
      const candidateToolchain =
        profile && known && tools.every((tool) => tool.step.state === "ready")
          ? Schema.decodeUnknownSync(FtcEnvironment.ToolchainDescriptor)({
              profileID: profile.id,
              ...paths,
              versions: Object.fromEntries(
                (
                  [
                    "buildJdk",
                    "editorJdk",
                    "androidSdk",
                    "adb",
                    "gradleWrapper",
                    "ftcSdk",
                    "androidGradlePlugin",
                  ] as const
                ).map((component) => [component, profile[component].version]),
              ),
            })
          : undefined
      const steps: FtcEnvironment.ReadinessStep[] = [
        projectStep,
        ...(resolved?.kind === "unsupported"
          ? [
              {
                id: "profile" as const,
                state: "incompatible" as const,
                cause: "unsupported_profile" as const,
                recovery: "review_project" as const,
                reasons: resolved.reasons,
              },
            ]
          : []),
        ...tools.map((tool) => tool.step),
        ...(candidateToolchain
          ? [
              {
                id: "build" as const,
                state: "pending" as const,
                cause: "build_unverified" as const,
                recovery: "verify_build" as const,
              },
            ]
          : []),
      ]
      return {
        readiness: {
          state: steps.some((step) => step.state === "incompatible")
            ? "incompatible"
            : steps.some((step) => step.state === "failed")
              ? "failed"
              : "missing",
          steps,
          missingAssets: steps.filter((step) => step.cause === "binary_missing").map((step) => step.id),
          ...(candidateToolchain ? { candidateToolchain } : {}),
        },
        ...(profile ? { profile } : {}),
      }
    }),
  )
}

function errorStep(
  id: FtcEnvironment.ReadinessStep["id"],
  error: FtcEnvironment.InspectionError,
): FtcEnvironment.ReadinessStep {
  return {
    id,
    state: error.code === "binary_missing" ? "missing" : error.code === "probe_failed" ? "failed" : "manual",
    cause: error.code,
    recovery:
      error.code === "binary_missing"
        ? "install"
        : error.code === "permission_denied"
          ? "grant_permission"
          : error.code === "manual_required"
            ? "manual_setup"
            : "retry_probe",
    ...(error.detail ? { detail: error.detail } : {}),
  }
}

// Runtime handles are local to this scoped service; only their records cross the Schema boundary.
export interface SetupRun {
  readonly events: Stream.Stream<FtcEnvironment.SetupEvent>
  readonly result: Effect.Effect<FtcEnvironment.SetupResult>
  readonly recheck: () => Effect.Effect<FtcEnvironment.SetupResult, FtcEnvironment.SetupError>
  readonly cancel: Effect.Effect<void>
}

export interface GuidedPorts {
  readonly inspection: EnvironmentAdapters.Ports
  readonly automatic?: EnvironmentAdapters.Automatic
  readonly context: {
    readonly read: (
      input: FtcEnvironment.ReadinessRequest,
    ) => Effect.Effect<unknown, FtcEnvironment.SetupError, Scope.Scope>
  }
  // The adapter verifies saved/current inputs and APK identity; it never calls setup recursively.
  readonly builds: {
    readonly verify: (
      input: FtcEnvironment.BuildRequest,
    ) => Effect.Effect<unknown, FtcEnvironment.SetupError, Scope.Scope>
  }
}

export interface GuidedInterface {
  readonly prepareEnvironment: (input: unknown) => Effect.Effect<SetupRun, FtcEnvironment.SetupError>
  // Latest local observation only. Deliberate prepare/recheck refreshes external facts.
  readonly readiness: (input: unknown) => Effect.Effect<FtcEnvironment.Readiness, FtcEnvironment.SetupError>
}

export class GuidedService extends Context.Service<GuidedService, GuidedInterface>()(
  "@opencode/FtcEnvironmentGuided",
) {}

const pendingReadiness: FtcEnvironment.Readiness = {
  state: "missing",
  missingAssets: [],
  steps: [{ id: "build", state: "pending", cause: "build_unverified", recovery: "verify_build" }],
}

export const guidedLayer = (ports: GuidedPorts) =>
  Layer.effect(
    GuidedService,
    Effect.gen(function* () {
      const scope = yield* Effect.scope
      const prepareLock = yield* Semaphore.make(1)
      const runs = new Map<
        string,
        { run: SetupRun; active: boolean; readiness: FtcEnvironment.Readiness; dispose: Effect.Effect<void> }
      >()
      const lifetime = { closed: false }
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          lifetime.closed = true
        }),
      )

      const prepareEnvironment = (input: unknown) =>
        Effect.gen(function* () {
          if (lifetime.closed) return yield* Effect.fail({ code: "closed" as const })
          const decoded = Schema.decodeUnknownOption(FtcEnvironment.PrepareRequest, { onExcessProperty: "error" })(
            input,
          )
          if (Option.isNone(decoded)) return yield* Effect.fail({ code: "invalid_input" as const })
          const request = decoded.value
          if (request.choice === "automatic" && !ports.automatic)
            return yield* Effect.fail({ code: "invalid_input" as const })
          const previous = runs.get(request.projectID)
          if (previous?.active) return yield* Effect.fail({ code: "busy" as const })
          if (previous) yield* previous.dispose
          const runScope = yield* Scope.fork(scope)
          const events = yield* PubSub.unbounded<FtcEnvironment.SetupEvent>({ replay: 16 })
          const state: {
            cancelled: boolean
            active: boolean
            readiness: FtcEnvironment.Readiness
            result: FtcEnvironment.SetupResult
            done: Deferred.Deferred<FtcEnvironment.SetupResult>
            fiber?: Fiber.Fiber<void>
          } = {
            cancelled: false,
            active: false,
            readiness: pendingReadiness,
            result: { state: "completed", readiness: pendingReadiness, steps: [] },
            done: yield* Deferred.make<FtcEnvironment.SetupResult>(),
          }

          const observe = (
            readiness: FtcEnvironment.Readiness,
            context?: FtcEnvironment.SetupContext,
            profile?: FtcEnvironment.Profile,
          ) =>
            Effect.gen(function* () {
              state.readiness = readiness
              const steps = setupSteps(readiness, context, profile)
              state.result = { state: "completed", readiness, steps }
              yield* Effect.forEach(steps, (step) =>
                PubSub.publish(events, { projectID: request.projectID, type: "step", step }),
              )
            })
          const check = Effect.scoped(
            Effect.gen(function* () {
              const raw = yield* ports.context.read({ projectID: request.projectID })
              const decoded = Schema.decodeUnknownOption(FtcEnvironment.SetupContext, { onExcessProperty: "error" })(
                raw,
              )
              if (Option.isNone(decoded)) return failedSetup("project", "invalid_response")
              const context = decoded.value
              const inspected = yield* inspectEnvironmentResult(context.inspection, ports.inspection)
              const unknown = inspected.readiness.steps.some((step) => step.cause === "requirements_unknown")
              const profile = inspected.profile?.id === request.profileID && !unknown ? inspected.profile : undefined
              const selected: FtcEnvironment.Readiness =
                inspected.profile && inspected.profile.id !== request.profileID
                  ? {
                      ...inspected.readiness,
                      state: "incompatible",
                      candidateToolchain: undefined,
                      steps: [
                        ...inspected.readiness.steps,
                        {
                          id: "profile",
                          state: "incompatible",
                          cause: "unsupported_profile",
                          recovery: "review_project",
                        },
                      ],
                    }
                  : inspected.readiness
              // Installation pins require a resolved choice and known imported requirements.
              const initial: FtcEnvironment.Readiness = profile
                ? request.choice === "automatic"
                  ? automaticReadiness(selected)
                  : selected
                : {
                    ...selected,
                    steps: selected.steps.map((step) =>
                      step.recovery === "install"
                        ? {
                            ...step,
                            state: "manual",
                            cause: unknown ? "requirements_unknown" : "unsupported_profile",
                            recovery: "review_project",
                          }
                        : step,
                    ),
                  }
              yield* observe(initial, context, profile)
              const missing = initial.steps.find(
                (step) => step.state === "missing" && step.recovery === "install" && step.id !== "gradleWrapper",
              )
              const component = missing
                ? Schema.decodeUnknownOption(FtcEnvironment.ToolComponent)(missing.id)
                : Option.none()
              const prepared =
                request.choice === "automatic" && ports.automatic && profile && Option.isSome(component)
                  ? yield* prepareComponent(
                      {
                        projectID: request.projectID,
                        profileID: profile.id,
                        component: component.value,
                        artifact: profile[component.value],
                        host: context.inspection.host,
                      },
                      context.inspection.project,
                      ports.automatic,
                      ports.inspection.probes,
                    ).pipe(Effect.match({ onFailure: (error) => ({ error }), onSuccess: () => ({ prepared: true }) }))
                  : undefined
              if (prepared && "error" in prepared && missing)
                return failedSetup(missing.id, prepared.error.code, initial, context, profile)
              const refreshed = prepared
                ? yield* inspectEnvironmentResult(context.inspection, ports.inspection)
                : undefined
              if (refreshed && refreshed.profile?.id !== profile?.id)
                return failedSetup(
                  "project",
                  "build_stale",
                  { ...refreshed.readiness, candidateToolchain: undefined },
                  context,
                )
              const readiness = refreshed ? automaticReadiness(refreshed.readiness) : initial
              if (prepared) yield* observe(readiness, context, profile)
              if (!readiness.candidateToolchain) return state.result
              if (context.dirty) return failedSetup("build", "build_stale", readiness, context, profile)
              const buildRequest = {
                projectID: request.projectID,
                root: context.inspection.project.root,
                toolchain: readiness.candidateToolchain,
                sourceRevision: context.sourceRevision,
                configurationRevision: context.configurationRevision,
              }
              const rawBuild = yield* ports.builds
                .verify(buildRequest)
                .pipe(Effect.match({ onFailure: (error) => ({ error }), onSuccess: (value) => ({ value }) }))
              if ("error" in rawBuild) return failedSetup("build", "build_failed", readiness, context, profile)
              const evidence = Schema.decodeUnknownOption(FtcEnvironment.BuildVerification, {
                onExcessProperty: "error",
              })(rawBuild.value)
              if (Option.isNone(evidence)) return failedSetup("build", "invalid_response", readiness, context, profile)
              if (evidence.value.state !== "verified")
                return failedSetup(
                  "build",
                  evidence.value.state === "stale" ? "build_stale" : "build_failed",
                  readiness,
                  context,
                  profile,
                )
              const verified = evidence.value
              if (
                verified.projectID !== request.projectID ||
                verified.root !== buildRequest.root ||
                verified.sourceRevision !== context.sourceRevision ||
                verified.configurationRevision !== context.configurationRevision ||
                !sameToolchain(verified.toolchain, buildRequest.toolchain)
              )
                return failedSetup("build", "build_stale", readiness, context, profile)
              const current = Schema.decodeUnknownOption(FtcEnvironment.SetupContext, { onExcessProperty: "error" })(
                yield* ports.context.read({ projectID: request.projectID }),
              )
              if (
                Option.isNone(current) ||
                current.value.dirty ||
                current.value.sourceRevision !== context.sourceRevision ||
                current.value.configurationRevision !== context.configurationRevision ||
                JSON.stringify(current.value.inspection) !== JSON.stringify(context.inspection)
              )
                return failedSetup("build", "build_stale", readiness, context, profile)
              const ready: FtcEnvironment.Readiness = {
                ...readiness,
                state: "ready",
                steps: readiness.steps.map((step) =>
                  step.id === "build" ? { id: "build", state: "ready", cause: "available", recovery: "reuse" } : step,
                ),
              }
              return {
                state: "completed" as const,
                readiness: ready,
                steps: setupSteps(ready, context, profile),
                buildEvidence: verified,
              }
            }),
          ).pipe(
            Effect.catchCause((cause) =>
              Cause.hasInterrupts(cause) ? Effect.interrupt : Effect.succeed(failedSetup("project", "probe_failed")),
            ),
          )

          const start = Effect.uninterruptibleMask(() =>
            Effect.gen(function* () {
              if (lifetime.closed) return yield* Effect.fail({ code: "closed" as const })
              if (state.cancelled) return yield* Effect.fail({ code: "cancelled" as const })
              if (state.active) return yield* Effect.fail({ code: "busy" as const })
              state.active = true
              state.readiness = pendingReadiness
              state.done = yield* Deferred.make<FtcEnvironment.SetupResult>()
              state.fiber = yield* Effect.forkIn(
                check.pipe(
                  Effect.onExit((exit) =>
                    Effect.gen(function* () {
                      state.active = false
                      state.result = Exit.isSuccess(exit)
                        ? exit.value
                        : { state: "cancelled", readiness: state.readiness, steps: state.result.steps }
                      if (Exit.isFailure(exit)) state.cancelled = true
                      state.readiness = state.result.readiness
                      const build = state.result.steps.find((step) => step.step.id === "build")
                      if (build)
                        yield* PubSub.publish(events, { projectID: request.projectID, type: "step", step: build })
                      yield* PubSub.publish(events, {
                        projectID: request.projectID,
                        type: "settled",
                        result: state.result,
                      })
                      yield* Deferred.succeed(state.done, state.result)
                    }),
                  ),
                  Effect.exit,
                  Effect.asVoid,
                ),
                runScope,
                { uninterruptible: false },
              )
              return state.done
            }),
          )
          const cancel = Effect.gen(function* () {
            if (state.cancelled) return
            state.cancelled = true
            if (state.fiber && state.active) {
              yield* Fiber.interrupt(state.fiber)
              return
            }
            state.readiness = pendingReadiness
            state.result = { state: "cancelled", readiness: state.readiness, steps: [] }
            yield* PubSub.publish(events, { projectID: request.projectID, type: "settled", result: state.result })
          })
          const run: SetupRun = {
            events: Stream.fromPubSub(events),
            result: Effect.suspend(() => (state.active ? Deferred.await(state.done) : Effect.succeed(state.result))),
            recheck: () => start.pipe(Effect.flatMap(Deferred.await)),
            cancel,
          }
          runs.set(request.projectID, {
            run,
            dispose: Scope.close(runScope, Exit.void),
            get active() {
              return state.active
            },
            get readiness() {
              return state.readiness
            },
          })
          yield* Effect.addFinalizer(() => cancel.pipe(Effect.andThen(PubSub.shutdown(events)))).pipe(
            Scope.provide(runScope),
          )
          yield* start
          return run
        })
      return {
        prepareEnvironment: (input) => prepareLock.withPermit(prepareEnvironment(input)),
        readiness: (input: unknown): Effect.Effect<FtcEnvironment.Readiness, FtcEnvironment.SetupError> =>
          Effect.suspend((): Effect.Effect<FtcEnvironment.Readiness, FtcEnvironment.SetupError> => {
            if (lifetime.closed) return Effect.fail({ code: "closed" as const })
            const decoded = Schema.decodeUnknownOption(FtcEnvironment.ReadinessRequest, { onExcessProperty: "error" })(
              input,
            )
            if (Option.isNone(decoded)) return Effect.fail({ code: "invalid_input" as const })
            return Effect.succeed(runs.get(decoded.value.projectID)?.readiness ?? pendingReadiness)
          }),
      }
    }),
  )

function automaticReadiness(readiness: FtcEnvironment.Readiness): FtcEnvironment.Readiness {
  return {
    ...readiness,
    steps: readiness.steps.map((step) =>
      step.id === "gradleWrapper" && step.recovery === "install"
        ? { ...step, state: "manual", cause: "manual_required", recovery: "manual_setup" }
        : step,
    ),
  }
}

function setupSteps(
  readiness: FtcEnvironment.Readiness,
  context?: FtcEnvironment.SetupContext,
  profile?: FtcEnvironment.Profile,
): FtcEnvironment.SetupStep[] {
  return readiness.steps.map((step) => {
    const component = Schema.decodeUnknownOption(FtcEnvironment.ToolComponent)(step.id)
    const artifact = profile && Option.isSome(component) ? profile[component.value] : undefined
    return {
      step,
      messageKey:
        step.recovery === "install"
          ? "ftc.setup.install"
          : step.recovery === "grant_permission"
            ? "ftc.setup.permission"
            : step.recovery === "reuse"
              ? "ftc.setup.available"
              : step.recovery === "verify_build"
                ? "ftc.setup.verify"
                : step.recovery === "retry_probe"
                  ? "ftc.setup.recheck"
                  : "ftc.setup.review",
      ...(context
        ? {
            os: context.inspection.host.os,
            osVersion: context.inspection.host.osVersion,
            architecture: context.inspection.host.architecture,
          }
        : {}),
      ...(artifact ? { version: artifact.version, source: artifact.source, license: artifact.license } : {}),
    }
  })
}

function failedSetup(
  id: FtcEnvironment.ReadinessStep["id"],
  cause: "invalid_response" | "probe_failed" | "build_failed" | "build_stale" | FtcEnvironment.PreparationError["code"],
  previous?: FtcEnvironment.Readiness,
  context?: FtcEnvironment.SetupContext,
  profile?: FtcEnvironment.Profile,
): FtcEnvironment.SetupResult {
  const readiness: FtcEnvironment.Readiness = {
    state: cause === "license_required" || cause === "permission_denied" ? "missing" : "failed",
    missingAssets: previous?.missingAssets ?? [],
    ...(previous?.candidateToolchain ? { candidateToolchain: previous.candidateToolchain } : {}),
    steps: [
      ...(previous?.steps.filter((step) => step.id !== id) ?? []),
      {
        id,
        state: cause === "license_required" || cause === "permission_denied" ? "manual" : "failed",
        cause,
        recovery:
          id === "build"
            ? "verify_build"
            : cause === "permission_denied"
              ? "grant_permission"
              : cause === "license_required"
                ? "manual_setup"
                : cause === "download_failed" || cause === "checksum_mismatch" || cause === "preparation_failed"
                  ? "install"
                  : "review_project",
      },
    ],
  }
  return { state: "completed", readiness, steps: setupSteps(readiness, context, profile) }
}

function prepareComponent(
  request: FtcEnvironment.PreparationRequest,
  project: FtcEnvironment.InspectionProject,
  ports: EnvironmentAdapters.Automatic,
  probes: EnvironmentAdapters.Probes,
): Effect.Effect<void, FtcEnvironment.PreparationError> {
  return Effect.scoped(
    Effect.gen(function* () {
      const authorization = Schema.decodeUnknownOption(FtcEnvironment.PreparationAuthorization, {
        onExcessProperty: "error",
      })(yield* ports.authorization.read(request))
      if (Option.isNone(authorization)) return yield* Effect.fail({ code: "invalid_response" as const })
      const approved = authorization.value
      if (
        approved.projectID !== request.projectID ||
        approved.profileID !== request.profileID ||
        approved.component !== request.component ||
        (["source", "version", "license", "sha256"] as const).some(
          (key) => approved.artifact[key] !== request.artifact[key],
        )
      )
        return yield* Effect.fail({ code: "invalid_response" as const })
      if (!approved.licenseAccepted) return yield* Effect.fail({ code: "license_required" as const })
      if (!approved.systemPermissionGranted) return yield* Effect.fail({ code: "permission_denied" as const })
      const cached = yield* ports.cache.lookup(request)
      const raw =
        cached !== undefined
          ? cached
          : yield* Effect.gen(function* () {
              const bytes = yield* ports.download.fetch(request)
              if (new Bun.CryptoHasher("sha256").update(bytes).digest("hex") !== request.artifact.sha256.toLowerCase())
                return yield* Effect.fail({ code: "checksum_mismatch" as const })
              return yield* ports.cache.stage(request, bytes)
            })
      const decoded = Schema.decodeUnknownOption(FtcEnvironment.PreparedAsset, { onExcessProperty: "error" })(raw)
      if (Option.isNone(decoded)) return yield* Effect.fail({ code: "invalid_response" as const })
      const asset = decoded.value
      yield* Effect.gen(function* () {
        const bytes = yield* Effect.tryPromise({
          try: () => Bun.file(asset.archivePath).bytes(),
          catch: () => ({ code: "preparation_failed" as const }),
        })
        if (new Bun.CryptoHasher("sha256").update(bytes).digest("hex") !== request.artifact.sha256.toLowerCase())
          return yield* Effect.fail({ code: "checksum_mismatch" as const })
        const exists = yield* Effect.tryPromise({
          try: () => Bun.file(asset.path).exists(),
          catch: () => ({ code: "preparation_failed" as const }),
        })
        if (!exists) return yield* Effect.fail({ code: "preparation_failed" as const })
        const probe = Schema.decodeUnknownOption(FtcEnvironment.ProbeResult, { onExcessProperty: "error" })(
          yield* probes
            .inspect({
              component: request.component,
              host: request.host,
              project,
              expectedVersion: request.artifact.version,
              path: asset.path,
            })
            .pipe(Effect.mapError(() => ({ code: "preparation_failed" as const }))),
        )
        if (
          Option.isNone(probe) ||
          probe.value.state !== "available" ||
          probe.value.path !== asset.path ||
          probe.value.version !== request.artifact.version
        )
          return yield* Effect.fail({ code: "preparation_failed" as const })
        return undefined
      }).pipe(Effect.tapError(() => (cached !== undefined ? ports.cache.discard(request, asset) : Effect.void)))
      return yield* ports.cache.commit(request, asset)
    }),
  ).pipe(
    Effect.catchCause((cause) =>
      Cause.hasInterrupts(cause)
        ? Effect.interrupt
        : Effect.fail({
            code: Cause.findErrorOption(cause).pipe(
              Option.map((error) => error.code),
              Option.getOrElse(() => "preparation_failed" as const),
            ),
          }),
    ),
  )
}

function sameToolchain(left: FtcEnvironment.ToolchainDescriptor, right: FtcEnvironment.ToolchainDescriptor) {
  return (
    (["profileID", "buildJdk", "editorJdk", "androidSdk", "adb", "gradleWrapper"] as const).every(
      (key) => left[key] === right[key],
    ) &&
    (["buildJdk", "editorJdk", "androidSdk", "adb", "gradleWrapper", "ftcSdk", "androidGradlePlugin"] as const).every(
      (key) => left.versions[key] === right.versions[key],
    )
  )
}
