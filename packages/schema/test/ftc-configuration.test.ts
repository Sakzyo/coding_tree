import { expect, test } from "bun:test"
import { Schema } from "effect"
import { FtcConfiguration } from "../src/index"

const manifest = {
  schemaVersion: 1,
  hardware: [{ id: "hub-a", devices: [{ category: "motor", port: 0, type: "catalog-type", name: "drive" }] }],
  managedPathing: "neither",
}

test.each([
  { ...manifest, credentials: "secret" },
  { ...manifest, hardware: [{ ...manifest.hardware[0], chat: "personal" }] },
  {
    ...manifest,
    hardware: [{ ...manifest.hardware[0], devices: [{ ...manifest.hardware[0].devices[0], approval: true }] }],
  },
])("canonical manifest decoder rejects additional personal fields %j", (value) => {
  expect(() => Schema.decodeUnknownSync(FtcConfiguration.Manifest)(value)).toThrow()
})

test("hardware and proposals serialize without machine-local fields or undefined error keys", () => {
  const decoded = Schema.decodeUnknownSync(FtcConfiguration.Manifest)(manifest)
  expect(JSON.parse(JSON.stringify(Schema.encodeSync(FtcConfiguration.Manifest)(decoded)))).toEqual(manifest)
  expect(
    Schema.encodeSync(FtcConfiguration.ManifestError)({
      code: "invalid_manifest",
      actualRevision: undefined,
      expectedRevision: undefined,
    }),
  ).toEqual({ code: "invalid_manifest" })
})

test("public contract identifiers are unique and domain-qualified", () => {
  const identifiers = [
    FtcConfiguration.Device,
    FtcConfiguration.Hub,
    FtcConfiguration.Manifest,
    FtcConfiguration.Revision,
    FtcConfiguration.ManifestSnapshot,
    FtcConfiguration.InitializationProposal,
    FtcConfiguration.ReadResult,
    FtcConfiguration.ManifestError,
    FtcConfiguration.ManifestEvent,
  ].map((schema) => schema.ast.annotations?.identifier)
  expect(
    identifiers.every((identifier) => typeof identifier === "string" && identifier.startsWith("FtcConfiguration.")),
  ).toBe(true)
  expect(new Set(identifiers).size).toBe(9)
})
