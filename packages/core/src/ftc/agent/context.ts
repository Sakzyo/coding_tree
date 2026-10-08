export * as FtcAgentContext from "./context"

import { FtcJava } from "@opencode-ai/schema/ftc-java"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { Location } from "@opencode-ai/schema/location"
import { Effect, Exit, Schema, Scope } from "effect"
import { FtcContextSanitizer } from "../context-sanitizer"
import { SystemContext } from "../../system-context"
import { SystemContextRegistry } from "../../system-context/registry"

const Snapshot = Schema.Struct({
  project: FtcProject.ProjectContext,
  language: Schema.Literals(["en", "zh"]),
  inference: Schema.Literals(["online", "offline"]),
  disclosure: Schema.String,
  projection: Schema.Literal("sanitized_context_projection"),
  freshness: Schema.Literals(["current", "stale", "unknown"]),
  missingFacts: Schema.Array(Schema.String),
  documents: Schema.Array(FtcJava.DocumentSnapshot),
})

export function source(input: {
  readonly project: FtcProject.ProjectContext
  readonly language: "en" | "zh"
  readonly inference: "online" | "offline"
  readonly sanitize: FtcContextSanitizer.Sanitizer
  readonly observe: () => Effect.Effect<
    | {
        readonly documents: ReadonlyArray<FtcJava.DocumentSnapshot>
        readonly missingFacts: ReadonlyArray<string>
        readonly freshness: "current" | "stale" | "unknown"
      }
    | SystemContext.Unavailable
  >
}): FtcContextSanitizer.BoundContext {
  const project = FtcContextSanitizer.binding(input.project)
  const selection = { language: input.language, inference: input.inference }
  return {
    project,
    key: SystemContext.Key.make("ftc/project-code"),
    context: SystemContext.make({
      key: SystemContext.Key.make("ftc/project-code"),
      codec: Schema.toCodecJson(Snapshot),
      load: FtcContextSanitizer.value(
        Snapshot,
        Effect.gen(function* () {
          const observed = yield* Effect.suspend(input.observe)
          if (observed === SystemContext.unavailable) return yield* Effect.fail("context_observation_unavailable")
          if (observed.documents.some((document) => document.projectID !== project.projectID))
            return yield* Effect.die(new Error("context_project_mismatch"))
          return {
            project: yield* FtcContextSanitizer.project(input.sanitize, project),
            language: selection.language,
            inference: selection.inference,
            disclosure:
              selection.inference === "online"
                ? "Relevant project code and available telemetry may be sent to the selected provider."
                : "Use local inference and locally available references; unavailable online knowledge remains missing.",
            projection: "sanitized_context_projection",
            freshness: observed.freshness,
            missingFacts: yield* Effect.forEach(observed.missingFacts, (fact) =>
              FtcContextSanitizer.identifier(input.sanitize, fact),
            ),
            documents: yield* Effect.forEach(observed.documents, (document) =>
              Effect.all({
                documentID: FtcContextSanitizer.identifier(input.sanitize, document.documentID),
                projectID: FtcContextSanitizer.identifier(input.sanitize, document.projectID),
                path: FtcContextSanitizer.identifier(input.sanitize, document.path),
                bufferRevision: Effect.succeed(document.bufferRevision),
                diskRevision: Effect.succeed(document.diskRevision),
                dirty: Effect.succeed(document.dirty),
                text: FtcContextSanitizer.text(input.sanitize, document.text),
              }),
            ),
          }
        }),
      ),
      baseline: FtcContextSanitizer.render,
      update: (_previous, current) => FtcContextSanitizer.render(current),
    }),
  }
}

/** Validate the entire supplied source set before the first scoped registration. */
export function register(input: {
  readonly registry: SystemContextRegistry.Interface
  readonly project: FtcProject.ProjectContext
  readonly location: Location.Info
  readonly sources: ReadonlyArray<FtcContextSanitizer.BoundContext>
}) {
  return Effect.gen(function* () {
    const equal = Schema.toEquivalence(FtcProject.ProjectContext)
    if (
      !Schema.toEquivalence(Location.Info)(input.location, input.project.location) ||
      input.sources.some((source) => !equal(source.project, input.project))
    )
      return yield* Effect.die(new Error("context_project_or_placement_mismatch"))
    // Combining first rejects repeated source keys before any registry mutation.
    SystemContext.combine(input.sources.map((source) => source.context))
    const scope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void))
    return yield* Effect.forEach(
      input.sources,
      (source) =>
        input.registry.register({
          key: source.key,
          load: Effect.succeed(source.context),
        }),
      { discard: true },
    ).pipe(
      Scope.provide(scope),
      Effect.onExit((exit) => (Exit.isFailure(exit) ? Scope.close(scope, exit) : Effect.void)),
    )
  })
}
