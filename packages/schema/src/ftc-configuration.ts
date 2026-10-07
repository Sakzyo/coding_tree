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

export interface HardwareChange extends Schema.Schema.Type<typeof HardwareChange> {}
export const HardwareChange = Schema.Struct({ hardware: Schema.Array(Hub) }).annotate({
  identifier: "FtcConfiguration.HardwareChange",
  parseOptions: { onExcessProperty: "error" },
})

export interface DeviceCatalog extends Schema.Schema.Type<typeof DeviceCatalog> {}
export const DeviceCatalog = Schema.Struct({
  // Trusted producer's selected SDK and project-hub snapshot, not controller configuration.
  sdkVersion: Text,
  revision: Text,
  hubs: Schema.Array(
    Schema.Struct({
      id: Text,
      categories: Schema.Array(
        Schema.Struct({
          category: Text,
          ports: Schema.Array(NonNegativeInt.check(Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER))),
          types: Schema.Array(Text),
        }).annotate({ parseOptions: { onExcessProperty: "error" } }),
      ),
    }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  ),
})
  .annotate({ identifier: "FtcConfiguration.DeviceCatalog" })
  .check(
    Schema.makeFilter(
      (catalog) =>
        new Set(catalog.hubs.map((hub) => hub.id)).size === catalog.hubs.length &&
        catalog.hubs.every(
          (hub) =>
            new Set(hub.categories.map((rule) => rule.category)).size === hub.categories.length &&
            hub.categories.every(
              (rule) =>
                new Set(rule.ports).size === rule.ports.length && new Set(rule.types).size === rule.types.length,
            ),
        ),
      // Effect checks read parser options from their filter annotation.
      { parseOptions: { onExcessProperty: "error" } },
    ),
  )

export interface HardwareError extends Schema.Schema.Type<typeof HardwareError> {}
export const HardwareError = Schema.Struct({
  code: Schema.Literals([
    "invalid_hardware",
    "invalid_catalog",
    "manifest_missing",
    "missing_name",
    "duplicate_name",
    "invalid_hub",
    "duplicate_hub",
    "invalid_category",
    "invalid_port",
    "occupied_port",
    "invalid_type",
  ]),
  field: Schema.Array(Schema.Union([Schema.String, NonNegativeInt])),
}).annotate({ identifier: "FtcConfiguration.HardwareError" })

export type InspectionReason = typeof InspectionReason.Type
export const InspectionReason = Schema.Literals([
  "dynamic_version",
  "unsupported_gradle",
  "unsupported_source",
  "missing_input",
  "file_unavailable",
  "changed_input",
  "manifest_missing",
  "invalid_manifest",
  "unsupported_schema_version",
  "sdk_version_conflict",
]).annotate({ identifier: "FtcConfiguration.InspectionReason" })

export interface InspectionDependency extends Schema.Schema.Type<typeof InspectionDependency> {}
export const InspectionDependency = Schema.Struct({
  path: Text,
  kind: Schema.Literals(["gradle", "java_import"]),
  group: optional(Text),
  artifact: optional(Text),
  version: optional(Text),
  import: optional(Text),
  reason: optional(InspectionReason),
}).annotate({ identifier: "FtcConfiguration.InspectionDependency" })

export interface InspectionUnknown extends Schema.Schema.Type<typeof InspectionUnknown> {}
export const InspectionUnknown = Schema.Struct({ path: Text, reason: InspectionReason }).annotate({
  identifier: "FtcConfiguration.InspectionUnknown",
})

export interface InspectionSourceRevision extends Schema.Schema.Type<typeof InspectionSourceRevision> {}
export const InspectionSourceRevision = Schema.Struct({
  // Project-relative observations, not an atomic whole-project snapshot.
  path: Text,
  state: Schema.Literals(["read", "missing", "unavailable", "changed"]),
  revision: optional(Revision),
}).annotate({ identifier: "FtcConfiguration.InspectionSourceRevision" })

export interface InspectionConflict extends Schema.Schema.Type<typeof InspectionConflict> {}
export const InspectionConflict = Schema.Struct({
  code: Schema.Literals(["both_pathing", "manifest_mismatch", "sdk_version_conflict"]),
  paths: Schema.Array(Text),
}).annotate({ identifier: "FtcConfiguration.InspectionConflict" })

export interface InspectionResult extends Schema.Schema.Type<typeof InspectionResult> {}
export const InspectionResult = Schema.Struct({
  sdkVersion: optional(Text),
  managedPathing: optional(Manifest.fields.managedPathing),
  dependencies: Schema.Array(InspectionDependency),
  detectedPathing: Schema.Literals(["pedro", "road-runner", "both", "neither", "unknown"]),
  conflicts: Schema.Array(InspectionConflict),
  sourceRevisions: Schema.Array(InspectionSourceRevision),
  unknowns: Schema.Array(InspectionUnknown),
}).annotate({ identifier: "FtcConfiguration.InspectionResult" })

export interface InspectionError extends Schema.Schema.Type<typeof InspectionError> {}
export const InspectionError = Schema.Struct({
  code: Schema.Literals([
    "owner_closed",
    "path_outside_project",
    "file_unavailable",
    "reader_unavailable",
    "unsupported_reader",
  ]),
  path: optional(Text),
}).annotate({ identifier: "FtcConfiguration.InspectionError" })
