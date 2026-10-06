import { expect, test } from "bun:test"
import { FtcEnvironment } from "@opencode-ai/schema/ftc-environment"
import { Project } from "@opencode-ai/schema/project"
import { Deferred, Effect, Schema, Stream } from "effect"
import { Environment } from "../../../src/ftc/environment"

const artifact = (version: string) => ({
  version,
  source: "https://fixtures.invalid/tool.zip",
  license: "fixture-license",
  sha256: "a".repeat(64),
})
// Pins, paths, resources, and build evidence are synthetic, not evaluated host support.
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
  evaluation: { status: "evaluated" as const, kind: "synthetic" as const, evidence: ["fixture://M4-03"] },
}
const context = {
  host: {
    os: "macos" as const,
    osVersion: "fixture-os",
    architecture: "arm64" as const,
    resources: { memoryBytes: 8, diskBytes: 16 },
  },
  project: { root: "/private/tmp/fixture-guided" },
  catalog: { kind: "synthetic" as const, profiles: [profile] },
}
const versions = {
  ftcSdk: "fixture-ftc",
  androidGradlePlugin: "fixture-agp",
  androidSdk: "fixture-android",
  gradleWrapper: "fixture-gradle",
}
const request = { choice: "guided" as const, profileID: profile.id, projectID: Project.ID.make("fixture-project") }
const ports = (): Environment.GuidedPorts => ({
  inspection: {
    dependencies: { read: () => Effect.succeed(versions) },
    probes: {
      inspect: (input) =>
        Effect.succeed({
          state: "available",
          path: input.component === "gradleWrapper" ? `${input.project.root}/gradlew` : `/fixture/${input.component}`,
          version: profile[input.component].version,
        }),
    },
  },
  context: {
    read: () =>
      Effect.succeed({
        inspection: context,
        sourceRevision: "fixture-source",
        configurationRevision: "fixture-config",
        dirty: false,
      }),
  },
  builds: {
    verify: (input) =>
      Effect.succeed({
        state: "verified",
        projectID: input.projectID,
        root: input.root,
        toolchain: input.toolchain,
        current: true,
        sourceRevision: "fixture-source",
        configurationRevision: "fixture-config",
        apkSha256: "b".repeat(64),
      }),
  },
})

test("guided setup stays incomplete until build evidence", async () => {
  expect(Environment.guidedLayer).toBeFunction()
  const supplied = ports()
  const evidence = Deferred.makeUnsafe<void>()
  const entered = Deferred.makeUnsafe<void>()
  await Effect.runPromise(
    Effect.gen(function* () {
      const service = yield* Environment.GuidedService
      const run = yield* service.prepareEnvironment(request)
      yield* Deferred.await(entered)
      const beforeBuild = yield* service.readiness({ projectID: request.projectID })
      expect(beforeBuild.state).not.toBe("ready")
      yield* Deferred.succeed(evidence, undefined)
      const afterVerifiedBuild = yield* run.result
      expect(afterVerifiedBuild.readiness.state).toBe("ready")
      expect((yield* service.readiness({ projectID: request.projectID })).state).toBe("ready")
      expect(Schema.decodeUnknownSync(FtcEnvironment.SetupResult)(afterVerifiedBuild)).toEqual(afterVerifiedBuild)
    }).pipe(
      Effect.provide(
        Environment.guidedLayer({
          ...supplied,
          builds: {
            verify: (input) =>
              Deferred.succeed(entered, undefined).pipe(
                Effect.andThen(Deferred.await(evidence)),
                Effect.andThen(supplied.builds.verify(input)),
              ),
          },
        }),
      ),
      Effect.scoped,
    ),
  )
})

const runSetup = (supplied: Environment.GuidedPorts, input: unknown = request) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const service = yield* Environment.GuidedService
      const run = yield* service.prepareEnvironment(input)
      return yield* run.result
    }).pipe(Effect.provide(Environment.guidedLayer(supplied)), Effect.scoped),
  )

test.each(["buildJdk", "editorJdk", "androidSdk", "adb", "gradleWrapper"] as const)(
  "missing %s produces pinned manual installation instructions without a build",
  async (component) => {
    const supplied = ports()
    const calls: string[] = []
    const result = await runSetup({
      ...supplied,
      inspection: {
        ...supplied.inspection,
        probes: {
          inspect: (input) =>
            input.component === component
              ? Effect.succeed({ state: "missing" })
              : supplied.inspection.probes.inspect(input),
        },
      },
      builds: {
        verify: () =>
          Effect.sync(() => {
            calls.push("build")
            return undefined
          }),
      },
    })
    expect(result.readiness.state).toBe("missing")
    expect(result.readiness.missingAssets).toEqual([component])
    expect(result.steps.find((item) => item.step.id === component)).toMatchObject({
      messageKey: "ftc.setup.install",
      version: profile[component].version,
      os: "macos",
      osVersion: "fixture-os",
      architecture: "arm64",
      source: "https://fixtures.invalid/tool.zip",
      license: "fixture-license",
    })
    expect(calls).toEqual([])
  },
)

test("unknown imported requirements remain manual and never invoke build", async () => {
  const supplied = ports()
  const calls: string[] = []
  const result = await runSetup({
    ...supplied,
    inspection: { ...supplied.inspection, dependencies: { read: () => Effect.succeed({}) } },
    builds: {
      verify: () =>
        Effect.sync(() => {
          calls.push("build")
          return undefined
        }),
    },
  })
  expect(result.readiness.state).toBe("missing")
  expect(result.steps.find((item) => item.step.id === "project")).toMatchObject({
    step: { state: "manual", cause: "requirements_unknown" },
    messageKey: "ftc.setup.review",
  })
  expect(result.readiness.candidateToolchain).toBeUndefined()
  expect(calls).toEqual([])
})

test("requested profile must match the inspected candidate", async () => {
  const supplied = ports()
  const result = await runSetup(supplied, { ...request, profileID: "other-profile" })
  expect(result.readiness.state).toBe("incompatible")
  expect(result.readiness.candidateToolchain).toBeUndefined()
  expect(result.readiness.steps.at(-1)?.cause).toBe("unsupported_profile")
})

test.each([
  ["projectID", "other-project"],
  ["root", "/other/root"],
  ["sourceRevision", "old-source"],
  ["configurationRevision", "old-config"],
  ["current", false],
  ["apkSha256", "invalid"],
] as const)("mismatched or malformed build %s cannot become ready", async (key, value) => {
  const supplied = ports()
  const result = await runSetup({
    ...supplied,
    builds: {
      verify: (input) =>
        supplied.builds.verify(input).pipe(
          Effect.map((evidence) => ({
            ...Schema.decodeUnknownSync(FtcEnvironment.BuildVerification)(evidence),
            [key]: value,
          })),
        ),
    },
  })
  expect(result.readiness.state).toBe("failed")
  expect(result.buildEvidence).toBeUndefined()
})

test("a different build toolchain cannot become ready", async () => {
  const supplied = ports()
  const result = await runSetup({
    ...supplied,
    builds: {
      verify: (input) =>
        supplied.builds.verify({ ...input, toolchain: { ...input.toolchain, buildJdk: "/other/java" } }),
    },
  })
  expect(result.readiness.steps.find((step) => step.id === "build")?.cause).toBe("build_stale")
  expect(result.readiness.state).toBe("failed")
})

test.each(["failed", "stale"] as const)("build %s remains recoverable", async (state) => {
  const supplied = ports()
  const result = await runSetup({ ...supplied, builds: { verify: () => Effect.succeed({ state }) } })
  expect(result.readiness.state).toBe("failed")
  expect(result.steps.find((item) => item.step.id === "build")).toMatchObject({
    step: { cause: state === "failed" ? "build_failed" : "build_stale", recovery: "verify_build" },
    messageKey: "ftc.setup.verify",
  })
})

test.each(["dirty", "sourceRevision", "configurationRevision", "root"] as const)(
  "changed %s after verification invalidates current readiness",
  async (key) => {
    const supplied = ports()
    const reads: string[] = []
    const result = await runSetup({
      ...supplied,
      context: {
        read: () =>
          Effect.sync(() => {
            reads.push("read")
            return {
              inspection:
                key === "root" && reads.length > 1 ? { ...context, project: { root: "/changed/root" } } : context,
              dirty: key === "dirty" && reads.length > 1,
              sourceRevision: key === "sourceRevision" && reads.length > 1 ? "changed" : "fixture-source",
              configurationRevision: key === "configurationRevision" && reads.length > 1 ? "changed" : "fixture-config",
            }
          }),
      },
    })
    expect(result.readiness.state).toBe("failed")
    expect(result.readiness.steps.find((step) => step.id === "build")?.cause).toBe("build_stale")
  },
)

test("dirty inputs do not invoke verification", async () => {
  const supplied = ports()
  const calls: string[] = []
  const result = await runSetup({
    ...supplied,
    context: {
      read: () =>
        Effect.succeed({
          inspection: context,
          sourceRevision: "fixture-source",
          configurationRevision: "fixture-config",
          dirty: true,
        }),
    },
    builds: {
      verify: () =>
        Effect.sync(() => {
          calls.push("build")
          return undefined
        }),
    },
  })
  expect(result.readiness.state).toBe("failed")
  expect(result.readiness.steps.find((step) => step.id === "build")?.cause).toBe("build_stale")
  expect(calls).toEqual([])
})

test("deliberate recheck reopens probes, invalidates old evidence and retries a failed build", async () => {
  const supplied = ports()
  const probes: string[] = []
  const builds: FtcEnvironment.BuildRequest[] = []
  await Effect.runPromise(
    Effect.gen(function* () {
      const service = yield* Environment.GuidedService
      const run = yield* service.prepareEnvironment(request)
      expect((yield* run.result).readiness.state).toBe("failed")
      expect((yield* run.recheck()).readiness.state).toBe("ready")
      expect(probes.length).toBe(10)
      expect(builds.length).toBe(2)
      expect(builds[1]).toMatchObject({
        root: "/private/tmp/fixture-guided",
        sourceRevision: "fixture-source",
        configurationRevision: "fixture-config",
        toolchain: { buildJdk: "/fixture/buildJdk", editorJdk: "/fixture/editorJdk" },
      })
    }).pipe(
      Effect.provide(
        Environment.guidedLayer({
          ...supplied,
          inspection: {
            ...supplied.inspection,
            probes: {
              inspect: (input) =>
                Effect.sync(() => {
                  probes.push(input.component)
                }).pipe(Effect.andThen(supplied.inspection.probes.inspect(input))),
            },
          },
          builds: {
            verify: (input) =>
              Effect.suspend(() => {
                builds.push(input)
                return builds.length === 1 ? Effect.succeed({ state: "failed" }) : supplied.builds.verify(input)
              }),
          },
        }),
      ),
      Effect.scoped,
    ),
  )
})

test("cancellation waits for scoped cleanup, publishes a terminal result and allows explicit retry", async () => {
  const supplied = ports()
  const entered = Deferred.makeUnsafe<void>()
  const leases: string[] = []
  const builds: string[] = []
  await Effect.runPromise(
    Effect.gen(function* () {
      const service = yield* Environment.GuidedService
      const run = yield* service.prepareEnvironment(request)
      yield* Deferred.await(entered)
      expect((yield* Effect.flip(run.recheck())).code).toBe("busy")
      expect((yield* Effect.flip(service.prepareEnvironment(request))).code).toBe("busy")
      yield* run.cancel
      const cancelled = yield* run.result
      expect(cancelled.state).toBe("cancelled")
      expect(cancelled.readiness.state).not.toBe("ready")
      expect(leases).toEqual(["open", "close"])
      expect((yield* Effect.flip(run.recheck())).code).toBe("cancelled")
      const terminal = yield* run.events.pipe(
        Stream.filter((event) => event.type === "settled"),
        Stream.take(1),
        Stream.runCollect,
      )
      expect(terminal[0]).toMatchObject({
        projectID: "fixture-project",
        type: "settled",
        result: { state: "cancelled" },
      })
      const retry = yield* service.prepareEnvironment(request)
      expect((yield* retry.result).readiness.state).toBe("ready")
      expect(builds).toEqual(["attempt", "attempt"])
    }).pipe(
      Effect.provide(
        Environment.guidedLayer({
          ...supplied,
          builds: {
            verify: (input) =>
              Effect.suspend(() => {
                builds.push("attempt")
                if (builds.length > 1) return supplied.builds.verify(input)
                return Effect.acquireRelease(
                  Effect.sync(() => {
                    leases.push("open")
                  }),
                  () =>
                    Effect.sync(() => {
                      leases.push("close")
                    }),
                ).pipe(Effect.andThen(Deferred.succeed(entered, undefined)), Effect.andThen(Effect.never))
              }),
          },
        }),
      ),
      Effect.scoped,
    ),
  )
})

test("disposing the service cancels in-flight verification and rejects stale handles", async () => {
  const supplied = ports()
  const entered = Deferred.makeUnsafe<void>()
  const leases: string[] = []
  const saved = await Effect.runPromise(
    Effect.gen(function* () {
      const service = yield* Environment.GuidedService
      const run = yield* service.prepareEnvironment(request)
      yield* Deferred.await(entered)
      return { service, run }
    }).pipe(
      Effect.provide(
        Environment.guidedLayer({
          ...supplied,
          builds: {
            verify: () =>
              Effect.acquireRelease(
                Effect.sync(() => {
                  leases.push("open")
                }),
                () =>
                  Effect.sync(() => {
                    leases.push("close")
                  }),
              ).pipe(Effect.andThen(Deferred.succeed(entered, undefined)), Effect.andThen(Effect.never)),
          },
        }),
      ),
      Effect.scoped,
    ),
  )
  expect(leases).toEqual(["open", "close"])
  expect((await Effect.runPromise(saved.run.result)).state).toBe("cancelled")
  expect((await Effect.runPromise(Effect.flip(saved.run.recheck()))).code).toBe("closed")
  expect((await Effect.runPromise(Effect.flip(saved.service.prepareEnvironment(request)))).code).toBe("closed")
})

test("separate projects run concurrently and cancellation cannot affect another project", async () => {
  const supplied = ports()
  const entered = Deferred.makeUnsafe<void>()
  await Effect.runPromise(
    Effect.gen(function* () {
      const service = yield* Environment.GuidedService
      const first = yield* service.prepareEnvironment(request)
      yield* Deferred.await(entered)
      const second = yield* service.prepareEnvironment({ ...request, projectID: "other-project" })
      expect((yield* second.result).readiness.state).toBe("ready")
      yield* first.cancel
      expect((yield* service.readiness({ projectID: "other-project" })).state).toBe("ready")
      expect((yield* first.result).state).toBe("cancelled")
    }).pipe(
      Effect.provide(
        Environment.guidedLayer({
          ...supplied,
          builds: {
            verify: (input) =>
              input.projectID === "fixture-project"
                ? Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never))
                : supplied.builds.verify(input),
          },
        }),
      ),
      Effect.scoped,
    ),
  )
})

test("independent service instances retain independent readiness", async () => {
  const supplied = ports()
  const [available, missing] = await Promise.all([
    runSetup(supplied),
    runSetup({
      ...supplied,
      inspection: { ...supplied.inspection, probes: { inspect: () => Effect.succeed({ state: "missing" }) } },
    }),
  ])
  expect(available.readiness.state).toBe("ready")
  expect(missing.readiness.state).toBe("missing")
})

test("step stream exposes current probe and completed build messages", async () => {
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const service = yield* Environment.GuidedService
      const run = yield* service.prepareEnvironment(request)
      yield* run.result
      return yield* run.events.pipe(
        Stream.takeUntil((event) => event.type === "settled"),
        Stream.runCollect,
      )
    }).pipe(Effect.provide(Environment.guidedLayer(ports())), Effect.scoped),
  )
  expect(result.filter((event) => event.type === "step").map((event) => event.step.step.id)).toContain("build")
  expect(result.at(-1)).toMatchObject({ type: "settled", result: { readiness: { state: "ready" } } })
})

test.each(["context", "build"] as const)("typed %s failure cleans up and cannot become ready", async (boundary) => {
  const supplied = ports()
  const leases: string[] = []
  const failed = Effect.acquireRelease(
    Effect.sync(() => {
      leases.push("open")
    }),
    () =>
      Effect.sync(() => {
        leases.push("close")
      }),
  ).pipe(Effect.andThen(Effect.fail({ code: "build_failed" as const })))
  const result = await runSetup({
    ...supplied,
    ...(boundary === "context" ? { context: { read: () => failed } } : { builds: { verify: () => failed } }),
  })
  expect(result.readiness.state).toBe("failed")
  if (boundary === "build")
    expect(result.readiness.steps.find((step) => step.id === "build")?.cause).toBe("build_failed")
  expect(leases).toEqual(["open", "close"])
})

test("successful checks release all probe and build leases", async () => {
  const supplied = ports()
  const opened: string[] = []
  const closed: string[] = []
  const lease = (name: string) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        opened.push(name)
      }),
      () =>
        Effect.sync(() => {
          closed.push(name)
        }),
    )
  const result = await runSetup({
    ...supplied,
    inspection: {
      ...supplied.inspection,
      probes: {
        inspect: (input) => lease(input.component).pipe(Effect.andThen(supplied.inspection.probes.inspect(input))),
      },
    },
    builds: { verify: (input) => lease("build").pipe(Effect.andThen(supplied.builds.verify(input))) },
  })
  expect(result.readiness.state).toBe("ready")
  expect(opened).toEqual(["buildJdk", "editorJdk", "androidSdk", "adb", "gradleWrapper", "build"])
  expect(closed.toSorted()).toEqual(opened.toSorted())
})

test("a finalizer defect cannot publish ready", async () => {
  const supplied = ports()
  const result = await runSetup({
    ...supplied,
    builds: {
      verify: (input) =>
        Effect.acquireRelease(Effect.void, () => Effect.die("fixture cleanup failure")).pipe(
          Effect.andThen(supplied.builds.verify(input)),
        ),
    },
  })
  expect(result.readiness.state).toBe("failed")
  expect(result.buildEvidence).toBeUndefined()
})

test.each([
  undefined,
  { ...request, choice: "automatic" },
  { ...request, injected: true },
  { ...request, projectID: "" },
])("invalid guided request is rejected before I/O", async (input) => {
  const supplied = ports()
  const calls: string[] = []
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const service = yield* Environment.GuidedService
      return yield* Effect.flip(service.prepareEnvironment(input))
    }).pipe(
      Effect.provide(
        Environment.guidedLayer({
          ...supplied,
          context: {
            read: () =>
              Effect.sync(() => {
                calls.push("read")
                return undefined
              }),
          },
        }),
      ),
      Effect.scoped,
    ),
  )
  expect(result.code).toBe("invalid_input")
  expect(calls).toEqual([])
})

test("constructing the guided layer starts no I/O and readiness is a snapshot", async () => {
  const supplied = ports()
  const calls: string[] = []
  const layer = Environment.guidedLayer({
    ...supplied,
    context: {
      read: () =>
        Effect.sync(() => {
          calls.push("read")
          return undefined
        }),
    },
  })
  expect(calls).toEqual([])
  await Effect.runPromise(
    Effect.gen(function* () {
      const service = yield* Environment.GuidedService
      expect((yield* service.readiness({ projectID: request.projectID })).state).toBe("missing")
      expect((yield* Effect.flip(service.readiness({ projectID: "" }))).code).toBe("invalid_input")
    }).pipe(Effect.provide(layer), Effect.scoped),
  )
  expect(calls).toEqual([])
})

test("setup records omit undefined, serialize and have unique stable identifiers", () => {
  expect(
    Schema.encodeSync(FtcEnvironment.SetupStep)({
      step: { id: "build", state: "pending", cause: "build_unverified", recovery: "verify_build" },
      messageKey: "ftc.setup.verify",
      os: undefined,
    }),
  ).not.toHaveProperty("os")
  expect(Schema.encodeSync(FtcEnvironment.SetupError)({ code: "busy", detail: undefined })).toEqual({ code: "busy" })
  const contracts = [
    FtcEnvironment.PrepareRequest,
    FtcEnvironment.ReadinessRequest,
    FtcEnvironment.SetupContext,
    FtcEnvironment.BuildRequest,
    FtcEnvironment.BuildVerification,
    FtcEnvironment.SetupError,
    FtcEnvironment.SetupStep,
    FtcEnvironment.SetupResult,
    FtcEnvironment.SetupEvent,
  ]
  const identifiers = contracts.map((contract) => contract.ast.annotations?.identifier)
  expect(identifiers).toEqual([
    "FtcEnvironment.PrepareRequest",
    "FtcEnvironment.ReadinessRequest",
    "FtcEnvironment.SetupContext",
    "FtcEnvironment.BuildRequest",
    "FtcEnvironment.BuildVerification",
    "FtcEnvironment.SetupError",
    "FtcEnvironment.SetupStep",
    "FtcEnvironment.SetupResult",
    "FtcEnvironment.SetupEvent",
  ])
  expect(new Set(identifiers).size).toBe(contracts.length)
  expect(Schema.decodeUnknownSync(FtcEnvironment.PrepareRequest)(JSON.parse(JSON.stringify(request)))).toEqual(request)
})

test("six guided keys exist in typed English and Chinese dictionaries with matching placeholders", async () => {
  const english = await import("../../../../app/src/i18n/en")
  const chinese = await import("../../../../app/src/i18n/zh")
  const keys = [
    "ftc.setup.install",
    "ftc.setup.permission",
    "ftc.setup.review",
    "ftc.setup.recheck",
    "ftc.setup.verify",
    "ftc.setup.available",
  ] as const
  keys.forEach((key) => {
    expect(english.dict[key]).toBeString()
    expect(chinese.dict[key]).toBeString()
    expect(chinese.dict[key]).not.toBe(english.dict[key])
    expect([...chinese.dict[key].matchAll(/{{(.*?)}}/g)].map((match) => match[1]).toSorted()).toEqual(
      [...english.dict[key].matchAll(/{{(.*?)}}/g)].map((match) => match[1]).toSorted(),
    )
  })
})

test("Windows guided steps use the supplied platform and pin without running an installer", async () => {
  const supplied = ports()
  const windows = {
    ...context,
    host: { ...context.host, os: "windows" as const, architecture: "x64" as const },
    project: { root: "C:\\fixture\\project" },
    catalog: {
      kind: "synthetic" as const,
      profiles: [{ ...profile, os: "windows" as const, architecture: "x64" as const }],
    },
  }
  const result = await runSetup({
    ...supplied,
    context: {
      read: () =>
        Effect.succeed({
          inspection: windows,
          sourceRevision: "source",
          configurationRevision: "config",
          dirty: false,
        }),
    },
    inspection: { ...supplied.inspection, probes: { inspect: () => Effect.succeed({ state: "missing" }) } },
  })
  expect(result.readiness.state).toBe("missing")
  expect(result.steps.find((step) => step.step.id === "buildJdk")).toMatchObject({
    messageKey: "ftc.setup.install",
    os: "windows",
    architecture: "x64",
    version: "17",
  })
  expect(result.steps.find((step) => step.step.id === "editorJdk")).toMatchObject({ version: "21" })
})

test.each([
  undefined,
  { inspection: context, dirty: false },
  { inspection: context, sourceRevision: "source", configurationRevision: "config", dirty: false, injected: true },
])("malformed setup context cannot invoke a build or become ready", async (value) => {
  const supplied = ports()
  const builds: string[] = []
  const result = await runSetup({
    ...supplied,
    context: { read: () => Effect.succeed(value) },
    builds: {
      verify: () =>
        Effect.sync(() => {
          builds.push("build")
          return undefined
        }),
    },
  })
  expect(result.readiness.state).toBe("failed")
  expect(result.readiness.steps[0]?.cause).toBe("invalid_response")
  expect(builds).toEqual([])
})

test("probe cancellation releases its lease and never advances to a build", async () => {
  const supplied = ports()
  const entered = Deferred.makeUnsafe<void>()
  const leases: string[] = []
  const builds: string[] = []
  await Effect.runPromise(
    Effect.gen(function* () {
      const service = yield* Environment.GuidedService
      const run = yield* service.prepareEnvironment(request)
      yield* Deferred.await(entered)
      yield* run.cancel
      expect((yield* run.result).state).toBe("cancelled")
      expect(leases).toEqual(["open", "close"])
      expect(builds).toEqual([])
    }).pipe(
      Effect.provide(
        Environment.guidedLayer({
          ...supplied,
          inspection: {
            ...supplied.inspection,
            probes: {
              inspect: () =>
                Effect.acquireRelease(
                  Effect.sync(() => {
                    leases.push("open")
                  }),
                  () =>
                    Effect.sync(() => {
                      leases.push("close")
                    }),
                ).pipe(Effect.andThen(Deferred.succeed(entered, undefined)), Effect.andThen(Effect.never)),
            },
          },
          builds: {
            verify: () =>
              Effect.sync(() => {
                builds.push("build")
                return undefined
              }),
          },
        }),
      ),
      Effect.scoped,
    ),
  )
})
