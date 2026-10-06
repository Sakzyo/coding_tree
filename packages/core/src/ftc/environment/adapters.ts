export * as EnvironmentAdapters from "./adapters"

import { FtcEnvironment } from "@opencode-ai/schema/ftc-environment"
import { Effect, Scope } from "effect"

export interface Dependencies {
  // Read a snapshot only. Never resolve/download dependencies or alter imported files.
  readonly read: (
    project: FtcEnvironment.InspectionProject,
  ) => Effect.Effect<unknown, FtcEnvironment.InspectionError, Scope.Scope>
}

export interface Probes {
  // The host supplies bounded, cancellable read-only probes and owns cleanup through Scope.
  // This boundary admits version/tool discovery only, never wrapper builds or ADB robot commands.
  readonly inspect: (
    request: FtcEnvironment.ProbeRequest,
  ) => Effect.Effect<unknown, FtcEnvironment.InspectionError, Scope.Scope>
}

export interface Ports {
  readonly dependencies: Dependencies
  readonly probes: Probes
}
