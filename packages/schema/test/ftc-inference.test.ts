import { expect, test } from "bun:test"
import { Schema } from "effect"
import { FtcInference } from "../src"
import { HostResources, Recommendation } from "../src/ftc-inference"

test("root inference export preserves canonical Schema identity", () => {
  expect(FtcInference.HostResources).toBe(HostResources)
  expect(FtcInference.Recommendation).toBe(Recommendation)
})

test("optional GPU facts and exclusion details omit undefined encoded keys", () => {
  expect(
    Schema.encodeSync(FtcInference.HostResources)({
      os: "macos",
      architecture: "arm64",
      availableMemoryBytes: 0,
      availableDiskBytes: 0,
      backends: [],
      gpu: undefined,
    }),
  ).toEqual({ os: "macos", architecture: "arm64", availableMemoryBytes: 0, availableDiskBytes: 0, backends: [] })
  expect(
    Schema.encodeSync(FtcInference.ExcludedModel)({
      profileID: undefined,
      reason: "invalid_input",
      reasons: [{ code: "invalid_input", required: undefined, available: undefined, capability: undefined }],
    }),
  ).toEqual({ reason: "invalid_input", reasons: [{ code: "invalid_input" }] })
})

test("unknown resource facts cannot be represented as known zero budgets", () => {
  expect(() =>
    Schema.decodeUnknownSync(FtcInference.HostResources)({
      os: "macos",
      architecture: "arm64",
      availableMemoryBytes: null,
      availableDiskBytes: 0,
      backends: [],
    }),
  ).toThrow()
  expect(() => Schema.decodeUnknownSync(FtcInference.Resources)({ memoryBytes: 0, diskBytes: 0 })).toThrow()
})

test("public inference schemas have unique domain identifiers", () => {
  const contracts = [
    FtcInference.Backend,
    FtcInference.Capability,
    FtcInference.Resources,
    FtcInference.HostResources,
    FtcInference.ConcurrentWork,
    FtcInference.Artifact,
    FtcInference.Evaluation,
    FtcInference.ModelProfile,
    FtcInference.Catalog,
    FtcInference.RecommendationRequest,
    FtcInference.ExclusionCode,
    FtcInference.ExclusionReason,
    FtcInference.ExcludedModel,
    FtcInference.EligibleModel,
    FtcInference.Recommendation,
  ]
  const identifiers = contracts.map((contract) => contract.ast.annotations?.identifier)
  expect(
    identifiers.every((identifier) => typeof identifier === "string" && identifier.startsWith("FtcInference.")),
  ).toBe(true)
  expect(new Set(identifiers).size).toBe(contracts.length)
})
