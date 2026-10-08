export * as FtcConfigurationContext from "./context"

import { FtcConfiguration } from "@opencode-ai/schema/ftc-configuration"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { Effect, Schema } from "effect"
import { FtcContextSanitizer } from "../context-sanitizer"
import { SystemContext } from "../../system-context"

const Snapshot = Schema.Struct({
  project: FtcProject.ProjectContext,
  projection: Schema.Literal("sanitized_context_projection"),
  freshness: Schema.Literals(["current", "stale", "unknown"]),
  missingFacts: Schema.Array(Schema.String),
  manifest: FtcConfiguration.ReadResult,
  inspection: FtcConfiguration.InspectionResult,
})

export function source(input: {
  readonly project: FtcProject.ProjectContext
  readonly sanitize: FtcContextSanitizer.Sanitizer
  readonly observe: () => Effect.Effect<
    | {
        readonly project: FtcProject.ProjectContext
        readonly freshness: "current" | "stale" | "unknown"
        readonly missingFacts: ReadonlyArray<string>
        readonly manifest: FtcConfiguration.ReadResult
        readonly inspection: FtcConfiguration.InspectionResult
      }
    | SystemContext.Unavailable
  >
}): FtcContextSanitizer.BoundContext {
  const project = FtcContextSanitizer.binding(input.project)
  const id = (value: string) => FtcContextSanitizer.identifier(input.sanitize, value)
  const optional = (value: string | undefined) => FtcContextSanitizer.optionalIdentifier(input.sanitize, value)
  return {
    project,
    key: SystemContext.Key.make("ftc/configuration"),
    context: SystemContext.make({
      key: SystemContext.Key.make("ftc/configuration"),
      codec: Schema.toCodecJson(Snapshot),
      load: FtcContextSanitizer.value(
        Snapshot,
        Effect.gen(function* () {
          const observed = yield* Effect.suspend(input.observe)
          if (observed === SystemContext.unavailable) return yield* Effect.fail("context_observation_unavailable")
          if (!Schema.toEquivalence(FtcProject.ProjectContext)(project, observed.project))
            return yield* Effect.die(new Error("context_project_or_placement_mismatch"))
          const manifest = observed.manifest.manifest
          const hardware = yield* Effect.forEach(manifest.hardware, (hub) =>
            Effect.all({
              id: id(hub.id),
              devices: Effect.forEach(hub.devices, (device) =>
                Effect.all({
                  category: id(device.category),
                  port: Effect.succeed(device.port),
                  type: id(device.type),
                  name: id(device.name),
                }),
              ),
            }),
          )
          return {
            project: yield* FtcContextSanitizer.project(input.sanitize, project),
            projection: "sanitized_context_projection",
            freshness: observed.freshness,
            missingFacts: yield* Effect.forEach(observed.missingFacts, id),
            manifest:
              "revision" in observed.manifest
                ? {
                    revision: yield* id(observed.manifest.revision),
                    manifest: {
                      schemaVersion: manifest.schemaVersion,
                      managedPathing: manifest.managedPathing,
                      hardware,
                    },
                  }
                : {
                    kind: observed.manifest.kind,
                    filename: observed.manifest.filename,
                    expectedRevision: null,
                    manifest: {
                      schemaVersion: manifest.schemaVersion,
                      managedPathing: manifest.managedPathing,
                      hardware,
                    },
                  },
            inspection: {
              sdkVersion: yield* optional(observed.inspection.sdkVersion),
              managedPathing: observed.inspection.managedPathing,
              detectedPathing: observed.inspection.detectedPathing,
              dependencies: yield* Effect.forEach(observed.inspection.dependencies, (dependency) =>
                Effect.all({
                  path: id(dependency.path),
                  kind: Effect.succeed(dependency.kind),
                  group: optional(dependency.group),
                  artifact: optional(dependency.artifact),
                  version: optional(dependency.version),
                  import: optional(dependency.import),
                  reason: Effect.succeed(dependency.reason),
                }),
              ),
              conflicts: yield* Effect.forEach(observed.inspection.conflicts, (conflict) =>
                Effect.all({
                  code: Effect.succeed(conflict.code),
                  paths: Effect.forEach(conflict.paths, id),
                }),
              ),
              sourceRevisions: yield* Effect.forEach(observed.inspection.sourceRevisions, (revision) =>
                Effect.all({
                  path: id(revision.path),
                  state: Effect.succeed(revision.state),
                  revision: optional(revision.revision),
                }),
              ),
              unknowns: yield* Effect.forEach(observed.inspection.unknowns, (unknown) =>
                Effect.all({
                  path: id(unknown.path),
                  reason: Effect.succeed(unknown.reason),
                }),
              ),
            },
          }
        }),
      ),
      baseline: FtcContextSanitizer.render,
      update: (_previous, current) => FtcContextSanitizer.render(current),
    }),
  }
}
