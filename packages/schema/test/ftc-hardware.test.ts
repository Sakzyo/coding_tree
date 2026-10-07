import { expect, test } from "bun:test"
import { Schema } from "effect"
import { FtcConfiguration } from "../src/ftc-configuration"

const catalog = {
  sdkVersion: "fixture-sdk-1",
  revision: "fixture-catalog-1",
  hubs: [{ id: "hub-a", categories: [{ category: "motor", ports: [0], types: ["fixture.Motor"] }] }],
}

// Accepting ambiguous producer rules would make command validation depend on array ordering.
test.each([
  { ...catalog, hubs: [catalog.hubs[0], catalog.hubs[0]] },
  { ...catalog, hubs: [{ id: "hub-a", categories: [catalog.hubs[0].categories[0], catalog.hubs[0].categories[0]] }] },
  { ...catalog, hubs: [{ id: "hub-a", categories: [{ category: "motor", ports: [0, 0], types: ["fixture.Motor"] }] }] },
  {
    ...catalog,
    hubs: [{ id: "hub-a", categories: [{ category: "motor", ports: [0], types: ["fixture.Motor", "fixture.Motor"] }] }],
  },
  { ...catalog, machinePath: "/private/fixture" },
])("catalog rejects ambiguous or machine-local producer data %j", (input) => {
  expect(() => Schema.decodeUnknownSync(FtcConfiguration.DeviceCatalog)(input)).toThrow()
})

// Changing or dropping identifiers/field positions would break language-independent caller handling.
test("hardware contracts preserve exact serializable identifiers and error fields", () => {
  const decoded = Schema.decodeUnknownSync(FtcConfiguration.DeviceCatalog)(catalog)
  expect(Schema.encodeSync(FtcConfiguration.DeviceCatalog)(decoded)).toEqual(catalog)
  const error = { code: "duplicate_name", field: ["hardware", 1, "devices", 0, "name"] } as const
  expect(
    Schema.encodeSync(FtcConfiguration.HardwareError)(Schema.decodeUnknownSync(FtcConfiguration.HardwareError)(error)),
  ).toEqual(error)
  const identifiers = [
    FtcConfiguration.HardwareChange,
    FtcConfiguration.DeviceCatalog,
    FtcConfiguration.HardwareError,
  ].map((schema) => schema.ast.annotations?.identifier)
  expect(identifiers).toEqual([
    "FtcConfiguration.HardwareChange",
    "FtcConfiguration.DeviceCatalog",
    "FtcConfiguration.HardwareError",
  ])
})
