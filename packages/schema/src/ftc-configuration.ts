export * as FtcConfiguration from "./ftc-configuration"

import { Schema } from "effect"
import { AbsolutePath, NonNegativeInt, optional } from "./schema"

const Text = Schema.String.check(Schema.isMinLength(1))

export interface Device extends Schema.Schema.Type<typeof Device> {}
export const Device = Schema.Struct({
  // Catalog identifiers; SDK-specific combinations are validated by M6-02.
  category: Text,
  port: NonNegativeInt.check(Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER)),
  type: Text,
  name: Text,
}).annotate({ identifier: "FtcConfiguration.Device", parseOptions: { onExcessProperty: "error" } })

export interface Hub extends Schema.Schema.Type<typeof Hub> {}
export const Hub = Schema.Struct({ id: Text, devices: Schema.Array(Device) }).annotate({
  identifier: "FtcConfiguration.Hub",
  parseOptions: { onExcessProperty: "error" },
})

export interface Manifest extends Schema.Schema.Type<typeof Manifest> {}
export const Manifest = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  hardware: Schema.Array(Hub),
  managedPathing: Schema.Literals(["pedro", "road-runner", "neither"]),
}).annotate({ identifier: "FtcConfiguration.Manifest", parseOptions: { onExcessProperty: "error" } })

export type Revision = typeof Revision.Type
export const Revision = Schema.String.annotate({ identifier: "FtcConfiguration.Revision" }).check(
  Schema.isPattern(/^[a-f0-9]{64}$/),
)

export interface ManifestSnapshot extends Schema.Schema.Type<typeof ManifestSnapshot> {}
export const ManifestSnapshot = Schema.Struct({ revision: Revision, manifest: Manifest }).annotate({
  identifier: "FtcConfiguration.ManifestSnapshot",
})

export interface InitializationProposal extends Schema.Schema.Type<typeof InitializationProposal> {}
export const InitializationProposal = Schema.Struct({
  kind: Schema.Literal("initialization_proposal"),
  filename: Schema.Literal("ftc-project.json"),
  expectedRevision: Schema.Null,
  manifest: Manifest,
}).annotate({ identifier: "FtcConfiguration.InitializationProposal" })

export type ReadResult = typeof ReadResult.Type
export const ReadResult = Schema.Union([ManifestSnapshot, InitializationProposal]).annotate({
  identifier: "FtcConfiguration.ReadResult",
})

export interface ManifestError extends Schema.Schema.Type<typeof ManifestError> {}
export const ManifestError = Schema.Struct({
  code: Schema.Literals([
    "invalid_manifest",
    "unsupported_schema_version",
    "revision_conflict",
    "path_outside_project",
    "file_unavailable",
    "owner_closed",
  ]),
  expectedRevision: optional(Schema.NullOr(Revision)),
  actualRevision: optional(Schema.NullOr(Revision)),
}).annotate({ identifier: "FtcConfiguration.ManifestError" })

export interface ManifestEvent extends Schema.Schema.Type<typeof ManifestEvent> {}
export const ManifestEvent = Schema.Struct({
  type: Schema.Literals(["updated", "external_changed"]),
  // Event placement is local context and is never written into the shared manifest.
  root: AbsolutePath,
  previousRevision: Schema.NullOr(Revision),
  result: ReadResult,
}).annotate({ identifier: "FtcConfiguration.ManifestEvent" })
