export * as Environment from "./environment"

import { FtcEnvironment } from "@opencode-ai/schema/ftc-environment"
import { Context, Effect, Layer, Option, Schema } from "effect"
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

export function inspectEnvironment(
  input: unknown,
  ports: EnvironmentAdapters.Ports,
): Effect.Effect<FtcEnvironment.Readiness> {
  return Effect.scoped(
    Effect.gen(function* () {
      const decoded = Schema.decodeUnknownOption(FtcEnvironment.InspectRequest, { onExcessProperty: "error" })(input)
      if (Option.isNone(decoded))
        return {
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
        state: steps.some((step) => step.state === "incompatible")
          ? "incompatible"
          : steps.some((step) => step.state === "failed")
            ? "failed"
            : "missing",
        steps,
        missingAssets: steps.filter((step) => step.cause === "binary_missing").map((step) => step.id),
        ...(candidateToolchain ? { candidateToolchain } : {}),
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
