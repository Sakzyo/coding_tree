import { expect, test } from "bun:test"
import { FtcEnvironment } from "@opencode-ai/schema/ftc-environment"
import { Project } from "@opencode-ai/schema/project"
import { Deferred, Effect, Exit, Option, Schema, Scope, Stream } from "effect"
import { mkdtemp, mkdir, rename, rm } from "node:fs/promises"
import { dirname, join } from "node:path"
import { Environment } from "../../../src/ftc/environment"

const bytes = new TextEncoder().encode("synthetic M4-04 archive bytes")
const artifact = (version: string) => ({
  version,
  source: "https://fixtures.invalid/m4-04.zip",
  license: "synthetic-license",
  sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
})
// Synthetic versions and OS/resources exercise orchestration, not a released support claim.
const profile = {
  id: "synthetic-m4-04",
  os: "macos" as const,
  osVersions: ["fixture-os"],
  architecture: "arm64" as const,
  resources: { memoryBytes: 8, diskBytes: 16 },
  buildJdk: artifact("17"),
  editorJdk: artifact("21"),
  androidSdk: artifact("fixture-android"),
  adb: artifact("fixture-adb"),
  gradleWrapper: artifact("fixture-gradle"),
  jdtLs: artifact("fixture-jdt"),
  ftcSdk: artifact("fixture-ftc"),
  androidGradlePlugin: artifact("fixture-agp"),
  evaluation: { status: "evaluated" as const, kind: "synthetic" as const, evidence: ["fixture://M4-04"] },
}
const request = {
  choice: "automatic" as const,
  projectID: Project.ID.make("fixture-automatic"),
  profileID: profile.id,
}
type Preparation = {
  projectID: Project.ID
  profileID: string
  component: FtcEnvironment.ToolComponent
  artifact: FtcEnvironment.Artifact
  host: FtcEnvironment.Host
}
type Asset = { archivePath: string; path: string }

async function fixture() {
  const root = await mkdtemp("/private/tmp/ftc-m4-04-cache-")
  await mkdir(join(root, "project"))
  await Bun.write(join(root, "project", "gradlew"), "preserved imported wrapper")
  const completed = new Map<FtcEnvironment.ToolComponent, Asset>()
  const downloads: string[] = []
  const commits: string[] = []
  const cleanups: string[] = []
  const discards: string[] = []
  const discardLeases: string[] = []
  const builds: string[] = []
  const state = {
    corruptDownload: false,
    corruptStage: false,
    incompleteStage: false,
    wrongProbe: false,
    denyLicense: false,
    denyPermission: false,
    wrongAuthorization: false,
    failDownload: false,
    failCommit: false,
    holdStage: false,
    failDiscard: false,
    holdDiscard: false,
    discardEntered: Deferred.makeUnsafe<void>(),
    stageEntered: Deferred.makeUnsafe<void>(),
  }
  const inspection = {
    host: {
      os: "macos" as const,
      osVersion: "fixture-os",
      architecture: "arm64" as const,
      resources: profile.resources,
    },
    project: { root: join(root, "project") },
    catalog: { kind: "synthetic" as const, profiles: [profile] },
  }
  const ports = {
    inspection: {
      dependencies: {
        read: () =>
          Effect.succeed({
            ftcSdk: profile.ftcSdk.version,
            androidGradlePlugin: profile.androidGradlePlugin.version,
            androidSdk: profile.androidSdk.version,
            gradleWrapper: profile.gradleWrapper.version,
          }),
      },
      probes: {
        inspect: (input: FtcEnvironment.ProbeRequest & { path?: string }) =>
          Effect.promise(async () => {
            const path = input.path ?? completed.get(input.component)?.path
            if (input.component === "gradleWrapper")
              return {
                state: "available",
                path: join(root, "project", "gradlew"),
                version: profile.gradleWrapper.version,
              }
            if (!path || !(await Bun.file(path).exists())) return { state: "missing" }
            return {
              state: "available",
              path: state.wrongProbe ? `${path}-wrong` : path,
              version: await Bun.file(path).text(),
            }
          }),
      },
    },
    context: {
      read: () =>
        Effect.succeed({ inspection, sourceRevision: "source", configurationRevision: "config", dirty: false }),
    },
    builds: {
      verify: (input: FtcEnvironment.BuildRequest) =>
        Effect.sync(() => {
          builds.push("verify")
          return { ...input, state: "verified", current: true, apkSha256: "b".repeat(64) }
        }),
    },
    automatic: {
      authorization: {
        read: (input: Preparation) =>
          Effect.succeed({
            projectID: state.wrongAuthorization ? Project.ID.make("other-project") : input.projectID,
            profileID: input.profileID,
            component: input.component,
            artifact: input.artifact,
            licenseAccepted: !state.denyLicense,
            systemPermissionGranted: !state.denyPermission,
          }),
      },
      download: {
        fetch: (input: Preparation): Effect.Effect<Uint8Array, FtcEnvironment.PreparationError, Scope.Scope> =>
          Effect.suspend(() => {
            downloads.push(input.component)
            if (state.failDownload) return Effect.fail({ code: "download_failed" as const })
            return Effect.succeed(state.corruptDownload ? new Uint8Array([1, 2, 3]) : bytes)
          }),
      },
      cache: {
        lookup: (input: Preparation): Effect.Effect<unknown, FtcEnvironment.PreparationError, Scope.Scope> =>
          Effect.succeed(completed.get(input.component)),
        discard: (
          input: Preparation,
          asset: Asset,
        ): Effect.Effect<void, FtcEnvironment.PreparationError, Scope.Scope> =>
          Effect.gen(function* () {
            yield* Effect.acquireRelease(
              Effect.sync(() => {
                discardLeases.push("open")
              }),
              () =>
                Effect.sync(() => {
                  discardLeases.push("close")
                }),
            )
            yield* Deferred.succeed(state.discardEntered, undefined)
            if (state.holdDiscard) yield* Effect.never
            if (state.failDiscard) return yield* Effect.fail({ code: "preparation_failed" as const })
            yield* Effect.promise(() => rm(dirname(asset.archivePath), { recursive: true, force: true }))
            completed.delete(input.component)
            discards.push(input.component)
            return undefined
          }),
        stage: (input: Preparation, supplied: Uint8Array) =>
          Effect.gen(function* () {
            const staging = yield* Effect.acquireRelease(
              Effect.promise(() => mkdtemp(join(root, "stage-"))),
              (path) =>
                Effect.promise(async () => {
                  await rm(path, { recursive: true, force: true })
                  cleanups.push(path)
                }),
            )
            const asset = { archivePath: join(staging, "archive"), path: join(staging, "tool") }
            yield* Effect.promise(async () => {
              await Bun.write(asset.archivePath, state.corruptStage ? "corrupt" : supplied)
              if (!state.incompleteStage) await Bun.write(asset.path, input.artifact.version)
            })
            yield* Deferred.succeed(state.stageEntered, undefined)
            if (state.holdStage && input.projectID === request.projectID) yield* Effect.never
            return asset
          }),
        commit: (input: Preparation, asset: Asset) =>
          Effect.gen(function* () {
            if (state.failCommit) return yield* Effect.fail({ code: "preparation_failed" as const })
            const destination = join(root, input.component)
            yield* Effect.promise(() => rename(dirname(asset.path), destination))
            completed.set(input.component, {
              archivePath: join(destination, "archive"),
              path: join(destination, "tool"),
            })
            commits.push(input.component)
            return undefined
          }),
      },
    },
  }
  return {
    root,
    ports,
    state,
    completed,
    downloads,
    commits,
    cleanups,
    discards,
    discardLeases,
    builds,
    cleanup: () => rm(root, { recursive: true, force: true }),
  }
}

const withSetup = async (
  work: (
    supplied: Awaited<ReturnType<typeof fixture>>,
    service: Environment.GuidedInterface,
  ) => Effect.Effect<void, FtcEnvironment.SetupError>,
) => {
  const supplied = await fixture()
  try {
    await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* Environment.GuidedService
        yield* work(supplied, service)
      }).pipe(Effect.provide(Environment.guidedLayer(supplied.ports)), Effect.scoped),
    )
  } finally {
    await supplied.cleanup()
  }
}

test("retry preserves completed components", async () => {
  expect.hasAssertions()
  await withSetup((supplied, service) =>
    Effect.gen(function* () {
      const first = yield* service.prepareEnvironment(request)
      expect((yield* first.result).readiness.steps.find((step) => step.id === "buildJdk")?.state).toBe("ready")
      supplied.state.corruptDownload = true
      const broken = yield* service.prepareEnvironment(request)
      const corrupt = (yield* broken.result).readiness.steps.find((step) => step.id === "editorJdk")!
      expect(corrupt.state).toBe("failed")
      expect(corrupt.cause).toBe("checksum_mismatch")
      supplied.state.corruptDownload = false
      const retry = yield* service.prepareEnvironment(request)
      expect((yield* retry.result).readiness.steps.find((step) => step.id === "editorJdk")?.state).toBe("ready")
      const reuse = yield* service.prepareEnvironment(request)
      yield* reuse.result
      const reinstalledValidTools = supplied.commits.filter(
        (component, index) => supplied.commits.indexOf(component) !== index,
      )
      expect(reinstalledValidTools).toEqual([])
      expect(supplied.downloads).toEqual(["buildJdk", "editorJdk", "editorJdk", "androidSdk"])
      expect(supplied.completed.size).toBe(3)
      expect(yield* Effect.promise(() => Bun.file(join(supplied.root, "project", "gradlew")).text())).toBe(
        "preserved imported wrapper",
      )
    }),
  )
})

test.each([
  ["corruptDownload", "checksum_mismatch"],
  ["corruptStage", "checksum_mismatch"],
  ["incompleteStage", "preparation_failed"],
  ["wrongProbe", "preparation_failed"],
  ["failDownload", "download_failed"],
  ["failCommit", "preparation_failed"],
] as const)("%s never publishes partial assets", async (fault, cause) => {
  expect.hasAssertions()
  await withSetup((supplied, service) =>
    Effect.gen(function* () {
      supplied.state[fault] = true
      const run = yield* service.prepareEnvironment(request)
      const result = yield* run.result
      expect(result.readiness.state).toBe("failed")
      expect(result.readiness.steps.find((step) => step.id === "buildJdk")).toMatchObject({ state: "failed", cause })
      expect(supplied.completed.size).toBe(0)
      expect(supplied.builds).toEqual([])
      expect(yield* Effect.promise(() => Bun.file(join(supplied.root, "buildJdk", "tool")).exists())).toBe(false)
      expect(
        yield* Effect.promise(async () =>
          Promise.all(supplied.cleanups.map((path) => Bun.file(join(path, "archive")).exists())),
        ),
      ).not.toContain(true)
    }),
  )
})

test.each([
  ["denyLicense", "license_required", "manual"],
  ["denyPermission", "permission_denied", "manual"],
  ["wrongAuthorization", "invalid_response", "failed"],
] as const)("%s blocks download and publication", async (fault, cause, state) => {
  expect.hasAssertions()
  await withSetup((supplied, service) =>
    Effect.gen(function* () {
      supplied.state[fault] = true
      const run = yield* service.prepareEnvironment(request)
      const result = yield* run.result
      expect(result.readiness.steps.find((step) => step.id === "buildJdk")).toMatchObject({ state, cause })
      expect(supplied.downloads).toEqual([])
      expect(supplied.discards).toEqual([])
      expect(supplied.completed.size).toBe(0)
      expect(result.steps.find((step) => step.step.id === "buildJdk")).toMatchObject({
        license: "synthetic-license",
        source: "https://fixtures.invalid/m4-04.zip",
      })
      supplied.state[fault] = false
      const retried = yield* run.recheck()
      expect(retried.readiness.steps.find((step) => step.id === "buildJdk")?.state).toBe("ready")
    }),
  )
})

test("cancellation removes staged files and deliberate retry retains published components", async () => {
  expect.hasAssertions()
  await withSetup((supplied, service) =>
    Effect.gen(function* () {
      const first = yield* service.prepareEnvironment(request)
      yield* first.result
      supplied.state.holdStage = true
      supplied.state.stageEntered = Deferred.makeUnsafe<void>()
      const run = yield* service.prepareEnvironment(request)
      yield* Deferred.await(supplied.state.stageEntered)
      const busy = yield* Effect.exit(service.prepareEnvironment(request))
      expect(Exit.isFailure(busy)).toBe(true)
      yield* run.cancel
      const cancelled = yield* run.result
      const cancelledReadyAssets = cancelled.readiness.steps.filter(
        (step) => step.id === "editorJdk" && step.state === "ready",
      )
      expect(cancelledReadyAssets).toEqual([])
      expect(cancelled.state).toBe("cancelled")
      expect(supplied.completed.has("editorJdk")).toBe(false)
      expect(supplied.completed.has("buildJdk")).toBe(true)
      expect(supplied.cleanups).toHaveLength(2)
      expect(yield* Effect.promise(() => Bun.file(join(supplied.cleanups[1], "archive")).exists())).toBe(false)
      supplied.state.holdStage = false
      const retry = yield* service.prepareEnvironment(request)
      yield* retry.result
      expect(supplied.commits).toEqual(["buildJdk", "editorJdk"])
    }),
  )
})

test("one component per deliberate recheck and the shared build gate determines ready", async () => {
  expect.hasAssertions()
  await withSetup((supplied, service) =>
    Effect.gen(function* () {
      const run = yield* service.prepareEnvironment(request)
      expect((yield* run.result).readiness.state).toBe("missing")
      expect(supplied.commits).toEqual(["buildJdk"])
      expect((yield* run.recheck()).readiness.state).toBe("missing")
      expect((yield* run.recheck()).readiness.state).toBe("missing")
      const final = yield* run.recheck()
      expect(final.readiness.state).toBe("ready")
      expect(supplied.commits).toEqual(["buildJdk", "editorJdk", "androidSdk", "adb"])
      expect(supplied.builds).toEqual(["verify"])
      const reused = yield* run.recheck()
      expect(reused.readiness.state).toBe("ready")
      expect(supplied.downloads).toEqual(["buildJdk", "editorJdk", "androidSdk", "adb"])
      expect(Schema.decodeUnknownSync(FtcEnvironment.SetupResult)(JSON.parse(JSON.stringify(final)))).toEqual(final)
    }),
  )
})

test("disposal waits for staging cleanup, closes handles and prevents publication", async () => {
  const supplied = await fixture()
  try {
    supplied.state.holdStage = true
    const saved = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* Environment.GuidedService
        const run = yield* service.prepareEnvironment(request)
        yield* Deferred.await(supplied.state.stageEntered)
        return { service, run }
      }).pipe(Effect.provide(Environment.guidedLayer(supplied.ports)), Effect.scoped),
    )
    expect((await Effect.runPromise(saved.run.result)).state).toBe("cancelled")
    expect(supplied.completed.size).toBe(0)
    expect(supplied.cleanups).toHaveLength(1)
    expect(await Bun.file(join(supplied.cleanups[0], "archive")).exists()).toBe(false)
    expect(Exit.isFailure(await Effect.runPromise(Effect.exit(saved.service.prepareEnvironment(request))))).toBe(true)
  } finally {
    await supplied.cleanup()
  }
})

test("automatic without supplied ports and public authorization/component overrides are rejected", async () => {
  const supplied = await fixture()
  try {
    const denied = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* Environment.GuidedService
        return yield* Effect.exit(service.prepareEnvironment(request))
      }).pipe(
        Effect.provide(
          Environment.guidedLayer({
            inspection: supplied.ports.inspection,
            context: supplied.ports.context,
            builds: supplied.ports.builds,
          }),
        ),
        Effect.scoped,
      ),
    )
    expect(Exit.isFailure(denied)).toBe(true)
    expect(
      Option.isNone(
        Schema.decodeUnknownOption(FtcEnvironment.PrepareRequest, { onExcessProperty: "error" })({
          ...request,
          component: "buildJdk",
        }),
      ),
    ).toBe(true)
    expect(
      Option.isNone(
        Schema.decodeUnknownOption(FtcEnvironment.PrepareRequest, { onExcessProperty: "error" })({
          ...request,
          licenseAccepted: true,
          systemPermissionGranted: true,
        }),
      ),
    ).toBe(true)
    expect(
      Schema.encodeSync(FtcEnvironment.ProbeRequest)({
        component: "buildJdk",
        host: {
          os: profile.os,
          osVersion: "fixture-os",
          architecture: profile.architecture,
          resources: profile.resources,
        },
        project: { root: supplied.root },
        path: undefined,
      }),
    ).not.toHaveProperty("path")
  } finally {
    await supplied.cleanup()
  }
})

test("automatic missing imported wrapper remains manual without download or replacement", async () => {
  const supplied = await fixture()
  try {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* Environment.GuidedService
        const run = yield* service.prepareEnvironment(request)
        return yield* run.result
      }).pipe(
        Effect.provide(
          Environment.guidedLayer({
            ...supplied.ports,
            inspection: {
              ...supplied.ports.inspection,
              probes: {
                inspect: (input) =>
                  Effect.succeed(
                    input.component === "gradleWrapper"
                      ? { state: "missing" }
                      : {
                          state: "available",
                          path: join(supplied.root, input.component),
                          version: profile[input.component].version,
                        },
                  ),
              },
            },
          }),
        ),
        Effect.scoped,
      ),
    )
    expect(result.readiness.steps.find((step) => step.id === "gradleWrapper")).toMatchObject({
      state: "manual",
      recovery: "manual_setup",
    })
    expect(supplied.downloads).toEqual([])
    expect(await Bun.file(join(supplied.root, "project", "gradlew")).text()).toBe("preserved imported wrapper")
  } finally {
    await supplied.cleanup()
  }
})

test("a changed resolved profile after publication cannot become ready through the build gate", async () => {
  const supplied = await fixture()
  const second = { ...profile, id: "changed-profile", ftcSdk: artifact("other-ftc") }
  const context = {
    host: { os: profile.os, osVersion: "fixture-os", architecture: profile.architecture, resources: profile.resources },
    project: { root: join(supplied.root, "project") },
    catalog: { kind: "synthetic" as const, profiles: [profile, second] },
  }
  try {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* Environment.GuidedService
        return yield* (yield* service.prepareEnvironment(request)).result
      }).pipe(
        Effect.provide(
          Environment.guidedLayer({
            ...supplied.ports,
            context: {
              read: () =>
                Effect.succeed({
                  inspection: context,
                  sourceRevision: "source",
                  configurationRevision: "config",
                  dirty: false,
                }),
            },
            inspection: {
              dependencies: {
                read: () =>
                  Effect.succeed({
                    ftcSdk: supplied.commits.length ? "other-ftc" : profile.ftcSdk.version,
                    androidGradlePlugin: profile.androidGradlePlugin.version,
                    androidSdk: profile.androidSdk.version,
                    gradleWrapper: profile.gradleWrapper.version,
                  }),
              },
              probes: {
                inspect: (input) =>
                  input.component === "buildJdk"
                    ? supplied.ports.inspection.probes.inspect(input)
                    : Effect.succeed({
                        state: "available",
                        path:
                          input.component === "gradleWrapper"
                            ? join(context.project.root, "gradlew")
                            : join(supplied.root, input.component),
                        version: profile[input.component].version,
                      }),
              },
            },
          }),
        ),
        Effect.scoped,
      ),
    )
    expect(result.readiness.state).not.toBe("ready")
    expect(result.readiness.candidateToolchain).toBeUndefined()
    expect(supplied.builds).toEqual([])
  } finally {
    await supplied.cleanup()
  }
})

test.each(["valid", "corrupt", "missing-archive", "missing-tool", "wrong-probe"] as const)(
  "%s cached bytes are independently verified before publication",
  async (kind) => {
    expect.hasAssertions()
    await withSetup((supplied, service) =>
      Effect.gen(function* () {
        const cached = join(supplied.root, "cached")
        const asset = { archivePath: join(cached, "archive"), path: join(cached, "tool") }
        yield* Effect.promise(async () => {
          await mkdir(cached)
          if (kind !== "missing-archive") await Bun.write(asset.archivePath, kind === "corrupt" ? "corrupt" : bytes)
          if (kind !== "missing-tool") await Bun.write(asset.path, "17")
        })
        supplied.ports.automatic.cache.lookup = () => Effect.succeed(asset)
        supplied.state.wrongProbe = kind === "wrong-probe"
        const run = yield* service.prepareEnvironment(request)
        const result = yield* run.result
        expect(result.readiness.steps.find((step) => step.id === "buildJdk")?.state).toBe(
          kind === "valid" ? "ready" : "failed",
        )
        expect(supplied.downloads).toEqual([])
        expect(supplied.commits).toEqual(kind === "valid" ? ["buildJdk"] : [])
        expect(supplied.discards).toEqual(kind === "valid" ? [] : ["buildJdk"])
        if (kind === "valid")
          expect(yield* Effect.promise(() => Bun.file(join(supplied.root, "buildJdk", "archive")).bytes())).toEqual(
            bytes,
          )
        if (kind === "corrupt")
          expect(result.readiness.steps.find((step) => step.id === "buildJdk")?.cause).toBe("checksum_mismatch")
      }),
    )
  },
)

test.each(["profile", "component", "source", "version", "license", "checksum"] as const)(
  "authorization replay with changed %s cannot download",
  async (field) => {
    expect.hasAssertions()
    await withSetup((supplied, service) =>
      Effect.gen(function* () {
        supplied.ports.automatic.authorization.read = (input) =>
          Effect.succeed({
            projectID: input.projectID,
            profileID: field === "profile" ? "other-profile" : input.profileID,
            component: field === "component" ? "editorJdk" : input.component,
            artifact: {
              ...input.artifact,
              ...(field === "source" ? { source: "https://other.invalid/tool.zip" } : {}),
              ...(field === "version" ? { version: "other-version" } : {}),
              ...(field === "license" ? { license: "other-license" } : {}),
              ...(field === "checksum" ? { sha256: "b".repeat(64) } : {}),
            },
            licenseAccepted: true,
            systemPermissionGranted: true,
          })
        const run = yield* service.prepareEnvironment(request)
        expect((yield* run.result).readiness.steps.find((step) => step.id === "buildJdk")?.cause).toBe(
          "invalid_response",
        )
        expect(supplied.downloads).toEqual([])
        expect(supplied.discards).toEqual([])
      }),
    )
  },
)

test("download cancellation closes its external lease before settling", async () => {
  expect.hasAssertions()
  await withSetup((supplied, service) =>
    Effect.gen(function* () {
      const entered = Deferred.makeUnsafe<void>()
      const leases: string[] = []
      supplied.ports.automatic.download.fetch = () =>
        Effect.acquireRelease(
          Effect.sync(() => {
            leases.push("open")
          }),
          () =>
            Effect.sync(() => {
              leases.push("close")
            }),
        ).pipe(Effect.andThen(Deferred.succeed(entered, undefined)), Effect.andThen(Effect.never))
      const run = yield* service.prepareEnvironment(request)
      yield* Deferred.await(entered)
      yield* run.cancel
      expect((yield* run.result).state).toBe("cancelled")
      expect(leases).toEqual(["open", "close"])
      expect(supplied.completed.size).toBe(0)
      expect(supplied.cleanups).toEqual([])
    }),
  )
})

test("automatic records serialize, omit optional paths and keep canonical identities", () => {
  const contracts = [
    FtcEnvironment.PreparationRequest,
    FtcEnvironment.PreparationAuthorization,
    FtcEnvironment.PreparedAsset,
    FtcEnvironment.PreparationError,
  ]
  expect(contracts.map((contract) => contract.ast.annotations?.identifier)).toEqual([
    "FtcEnvironment.PreparationRequest",
    "FtcEnvironment.PreparationAuthorization",
    "FtcEnvironment.PreparedAsset",
    "FtcEnvironment.PreparationError",
  ])
  expect(new Set(contracts.map((contract) => contract.ast.annotations?.identifier)).size).toBe(4)
  const authorization = {
    projectID: request.projectID,
    profileID: request.profileID,
    component: "buildJdk" as const,
    artifact: profile.buildJdk,
    licenseAccepted: false,
    systemPermissionGranted: false,
  }
  expect(
    Schema.decodeUnknownSync(FtcEnvironment.PreparationAuthorization)(JSON.parse(JSON.stringify(authorization))),
  ).toEqual(authorization)
  expect(Schema.decodeUnknownSync(FtcEnvironment.PrepareRequest)(JSON.parse(JSON.stringify(request)))).toEqual(request)
})

test("a second project can prepare while the first is cancelled without deleting its valid cache", async () => {
  expect.hasAssertions()
  await withSetup((supplied, service) =>
    Effect.gen(function* () {
      supplied.state.holdStage = true
      const first = yield* service.prepareEnvironment(request)
      yield* Deferred.await(supplied.state.stageEntered)
      const second = yield* service.prepareEnvironment({ ...request, projectID: Project.ID.make("other-project") })
      const completed = yield* second.result
      expect(completed.readiness.steps.find((step) => step.id === "buildJdk")?.state).toBe("ready")
      yield* first.cancel
      expect((yield* first.result).state).toBe("cancelled")
      expect((yield* second.result).state).toBe("completed")
      expect(yield* Effect.promise(() => Bun.file(join(supplied.root, "buildJdk", "archive")).bytes())).toEqual(bytes)
      expect(supplied.commits).toEqual(["buildJdk"])
    }),
  )
})

test("unresolved automatic profile cannot obtain download or license metadata", async () => {
  expect.hasAssertions()
  await withSetup((supplied, service) =>
    Effect.gen(function* () {
      const run = yield* service.prepareEnvironment({ ...request, profileID: "unknown" })
      const result = yield* run.result
      expect(result.readiness.state).toBe("incompatible")
      expect(result.steps.find((step) => step.step.id === "buildJdk")).not.toHaveProperty("source")
      expect(supplied.downloads).toEqual([])
      expect(supplied.commits).toEqual([])
    }),
  )
})

test("corrupt cache fails now, is discarded exactly once and recovers on deliberate retry", async () => {
  expect.hasAssertions()
  await withSetup((supplied, service) =>
    Effect.gen(function* () {
      const first = yield* service.prepareEnvironment(request)
      yield* first.result
      const invalid = join(supplied.root, "cached-editor")
      yield* Effect.promise(async () => {
        await mkdir(invalid)
        await Bun.write(join(invalid, "archive"), "corrupt")
        await Bun.write(join(invalid, "tool"), "21")
      })
      const asset = { archivePath: join(invalid, "archive"), path: join(invalid, "tool") }
      supplied.ports.automatic.cache.lookup = (input) =>
        Effect.promise(async () =>
          input.component === "editorJdk" && (await Bun.file(asset.archivePath).exists())
            ? asset
            : supplied.completed.get(input.component),
        )
      const run = yield* service.prepareEnvironment(request)
      expect((yield* run.result).readiness.steps.find((step) => step.id === "editorJdk")).toMatchObject({
        state: "failed",
        cause: "checksum_mismatch",
      })
      expect(supplied.discards).toEqual(["editorJdk"])
      expect(supplied.downloads).toEqual(["buildJdk"])
      expect(yield* Effect.promise(() => Bun.file(join(supplied.root, "buildJdk", "archive")).bytes())).toEqual(bytes)
      const retry = yield* run.recheck()
      expect(retry.readiness.steps.find((step) => step.id === "editorJdk")?.state).toBe("ready")
      expect(supplied.commits).toEqual(["buildJdk", "editorJdk"])
      expect(supplied.downloads).toEqual(["buildJdk", "editorJdk"])
    }),
  )
})

test.each(["failDiscard", "holdDiscard"] as const)(
  "%s never repairs or publishes a corrupt cache entry",
  async (fault) => {
    expect.hasAssertions()
    await withSetup((supplied, service) =>
      Effect.gen(function* () {
        const cached = join(supplied.root, "cached-broken")
        const asset = { archivePath: join(cached, "archive"), path: join(cached, "tool") }
        yield* Effect.promise(async () => {
          await mkdir(cached)
          await Bun.write(asset.archivePath, "corrupt")
          await Bun.write(asset.path, "17")
        })
        supplied.ports.automatic.cache.lookup = () => Effect.succeed(asset)
        supplied.state[fault] = true
        const run = yield* service.prepareEnvironment(request)
        if (fault === "holdDiscard") {
          yield* Deferred.await(supplied.state.discardEntered)
          yield* run.cancel
        }
        const result = yield* run.result
        expect(result.state).toBe(fault === "holdDiscard" ? "cancelled" : "completed")
        expect(result.readiness.state).not.toBe("ready")
        expect(supplied.discards).toEqual([])
        expect(supplied.discardLeases).toEqual(["open", "close"])
        expect(supplied.commits).toEqual([])
        expect(supplied.downloads).toEqual([])
        expect(yield* Effect.promise(() => Bun.file(asset.archivePath).text())).toBe("corrupt")
      }),
    )
  },
)

test.each([null, true, { archivePath: "relative-unowned", path: "relative-unowned" }])(
  "malformed cache references are failed without discard",
  async (value) => {
    expect.hasAssertions()
    await withSetup((supplied, service) =>
      Effect.gen(function* () {
        supplied.ports.automatic.cache.lookup = () => Effect.succeed(value)
        const run = yield* service.prepareEnvironment(request)
        expect((yield* run.result).readiness.steps.find((step) => step.id === "buildJdk")?.cause).toBe(
          "invalid_response",
        )
        expect(supplied.discards).toEqual([])
        expect(supplied.downloads).toEqual([])
        expect(supplied.commits).toEqual([])
      }),
    )
  },
)

test("automatic refresh preserves manual imported wrapper recovery after preparing missing Java", async () => {
  const supplied = await fixture()
  try {
    const observed = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* Environment.GuidedService
        const run = yield* service.prepareEnvironment(request)
        const result = yield* run.result
        const events = yield* run.events.pipe(
          Stream.takeUntil((event) => event.type === "settled"),
          Stream.runCollect,
        )
        const rechecked = yield* run.recheck()
        return { result, events, rechecked }
      }).pipe(
        Effect.provide(
          Environment.guidedLayer({
            ...supplied.ports,
            inspection: {
              ...supplied.ports.inspection,
              probes: {
                inspect: (input) => {
                  if (input.component === "gradleWrapper") return Effect.succeed({ state: "missing" })
                  if (input.component === "buildJdk") return supplied.ports.inspection.probes.inspect(input)
                  return Effect.succeed({
                    state: "available",
                    path: join(supplied.root, input.component),
                    version: profile[input.component].version,
                  })
                },
              },
            },
          }),
        ),
        Effect.scoped,
      ),
    )
    expect(observed.result.readiness.steps.find((step) => step.id === "buildJdk")?.state).toBe("ready")
    expect(observed.result.readiness.steps.find((step) => step.id === "gradleWrapper")).toMatchObject({
      state: "manual",
      cause: "manual_required",
      recovery: "manual_setup",
    })
    expect(observed.result.readiness.state).toBe("missing")
    expect(observed.result.readiness.candidateToolchain).toBeUndefined()
    expect(observed.events.at(-1)).toMatchObject({ type: "settled", result: observed.result })
    expect(
      observed.events
        .filter((event) => event.type === "step" && event.step.step.id === "gradleWrapper")
        .every(
          (event) =>
            event.type === "step" && event.step.step.state === "manual" && event.step.step.recovery === "manual_setup",
        ),
    ).toBe(true)
    expect(observed.rechecked.readiness.steps.find((step) => step.id === "gradleWrapper")).toMatchObject({
      state: "manual",
      recovery: "manual_setup",
    })
    expect(supplied.downloads).toEqual(["buildJdk"])
    expect(supplied.commits).toEqual(["buildJdk"])
    expect(supplied.builds).toEqual([])
    expect(await Bun.file(join(supplied.root, "project", "gradlew")).text()).toBe("preserved imported wrapper")
  } finally {
    await supplied.cleanup()
  }
})
