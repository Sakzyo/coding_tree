import { expect, test } from "bun:test"
import { Schema } from "effect"
import { FtcConfiguration } from "../src/ftc-configuration"

test("inspection records serialize unknown versions without invented values", () => {
  const value = {
    dependencies: [
      {
        path: "TeamCode/build.gradle",
        kind: "gradle",
        group: "com.pedropathing",
        artifact: "core",
        reason: "dynamic_version",
      },
    ],
    detectedPathing: "unknown",
    conflicts: [],
    sourceRevisions: [{ path: "TeamCode/build.gradle", state: "read", revision: "a".repeat(64) }],
    unknowns: [{ path: "TeamCode/build.gradle", reason: "dynamic_version" }],
  } satisfies FtcConfiguration.InspectionResult
  expect(
    Schema.encodeSync(FtcConfiguration.InspectionResult)(
      Schema.decodeUnknownSync(FtcConfiguration.InspectionResult)(value),
    ),
  ).toEqual(value)
  expect(Schema.encodeSync(FtcConfiguration.InspectionError)({ code: "owner_closed", path: undefined })).toEqual({
    code: "owner_closed",
  })
})

test("inspection contracts reject malformed evidence and language-dependent reasons", () => {
  expect(() =>
    Schema.decodeUnknownSync(FtcConfiguration.InspectionSourceRevision)({
      path: "build.gradle",
      state: "read",
      revision: "not-a-hash",
    }),
  ).toThrow()
  expect(() => Schema.decodeUnknownSync(FtcConfiguration.InspectionUnknown)({ reason: "Unable to inspect" })).toThrow()
})
