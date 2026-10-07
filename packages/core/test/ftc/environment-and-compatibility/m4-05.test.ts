import { expect, test } from "bun:test"
import { Environment } from "../../../src/ftc/environment"

// Removing per-feature dependency evaluation would hide missing cache entries or block editing.
test("missing cache entry does not disable available local features", () => {
  expect(Environment.offlineReadiness).toBeFunction()
  const result = Environment.offlineReadiness({
    tools: [{ id: "editor-fixture", version: "1", sha256: "a".repeat(64), available: true, features: ["editing"] }],
    dependencies: [
      {
        id: "gradle-dependency-fixture",
        version: "1",
        sha256: "b".repeat(64),
        available: false,
        features: ["building"],
      },
    ],
    models: [],
    content: [],
  })
  const availableFeatures = result.availableFeatures
  expect(result.missingAssets).toContain("gradle-dependency-fixture")
  expect(availableFeatures).toContain("editing")
  expect(availableFeatures).not.toContain("building")
  expect(result.state).toBe("missing")
})

const asset = { id: "fixture-asset", version: "1.0.0", sha256: "a".repeat(64), available: true, features: ["editing"] }
const empty = { tools: [], dependencies: [], models: [], content: [] }

// Treating one available prerequisite as sufficient would incorrectly enable building.
test("each feature requires all its declared assets across categories", () => {
  const result = Environment.offlineReadiness({
    tools: [{ ...asset, features: ["editing", "building"] }],
    dependencies: [{ ...asset, id: "android-dependency", available: false, features: ["building"] }],
    models: [{ ...asset, id: "selected-model", available: false, features: ["inference"] }],
    content: [{ ...asset, id: "reference", features: ["learning"] }],
  })
  expect(result.availableFeatures).toEqual(["editing", "learning"])
  expect(result.missingAssets).toEqual(["android-dependency", "selected-model"])
  expect(result.steps).toEqual([
    { id: "offline_tools", state: "ready", cause: "available", recovery: "reuse" },
    { id: "offline_dependencies", state: "missing", cause: "asset_missing", recovery: "prepare_offline" },
    { id: "offline_models", state: "missing", cause: "asset_missing", recovery: "prepare_offline" },
    { id: "offline_content", state: "ready", cause: "available", recovery: "reuse" },
  ])
})

// Ignoring an inventory category would conceal that category's missing local prerequisite.
test.each(["tools", "dependencies", "models", "content"])("missing %s assets stay visible", (category) => {
  const result = Environment.offlineReadiness({ ...empty, [category]: [{ ...asset, available: false }] })
  expect(result.state).toBe("missing")
  expect(result.missingAssets).toEqual(["fixture-asset"])
  expect(result.availableFeatures).toEqual([])
})

// Inferring unrequested features from ready tools would broaden the readiness claim.
test.each(["editing", "building", "learning", "deployment", "robot_network", "inference"])(
  "an independently prepared %s prerequisite enables only that feature",
  (feature) => {
    const result = Environment.offlineReadiness({ ...empty, tools: [{ ...asset, features: [feature] }] })
    expect(result.state).toBe("ready")
    expect(result.missingAssets).toEqual([])
    expect(result.availableFeatures).toEqual([feature])
    expect(result.candidateToolchain).toBeUndefined()
  },
)

// Vacuous truth must not turn absent requirement evidence into prepared offline availability.
test("an empty required inventory makes no feature claim", () => {
  const result = Environment.offlineReadiness(empty)
  expect(result.state).toBe("missing")
  expect(result.availableFeatures).toEqual([])
  expect(result.missingAssets).toEqual([])
  expect(result.steps).toEqual([
    { id: "offline", state: "manual", cause: "requirements_unknown", recovery: "review_project" },
  ])
})

// Accepting malformed producer evidence would publish availability that was never validated.
test.each([
  undefined,
  { tools: [] },
  { ...empty, remote: true },
  { ...empty, tools: [{ ...asset, id: " " }] },
  { ...empty, tools: [{ ...asset, version: "latest.release" }] },
  { ...empty, tools: [{ ...asset, version: "1.+" }] },
  { ...empty, tools: [{ ...asset, sha256: "not-a-checksum" }] },
  { ...empty, tools: [{ ...asset, available: "true" }] },
  { ...empty, tools: [{ ...asset, features: [] }] },
  { ...empty, tools: [{ ...asset, features: ["unknown"] }] },
  { ...empty, tools: [{ ...asset, features: ["editing", "editing"] }] },
  { ...empty, tools: [{ ...asset, remote: true }] },
  { ...empty, tools: [asset, asset] },
  { ...empty, tools: [asset], dependencies: [asset] },
])("malformed or duplicate inventory %# fails closed", (input) => {
  const result = Environment.offlineReadiness(input)
  expect(result.state).toBe("failed")
  expect(result.availableFeatures).toEqual([])
  expect(result.missingAssets).toEqual([])
  expect(result.steps).toEqual([{ id: "offline", state: "failed", cause: "invalid_input", recovery: "review_project" }])
})

// Mutating producer-owned arrays or assets would violate the immutable snapshot boundary.
test("frozen snapshots remain unchanged and separate evaluations do not share state", () => {
  const snapshot = Object.freeze({
    ...empty,
    tools: Object.freeze([Object.freeze({ ...asset, features: Object.freeze(["editing"]) })]),
    dependencies: Object.freeze([]),
    models: Object.freeze([]),
    content: Object.freeze([]),
  })
  const before = JSON.stringify(snapshot)
  expect(Environment.offlineReadiness(snapshot).availableFeatures).toEqual(["editing"])
  expect(Environment.offlineReadiness({ ...empty, tools: [{ ...asset, available: false }] }).availableFeatures).toEqual(
    [],
  )
  expect(Environment.offlineReadiness(snapshot).availableFeatures).toEqual(["editing"])
  expect(JSON.stringify(snapshot)).toBe(before)
})
