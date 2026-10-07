export * as FtcInference from "./ftc-inference"

import { Schema } from "effect"
import { NonNegativeInt, PositiveInt, optional } from "./schema"

const Text = Schema.String.check(Schema.isMinLength(1), Schema.isTrimmed())
const Bytes = NonNegativeInt.check(Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER))
const Budget = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(-Number.MAX_SAFE_INTEGER),
  Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
)
const Tokens = PositiveInt.check(Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER))
const Revision = Text.check(
  Schema.isPattern(/^(?!latest(?:\.|$))(?!(?:next|nightly)$)[a-z0-9][a-z0-9._-]*(?:\+[a-z0-9][a-z0-9._-]*)?$/i),
)

export type Backend = typeof Backend.Type
export const Backend = Schema.Literals(["cpu", "metal", "cuda", "vulkan"]).annotate({
  identifier: "FtcInference.Backend",
})

export type Capability = typeof Capability.Type
export const Capability = Schema.Literals(["structured_tools", "english", "simplified_chinese"]).annotate({
  identifier: "FtcInference.Capability",
})
const Capabilities = Schema.Array(Capability).check(Schema.makeFilter((value) => new Set(value).size === value.length))

export interface Resources extends Schema.Schema.Type<typeof Resources> {}
export const Resources = Schema.Struct({
  // RAM excludes GPU allocations, including allocations in shared memory.
  memoryBytes: Bytes,
  gpuMemoryBytes: Bytes,
  diskBytes: Bytes,
}).annotate({ identifier: "FtcInference.Resources" })

export interface HostResources extends Schema.Schema.Type<typeof HostResources> {}
export const HostResources = Schema.Struct({
  os: Schema.Literals(["macos", "windows"]),
  architecture: Schema.Literals(["arm64", "x64"]),
  availableMemoryBytes: Bytes,
  availableDiskBytes: Bytes,
  backends: Schema.Array(Backend).check(Schema.makeFilter((value) => new Set(value).size === value.length)),
  gpu: optional(Schema.Struct({ availableMemoryBytes: Bytes, memory: Schema.Literals(["shared", "dedicated"]) })),
}).annotate({ identifier: "FtcInference.HostResources" })

export interface ConcurrentWork extends Schema.Schema.Type<typeof ConcurrentWork> {}
export const ConcurrentWork = Schema.Struct({
  desktop: Resources,
  jdt: Resources,
  gradle: Resources,
  projects: Schema.Array(Schema.Struct({ projectID: Text, resources: Resources })).check(
    Schema.makeFilter((value) => new Set(value.map((project) => project.projectID)).size === value.length),
  ),
  requiredContextTokens: Tokens,
  requiredCapabilities: Capabilities,
}).annotate({ identifier: "FtcInference.ConcurrentWork" })

export interface Artifact extends Schema.Schema.Type<typeof Artifact> {}
export const Artifact = Schema.Struct({
  revision: Revision,
  source: Text.check(Schema.makeFilter((value) => URL.canParse(value) && new URL(value).protocol === "https:")),
  sha256: Text.check(Schema.isPattern(/^[a-fA-F0-9]{64}$/)),
  license: Text,
}).annotate({ identifier: "FtcInference.Artifact" })

export type Evaluation = typeof Evaluation.Type
export const Evaluation = Schema.Union([
  Schema.Struct({ status: Schema.Literal("unevaluated") }),
  Schema.Struct({
    status: Schema.Literal("evaluated"),
    kind: Schema.Literals(["synthetic", "platform"]),
    evidence: Schema.Array(Text).check(Schema.isMinLength(1)),
  }),
]).annotate({ identifier: "FtcInference.Evaluation" })

export interface ModelProfile extends Schema.Schema.Type<typeof ModelProfile> {}
export const ModelProfile = Schema.Struct({
  id: Text,
  runtime: Artifact,
  model: Artifact,
  quantization: Text,
  template: Text,
  os: Schema.Literals(["macos", "windows"]),
  architecture: Schema.Literals(["arm64", "x64"]),
  backend: Backend,
  // Resources cover the entire evaluated context; never extrapolate to a larger context.
  contextTokens: Tokens,
  resources: Resources,
  testedCapabilities: Capabilities,
  evaluation: Evaluation,
})
  .annotate({ identifier: "FtcInference.ModelProfile" })
  .check(
    Schema.makeFilter(
      (value) =>
        value.resources.memoryBytes > 0 &&
        value.resources.diskBytes > 0 &&
        (value.backend === "cpu" ? value.resources.gpuMemoryBytes === 0 : value.resources.gpuMemoryBytes > 0),
    ),
  )

export interface Catalog extends Schema.Schema.Type<typeof Catalog> {}
export const Catalog = Schema.Struct({
  kind: Schema.Literals(["production", "synthetic"]),
  profiles: Schema.Array(ModelProfile).check(
    Schema.makeFilter((value) => new Set(value.map((profile) => profile.id)).size === value.length),
  ),
}).annotate({ identifier: "FtcInference.Catalog" })

export interface RecommendationRequest extends Schema.Schema.Type<typeof RecommendationRequest> {}
export const RecommendationRequest = Schema.Struct({
  hostResources: HostResources,
  concurrentWork: ConcurrentWork,
  catalog: Catalog,
}).annotate({ identifier: "FtcInference.RecommendationRequest" })

export type ExclusionCode = typeof ExclusionCode.Type
export const ExclusionCode = Schema.Literals([
  "invalid_input",
  "invalid_catalog",
  "unevaluated_profile",
  "evaluation_kind",
  "unsupported_platform",
  "unsupported_backend",
  "gpu_unavailable",
  "insufficient_memory",
  "insufficient_gpu_memory",
  "insufficient_disk",
  "insufficient_context",
  "untested_capability",
]).annotate({ identifier: "FtcInference.ExclusionCode" })

export interface ExclusionReason extends Schema.Schema.Type<typeof ExclusionReason> {}
export const ExclusionReason = Schema.Struct({
  code: ExclusionCode,
  required: optional(Bytes),
  // Negative available headroom preserves an already overcommitted reservation budget.
  available: optional(Budget),
  capability: optional(Capability),
}).annotate({ identifier: "FtcInference.ExclusionReason" })

export interface ExcludedModel extends Schema.Schema.Type<typeof ExcludedModel> {}
export const ExcludedModel = Schema.Struct({
  profileID: optional(Text),
  reason: ExclusionCode,
  reasons: Schema.Array(ExclusionReason).check(Schema.isMinLength(1)),
}).annotate({ identifier: "FtcInference.ExcludedModel" })

export interface EligibleModel extends Schema.Schema.Type<typeof EligibleModel> {}
export const EligibleModel = Schema.Struct({
  profile: ModelProfile,
  // Together with profile backend/quantization/context/capabilities, these are UI tradeoff facts.
  remainingResources: Resources,
}).annotate({ identifier: "FtcInference.EligibleModel" })

export interface Recommendation extends Schema.Schema.Type<typeof Recommendation> {}
export const Recommendation = Schema.Struct({
  eligible: Schema.Array(EligibleModel),
  excluded: Schema.Array(ExcludedModel),
}).annotate({ identifier: "FtcInference.Recommendation" })
