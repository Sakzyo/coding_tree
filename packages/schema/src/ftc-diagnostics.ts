export * as FtcDiagnostics from "./ftc-diagnostics"

import { Schema } from "effect"

export interface ContextUnavailable extends Schema.Schema.Type<typeof ContextUnavailable> {}
export const ContextUnavailable = Schema.Struct({
  kind: Schema.Literal("unavailable"),
  reason: Schema.Literal("observation_adapter_unavailable"),
  freshness: Schema.Literal("unknown"),
  logs: Schema.Struct({ state: Schema.Literal("unknown") }),
  deployedBuild: Schema.Struct({ state: Schema.Literal("unknown") }),
}).annotate({ identifier: "FtcDiagnostics.ContextUnavailable", parseOptions: { onExcessProperty: "error" } })
