export * as InspectionFilesystem from "./inspection-filesystem"

import { FtcConfiguration } from "@opencode-ai/schema/ftc-configuration"
import { Effect, Scope } from "effect"

export interface Project {
  readonly canonicalRoot: string
  readonly identity: string
  // The infrastructure boundary verifies held root identity and protects every ancestor.
  readonly verify: () => Effect.Effect<void, FtcConfiguration.InspectionError>
  readonly readFile: (relative: string) => Effect.Effect<Uint8Array | undefined, FtcConfiguration.InspectionError>
  readonly readDirectory: (
    relative: string,
  ) => Effect.Effect<
    readonly { readonly name: string; readonly type: "file" | "directory" }[] | undefined,
    FtcConfiguration.InspectionError
  >
}

export interface Interface {
  // Required trusted capability; the native adapter is an explicit infrastructure composition.
  // Acquisition owns resources in Scope. Missing inputs return undefined; unsafe/unsupported
  // reads and listings fail before consuming foreign bytes or directory entries.
  readonly openProject: (input: {
    readonly root: string
  }) => Effect.Effect<Project, FtcConfiguration.InspectionError, Scope.Scope>
}
