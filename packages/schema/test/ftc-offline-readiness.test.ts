import { expect, test } from "bun:test"
import { Schema } from "effect"
import { FtcEnvironment } from "../src/ftc-environment"

// Dropping the additive availability field would lose the independent feature report on the wire.
test("offline readiness survives serialization with stable canonical contract identities", () => {
  const value = {
    state: "missing" as const,
    steps: [
      {
        id: "offline_dependencies" as const,
        state: "missing" as const,
        cause: "asset_missing" as const,
        recovery: "prepare_offline" as const,
      },
    ],
    missingAssets: ["gradle-dependency-fixture"],
    availableFeatures: ["editing" as const],
  }
  expect(Schema.encodeSync(FtcEnvironment.Readiness)(value)).toEqual(value)
  expect(
    Schema.decodeUnknownSync(FtcEnvironment.Readiness, { onExcessProperty: "error" })(
      JSON.parse(JSON.stringify(value)),
    ),
  ).toEqual(value)
  expect(
    [FtcEnvironment.OfflineFeature, FtcEnvironment.OfflineAsset, FtcEnvironment.OfflineRequest].map(
      (contract) => contract.ast.annotations?.identifier,
    ),
  ).toEqual(["FtcEnvironment.OfflineFeature", "FtcEnvironment.OfflineAsset", "FtcEnvironment.OfflineRequest"])
})

// Making availableFeatures mandatory or encoding undefined would break prior inspection/setup records.
test("prior readiness records omit undefined offline availability", () => {
  const value = { state: "ready" as const, steps: [], missingAssets: [] }
  expect(Schema.decodeUnknownSync(FtcEnvironment.Readiness)(value)).toEqual(value)
  expect(Schema.encodeSync(FtcEnvironment.Readiness)({ ...value, availableFeatures: undefined })).toEqual(value)
})
