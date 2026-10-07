import { expect, test } from "bun:test"
import { Cause, Deferred, Effect, Exit, Fiber, Result, Scope } from "effect"
import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { tmpdir } from "../../fixture/tmpdir"

const initial = { schemaVersion: 1, hardware: [], managedPathing: "neither" } as const

test("pure manifest producer decodes and hashes one copied byte snapshot", async () => {
  const module = await import("../../../src/ftc/configuration/manifest-snapshot").catch(() => undefined)
  expect(module?.ManifestSnapshot.decodeRead).toBeFunction()
  if (!module) return
  const bytes = new TextEncoder().encode(JSON.stringify(initial))
  const result = module.ManifestSnapshot.decodeRead(bytes)
  const revision = createHash("sha256").update(bytes).digest("hex")
  bytes.fill(0)
  expect(result).toEqual(Result.succeed({ revision, manifest: initial }))
  expect(module.ManifestSnapshot.decodeRead(undefined)).toEqual(
    Result.succeed({
      kind: "initialization_proposal",
      filename: "ftc-project.json",
      expectedRevision: null,
      manifest: initial,
    }),
  )
  expect(module.ManifestSnapshot.decodeRead(new TextEncoder().encode('{"schemaVersion":2}'))).toEqual(
    Result.fail({ code: "unsupported_schema_version" }),
  )
  expect(module.ManifestSnapshot.decodeRead(new Uint8Array([255]))).toEqual(Result.fail({ code: "invalid_manifest" }))
})

test("real Effect adapter owns and retires resources with its Scope", async () => {
  const module = await import("../../../src/ftc/configuration/inspection-filesystem.native").catch(() => undefined)
  expect(module?.NativeInspectionFilesystem.make).toBeFunction()
  if (!module) return
  await using fixture = await tmpdir()
  await fs.writeFile(path.join(fixture.path, "test.txt"), "own")
  const reader = module.NativeInspectionFilesystem.make()
  const project = await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const project = yield* reader.openProject({ root: fixture.path })
        expect(new TextDecoder().decode(yield* project.readFile("test.txt"))).toBe("own")
        expect(yield* project.readFile("missing")).toBeUndefined()
        return project
      }),
    ),
  )
  expect(await Effect.runPromise(project.readFile("test.txt").pipe(Effect.flip))).toEqual({ code: "owner_closed" })
})

test("native caller and owner interruption retire real asynchronous reads before releasing descriptors", async () => {
  const { NativeInspectionFilesystem } = await import("../../../src/ftc/configuration/inspection-filesystem.native")
  await using fixture = await tmpdir()
  const large = await fs.open(path.join(fixture.path, "large"), "w")
  await large.truncate(256 * 1024 * 1024)
  await large.close()
  await fs.writeFile(path.join(fixture.path, "small"), "own")
  // Initialize the runtime worker pool before counting owned resources.
  await Effect.runPromise(Effect.scoped(NativeInspectionFilesystem.make().openProject({ root: fixture.path })))
  const baseline = (await fs.readdir("/dev/fd")).length
  await Effect.runPromise(
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const project = yield* NativeInspectionFilesystem.make()
        .openProject({ root: fixture.path })
        .pipe(Scope.provide(scope))
      const admitted = (yield* Effect.promise(() => fs.readdir("/dev/fd"))).length
      for (const closing of [false, true]) {
        const reading = yield* Effect.forkChild(project.readFile("large"))
        // Observe the actual held file descriptor, not a substitute reader or artificial delay.
        yield* Effect.promise(async () => {
          while ((await fs.readdir("/dev/fd")).length <= admitted) await Bun.sleep(1)
        })
        if (closing) yield* Scope.close(scope, Exit.void)
        else yield* Fiber.interrupt(reading)
        const result = yield* Fiber.await(reading)
        expect(Exit.isFailure(result) && Cause.hasInterrupts(result.cause)).toBe(true)
        expect((yield* Effect.promise(() => fs.readdir("/dev/fd"))).length).toBe(closing ? baseline : admitted)
        if (!closing) expect(new TextDecoder().decode(yield* project.readFile("small"))).toBe("own")
      }
      expect(yield* project.verify().pipe(Effect.flip)).toEqual({ code: "owner_closed" })
    }),
  )
})

test("Inspection decodes the protected manifest bytes even when its pathname changes at production", async () => {
  const { NativeInspectionFilesystem } = await import("../../../src/ftc/configuration/inspection-filesystem.native")
  const { ManifestSnapshot } = await import("../../../src/ftc/configuration/manifest-snapshot")
  const { Inspection } = await import("../../../src/ftc/configuration/inspection")
  const { renameSync, symlinkSync } = await import("node:fs")
  await using fixture = await tmpdir()
  const own = path.join(fixture.path, "own")
  await fs.mkdir(own)
  const text = JSON.stringify(initial)
  await fs.writeFile(path.join(own, "ftc-project.json"), text)
  await fs.writeFile(path.join(fixture.path, "foreign.json"), JSON.stringify({ ...initial, managedPathing: "pedro" }))
  let calls = 0
  const producer = {
    decodeRead: (bytes: Uint8Array | undefined) => {
      calls++
      expect(new TextDecoder().decode(bytes)).toBe(text)
      renameSync(path.join(own, "ftc-project.json"), path.join(own, "original.json"))
      symlinkSync(path.join(fixture.path, "foreign.json"), path.join(own, "ftc-project.json"))
      return ManifestSnapshot.decodeRead(bytes)
    },
  }
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const owner = yield* Inspection.make({ reader: NativeInspectionFilesystem.make(), manifest: producer })
        producer.decodeRead = () => {
          throw new Error("mutable producer was not captured")
        }
        const result = yield* owner.inspectProject({ root: own })
        expect(result.managedPathing).toBe("neither")
        expect(result.sourceRevisions.find((source) => source.path === "ftc-project.json")).toEqual({
          path: "ftc-project.json",
          state: "read",
          revision: createHash("sha256").update(text).digest("hex"),
        })
        expect(calls).toBe(1)
      }),
    ),
  )
})

test("unavailable native manifest never reaches missing-file producer; actual absence does", async () => {
  const { NativeInspectionFilesystem } = await import("../../../src/ftc/configuration/inspection-filesystem.native")
  const { ManifestSnapshot } = await import("../../../src/ftc/configuration/manifest-snapshot")
  const { Inspection } = await import("../../../src/ftc/configuration/inspection")
  await using fixture = await tmpdir()
  await fs.mkdir(path.join(fixture.path, "ftc-project.json"))
  let calls = 0
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const owner = yield* Inspection.make({
          reader: NativeInspectionFilesystem.make(),
          manifest: {
            decodeRead: (bytes) => {
              calls++
              expect(bytes).toBeUndefined()
              return ManifestSnapshot.decodeRead(bytes)
            },
          },
        })
        const unavailable = yield* owner.inspectProject({ root: fixture.path })
        expect(calls).toBe(0)
        expect(unavailable.sourceRevisions.find((source) => source.path === "ftc-project.json")?.state).toBe(
          "unavailable",
        )
        yield* Effect.promise(() => fs.rmdir(path.join(fixture.path, "ftc-project.json")))
        const missing = yield* owner.inspectProject({ root: fixture.path })
        expect(calls).toBe(1)
        expect(missing.unknowns).toContainEqual({ path: "ftc-project.json", reason: "manifest_missing" })
      }),
    ),
  )
})

test("shared manifest producer retains exact byte hashing and existing UTF-8 replacement semantics", async () => {
  const { ManifestSnapshot } = await import("../../../src/ftc/configuration/manifest-snapshot")
  const json = JSON.stringify({ schemaVersion: 1, hardware: [{ id: "NAME", devices: [] }], managedPathing: "neither" })
  const bytes = new TextEncoder().encode(json)
  bytes[json.indexOf("NAME")] = 255
  const result = ManifestSnapshot.decodeRead(bytes)
  expect(Result.isSuccess(result)).toBe(true)
  if (Result.isSuccess(result) && "revision" in result.success) {
    expect(result.success.revision).toBe(createHash("sha256").update(bytes).digest("hex"))
    expect(result.success.manifest.hardware[0].id).toBe("\ufffdAME")
  }
  expect(ManifestSnapshot.decodeRead(new TextEncoder().encode(JSON.stringify({ ...initial, secret: true })))).toEqual(
    Result.fail({ code: "invalid_manifest" }),
  )
})

for (const attack of ["leaf", "ancestor", "listing", "root"] as const) {
  test(`public Inspection rejects real native ${attack} retarget before foreign content consumption`, async () => {
    const { NativeInspectionFilesystem } = await import("../../../src/ftc/configuration/inspection-filesystem.native")
    const { ManifestSnapshot } = await import("../../../src/ftc/configuration/manifest-snapshot")
    const { Inspection } = await import("../../../src/ftc/configuration/inspection")
    await using fixture = await tmpdir()
    const own = path.join(fixture.path, "own")
    const foreign = path.join(fixture.path, "foreign")
    await fs.mkdir(path.join(own, "TeamCode/src/main/java"), { recursive: true })
    await fs.mkdir(path.join(foreign, "TeamCode/src/main/java"), { recursive: true })
    await fs.writeFile(path.join(own, "TeamCode/build.gradle"), "dependencies {\n}\n")
    await fs.writeFile(path.join(own, "TeamCode/src/main/java/Own.java"), "class Own {}")
    await fs.writeFile(path.join(foreign, "TeamCode/build.gradle"), "FOREIGN")
    await fs.writeFile(path.join(foreign, "TeamCode/src/main/java/Foreign.java"), "FOREIGN")
    const consumed: string[] = []
    let attacked = false
    const native = NativeInspectionFilesystem.make()
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const owner = yield* Inspection.make({
            manifest: ManifestSnapshot,
            reader: {
              openProject: (input) =>
                Effect.gen(function* () {
                  const project = yield* native.openProject(input)
                  if (attack === "root") {
                    yield* Effect.promise(() => fs.rename(own, `${own}-held`))
                    yield* Effect.promise(() => fs.symlink(foreign, own))
                  }
                  return {
                    ...project,
                    readFile: (relative) =>
                      Effect.gen(function* () {
                        if (
                          !attacked &&
                          relative === "TeamCode/build.gradle" &&
                          (attack === "leaf" || attack === "ancestor")
                        ) {
                          attacked = true
                          const target = attack === "leaf" ? "TeamCode/build.gradle" : "TeamCode"
                          yield* Effect.promise(() =>
                            fs.rename(path.join(own, target), path.join(own, `${target}-held`)),
                          )
                          yield* Effect.promise(() => fs.symlink(path.join(foreign, target), path.join(own, target)))
                        }
                        const bytes = yield* project.readFile(relative)
                        if (bytes) consumed.push(new TextDecoder().decode(bytes))
                        return bytes
                      }),
                    readDirectory: (relative) =>
                      Effect.gen(function* () {
                        if (!attacked && attack === "listing") {
                          attacked = true
                          yield* Effect.promise(() =>
                            fs.rename(path.join(own, "TeamCode/src"), path.join(own, "TeamCode/held")),
                          )
                          yield* Effect.promise(() =>
                            fs.symlink(path.join(foreign, "TeamCode/src"), path.join(own, "TeamCode/src")),
                          )
                        }
                        const entries = yield* project.readDirectory(relative)
                        entries?.forEach((entry) => consumed.push(entry.name))
                        return entries
                      }),
                  }
                }),
            },
          })
          expect((yield* owner.inspectProject({ root: own }).pipe(Effect.flip)).code).toBe("path_outside_project")
          expect(consumed.some((value) => value.includes("FOREIGN") || value.includes("Foreign"))).toBe(false)
        }),
      ),
    )
  })
}

test("public Inspection caller and owner cancellation join native retirement and close escaped owners", async () => {
  const { NativeInspectionFilesystem } = await import("../../../src/ftc/configuration/inspection-filesystem.native")
  const { ManifestSnapshot } = await import("../../../src/ftc/configuration/manifest-snapshot")
  const { Inspection } = await import("../../../src/ftc/configuration/inspection")
  await using fixture = await tmpdir()
  const large = await fs.open(path.join(fixture.path, "build.gradle"), "w")
  await large.truncate(256 * 1024 * 1024)
  await large.close()
  await fs.mkdir(path.join(fixture.path, "small"))
  await Effect.runPromise(Effect.scoped(NativeInspectionFilesystem.make().openProject({ root: fixture.path })))
  const baseline = (await fs.readdir("/dev/fd")).length
  const completion = Effect.runPromise(
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const owner = yield* Inspection.make({
        reader: NativeInspectionFilesystem.make(),
        manifest: ManifestSnapshot,
      }).pipe(Scope.provide(scope))
      for (const closeOwner of [false, true]) {
        const reading = yield* Effect.forkChild(owner.inspectProject({ root: fixture.path }))
        // The real native project root plus the active build.gradle descriptor must be held.
        yield* Effect.promise(async () => {
          while ((await fs.readdir("/dev/fd")).length < baseline + 2) await Bun.sleep(1)
        })
        if (closeOwner) yield* Scope.close(scope, Exit.void)
        else yield* Fiber.interrupt(reading)
        const exit = yield* Fiber.await(reading)
        expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true)
        expect((yield* Effect.promise(() => fs.readdir("/dev/fd"))).length).toBe(baseline)
        if (!closeOwner) {
          const next = yield* owner.inspectProject({ root: path.join(fixture.path, "small") })
          expect(next.detectedPathing).toBe("unknown")
        }
      }
      expect(yield* owner.inspectProject({ root: fixture.path }).pipe(Effect.flip)).toEqual({ code: "owner_closed" })
    }),
  ).then(() => "completed")
  // This bounded diagnostic detects a lost notification; it is not a product cancellation SLA.
  const outcome = await Promise.race([completion, Bun.sleep(1000).then(() => "not-completed-in-diagnostic-window")])
  expect((await fs.readdir("/dev/fd")).length).toBe(baseline)
  expect(outcome).toBe("completed")
})

test("public Inspection overlapping caller cancellation and owner closure both join retirement", async () => {
  const { NativeInspectionFilesystem } = await import("../../../src/ftc/configuration/inspection-filesystem.native")
  const { ManifestSnapshot } = await import("../../../src/ftc/configuration/manifest-snapshot")
  const { Inspection } = await import("../../../src/ftc/configuration/inspection")
  await using fixture = await tmpdir()
  const large = await fs.open(path.join(fixture.path, "build.gradle"), "w")
  await large.truncate(256 * 1024 * 1024)
  await large.close()
  await Effect.runPromise(Effect.scoped(NativeInspectionFilesystem.make().openProject({ root: fixture.path })))
  const baseline = (await fs.readdir("/dev/fd")).length
  const completion = Effect.runPromise(
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const owner = yield* Inspection.make({
        reader: NativeInspectionFilesystem.make(),
        manifest: ManifestSnapshot,
      }).pipe(Scope.provide(scope))
      const reading = yield* Effect.forkChild(owner.inspectProject({ root: fixture.path }))
      const gate = yield* Deferred.make<void>()
      const cancel = yield* Effect.forkChild(Deferred.await(gate).pipe(Effect.andThen(Fiber.interrupt(reading))))
      const closing = yield* Effect.forkChild(Deferred.await(gate).pipe(Effect.andThen(Scope.close(scope, Exit.void))))
      yield* Effect.promise(async () => {
        while ((await fs.readdir("/dev/fd")).length < baseline + 2) await Bun.sleep(1)
      })
      yield* Deferred.succeed(gate, undefined)
      yield* Fiber.join(cancel)
      yield* Fiber.join(closing)
      const exit = yield* Fiber.await(reading)
      expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true)
      expect(yield* owner.inspectProject({ root: fixture.path }).pipe(Effect.flip)).toEqual({ code: "owner_closed" })
    }),
  ).then(() => "completed")
  const outcome = await Promise.race([completion, Bun.sleep(1000).then(() => "not-completed-in-diagnostic-window")])
  expect((await fs.readdir("/dev/fd")).length).toBe(baseline)
  expect(outcome).toBe("completed")
})
