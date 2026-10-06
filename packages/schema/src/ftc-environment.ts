export * as FtcEnvironment from "./ftc-environment"

import { Schema } from "effect"
import { NonNegativeInt, optional } from "./schema"

const Text = Schema.String.check(Schema.isMinLength(1), Schema.isTrimmed())
// A plus may introduce exact build metadata, but never an open-ended Gradle selector.
const Version = Text.check(
  Schema.isPattern(
    /^(?!(?:latest(?:\.(?:release|integration))?|next|nightly)$)[a-z0-9][a-z0-9._-]*(?:\+[a-z0-9][a-z0-9._-]*)?$/i,
  ),
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
