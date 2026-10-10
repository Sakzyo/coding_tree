import { expect, test } from "bun:test"
import { Schema } from "effect"
import { FtcJava } from "../src/ftc-java"

const ref = {
  buildID: "build_fixture",
  projectID: "fixture",
  sourceRevision: "complete-saved-source",
  configurationRevision: "configuration-1",
  digest: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  path: "/retained/fixture.apk",
}
const currentProject = {
  projectID: "fixture",
  canonicalRoot: "/fixture",
  location: { directory: "/fixture", project: { id: "global", directory: "/" } },
}

test("artifact reference and verification preserve complete identity and JSON", () => {
  expect(Schema.encodeSync(FtcJava.ArtifactRef)(Schema.decodeUnknownSync(FtcJava.ArtifactRef)(ref))).toEqual(ref)
  const request = { ref, currentProject }
  expect(
    Schema.encodeSync(FtcJava.ArtifactVerificationRequest)(
      Schema.decodeUnknownSync(FtcJava.ArtifactVerificationRequest)(request),
    ),
  ).toEqual(request)
  expect(
    Schema.encodeSync(FtcJava.ArtifactQuery)(Schema.decodeUnknownSync(FtcJava.ArtifactQuery)({ buildID: ref.buildID })),
  ).toEqual({ buildID: ref.buildID })
})

test("optional reason and artifact error build ID omit undefined", () => {
  expect(Schema.encodeSync(FtcJava.ArtifactVerificationResult)({ valid: true, reason: undefined })).toEqual({
    valid: true,
  })
  expect(Schema.encodeSync(FtcJava.ArtifactError)({ code: "artifact_unavailable", buildID: undefined })).toEqual({
    code: "artifact_unavailable",
  })
})

test("artifact contracts have stable unique identifiers", () => {
  const names = [
    "ArtifactRef",
    "ArtifactQuery",
    "ArtifactVerificationRequest",
    "ArtifactVerificationResult",
    "ArtifactError",
  ] as const
  expect(names.map((name) => FtcJava[name].ast.annotations?.identifier)).toEqual(names.map((name) => `FtcJava.${name}`))
  expect(new Set(names.map((name) => FtcJava[name].ast.annotations?.identifier)).size).toBe(names.length)
})

for (const invalid of [
  { buildID: "build" },
  { digest: "A".repeat(64) },
  { digest: "f".repeat(63) },
  { digest: "g".repeat(64) },
  { path: "relative.apk" },
  { sourceRevision: [] },
  { sourceRevision: "" },
  { configurationRevision: "" },
  { execution: {} },
  { read: () => new Uint8Array() },
  { success: true },
])
  test(`strict artifact identity rejects ${Object.keys(invalid)[0]}`, () => {
    expect(() =>
      Schema.decodeUnknownSync(FtcJava.ArtifactRef, { onExcessProperty: "error" })({ ...ref, ...invalid }),
    ).toThrow()
  })

test("strict artifact commands reject unknown selection and authority fields", () => {
  expect(() =>
    Schema.decodeUnknownSync(FtcJava.ArtifactQuery, { onExcessProperty: "error" })({
      buildID: ref.buildID,
      path: ref.path,
    }),
  ).toThrow()
  expect(() =>
    Schema.decodeUnknownSync(FtcJava.ArtifactVerificationRequest, { onExcessProperty: "error" })({
      ref,
      currentProject,
      execution: {},
    }),
  ).toThrow()
  expect(() => Schema.decodeUnknownSync(FtcJava.ArtifactError)({ code: "succeeded" })).toThrow()
  expect(() =>
    Schema.decodeUnknownSync(FtcJava.ArtifactVerificationResult)({ valid: false, reason: "arbitrary failure text" }),
  ).toThrow()
})
