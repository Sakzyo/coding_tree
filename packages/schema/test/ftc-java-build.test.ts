import { expect, test } from "bun:test"
import { Schema } from "effect"
import { FtcJava } from "../src/ftc-java"

const request = {
  project: {
    projectID: "fixture",
    canonicalRoot: "/fixture",
    location: { directory: "/fixture", project: { id: "global", directory: "/" } },
  },
  toolchain: {
    profileID: "fixture",
    buildJdk: "/jdk",
    editorJdk: "/editor",
    androidSdk: "/sdk",
    adb: "/adb",
    gradleWrapper: "/fixture/gradlew",
    versions: {
      buildJdk: "17",
      editorJdk: "21",
      androidSdk: "fixture",
      adb: "fixture",
      gradleWrapper: "fixture",
      ftcSdk: "fixture",
      androidGradlePlugin: "fixture",
    },
  },
  configurationRevision: "config-1",
}
const evidence = {
  buildID: "build_fixture",
  projectID: "fixture",
  sourceRevision: "source-1",
  configurationRevision: "config-1",
  inputChanged: false,
  status: "succeeded" as const,
  logs: [{ sequence: 0, stream: "stdout" as const, text: "actual" }],
  outputComplete: true,
  savedInputsOnly: true as const,
  exclusions: {
    initial: [],
    settlement: [{ path: "Main.java", documentID: "doc_fixture", bufferRevision: 1, diskRevision: 0 }],
  },
  errors: [],
}

test("build request and evidence preserve canonical project, descriptor, saved basis and JSON", () => {
  expect(Schema.encodeSync(FtcJava.BuildRequest)(Schema.decodeUnknownSync(FtcJava.BuildRequest)(request))).toEqual(
    request,
  )
  expect(Schema.encodeSync(FtcJava.BuildEvidence)(Schema.decodeUnknownSync(FtcJava.BuildEvidence)(evidence))).toEqual(
    evidence,
  )
  const settled = { state: "settled" as const, buildID: evidence.buildID, projectID: evidence.projectID, evidence }
  expect(Schema.encodeSync(FtcJava.BuildRecord)(Schema.decodeUnknownSync(FtcJava.BuildRecord)(settled))).toEqual(
    settled,
  )
})

test("optional actual exits and exclusion/error properties omit undefined while encoding", () => {
  const decoded = Schema.decodeUnknownSync(FtcJava.BuildEvidence)(evidence)
  expect(Schema.encodeSync(FtcJava.BuildEvidence)({ ...decoded, exitCode: undefined, signal: undefined })).toEqual(
    evidence,
  )
  expect(
    Schema.encodeSync(FtcJava.BuildError)({ code: "owner_closed", buildID: undefined, projectID: undefined }),
  ).toEqual({ code: "owner_closed" })
  expect(
    Schema.encodeSync(FtcJava.BuildExclusion)({
      path: "Main.java",
      documentID: undefined,
      bufferRevision: undefined,
      diskRevision: undefined,
    }),
  ).toEqual({ path: "Main.java" })
})

test("owner-generated build IDs validate exactly their emitted prefix and are distinct", () => {
  const first = FtcJava.BuildID.create()
  expect(Schema.decodeUnknownSync(FtcJava.BuildID)(first)).toBe(first)
  expect(first).toStartWith("build_")
  expect(first).not.toBe(FtcJava.BuildID.create())
  for (const value of ["build", "builds_fixture", "doc_fixture"])
    expect(() => Schema.decodeUnknownSync(FtcJava.BuildID)(value)).toThrow()
})

test("build contracts have unique stable domain identifiers", () => {
  const names = [
    "BuildID",
    "BuildRequest",
    "BuildExclusion",
    "BuildLog",
    "BuildEvidence",
    "BuildError",
    "BuildQuery",
    "BuildRecord",
  ] as const
  const identifiers = names.map((name) =>
    "identifier" in FtcJava[name] ? FtcJava[name].identifier : FtcJava[name].ast.annotations?.identifier,
  )
  expect(identifiers).toEqual(names.map((name) => `FtcJava.${name}`))
  expect(new Set(identifiers).size).toBe(names.length)
})

test("strict request decoding rejects capability/command/output and invented successful records", () => {
  const decode = Schema.decodeUnknownSync(FtcJava.BuildRequest, { onExcessProperty: "error" })
  for (const extra of [
    { command: "gradle" },
    { task: "assemble" },
    { env: {} },
    { output: "/foreign" },
    { execution: {} },
    { configurationRevision: "" },
  ])
    expect(() => decode({ ...request, ...extra })).toThrow()
  expect(() => Schema.decodeUnknownSync(FtcJava.BuildEvidence)({ ...evidence, status: "verified" })).toThrow()
  expect(() => Schema.decodeUnknownSync(FtcJava.BuildError)({ code: "success" })).toThrow()
  expect(() =>
    Schema.decodeUnknownSync(FtcJava.BuildRecord, { onExcessProperty: "error" })({
      state: "running",
      buildID: evidence.buildID,
      projectID: evidence.projectID,
      evidence,
    }),
  ).toThrow()
})

test.each(["", "../outside", "nested/../outside", "/outside", "C:\\outside"])(
  "unsaved exclusion rejects escaped/empty path %s",
  (value) => {
    expect(() => Schema.decodeUnknownSync(FtcJava.BuildExclusion)({ path: value })).toThrow()
  },
)

test("actual integer exit/log sequences and text-free exclusion records reject malformed wire values", () => {
  expect(() => Schema.decodeUnknownSync(FtcJava.BuildEvidence)({ ...evidence, exitCode: 1.5 })).toThrow()
  expect(() =>
    Schema.decodeUnknownSync(FtcJava.BuildLog)({ sequence: -1, stream: "stdout" as const, text: "actual" }),
  ).toThrow()
  expect(() =>
    Schema.decodeUnknownSync(FtcJava.BuildLog)({ sequence: 0, stream: "combined", text: "actual" }),
  ).toThrow()
  expect(() =>
    Schema.decodeUnknownSync(FtcJava.BuildExclusion, { onExcessProperty: "error" })({
      path: "Main.java",
      text: "secret unsaved",
    }),
  ).toThrow()
  expect(() =>
    Schema.decodeUnknownSync(FtcJava.BuildEvidence, { onExcessProperty: "error" })({ ...evidence, artifact: {} }),
  ).toThrow()
})
