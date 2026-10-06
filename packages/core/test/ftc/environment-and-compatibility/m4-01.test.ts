import { expect, test } from "bun:test"
import { FtcEnvironment } from "@opencode-ai/schema"
import { Profile } from "@opencode-ai/schema/ftc-environment"
import { Schema } from "effect"
import { resolveProfile } from "../../../src/ftc/environment/catalog"

// All versions, URLs, checksums, resource thresholds and evidence here are synthetic.
const artifact = (version: string) => ({
  version,
  source: "https://fixtures.invalid/tool.zip",
  license: "fixture-license",
  sha256: "a".repeat(64),
})
const profile = {
  id: "synthetic-macos-arm64",
  os: "macos",
  osVersions: ["fixture-os"],
  architecture: "arm64",
  resources: { memoryBytes: 8, diskBytes: 16 },
  editorJdk: artifact("21"),
  buildJdk: artifact("17"),
  jdtLs: artifact("fixture-jdt"),
  ftcSdk: artifact("fixture-ftc"),
  androidGradlePlugin: artifact("fixture-agp"),
  androidSdk: artifact("fixture-android"),
  adb: artifact("fixture-adb"),
  gradleWrapper: artifact("fixture-gradle"),
  evaluation: { status: "evaluated", kind: "synthetic", evidence: ["fixture://M4-01"] },
}
const host = {
  os: "macos",
  osVersion: "fixture-os",
  architecture: "arm64",
  resources: { memoryBytes: 8, diskBytes: 16 },
}
const projectVersions = {
  ftcSdk: "fixture-ftc",
  androidGradlePlugin: "fixture-agp",
  androidSdk: "fixture-android",
  gradleWrapper: "fixture-gradle",
}
const catalog = { kind: "synthetic", profiles: [profile] }

test("profile pins independent editor and build runtimes", () => {
  const result = resolveProfile({ host, projectVersions, catalog })
  expect(result.kind).toBe("matched")
  if (result.kind !== "matched") throw new Error("Expected a matched synthetic profile")
  const selected = result.profile
  expect(selected.editorJdk.version).toBe("21")
  expect(selected.buildJdk.version).toBe("17")
  expect(selected.jdtLs.version).toBe("fixture-jdt")
  const unsupported = resolveProfile({ host, projectVersions: { ...projectVersions, ftcSdk: "outside" }, catalog })
  expect(unsupported.kind).toBe("unsupported")
})

test.each([
  ["OS", { ...host, os: "windows" }, "host_os"],
  ["OS version", { ...host, osVersion: "unmeasured-os" }, "host_version"],
  ["architecture", { ...host, architecture: "x64" }, "host_architecture"],
  ["memory", { ...host, resources: { memoryBytes: 7, diskBytes: 16 } }, "host_resources"],
  ["disk", { ...host, resources: { memoryBytes: 8, diskBytes: 15 } }, "host_resources"],
] as const)("rejects incompatible host %s", (_, host, code) => {
  const result = resolveProfile({ host, projectVersions, catalog })
  expect(result.kind).toBe("unsupported")
  if (result.kind !== "unsupported") throw new Error("Expected unsupported host")
  expect(result.reasons).toContainEqual({ code, profileID: profile.id })
})

test.each(["ftcSdk", "androidGradlePlugin", "androidSdk", "gradleWrapper"])(
  "preserves incompatible project requirement %s",
  (component) => {
    const input = { host, projectVersions: { ...projectVersions, [component]: "outside" }, catalog }
    const before = JSON.stringify(input)
    const result = resolveProfile(input)
    expect(result.kind).toBe("unsupported")
    if (result.kind !== "unsupported") throw new Error("Expected unsupported project")
    expect(result.reasons).toContainEqual({ code: "project_version", profileID: profile.id, component })
    expect(JSON.stringify(input)).toBe(before)
  },
)

test("selects a whole matching combination without mixing newer components", () => {
  const result = resolveProfile({
    host,
    projectVersions,
    catalog: {
      kind: "synthetic",
      profiles: [
        { ...profile, id: "synthetic-other", editorJdk: artifact("99"), ftcSdk: artifact("outside") },
        profile,
      ],
    },
  })
  expect(result.kind).toBe("matched")
  if (result.kind !== "matched") throw new Error("Expected a matched synthetic profile")
  expect(result.profile.id).toBe("synthetic-macos-arm64")
  expect(result.profile.editorJdk.version).toBe("21")
  expect(result.profile.ftcSdk.version).toBe("fixture-ftc")
})

test.each([
  ["version", ""],
  ["source", "not-a-url"],
  ["license", " "],
  ["sha256", "not-a-checksum"],
])("rejects invalid artifact %s metadata", (field, value) => {
  const result = resolveProfile({
    host,
    projectVersions,
    catalog: { ...catalog, profiles: [{ ...profile, buildJdk: { ...profile.buildJdk, [field]: value } }] },
  })
  expect(result).toEqual({ kind: "unsupported", reasons: [{ code: "invalid_input" }] })
})

test("rejects invalid host resources and unpinned project versions", () => {
  expect(
    resolveProfile({ host: { ...host, resources: { memoryBytes: -1, diskBytes: 16 } }, projectVersions, catalog }),
  ).toEqual({ kind: "unsupported", reasons: [{ code: "invalid_input" }] })
  expect(resolveProfile({ host, projectVersions: { ...projectVersions, ftcSdk: "latest" }, catalog })).toEqual({
    kind: "unsupported",
    reasons: [{ code: "invalid_input" }],
  })
})

const selectors = [
  "latest.release",
  "latest.integration",
  "1.+",
  "1.2+",
  "1+",
  "LATEST",
  "Latest.Release",
  "LATEST.INTEGRATION",
  "NEXT",
  "Nightly",
]

test.each(selectors)("rejects dynamic artifact version %s", (version) => {
  expect(
    resolveProfile({
      host,
      projectVersions: {},
      catalog: { ...catalog, profiles: [{ ...profile, androidGradlePlugin: artifact(version) }] },
    }),
  ).toEqual({ kind: "unsupported", reasons: [{ code: "invalid_input" }] })
})

test.each(selectors)("rejects dynamic supplied project constraint %s", (version) => {
  expect(
    resolveProfile({
      host,
      projectVersions: { ...projectVersions, androidGradlePlugin: version },
      catalog,
    }),
  ).toEqual({ kind: "unsupported", reasons: [{ code: "invalid_input" }] })
})

test.each(["8.7.3", "8.7.3-rc.1", "8.7.3+build.42"])("matches an exact artifact and project version %s", (version) => {
  const result = resolveProfile({
    host,
    projectVersions: { ...projectVersions, androidGradlePlugin: version },
    catalog: { ...catalog, profiles: [{ ...profile, androidGradlePlugin: artifact(version) }] },
  })
  expect(result.kind).toBe("matched")
  if (result.kind !== "matched") throw new Error("Expected a matched exact version")
  expect(result.profile.androidGradlePlugin.version).toBe(version)
})

test("unevaluated profiles cannot be selected", () => {
  expect(
    resolveProfile({
      host,
      projectVersions,
      catalog: { ...catalog, profiles: [{ ...profile, evaluation: { status: "unevaluated" } }] },
    }),
  ).toEqual({ kind: "unsupported", reasons: [{ code: "unevaluated_profile", profileID: profile.id }] })
})

test("evaluated profiles require evidence", () => {
  expect(
    resolveProfile({
      host,
      projectVersions,
      catalog: { ...catalog, profiles: [{ ...profile, evaluation: { ...profile.evaluation, evidence: [] } }] },
    }),
  ).toEqual({ kind: "unsupported", reasons: [{ code: "invalid_input" }] })
})

test.each([undefined, { status: "evaluated", kind: "platform", evidence: [" "] }])(
  "rejects absent or malformed evaluation provenance %j",
  (evaluation) => {
    expect(
      resolveProfile({ host, projectVersions, catalog: { ...catalog, profiles: [{ ...profile, evaluation }] } }),
    ).toEqual({ kind: "unsupported", reasons: [{ code: "invalid_input" }] })
  },
)

test("rejects duplicate profile identities", () => {
  expect(resolveProfile({ host, projectVersions, catalog: { ...catalog, profiles: [profile, profile] } })).toEqual({
    kind: "unsupported",
    reasons: [{ code: "invalid_input" }],
  })
})

test("does not choose arbitrarily between multiple matching combinations", () => {
  expect(
    resolveProfile({
      host,
      projectVersions,
      catalog: {
        ...catalog,
        profiles: [profile, { ...profile, id: "synthetic-alternative", editorJdk: artifact("22") }],
      },
    }),
  ).toEqual({ kind: "unsupported", reasons: [{ code: "ambiguous_profiles" }] })
})

test("production catalogs cannot claim synthetic evaluations as support", () => {
  expect(resolveProfile({ host, projectVersions, catalog: { ...catalog, kind: "production" } })).toEqual({
    kind: "unsupported",
    reasons: [{ code: "evaluation_kind", profileID: profile.id }],
  })
})

test("supports independently supplied Windows profiles", () => {
  const result = resolveProfile({
    host: { ...host, os: "windows", architecture: "x64" },
    projectVersions,
    catalog: {
      ...catalog,
      profiles: [{ ...profile, id: "synthetic-windows-x64", os: "windows", architecture: "x64" }],
    },
  })
  expect(result.kind).toBe("matched")
  if (result.kind !== "matched") throw new Error("Expected a matched synthetic profile")
  expect(result.profile.id).toBe("synthetic-windows-x64")
})

test("empty production catalog reports no evaluated compatibility profiles", async () => {
  const production = await Bun.file(new URL("../../../resources/ftc/compatibility.json", import.meta.url)).json()
  expect(Schema.decodeUnknownSync(FtcEnvironment.Catalog)(production)).toEqual({ kind: "production", profiles: [] })
  expect(resolveProfile({ host, projectVersions, catalog: production })).toEqual({
    kind: "unsupported",
    reasons: [{ code: "no_profiles" }],
  })
})

test("unknown project dependencies are not silently ignored", () => {
  expect(resolveProfile({ host, projectVersions: { ...projectVersions, unknownDependency: "1" }, catalog })).toEqual({
    kind: "unsupported",
    reasons: [{ code: "invalid_input" }],
  })
})

test.each([{}, { ftcSdk: "fixture-ftc" }])(
  "omitted project constraints permit the one evaluated combination %j",
  (projectVersions) => {
    const result = resolveProfile({ host, projectVersions, catalog })
    expect(result.kind).toBe("matched")
    if (result.kind !== "matched") throw new Error("Expected a matched synthetic profile")
    expect(result.profile.buildJdk.version).toBe("17")
    expect(result.profile.gradleWrapper.version).toBe("fixture-gradle")
  },
)

test("missing project constraints never choose the newest matching profile", () => {
  expect(
    resolveProfile({
      host,
      projectVersions: {},
      catalog: {
        ...catalog,
        profiles: [profile, { ...profile, id: "synthetic-newer", ftcSdk: artifact("fixture-newer") }],
      },
    }),
  ).toEqual({ kind: "unsupported", reasons: [{ code: "ambiguous_profiles" }] })
})

test("profile selection is unchanged by catalog order", () => {
  const other = { ...profile, id: "synthetic-incompatible", ftcSdk: artifact("outside") }
  const before = JSON.stringify(catalog)
  const result = resolveProfile({ host, projectVersions, catalog: { ...catalog, profiles: [other, profile] } })
  expect(resolveProfile({ host, projectVersions, catalog: { ...catalog, profiles: [profile, other] } })).toEqual(result)
  expect(JSON.stringify(catalog)).toBe(before)
})

test("resolved records serialize through the canonical readonly contracts", () => {
  const result = resolveProfile({ host, projectVersions, catalog })
  expect(Schema.decodeUnknownSync(FtcEnvironment.ResolveResult)(JSON.parse(JSON.stringify(result)))).toEqual(result)
  expect(
    Schema.encodeSync(FtcEnvironment.Reason)({ code: "invalid_input", profileID: undefined, component: undefined }),
  ).toEqual({ code: "invalid_input" })
  expect(FtcEnvironment.Profile).toBe(Profile)
  const identifiers = [
    FtcEnvironment.Resources,
    FtcEnvironment.Host,
    FtcEnvironment.Artifact,
    FtcEnvironment.Evaluation,
    FtcEnvironment.Profile,
    FtcEnvironment.ProjectVersions,
    FtcEnvironment.Catalog,
    FtcEnvironment.ResolveRequest,
    FtcEnvironment.Reason,
    FtcEnvironment.ResolveResult,
  ].map((schema) => schema.ast.annotations?.identifier)
  expect(
    identifiers.every((identifier) => typeof identifier === "string" && identifier.startsWith("FtcEnvironment.")),
  ).toBe(true)
  expect(new Set(identifiers).size).toBe(10)
})
