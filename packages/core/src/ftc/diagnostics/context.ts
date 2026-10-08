export * as FtcDiagnosticsContext from "./context"

import { FtcDiagnostics } from "@opencode-ai/schema/ftc-diagnostics"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { Effect, Schema } from "effect"
import { FtcContextSanitizer } from "../context-sanitizer"
import { SystemContext } from "../../system-context"

export function source(input: {
  readonly project: FtcProject.ProjectContext
  readonly observe: () => Effect.Effect<FtcDiagnostics.ContextUnavailable | SystemContext.Unavailable>
}): FtcContextSanitizer.BoundContext {
  return {
    project: FtcContextSanitizer.binding(input.project),
    key: SystemContext.Key.make("ftc/diagnostics"),
    context: SystemContext.make({
      key: SystemContext.Key.make("ftc/diagnostics"),
      codec: Schema.toCodecJson(FtcDiagnostics.ContextUnavailable),
      load: FtcContextSanitizer.value(
        FtcDiagnostics.ContextUnavailable,
        Effect.suspend(input.observe).pipe(
          Effect.flatMap((value) =>
            value === SystemContext.unavailable
              ? Effect.fail("context_observation_unavailable")
              : Effect.succeed({
                  kind: value.kind,
                  reason: value.reason,
                  freshness: value.freshness,
                  logs: { state: value.logs.state },
                  deployedBuild: { state: value.deployedBuild.state },
                }),
          ),
        ),
      ),
      baseline: FtcContextSanitizer.render,
      update: (_previous, current) => FtcContextSanitizer.render(current),
    }),
  }
}
