export * as FtcEnvironment from "./ftc-environment"

import { Schema } from "effect"
import { NonNegativeInt, optional } from "./schema"
import { Project } from "./project"

const Text = Schema.String.check(Schema.isMinLength(1), Schema.isTrimmed())
// Reject every latest.<status> selector; a plus must introduce exact build metadata.
const Version = Text.check(
  Schema.isPattern(/^(?!latest(?:\.|$))(?!(?:next|nightly)$)[a-z0-9][a-z0-9._-]*(?:\+[a-z0-9][a-z0-9._-]*)?$/i),
)
const Bytes = NonNegativeInt.check(Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER))
const Os = Schema.Literals(["macos", "windows"])
const Architecture = Schema.Literals(["arm64", "x64"])

export interface Resources extends Schema.Schema.Type<typeof Resources> {}
export const Resources = Schema.Struct({
  memoryBytes: Bytes,
  diskBytes: Bytes,
}).annotate({ identifier: "FtcEnvironment.Resources" })

export interface Host extends Schema.Schema.Type<typeof Host> {}
export const Host = Schema.Struct({
  os: Os,
  osVersion: Text,
  architecture: Architecture,
  resources: Resources,
}).annotate({ identifier: "FtcEnvironment.Host" })

export interface Artifact extends Schema.Schema.Type<typeof Artifact> {}
export const Artifact = Schema.Struct({
  version: Version,
  source: Text.check(Schema.makeFilter((value) => URL.canParse(value) && new URL(value).protocol === "https:")),
  license: Text,
  sha256: Text.check(Schema.isPattern(/^[a-fA-F0-9]{64}$/)),
}).annotate({ identifier: "FtcEnvironment.Artifact" })

export type Evaluation = typeof Evaluation.Type
export const Evaluation = Schema.Union([
  Schema.Struct({ status: Schema.Literal("unevaluated") }),
  Schema.Struct({
    status: Schema.Literal("evaluated"),
    kind: Schema.Literals(["synthetic", "platform"]),
    evidence: Schema.Array(Text).check(Schema.isMinLength(1)),
  }),
]).annotate({ identifier: "FtcEnvironment.Evaluation" })

export interface Profile extends Schema.Schema.Type<typeof Profile> {}
export const Profile = Schema.Struct({
  id: Text,
  os: Os,
  osVersions: Schema.Array(Text).check(Schema.isMinLength(1)),
  architecture: Architecture,
  resources: Resources,
  editorJdk: Artifact,
  buildJdk: Artifact,
  jdtLs: Artifact,
  ftcSdk: Artifact,
  androidGradlePlugin: Artifact,
  androidSdk: Artifact,
  adb: Artifact,
  gradleWrapper: Artifact,
  evaluation: Evaluation,
}).annotate({ identifier: "FtcEnvironment.Profile" })

export interface ProjectVersions extends Schema.Schema.Type<typeof ProjectVersions> {}
export const ProjectVersions = Schema.Struct({
  ftcSdk: optional(Version),
  androidGradlePlugin: optional(Version),
  androidSdk: optional(Version),
  gradleWrapper: optional(Version),
}).annotate({ identifier: "FtcEnvironment.ProjectVersions" })

export interface Catalog extends Schema.Schema.Type<typeof Catalog> {}
export const Catalog = Schema.Struct({
  kind: Schema.Literals(["production", "synthetic"]),
  profiles: Schema.Array(Profile),
})
  .annotate({ identifier: "FtcEnvironment.Catalog" })
  .check(
    Schema.makeFilter((value) => new Set(value.profiles.map((profile) => profile.id)).size === value.profiles.length),
  )

export interface ResolveRequest extends Schema.Schema.Type<typeof ResolveRequest> {}
export const ResolveRequest = Schema.Struct({
  host: Host,
  projectVersions: ProjectVersions,
  catalog: Catalog,
}).annotate({ identifier: "FtcEnvironment.ResolveRequest" })

export interface Reason extends Schema.Schema.Type<typeof Reason> {}
export const Reason = Schema.Struct({
  code: Schema.Literals([
    "invalid_input",
    "no_profiles",
    "unevaluated_profile",
    "evaluation_kind",
    "host_os",
    "host_version",
    "host_architecture",
    "host_resources",
    "project_version",
    "ambiguous_profiles",
  ]),
  profileID: optional(Text),
  component: optional(Schema.Literals(["ftcSdk", "androidGradlePlugin", "androidSdk", "gradleWrapper"])),
}).annotate({ identifier: "FtcEnvironment.Reason" })

export type ResolveResult = typeof ResolveResult.Type
export const ResolveResult = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("matched"), profile: Profile }),
  Schema.Struct({ kind: Schema.Literal("unsupported"), reasons: Schema.Array(Reason).check(Schema.isMinLength(1)) }),
]).annotate({ identifier: "FtcEnvironment.ResolveResult" })

const LocalPath = Text.check(Schema.isPattern(/^(?:\/|[a-zA-Z]:[\\/]|\\\\)/))

export type ToolComponent = typeof ToolComponent.Type
export const ToolComponent = Schema.Literals(["buildJdk", "editorJdk", "androidSdk", "adb", "gradleWrapper"]).annotate({
  identifier: "FtcEnvironment.ToolComponent",
})

export interface InspectionProject extends Schema.Schema.Type<typeof InspectionProject> {}
export const InspectionProject = Schema.Struct({ root: LocalPath }).annotate({
  identifier: "FtcEnvironment.InspectionProject",
})

export interface InspectRequest extends Schema.Schema.Type<typeof InspectRequest> {}
export const InspectRequest = Schema.Struct({ host: Host, project: InspectionProject, catalog: Catalog }).annotate({
  identifier: "FtcEnvironment.InspectRequest",
})

export interface InspectionError extends Schema.Schema.Type<typeof InspectionError> {}
export const InspectionError = Schema.Struct({
  code: Schema.Literals(["binary_missing", "permission_denied", "manual_required", "probe_failed"]),
  detail: optional(Text),
}).annotate({ identifier: "FtcEnvironment.InspectionError" })

export interface ProbeRequest extends Schema.Schema.Type<typeof ProbeRequest> {}
export const ProbeRequest = Schema.Struct({
  component: ToolComponent,
  host: Host,
  project: InspectionProject,
  expectedVersion: optional(Version),
  // A read-only staged probe; host adapters must not discover a different installed tool.
  path: optional(LocalPath),
}).annotate({ identifier: "FtcEnvironment.ProbeRequest" })

export type ProbeResult = typeof ProbeResult.Type
export const ProbeResult = Schema.Union([
  Schema.Struct({ state: Schema.Literal("available"), path: LocalPath, version: Version }),
  Schema.Struct({
    state: Schema.Literals(["missing", "denied", "manual", "failed"]),
    detail: optional(Text),
  }),
]).annotate({ identifier: "FtcEnvironment.ProbeResult" })

export interface ToolchainVersions extends Schema.Schema.Type<typeof ToolchainVersions> {}
export const ToolchainVersions = Schema.Struct({
  buildJdk: Version,
  editorJdk: Version,
  androidSdk: Version,
  adb: Version,
  gradleWrapper: Version,
  ftcSdk: Version,
  androidGradlePlugin: Version,
}).annotate({ identifier: "FtcEnvironment.ToolchainVersions" })

// Discovery produces a candidate; only later build verification can establish setup readiness.
export interface ToolchainDescriptor extends Schema.Schema.Type<typeof ToolchainDescriptor> {}
export const ToolchainDescriptor = Schema.Struct({
  profileID: Text,
  buildJdk: LocalPath,
  editorJdk: LocalPath,
  androidSdk: LocalPath,
  adb: LocalPath,
  gradleWrapper: LocalPath,
  versions: ToolchainVersions,
}).annotate({ identifier: "FtcEnvironment.ToolchainDescriptor" })

export interface ReadinessStep extends Schema.Schema.Type<typeof ReadinessStep> {}
export const ReadinessStep = Schema.Struct({
  id: Schema.Literals(["project", "profile", "buildJdk", "editorJdk", "androidSdk", "adb", "gradleWrapper", "build"]),
  state: Schema.Literals(["ready", "missing", "incompatible", "failed", "manual", "pending"]),
  cause: Schema.Literals([
    "available",
    "binary_missing",
    "permission_denied",
    "manual_required",
    "probe_failed",
    "invalid_input",
    "invalid_response",
    "version_mismatch",
    "requirements_unknown",
    "unsupported_profile",
    "build_unverified",
    "build_failed",
    "build_stale",
    "license_required",
    "download_failed",
    "checksum_mismatch",
    "preparation_failed",
  ]),
  recovery: Schema.Literals([
    "reuse",
    "install",
    "grant_permission",
    "manual_setup",
    "retry_probe",
    "review_project",
    "verify_build",
  ]),
  detail: optional(Text),
  reasons: optional(Schema.Array(Reason)),
}).annotate({ identifier: "FtcEnvironment.ReadinessStep" })

export interface Readiness extends Schema.Schema.Type<typeof Readiness> {}
export const Readiness = Schema.Struct({
  // Missing includes pending verification/manual prerequisites; missingAssets lists absent tools separately.
  state: Schema.Literals(["ready", "missing", "incompatible", "failed"]),
  steps: Schema.Array(ReadinessStep),
  missingAssets: Schema.Array(Text),
  candidateToolchain: optional(ToolchainDescriptor),
}).annotate({ identifier: "FtcEnvironment.Readiness" })

export interface PrepareRequest extends Schema.Schema.Type<typeof PrepareRequest> {}
export const PrepareRequest = Schema.Struct({
  choice: Schema.Literals(["guided", "automatic"]),
  profileID: Text,
  projectID: Project.ID.check(Schema.isMinLength(1), Schema.isTrimmed()),
}).annotate({ identifier: "FtcEnvironment.PrepareRequest" })

export interface PreparationRequest extends Schema.Schema.Type<typeof PreparationRequest> {}
export const PreparationRequest = Schema.Struct({
  projectID: Project.ID.check(Schema.isMinLength(1), Schema.isTrimmed()),
  profileID: Text,
  component: ToolComponent,
  artifact: Artifact,
  host: Host,
}).annotate({ identifier: "FtcEnvironment.PreparationRequest" })

// Trusted host approval evidence, never an agent/public prepare request field.
export interface PreparationAuthorization extends Schema.Schema.Type<typeof PreparationAuthorization> {}
export const PreparationAuthorization = Schema.Struct({
  projectID: Project.ID.check(Schema.isMinLength(1), Schema.isTrimmed()),
  profileID: Text,
  component: ToolComponent,
  artifact: Artifact,
  licenseAccepted: Schema.Boolean,
  systemPermissionGranted: Schema.Boolean,
}).annotate({ identifier: "FtcEnvironment.PreparationAuthorization" })

export interface PreparedAsset extends Schema.Schema.Type<typeof PreparedAsset> {}
export const PreparedAsset = Schema.Struct({
  archivePath: LocalPath,
  path: LocalPath,
}).annotate({ identifier: "FtcEnvironment.PreparedAsset" })

export interface PreparationError extends Schema.Schema.Type<typeof PreparationError> {}
export const PreparationError = Schema.Struct({
  code: Schema.Literals([
    "license_required",
    "permission_denied",
    "download_failed",
    "checksum_mismatch",
    "preparation_failed",
    "invalid_response",
  ]),
}).annotate({ identifier: "FtcEnvironment.PreparationError" })

export interface ReadinessRequest extends Schema.Schema.Type<typeof ReadinessRequest> {}
export const ReadinessRequest = Schema.Struct({
  projectID: Project.ID.check(Schema.isMinLength(1), Schema.isTrimmed()),
}).annotate({
  identifier: "FtcEnvironment.ReadinessRequest",
})

export interface SetupContext extends Schema.Schema.Type<typeof SetupContext> {}
export const SetupContext = Schema.Struct({
  inspection: InspectRequest,
  sourceRevision: Text,
  configurationRevision: Text,
  dirty: Schema.Boolean,
}).annotate({ identifier: "FtcEnvironment.SetupContext" })

export interface BuildRequest extends Schema.Schema.Type<typeof BuildRequest> {}
export const BuildRequest = Schema.Struct({
  projectID: Project.ID.check(Schema.isMinLength(1), Schema.isTrimmed()),
  root: LocalPath,
  toolchain: ToolchainDescriptor,
  sourceRevision: Text,
  configurationRevision: Text,
}).annotate({ identifier: "FtcEnvironment.BuildRequest" })

export type BuildVerification = typeof BuildVerification.Type
export const BuildVerification = Schema.Union([
  Schema.Struct({
    state: Schema.Literal("verified"),
    projectID: Project.ID.check(Schema.isMinLength(1), Schema.isTrimmed()),
    root: LocalPath,
    toolchain: ToolchainDescriptor,
    sourceRevision: Text,
    configurationRevision: Text,
    apkSha256: Text.check(Schema.isPattern(/^[a-fA-F0-9]{64}$/)),
    current: Schema.Literal(true),
  }),
  Schema.Struct({ state: Schema.Literals(["failed", "stale"]), detail: optional(Text) }),
]).annotate({ identifier: "FtcEnvironment.BuildVerification" })

export interface SetupError extends Schema.Schema.Type<typeof SetupError> {}
export const SetupError = Schema.Struct({
  code: Schema.Literals(["invalid_input", "busy", "cancelled", "closed", "context_failed", "build_failed"]),
  detail: optional(Text),
}).annotate({ identifier: "FtcEnvironment.SetupError" })

export interface SetupStep extends Schema.Schema.Type<typeof SetupStep> {}
export const SetupStep = Schema.Struct({
  step: ReadinessStep,
  messageKey: Schema.Literals([
    "ftc.setup.install",
    "ftc.setup.permission",
    "ftc.setup.review",
    "ftc.setup.recheck",
    "ftc.setup.verify",
    "ftc.setup.available",
  ]),
  os: optional(Os),
  osVersion: optional(Text),
  architecture: optional(Architecture),
  version: optional(Version),
  source: optional(Text),
  license: optional(Text),
}).annotate({ identifier: "FtcEnvironment.SetupStep" })

export interface SetupResult extends Schema.Schema.Type<typeof SetupResult> {}
export const SetupResult = Schema.Struct({
  state: Schema.Literals(["completed", "cancelled"]),
  readiness: Readiness,
  steps: Schema.Array(SetupStep),
  buildEvidence: optional(BuildVerification),
}).annotate({ identifier: "FtcEnvironment.SetupResult" })

export type SetupEvent = typeof SetupEvent.Type
export const SetupEvent = Schema.Union([
  Schema.Struct({
    projectID: Project.ID.check(Schema.isMinLength(1), Schema.isTrimmed()),
    type: Schema.Literal("step"),
    step: SetupStep,
  }),
  Schema.Struct({
    projectID: Project.ID.check(Schema.isMinLength(1), Schema.isTrimmed()),
    type: Schema.Literal("settled"),
    result: SetupResult,
  }),
]).annotate({ identifier: "FtcEnvironment.SetupEvent" })
