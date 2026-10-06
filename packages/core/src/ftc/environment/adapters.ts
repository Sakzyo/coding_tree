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

export interface Automatic {
  readonly authorization: {
    readonly read: (
      request: FtcEnvironment.PreparationRequest,
    ) => Effect.Effect<unknown, FtcEnvironment.PreparationError, Scope.Scope>
  }
  // No redirects or source substitution. Production networking remains an OS/isolation evidence gate.
  readonly download: {
    readonly fetch: (
      request: FtcEnvironment.PreparationRequest,
    ) => Effect.Effect<Uint8Array, FtcEnvironment.PreparationError, Scope.Scope>
  }
  readonly cache: {
    readonly lookup: (
      request: FtcEnvironment.PreparationRequest,
    ) => Effect.Effect<unknown, FtcEnvironment.PreparationError, Scope.Scope>
    // Invalidate only the exact rejected lookup entry. Enforce cache ownership/root confinement;
    // atomically quarantine/remove it without touching other cache entries or project/system files.
    readonly discard: (
      request: FtcEnvironment.PreparationRequest,
      asset: FtcEnvironment.PreparedAsset,
    ) => Effect.Effect<void, FtcEnvironment.PreparationError, Scope.Scope>
    // App-owned cache only. Acquire scoped staging; remove all unpublished partial files on exit.
    readonly stage: (
      request: FtcEnvironment.PreparationRequest,
      bytes: Uint8Array,
    ) => Effect.Effect<unknown, FtcEnvironment.PreparationError, Scope.Scope>
    // Atomic app-cache publication; never replace project dependencies or system-wide Java.
    // On interruption/failure publish nothing; preserve previously published components.
    readonly commit: (
      request: FtcEnvironment.PreparationRequest,
      asset: FtcEnvironment.PreparedAsset,
    ) => Effect.Effect<void, FtcEnvironment.PreparationError, Scope.Scope>
  }
}
