import { expect, test } from "bun:test"
import { FtcEnvironment } from "@opencode-ai/schema/ftc-environment"
import { Effect, Fiber, Schema } from "effect"
import { Environment, inspectEnvironment } from "../../../src/ftc/environment"
import { EnvironmentAdapters } from "../../../src/ftc/environment/adapters"

// Everything in this catalog is synthetic, including the version strings and resource thresholds.
const artifact = (version: string) => ({
  version,
  source: "https://fixtures.invalid/tool.zip",
  license: "fixture-license",
  sha256: "a".repeat(64),
})
const profile = {
  id: "synthetic-macos-arm64",
  os: "macos" as const,
  osVersions: ["fixture-os"],
  architecture: "arm64" as const,
  resources: { memoryBytes: 8, diskBytes: 16 },
  editorJdk: artifact("21"),
  buildJdk: artifact("17"),
  jdtLs: artifact("fixture-jdt"),
  ftcSdk: artifact("fixture-ftc"),
  androidGradlePlugin: artifact("fixture-agp"),
  androidSdk: artifact("fixture-android"),
  adb: artifact("fixture-adb"),
  gradleWrapper: artifact("fixture-gradle"),
  evaluation: { status: "evaluated" as const, kind: "synthetic" as const, evidence: ["fixture://M4-02"] },
}
const host = {
  os: "macos" as const,
  osVersion: "fixture-os",
  architecture: "arm64" as const,
  resources: { memoryBytes: 8, diskBytes: 16 },
}
const versions = {
  ftcSdk: "fixture-ftc",
  androidGradlePlugin: "fixture-agp",
  androidSdk: "fixture-android",
  gradleWrapper: "fixture-gradle",
}
const catalog = { kind: "synthetic" as const, profiles: [profile] }
const project = { root: "/private/tmp/fixture-import" }
const input = { host, project, catalog }
const calls: FtcEnvironment.ProbeRequest[] = []
const ports = (changes: Partial<Record<FtcEnvironment.ToolComponent, unknown>> = {}): EnvironmentAdapters.Ports => ({
  dependencies: { read: () => Effect.succeed(versions) },
  probes: {
    inspect: (request) =>
      Effect.sync(() => {
        calls.push(request)
        return (
          changes[request.component] ?? {
            state: "available",
            path:
              request.component === "gradleWrapper"
                ? `${request.project.root}/gradlew`
                : `/fixture/${request.component}`,
            version: profile[request.component].version,
          }
        )
      }),
  },
})

test("inspection preserves incompatible imported files", async () => {
  const root = await Bun.$`mktemp -d /private/tmp/ftc-m4-02-import.XXXXXX`.text().then((value) => value.trim())
  const files = ["build.gradle", "gradlew", "ftc-project.json"]
  await Promise.all(files.map((file) => Bun.write(`${root}/${file}`, `unchanged ${file}`)))
  const beforeFiles = await Promise.all(files.map((file) => Bun.file(`${root}/${file}`).text()))
  const probes: string[] = []
  const result = await Effect.runPromise(
    inspectEnvironment(
      { host, project: { root }, catalog },
      {
        dependencies: { read: () => Effect.succeed({ ...versions, ftcSdk: "outside" }) },
        probes: {
          inspect: (request: { component: string }) => {
            probes.push(request.component)
            return Effect.succeed({ state: "available", path: `${root}/${request.component}`, version: "17" })
          },
        },
      },
    ),
  )
  const afterFiles = await Promise.all(files.map((file) => Bun.file(`${root}/${file}`).text()))
  await Bun.$`rm -r ${root}`
  expect(afterFiles).toEqual(beforeFiles)
  expect(result.state).toBe("incompatible")
  expect(probes).toContain("adb")
})

test("working tools produce a pinned candidate while build verification remains pending", async () => {
  const before = calls.length
  const result = await Effect.runPromise(inspectEnvironment(input, ports()))
  expect(result.state).toBe("missing")
  expect(result.missingAssets).toEqual([])
  expect(result.steps.find((step) => step.id === "build")).toEqual({
    id: "build",
    state: "pending",
    cause: "build_unverified",
    recovery: "verify_build",
  })
  expect(result.candidateToolchain).toEqual({
    profileID: profile.id,
    buildJdk: "/fixture/buildJdk",
    editorJdk: "/fixture/editorJdk",
    androidSdk: "/fixture/androidSdk",
    adb: "/fixture/adb",
    gradleWrapper: `${project.root}/gradlew`,
    versions: { ...versions, buildJdk: "17", editorJdk: "21", adb: "fixture-adb" },
  })
  expect(calls.slice(before).map((request) => [request.component, request.expectedVersion])).toEqual([
    ["buildJdk", "17"],
    ["editorJdk", "21"],
    ["androidSdk", "fixture-android"],
    ["adb", "fixture-adb"],
    ["gradleWrapper", "fixture-gradle"],
  ])
  expect(Schema.decodeUnknownSync(FtcEnvironment.Readiness)(JSON.parse(JSON.stringify(result)))).toEqual(result)
})

test.each(["buildJdk", "editorJdk", "androidSdk", "adb", "gradleWrapper"] as const)(
  "missing %s is an installable missing asset, not a failed probe",
  async (component) => {
    const result = await Effect.runPromise(inspectEnvironment(input, ports({ [component]: { state: "missing" } })))
    expect(result.state).toBe("missing")
    expect(result.missingAssets).toEqual([component])
    expect(result.candidateToolchain).toBeUndefined()
    expect(result.steps.find((step) => step.id === component)).toEqual({
      id: component,
      state: "missing",
      cause: "binary_missing",
      recovery: "install",
    })
  },
)

test.each([
  ["failed", "failed", "probe_failed", "retry_probe"],
  ["denied", "missing", "permission_denied", "grant_permission"],
  ["manual", "missing", "manual_required", "manual_setup"],
] as const)("reports %s probes distinctly", async (state, readiness, cause, recovery) => {
  const result = await Effect.runPromise(inspectEnvironment(input, ports({ adb: { state, detail: "fixture detail" } })))
  expect(result.state).toBe(readiness)
  expect(result.missingAssets).toEqual([])
  expect(result.candidateToolchain).toBeUndefined()
  expect(result.steps.find((step) => step.id === "adb")).toEqual({
    id: "adb",
    state: state === "failed" ? "failed" : "manual",
    cause,
    recovery,
    detail: "fixture detail",
  })
})

test.each(["binary_missing", "permission_denied", "manual_required", "probe_failed"] as const)(
  "typed probe error %s remains a recoverable step and later probes still run",
  async (code) => {
    const requests: string[] = []
    const supplied = ports()
    const result = await Effect.runPromise(
      inspectEnvironment(input, {
        ...supplied,
        probes: {
          inspect: (request) => {
            requests.push(request.component)
            return request.component === "buildJdk" ? Effect.fail({ code }) : supplied.probes.inspect(request)
          },
        },
      }),
    )
    expect(result.steps.find((step) => step.id === "buildJdk")?.cause).toBe(code)
    expect(requests).toContain("gradleWrapper")
    expect(result.candidateToolchain).toBeUndefined()
  },
)

test.each(["buildJdk", "editorJdk", "androidSdk", "adb", "gradleWrapper"] as const)(
  "rejects %s version mismatch without replacing working tools",
  async (component) => {
    const result = await Effect.runPromise(
      inspectEnvironment(
        input,
        ports({
          [component]: {
            state: "available",
            path: component === "gradleWrapper" ? `${project.root}/gradlew` : `/fixture/${component}`,
            version: "outside",
          },
        }),
      ),
    )
    expect(result.state).toBe("incompatible")
    expect(result.steps.find((step) => step.id === component)?.cause).toBe("version_mismatch")
    expect(result.candidateToolchain).toBeUndefined()
  },
)

test.each([{}, { ftcSdk: "fixture-ftc" }])(
  "unknown imported requirements %j need manual inspection",
  async (snapshot) => {
    const result = await Effect.runPromise(
      inspectEnvironment(input, {
        ...ports(),
        dependencies: { read: () => Effect.succeed(snapshot) },
      }),
    )
    expect(result.state).toBe("missing")
    expect(result.steps.find((step) => step.id === "project")).toEqual({
      id: "project",
      state: "manual",
      cause: "requirements_unknown",
      recovery: "review_project",
    })
    expect(result.candidateToolchain).toBeUndefined()
  },
)

test.each([undefined, { ...versions, unexpected: "1" }, { ...versions, ftcSdk: "latest" }])(
  "malformed dependency snapshot %j fails without claiming compatibility",
  async (snapshot) => {
    const result = await Effect.runPromise(
      inspectEnvironment(input, {
        ...ports(),
        dependencies: { read: () => Effect.succeed(snapshot) },
      }),
    )
    expect(result.state).toBe("failed")
    expect(result.steps.find((step) => step.id === "project")?.cause).toBe("invalid_response")
    expect(result.candidateToolchain).toBeUndefined()
  },
)

test("dependency permission failure is manual and does not skip tool inspection", async () => {
  const before = calls.length
  const result = await Effect.runPromise(
    inspectEnvironment(input, {
      ...ports(),
      dependencies: { read: () => Effect.fail({ code: "permission_denied" }) },
    }),
  )
  expect(result.state).toBe("missing")
  expect(result.steps.find((step) => step.id === "project")?.recovery).toBe("grant_permission")
  expect(calls.slice(before)).toHaveLength(5)
  expect(result.candidateToolchain).toBeUndefined()
})

test.each([
  undefined,
  { state: "available", path: "/fixture/adb", version: "latest" },
  { state: "available", path: "relative", version: "fixture-adb" },
  { state: "available", path: "/fixture/adb", version: "fixture-adb", injected: true },
])("malformed probe output %j cannot yield a candidate", async (response) => {
  const supplied = ports()
  const result = await Effect.runPromise(
    inspectEnvironment(input, {
      ...supplied,
      probes: {
        inspect: (request) =>
          request.component === "adb" ? Effect.succeed(response) : supplied.probes.inspect(request),
      },
    }),
  )
  expect(result.state).toBe("failed")
  expect(result.steps.find((step) => step.id === "adb")?.cause).toBe("invalid_response")
  expect(result.candidateToolchain).toBeUndefined()
})

test("a global Gradle binary cannot replace the project's wrapper", async () => {
  const result = await Effect.runPromise(
    inspectEnvironment(
      input,
      ports({
        gradleWrapper: {
          state: "available",
          path: "/fixture/global-gradle",
          version: "fixture-gradle",
        },
      }),
    ),
  )
  expect(result.state).toBe("failed")
  expect(result.steps.find((step) => step.id === "gradleWrapper")?.cause).toBe("invalid_response")
})

test("invalid requests perform no dependency reads or probes", async () => {
  const activity: string[] = []
  const result = await Effect.runPromise(
    inspectEnvironment(
      { ...input, project: { root: "relative" } },
      {
        dependencies: {
          read: () =>
            Effect.sync(() => {
              activity.push("read")
              return versions
            }),
        },
        probes: {
          inspect: () =>
            Effect.sync(() => {
              activity.push("probe")
              return undefined
            }),
        },
      },
    ),
  )
  expect(result.state).toBe("failed")
  expect(result.steps[0]?.cause).toBe("invalid_input")
  expect(activity).toEqual([])
})

test("empty production catalogs do not promote synthetic support", async () => {
  const result = await Effect.runPromise(
    inspectEnvironment({ ...input, catalog: { kind: "production", profiles: [] } }, ports()),
  )
  expect(result.state).toBe("incompatible")
  expect(result.steps.find((step) => step.id === "profile")?.reasons).toEqual([{ code: "no_profiles" }])
  expect(result.candidateToolchain).toBeUndefined()
})

test("Windows inspection uses supplied paths and the project's batch wrapper", async () => {
  const result = await Effect.runPromise(
    inspectEnvironment(
      {
        host: { ...host, os: "windows", architecture: "x64" },
        project: { root: "C:\\fixture\\import" },
        catalog: { ...catalog, profiles: [{ ...profile, os: "windows", architecture: "x64" }] },
      },
      {
        ...ports(),
        probes: {
          inspect: (request) =>
            Effect.succeed({
              state: "available",
              version: profile[request.component].version,
              path:
                request.component === "gradleWrapper"
                  ? `${request.project.root}\\gradlew.bat`
                  : `C:\\fixture\\${request.component}`,
            }),
        },
      },
    ),
  )
  expect(result.candidateToolchain?.gradleWrapper).toBe("C:\\fixture\\import\\gradlew.bat")
  expect(result.candidateToolchain?.buildJdk).toBe("C:\\fixture\\buildJdk")
  expect(result.candidateToolchain?.editorJdk).toBe("C:\\fixture\\editorJdk")
  expect(result.state).toBe("missing")
})

test.each([
  ["C:/fixture/import", "C:/fixture/import/gradlew.bat", true],
  ["C:/fixture/import", "C:\\fixture/import\\gradlew.bat", true],
  ["C:\\fixture/import", "C:/fixture\\import/gradlew.bat", true],
  ["C:/fixture/import", "C:/fixture/global/gradlew.bat", false],
  ["C:/fixture/import", "C:\\fixture\\global-gradle", false],
] as const)(
  "Windows wrapper identity accepts equivalent separators and rejects outside paths: %s, %s",
  async (root, wrapper, accepted) => {
    const result = await Effect.runPromise(
      inspectEnvironment(
        {
          host: { ...host, os: "windows", architecture: "x64" },
          project: { root },
          catalog: { ...catalog, profiles: [{ ...profile, os: "windows", architecture: "x64" }] },
        },
        {
          ...ports(),
          probes: {
            inspect: (request) =>
              Effect.succeed({
                state: "available",
                version: profile[request.component].version,
                path: request.component === "gradleWrapper" ? wrapper : `C:/fixture/${request.component}`,
              }),
          },
        },
      ),
    )
    expect(result.state).toBe(accepted ? "missing" : "failed")
    expect(result.steps.find((step) => step.id === "gradleWrapper")?.cause).toBe(
      accepted ? "available" : "invalid_response",
    )
    expect(result.candidateToolchain?.gradleWrapper).toBe(accepted ? wrapper : undefined)
  },
)

test("scoped probes clean up on success and each recheck obtains fresh observations", async () => {
  const activity: string[] = []
  const supplied = ports()
  const scoped: EnvironmentAdapters.Ports = {
    ...supplied,
    probes: {
      inspect: (request) =>
        Effect.gen(function* () {
          yield* Effect.acquireRelease(
            Effect.sync(() => activity.push(`open:${request.component}`)),
            () =>
              Effect.sync(() => {
                activity.push(`close:${request.component}`)
              }),
          )
          return yield* supplied.probes.inspect(request)
        }),
    },
  }
  const run = Effect.gen(function* () {
    const service = yield* Environment.Service
    return yield* service.inspectEnvironment(input)
  }).pipe(Effect.provide(Environment.layer(scoped)))
  expect(activity).toEqual([])
  const first = await Effect.runPromise(run)
  expect(activity.filter((entry) => entry.startsWith("close:"))).toHaveLength(5)
  const second = await Effect.runPromise(run)
  expect(first).toEqual(second)
  expect(activity.filter((entry) => entry.startsWith("open:"))).toHaveLength(10)
  expect(activity.filter((entry) => entry.startsWith("close:"))).toHaveLength(10)
})

test("cancellation releases an in-flight probe and a fresh scope remains usable", async () => {
  const activity: string[] = []
  const started = Promise.withResolvers<void>()
  const interrupted = inspectEnvironment(input, {
    ...ports(),
    probes: {
      inspect: () =>
        Effect.gen(function* () {
          yield* Effect.acquireRelease(
            Effect.sync(() => {
              activity.push("open")
              started.resolve()
            }),
            () =>
              Effect.sync(() => {
                activity.push("close")
              }),
          )
          return yield* Effect.never
        }),
    },
  })
  const fiber = Effect.runFork(interrupted)
  await started.promise
  await Effect.runPromise(Fiber.interrupt(fiber))
  expect(activity).toEqual(["open", "close"])
  const result = await Effect.runPromise(inspectEnvironment(input, ports()))
  expect(result.candidateToolchain?.profileID).toBe(profile.id)
})

test("failed scoped reads release resources before returning recoverable failure", async () => {
  const activity: string[] = []
  const supplied = ports()
  const result = await Effect.runPromise(
    inspectEnvironment(input, {
      dependencies: {
        read: () =>
          Effect.gen(function* () {
            yield* Effect.acquireRelease(
              Effect.sync(() => {
                activity.push("dependency-open")
              }),
              () =>
                Effect.sync(() => {
                  activity.push("dependency-close")
                }),
            )
            return versions
          }),
      },
      probes: {
        inspect: (request) =>
          Effect.gen(function* () {
            yield* Effect.acquireRelease(
              Effect.sync(() => {
                activity.push(`open:${request.component}`)
              }),
              () =>
                Effect.sync(() => {
                  activity.push(`close:${request.component}`)
                }),
            )
            if (request.component === "adb") return yield* Effect.fail({ code: "probe_failed" as const })
            return yield* supplied.probes.inspect(request)
          }),
      },
    }),
  )
  expect(result.state).toBe("failed")
  expect(activity.filter((entry) => entry.startsWith("close:"))).toHaveLength(5)
  expect(activity).toContain("dependency-close")
})

test("independent service layers never share probe observations", async () => {
  const run = (supplied: EnvironmentAdapters.Ports) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* Environment.Service
        return yield* service.inspectEnvironment(input)
      }).pipe(Effect.provide(Environment.layer(supplied))),
    )
  const results = await Promise.all([run(ports()), run(ports({ adb: { state: "missing" } }))])
  expect(results[0].candidateToolchain?.adb).toBe("/fixture/adb")
  expect(results[1].candidateToolchain).toBeUndefined()
  expect(results[1].missingAssets).toEqual(["adb"])
})

test("inspection contracts preserve canonical identities, identifiers and omitted optional fields", () => {
  expect(Environment.Readiness).toBe(FtcEnvironment.Readiness)
  expect(Environment.ToolchainDescriptor).toBe(FtcEnvironment.ToolchainDescriptor)
  expect(
    Schema.encodeSync(FtcEnvironment.Readiness)({
      state: "missing",
      steps: [],
      missingAssets: [],
      candidateToolchain: undefined,
    }),
  ).toEqual({ state: "missing", steps: [], missingAssets: [] })
  expect(Schema.encodeSync(FtcEnvironment.InspectionError)({ code: "probe_failed", detail: undefined })).toEqual({
    code: "probe_failed",
  })
  const identifiers = [
    FtcEnvironment.ToolComponent,
    FtcEnvironment.InspectionProject,
    FtcEnvironment.InspectRequest,
    FtcEnvironment.InspectionError,
    FtcEnvironment.ProbeRequest,
    FtcEnvironment.ProbeResult,
    FtcEnvironment.ToolchainVersions,
    FtcEnvironment.ToolchainDescriptor,
    FtcEnvironment.ReadinessStep,
    FtcEnvironment.Readiness,
  ].map((schema) => schema.ast.annotations?.identifier)
  expect(new Set(identifiers).size).toBe(10)
  expect(
    identifiers.every((identifier) => typeof identifier === "string" && identifier.startsWith("FtcEnvironment.")),
  ).toBe(true)
})
