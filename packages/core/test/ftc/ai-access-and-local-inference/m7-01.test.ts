import { expect, test } from "bun:test"
import { FtcInference } from "@opencode-ai/schema/ftc-inference"
import { Schema } from "effect"
import { FtcInferenceCatalog } from "../../../src/ftc/inference/catalog"

const profile = {
  id: "synthetic-cpu",
  runtime: {
    revision: "fixture-runtime-1",
    source: "https://example.invalid/runtime",
    sha256: "1".repeat(64),
    license: "fixture-license",
  },
  model: {
    revision: "fixture-model-1",
    source: "https://example.invalid/model",
    sha256: "2".repeat(64),
    license: "fixture-license",
  },
  quantization: "fixture-q4",
  template: "fixture-template",
  os: "macos",
  architecture: "arm64",
  backend: "cpu",
  contextTokens: 4096,
  resources: { memoryBytes: 600, gpuMemoryBytes: 0, diskBytes: 100 },
  testedCapabilities: ["english"],
  evaluation: { status: "evaluated", kind: "synthetic", evidence: ["fixture-only"] },
} as const

const input = {
  hostResources: {
    os: "macos",
    architecture: "arm64",
    availableMemoryBytes: 1000,
    availableDiskBytes: 500,
    backends: ["cpu"],
  },
  concurrentWork: {
    desktop: { memoryBytes: 100, gpuMemoryBytes: 0, diskBytes: 0 },
    jdt: { memoryBytes: 100, gpuMemoryBytes: 0, diskBytes: 0 },
    gradle: { memoryBytes: 100, gpuMemoryBytes: 0, diskBytes: 0 },
    projects: [{ projectID: "fixture-project", resources: { memoryBytes: 100, gpuMemoryBytes: 0, diskBytes: 0 } }],
    requiredContextTokens: 4096,
    requiredCapabilities: ["english"],
  },
  catalog: { kind: "synthetic", profiles: [profile] },
} as const

test("insufficient resources exclude model with a reason", () => {
  const result = FtcInferenceCatalog.recommendModels({
    ...input,
    hostResources: { ...input.hostResources, availableMemoryBytes: 999 },
  })
  expect(result.eligible).toEqual([])
  expect(result.excluded[0]?.reason).toBe("insufficient_memory")
})

test("exact memory boundary includes desktop, JDT, Gradle and concurrent project reservations", () => {
  const result = FtcInferenceCatalog.recommendModels(input)
  expect(result.excluded).toEqual([])
  expect(result.eligible).toHaveLength(1)
})

test.each(["desktop", "jdt", "gradle"] as const)(
  "%s headroom cannot be omitted from memory accounting",
  (component) => {
    const result = FtcInferenceCatalog.recommendModels({
      ...input,
      concurrentWork: {
        ...input.concurrentWork,
        [component]: { ...input.concurrentWork[component], memoryBytes: 101 },
      },
    })
    expect(result.eligible).toEqual([])
    expect(result.excluded[0]?.reason).toBe("insufficient_memory")
  },
)

test("every concurrent project reserves resources", () => {
  const result = FtcInferenceCatalog.recommendModels({
    ...input,
    concurrentWork: {
      ...input.concurrentWork,
      projects: [
        ...input.concurrentWork.projects,
        { projectID: "other-project", resources: { memoryBytes: 1, gpuMemoryBytes: 0, diskBytes: 0 } },
      ],
    },
  })
  expect(result.eligible).toEqual([])
  expect(result.excluded[0]?.reason).toBe("insufficient_memory")
})

test("disk requirements reserve workspace disk before a model download", () => {
  const result = FtcInferenceCatalog.recommendModels({
    ...input,
    concurrentWork: { ...input.concurrentWork, gradle: { ...input.concurrentWork.gradle, diskBytes: 401 } },
  })
  expect(result.eligible).toEqual([])
  expect(result.excluded[0]?.reason).toBe("insufficient_disk")
})

test.each([
  { os: "windows", architecture: "arm64", backends: ["cpu"], want: "unsupported_platform" },
  { os: "macos", architecture: "x64", backends: ["cpu"], want: "unsupported_platform" },
  { os: "macos", architecture: "arm64", backends: ["metal"], want: "unsupported_backend" },
])("rejects incompatible host facts: %j", (fixture) => {
  const result = FtcInferenceCatalog.recommendModels({
    ...input,
    hostResources: {
      ...input.hostResources,
      os: fixture.os,
      architecture: fixture.architecture,
      backends: fixture.backends,
    },
  })
  expect(result.eligible).toEqual([])
  expect(result.excluded[0]?.reason).toBe(fixture.want)
})

test("context requirements cannot silently truncate working history", () => {
  const result = FtcInferenceCatalog.recommendModels({
    ...input,
    concurrentWork: { ...input.concurrentWork, requiredContextTokens: 4097 },
  })
  expect(result.eligible).toEqual([])
  expect(result.excluded[0]?.reason).toBe("insufficient_context")
})

test("required structured tools must have profile-specific test evidence", () => {
  const result = FtcInferenceCatalog.recommendModels({
    ...input,
    concurrentWork: { ...input.concurrentWork, requiredCapabilities: ["structured_tools"] },
  })
  expect(result.eligible).toEqual([])
  expect(result.excluded[0]?.reason).toBe("untested_capability")
})

test.each([
  { evaluation: { status: "unevaluated" }, kind: "synthetic", want: "unevaluated_profile" },
  { evaluation: profile.evaluation, kind: "production", want: "evaluation_kind" },
  { evaluation: { ...profile.evaluation, kind: "platform" }, kind: "synthetic", want: "evaluation_kind" },
])("catalog provenance fails closed: %j", (fixture) => {
  const result = FtcInferenceCatalog.recommendModels({
    ...input,
    catalog: { kind: fixture.kind, profiles: [{ ...profile, evaluation: fixture.evaluation }] },
  })
  expect(result.eligible).toEqual([])
  expect(result.excluded[0]?.reason).toBe(fixture.want)
})

test.each([
  { ...input, hostResources: { ...input.hostResources, availableMemoryBytes: -1 } },
  { ...input, hostResources: { ...input.hostResources, availableMemoryBytes: Number.NaN } },
  { ...input, concurrentWork: { ...input.concurrentWork, desktop: undefined } },
  { ...input, concurrentWork: { ...input.concurrentWork, requiredContextTokens: 0 } },
])("invalid resource facts cannot produce a recommendation: %j", (fixture) => {
  const result = FtcInferenceCatalog.recommendModels(fixture)
  expect(result.eligible).toEqual([])
  expect(result.excluded[0]?.reason).toBe("invalid_input")
})

const gpuProfile = {
  ...profile,
  id: "synthetic-metal",
  backend: "metal",
  resources: { ...profile.resources, memoryBytes: 400, gpuMemoryBytes: 200 },
} as const
const gpuHost = {
  ...input.hostResources,
  backends: ["cpu", "metal"],
  gpu: { availableMemoryBytes: 300, memory: "shared" },
} as const

test.each([
  { memory: "shared", availableMemoryBytes: 999 },
  { memory: "dedicated", availableMemoryBytes: 799 },
])("GPU memory accounting respects the memory pool: %j", (fixture) => {
  const result = FtcInferenceCatalog.recommendModels({
    ...input,
    hostResources: {
      ...gpuHost,
      availableMemoryBytes: fixture.availableMemoryBytes,
      gpu: { ...gpuHost.gpu, memory: fixture.memory },
    },
    catalog: { ...input.catalog, profiles: [gpuProfile] },
  })
  expect(result.eligible).toEqual([])
  expect(result.excluded[0]?.reason).toBe("insufficient_memory")
})

test("dedicated GPU allocation does not consume host RAM", () => {
  const result = FtcInferenceCatalog.recommendModels({
    ...input,
    hostResources: { ...gpuHost, availableMemoryBytes: 800, gpu: { ...gpuHost.gpu, memory: "dedicated" } },
    catalog: { ...input.catalog, profiles: [gpuProfile] },
  })
  expect(result.excluded).toEqual([])
  expect(result.eligible).toHaveLength(1)
})

test("available GPU memory includes concurrent GPU headroom", () => {
  const result = FtcInferenceCatalog.recommendModels({
    ...input,
    hostResources: { ...gpuHost, availableMemoryBytes: 2000 },
    concurrentWork: { ...input.concurrentWork, desktop: { ...input.concurrentWork.desktop, gpuMemoryBytes: 101 } },
    catalog: { ...input.catalog, profiles: [gpuProfile] },
  })
  expect(result.eligible).toEqual([])
  expect(result.excluded[0]?.reason).toBe("insufficient_gpu_memory")
})

test("GPU configuration cannot be eligible without GPU resource facts", () => {
  const result = FtcInferenceCatalog.recommendModels({
    ...input,
    hostResources: { ...input.hostResources, backends: ["cpu", "metal"] },
    catalog: { ...input.catalog, profiles: [gpuProfile] },
  })
  expect(result.eligible).toEqual([])
  expect(result.excluded[0]?.reason).toBe("gpu_unavailable")
})

test.each([
  { ...profile, model: { ...profile.model, revision: "latest" } },
  { ...profile, model: { ...profile.model, revision: "latest.release" } },
  { ...profile, runtime: { ...profile.runtime, sha256: "bad-digest" } },
  { ...profile, model: { ...profile.model, source: "http://example.invalid/model" } },
  { ...profile, model: { ...profile.model, license: " " } },
  { ...profile, template: "" },
  { ...profile, resources: { ...profile.resources, gpuMemoryBytes: 1 } },
  { ...profile, evaluation: { ...profile.evaluation, evidence: [] } },
])("malformed catalog metadata fails closed: %j", (candidate) => {
  const result = FtcInferenceCatalog.recommendModels({ ...input, catalog: { ...input.catalog, profiles: [candidate] } })
  expect(result.eligible).toEqual([])
  expect(result.excluded[0]?.reason).toBe("invalid_catalog")
})

test("duplicate catalog identities cannot yield ambiguous recommendations", () => {
  const result = FtcInferenceCatalog.recommendModels({
    ...input,
    catalog: { ...input.catalog, profiles: [profile, profile] },
  })
  expect(result.eligible).toEqual([])
  expect(result.excluded[0]?.reason).toBe("invalid_catalog")
})

test("eligible results expose measured configuration and exact remaining headroom", () => {
  const result = FtcInferenceCatalog.recommendModels({
    ...input,
    hostResources: { ...gpuHost, availableMemoryBytes: 1200 },
    concurrentWork: {
      ...input.concurrentWork,
      desktop: { ...input.concurrentWork.desktop, gpuMemoryBytes: 100, diskBytes: 100 },
    },
    catalog: { ...input.catalog, profiles: [gpuProfile] },
  })
  expect(result.excluded).toEqual([])
  expect(result.eligible[0]).toMatchObject({
    profile: {
      id: "synthetic-metal",
      backend: "metal",
      quantization: "fixture-q4",
      contextTokens: 4096,
      testedCapabilities: ["english"],
    },
    remainingResources: { memoryBytes: 100, gpuMemoryBytes: 0, diskBytes: 300 },
  })
  expect(Schema.decodeUnknownSync(FtcInference.Recommendation)(JSON.parse(JSON.stringify(result)))).toEqual(result)
})

test("all deficits are returned with stable priority and exact required/available facts", () => {
  const result = FtcInferenceCatalog.recommendModels({
    ...input,
    hostResources: { ...input.hostResources, availableMemoryBytes: 999, availableDiskBytes: 99 },
    concurrentWork: {
      ...input.concurrentWork,
      requiredContextTokens: 4097,
      requiredCapabilities: ["structured_tools", "simplified_chinese"],
    },
  })
  expect(result).toEqual({
    eligible: [],
    excluded: [
      {
        profileID: "synthetic-cpu",
        reason: "insufficient_memory",
        reasons: [
          { code: "insufficient_memory", required: 600, available: 599 },
          { code: "insufficient_disk", required: 100, available: 99 },
          { code: "insufficient_context", required: 4097, available: 4096 },
          { code: "untested_capability", capability: "structured_tools" },
          { code: "untested_capability", capability: "simplified_chinese" },
        ],
      },
    ],
  })
})

test("overcommitted reservations retain the negative available budget in exclusion details", () => {
  const result = FtcInferenceCatalog.recommendModels({
    ...input,
    hostResources: { ...input.hostResources, availableMemoryBytes: 399 },
  })
  expect(result.excluded[0]?.reasons).toEqual([{ code: "insufficient_memory", required: 600, available: -1 }])
  expect(Schema.decodeUnknownSync(FtcInference.Recommendation)(result)).toEqual(result)
})

test("unrequired capabilities do not block a caller-selected workload", () => {
  const result = FtcInferenceCatalog.recommendModels({
    ...input,
    concurrentWork: { ...input.concurrentWork, requiredCapabilities: [] },
  })
  expect(result.eligible).toHaveLength(1)
  expect(result.eligible[0].profile.testedCapabilities).toEqual(["english"])
})

test("supplied platform evidence can select a production profile without asserting real platform support", () => {
  const result = FtcInferenceCatalog.recommendModels({
    ...input,
    catalog: {
      kind: "production",
      profiles: [{ ...profile, evaluation: { ...profile.evaluation, kind: "platform" } }],
    },
  })
  expect(result.eligible).toHaveLength(1)
  expect(result.excluded).toEqual([])
})

test.each([
  {
    ...input,
    concurrentWork: {
      ...input.concurrentWork,
      projects: [...input.concurrentWork.projects, ...input.concurrentWork.projects],
    },
  },
  { ...input, concurrentWork: { ...input.concurrentWork, requiredCapabilities: ["english", "english"] } },
  { ...input, hostResources: { ...input.hostResources, backends: ["cpu", "cpu"] } },
  {
    ...input,
    concurrentWork: { ...input.concurrentWork, desktop: { ...input.concurrentWork.desktop, gpuMemoryBytes: 1 } },
  },
  {
    ...input,
    concurrentWork: {
      ...input.concurrentWork,
      desktop: { ...input.concurrentWork.desktop, memoryBytes: Number.MAX_SAFE_INTEGER },
    },
  },
  { ...input, hostResources: { ...input.hostResources, availableMemoryBytes: Number.POSITIVE_INFINITY } },
  { ...input, concurrentWork: { ...input.concurrentWork, jdt: { ...input.concurrentWork.jdt, memoryBytes: 0.5 } } },
  { ...input, hostResources: { ...input.hostResources, gpu: { memory: "unknown", availableMemoryBytes: 100 } } },
])("ambiguous or inexact resource accounting is rejected: %j", (fixture) => {
  expect(FtcInferenceCatalog.recommendModels(fixture).excluded[0]?.reason).toBe("invalid_input")
})

test("policy preserves supplied facts and separate requests cannot leak selection state", () => {
  const before = JSON.stringify(input)
  expect(FtcInferenceCatalog.recommendModels(input).eligible).toHaveLength(1)
  expect(FtcInferenceCatalog.recommendModels({ ...input, catalog: { kind: "production", profiles: [] } })).toEqual({
    eligible: [],
    excluded: [],
  })
  expect(FtcInferenceCatalog.recommendModels(input).eligible).toHaveLength(1)
  expect(JSON.stringify(input)).toBe(before)
})

test("shipped catalog admits no unmeasured production models", async () => {
  const catalog = Schema.decodeUnknownSync(FtcInference.Catalog)(
    await Bun.file(new URL("../../../resources/ftc/models.json", import.meta.url)).json(),
  )
  expect(catalog.kind).toBe("production")
  expect(FtcInferenceCatalog.recommendModels({ ...input, catalog })).toEqual({ eligible: [], excluded: [] })
})
