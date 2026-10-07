import { expect, test } from "bun:test"
import { Deferred, Effect, Fiber, Schema, Stream } from "effect"
import { FtcConfiguration } from "@opencode-ai/schema/ftc-configuration"
import { Configuration } from "../../../src/ftc/configuration"
import { ManifestRepository } from "../../../src/ftc/configuration/manifest"
import fs from "node:fs/promises"
import path from "node:path"
import { FSUtil } from "../../../src/fs-util"
import { LayerNode } from "../../../src/effect/layer-node"
import { tmpdir } from "../../fixture/tmpdir"

const initial = { schemaVersion: 1, hardware: [], managedPathing: "neither" } as const

function run<A, E>(body: (filesystem: FSUtil.Interface) => Effect.Effect<A, E, import("effect").Scope.Scope>) {
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const filesystem = yield* FSUtil.Service
        return yield* body(filesystem)
      }),
    ).pipe(Effect.provide(LayerNode.compile(FSUtil.node))),
  )
}

// Removing revision comparison would overwrite these externally authored bytes.
test("stale manifest update preserves external bytes", async () => {
  await using directory = await tmpdir()
  const filename = path.join(directory.path, "ftc-project.json")
  await fs.writeFile(filename, JSON.stringify(initial))
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const filesystem = yield* FSUtil.Service
        const service = yield* ManifestRepository.make({ filesystem })
        const before = yield* service.readManifest({ root: directory.path })
        if (!("revision" in before)) throw new Error("Expected existing manifest")
        const externalBytes = '{"schemaVersion":1,"hardware":[],"managedPathing":"pedro"}\n'
        yield* Effect.promise(() => fs.writeFile(filename, externalBytes))
        const stale = yield* service
          .updateManifest({
            root: directory.path,
            expectedRevision: before.revision,
            change: { ...initial, managedPathing: "road-runner" },
          })
          .pipe(Effect.flip)
        const afterBytes = yield* Effect.promise(() => fs.readFile(filename, "utf8"))
        const current = yield* service.readManifest({ root: directory.path })
        if (!("revision" in current)) throw new Error("Expected existing manifest")
        const secretFields = Object.keys(current.manifest).filter((key) =>
          ["credentials", "chats", "progress", "machinePaths", "approvals", "observations"].includes(key),
        )
        expect(stale.code).toBe("revision_conflict")
        expect(afterBytes).toBe(externalBytes)
        expect(secretFields).toEqual([])
      }),
    ).pipe(Effect.provide(LayerNode.compile(FSUtil.node))),
  )
})

test("absent read proposes initialization without writing, explicit initialization survives reopen", async () => {
  await using directory = await tmpdir()
  await run((filesystem) =>
    Effect.gen(function* () {
      const owner = yield* ManifestRepository.make({ filesystem })
      const proposed = yield* owner.readManifest({ root: directory.path })
      expect(proposed).toEqual({
        kind: "initialization_proposal",
        filename: "ftc-project.json",
        expectedRevision: null,
        manifest: initial,
      })
      expect(yield* Effect.promise(() => fs.readdir(directory.path))).toEqual([])
      const saved = yield* owner.updateManifest({ root: directory.path, expectedRevision: null, change: initial })
      const reopened = yield* ManifestRepository.make({ filesystem })
      expect(yield* reopened.readManifest({ root: directory.path })).toEqual(saved)
      expect(yield* Effect.promise(() => fs.readdir(directory.path))).toEqual(["ftc-project.json"])
    }),
  )
})

test("concurrent initializer cannot replace external bytes at exclusive publication", async () => {
  await using directory = await tmpdir()
  const filename = path.join(directory.path, "ftc-project.json")
  const external = '{"schemaVersion":1,"hardware":[],"managedPathing":"pedro"}'
  await run((filesystem) =>
    Effect.gen(function* () {
      const owner = yield* ManifestRepository.make({
        filesystem: {
          ...filesystem,
          link: (from, to) =>
            Effect.promise(() => fs.writeFile(filename, external)).pipe(Effect.andThen(filesystem.link(from, to))),
        },
      })
      const failure = yield* owner
        .updateManifest({ root: directory.path, expectedRevision: null, change: initial })
        .pipe(Effect.flip)
      expect(failure.code).toBe("revision_conflict")
      expect(yield* Effect.promise(() => fs.readFile(filename, "utf8"))).toBe(external)
      expect(yield* Effect.promise(() => fs.readdir(directory.path))).toEqual(["ftc-project.json"])
    }),
  )
})

test("external edit during staging is detected before replacement and staging is removed", async () => {
  await using directory = await tmpdir()
  const filename = path.join(directory.path, "ftc-project.json")
  await fs.writeFile(filename, JSON.stringify(initial))
  const external = '{"schemaVersion":1,"hardware":[],"managedPathing":"pedro"}\n'
  await run((filesystem) =>
    Effect.gen(function* () {
      const owner = yield* ManifestRepository.make({
        filesystem: {
          ...filesystem,
          writeFile: (file, bytes, options) =>
            filesystem
              .writeFile(file, bytes, options)
              .pipe(Effect.andThen(Effect.promise(() => fs.writeFile(filename, external)))),
        },
      })
      const before = yield* owner.readManifest({ root: directory.path })
      if (!("revision" in before)) throw new Error("Expected snapshot")
      const failure = yield* owner
        .updateManifest({
          root: directory.path,
          expectedRevision: before.revision,
          change: { ...initial, managedPathing: "road-runner" },
        })
        .pipe(Effect.flip)
      expect(failure.code).toBe("revision_conflict")
      expect(yield* Effect.promise(() => fs.readFile(filename, "utf8"))).toBe(external)
      expect(yield* Effect.promise(() => fs.readdir(directory.path))).toEqual(["ftc-project.json"])
    }),
  )
})

test("cancellation after staging preserves the manifest and removes only its staging", async () => {
  await using directory = await tmpdir()
  const filename = path.join(directory.path, "ftc-project.json")
  const beforeBytes = JSON.stringify(initial)
  await fs.writeFile(filename, beforeBytes)
  await fs.writeFile(path.join(directory.path, "team.java"), "team source")
  await run((filesystem) =>
    Effect.gen(function* () {
      const staged = yield* Deferred.make<void>()
      const owner = yield* ManifestRepository.make({
        filesystem: {
          ...filesystem,
          writeFile: (file, bytes, options) =>
            filesystem
              .writeFile(file, bytes, options)
              .pipe(Effect.andThen(Deferred.succeed(staged, undefined)), Effect.andThen(Effect.never)),
        },
      })
      const before = yield* owner.readManifest({ root: directory.path })
      if (!("revision" in before)) throw new Error("Expected snapshot")
      const pending = yield* Effect.forkChild(
        owner.updateManifest({
          root: directory.path,
          expectedRevision: before.revision,
          change: { ...initial, managedPathing: "pedro" },
        }),
      )
      yield* Deferred.await(staged)
      yield* Fiber.interrupt(pending)
      expect(yield* Effect.promise(() => fs.readFile(filename, "utf8"))).toBe(beforeBytes)
      expect((yield* Effect.promise(() => fs.readdir(directory.path))).sort()).toEqual([
        "ftc-project.json",
        "team.java",
      ])
      expect(yield* Effect.promise(() => fs.readFile(path.join(directory.path, "team.java"), "utf8"))).toBe(
        "team source",
      )
    }),
  )
})

test.each([
  { ...initial, credentials: "secret" },
  { ...initial, hardware: [{ id: "hub", approvals: [], devices: [] }] },
  {
    ...initial,
    hardware: [
      {
        id: "hub",
        devices: [{ category: "motor", port: 0, type: "fixture", name: "drive", machinePaths: ["/private"] }],
      },
    ],
  },
  { ...initial, schemaVersion: 0 },
  { ...initial, managedPathing: ["pedro", "road-runner"] },
  { ...initial, hardware: [{ id: "hub", devices: [{ category: "motor", port: -1, type: "fixture", name: "drive" }] }] },
])("invalid shared manifest is rejected without creating a file %j", async (change) => {
  await using directory = await tmpdir()
  await run((filesystem) =>
    Effect.gen(function* () {
      const owner = yield* ManifestRepository.make({ filesystem })
      const failure = yield* owner
        // @ts-expect-error Deliberately invalid form/chat input must also fail at runtime.
        .updateManifest({ root: directory.path, expectedRevision: null, change })
        .pipe(Effect.flip)
      expect(failure.code).toBe("invalid_manifest")
      expect(yield* Effect.promise(() => fs.readdir(directory.path))).toEqual([])
    }),
  )
})

test.each([
  {
    bytes: '{"schemaVersion":2,"hardware":[],"managedPathing":"neither","future":true}',
    code: "unsupported_schema_version",
  },
  { bytes: '{"schemaVersion":1,"hardware":[],"managedPathing":"neither","chats":[]}', code: "invalid_manifest" },
  { bytes: "malformed json", code: "invalid_manifest" },
])("unsupported or invalid external content is never replaced %j", async ({ bytes, code }) => {
  await using directory = await tmpdir()
  const filename = path.join(directory.path, "ftc-project.json")
  await fs.writeFile(filename, bytes)
  await run((filesystem) =>
    Effect.gen(function* () {
      const owner = yield* ManifestRepository.make({ filesystem })
      expect((yield* owner.readManifest({ root: directory.path }).pipe(Effect.flip)).code).toBe(code)
      expect(
        (yield* owner
          .updateManifest({ root: directory.path, expectedRevision: null, change: initial })
          .pipe(Effect.flip)).code,
      ).toBe(code)
      expect(yield* Effect.promise(() => fs.readFile(filename, "utf8"))).toBe(bytes)
    }),
  )
})

test("revision events report commits and observed external bytes, without unchanged-read duplicates", async () => {
  await using directory = await tmpdir()
  await run((filesystem) =>
    Effect.gen(function* () {
      const owner = yield* ManifestRepository.make({ filesystem })
      yield* owner.readManifest({ root: directory.path })
      const collected = yield* Effect.forkChild(Stream.runCollect(Stream.take(owner.events, 2)))
      yield* Effect.yieldNow
      const saved = yield* owner.updateManifest({ root: directory.path, expectedRevision: null, change: initial })
      yield* owner.readManifest({ root: directory.path })
      yield* Effect.promise(() =>
        fs.writeFile(
          path.join(directory.path, "ftc-project.json"),
          '{"schemaVersion":1,"hardware":[],"managedPathing":"pedro"}',
        ),
      )
      const external = yield* owner.readManifest({ root: directory.path })
      const result = yield* Fiber.join(collected)
      expect(JSON.stringify(Array.from(result))).toBe(
        JSON.stringify([
          { type: "updated", root: directory.path, previousRevision: null, result: saved },
          { type: "external_changed", root: directory.path, previousRevision: saved.revision, result: external },
        ]),
      )
    }),
  )
})

test("manifest symlink cannot write outside the project", async () => {
  await using directory = await tmpdir()
  await using outside = await tmpdir()
  const filename = path.join(outside.path, "foreign.json")
  await fs.writeFile(filename, JSON.stringify(initial))
  await fs.symlink(filename, path.join(directory.path, "ftc-project.json"))
  await run((filesystem) =>
    Effect.gen(function* () {
      const owner = yield* ManifestRepository.make({ filesystem })
      expect((yield* owner.readManifest({ root: directory.path }).pipe(Effect.flip)).code).toBe("path_outside_project")
      expect(
        (yield* owner
          .updateManifest({ root: directory.path, expectedRevision: null, change: initial })
          .pipe(Effect.flip)).code,
      ).toBe("path_outside_project")
      expect(yield* Effect.promise(() => fs.readFile(filename, "utf8"))).toBe(JSON.stringify(initial))
    }),
  )
})

test("scope closure rejects retained commands and ends event consumers", async () => {
  await using directory = await tmpdir()
  const owner = await run((filesystem) => ManifestRepository.make({ filesystem }))
  const failure = await Effect.runPromise(owner.readManifest({ root: directory.path }).pipe(Effect.flip))
  expect(failure.code).toBe("owner_closed")
  expect(await Effect.runPromise(Stream.runCollect(owner.events))).toEqual([])
})

test("canonical facade and serializable manifest preserve shared hardware fields", () => {
  const hardware = {
    ...initial,
    hardware: [
      { id: "hub-a", devices: [{ category: "catalog-category", port: 0, type: "catalog-device", name: "drive" }] },
    ],
  }
  expect(Configuration.Manifest).toBe(FtcConfiguration.Manifest)
  expect(Schema.decodeUnknownSync(FtcConfiguration.Manifest, { onExcessProperty: "error" })(hardware)).toEqual(hardware)
  expect(
    Schema.encodeSync(FtcConfiguration.ManifestError)({
      code: "invalid_manifest",
      actualRevision: undefined,
      expectedRevision: undefined,
    }),
  ).toEqual({ code: "invalid_manifest" })
})

test("concurrent updates serialize and only one expected revision can publish", async () => {
  await using directory = await tmpdir()
  await fs.writeFile(path.join(directory.path, "ftc-project.json"), JSON.stringify(initial))
  await run((filesystem) =>
    Effect.gen(function* () {
      const owner = yield* ManifestRepository.make({ filesystem })
      const before = yield* owner.readManifest({ root: directory.path })
      if (!("revision" in before)) throw new Error("Expected snapshot")
      expect(before.revision).toBe("21cef7b42140e06d155797150f863becc9be6a63b49342544a9efeccbda87f6a")
      const results = yield* Effect.all(
        [
          owner
            .updateManifest({
              root: directory.path,
              expectedRevision: before.revision,
              change: { ...initial, managedPathing: "pedro" },
            })
            .pipe(Effect.result),
          owner
            .updateManifest({
              root: directory.path,
              expectedRevision: before.revision,
              change: { ...initial, managedPathing: "road-runner" },
            })
            .pipe(Effect.result),
        ],
        { concurrency: "unbounded" },
      )
      expect(results.filter((result) => result._tag === "Success")).toHaveLength(1)
      const failures = results.filter((result) => result._tag === "Failure")
      expect(failures).toHaveLength(1)
      expect(failures[0]?.failure.code).toBe("revision_conflict")
      const success = results.find((result) => result._tag === "Success")
      if (!success || success._tag !== "Success") throw new Error("Expected successful update")
      const reopened = yield* ManifestRepository.make({ filesystem })
      expect(yield* reopened.readManifest({ root: directory.path })).toEqual(success.success)
      expect(yield* Effect.promise(() => fs.readdir(directory.path))).toEqual(["ftc-project.json"])
    }),
  )
})

test("canonical root alias retargeted during staging cannot publish to either project", async () => {
  await using directory = await tmpdir()
  await using other = await tmpdir()
  await using links = await tmpdir()
  const alias = path.join(links.path, "project")
  const filename = path.join(directory.path, "ftc-project.json")
  await fs.writeFile(filename, JSON.stringify(initial))
  await fs.symlink(directory.path, alias)
  await run((filesystem) =>
    Effect.gen(function* () {
      const owner = yield* ManifestRepository.make({
        filesystem: {
          ...filesystem,
          writeFile: (file, bytes, options) =>
            filesystem.writeFile(file, bytes, options).pipe(
              Effect.andThen(
                Effect.promise(async () => {
                  await fs.unlink(alias)
                  await fs.symlink(other.path, alias)
                }),
              ),
            ),
        },
      })
      const before = yield* owner.readManifest({ root: alias })
      if (!("revision" in before)) throw new Error("Expected snapshot")
      expect(
        (yield* owner
          .updateManifest({
            root: alias,
            expectedRevision: before.revision,
            change: { ...initial, managedPathing: "pedro" },
          })
          .pipe(Effect.flip)).code,
      ).toBe("path_outside_project")
      expect(yield* Effect.promise(() => fs.readFile(filename, "utf8"))).toBe(JSON.stringify(initial))
      expect(yield* Effect.promise(() => fs.readdir(other.path))).toEqual([])
      expect(yield* Effect.promise(() => fs.readdir(directory.path))).toEqual(["ftc-project.json"])
    }),
  )
})

test("cancellation during the final filesystem check does not publish staged content", async () => {
  await using directory = await tmpdir()
  const filename = path.join(directory.path, "ftc-project.json")
  const beforeBytes = JSON.stringify(initial)
  await fs.writeFile(filename, beforeBytes)
  await run((filesystem) =>
    Effect.gen(function* () {
      const checking = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      let staged = false
      const owner = yield* ManifestRepository.make({
        filesystem: {
          ...filesystem,
          writeFile: (file, bytes, options) =>
            filesystem.writeFile(file, bytes, options).pipe(
              Effect.tap(() =>
                Effect.sync(() => {
                  staged = true
                }),
              ),
            ),
          readFile: (file) =>
            staged
              ? Deferred.succeed(checking, undefined).pipe(
                  Effect.andThen(Deferred.await(release)),
                  Effect.andThen(filesystem.readFile(file)),
                )
              : filesystem.readFile(file),
        },
      })
      const before = yield* owner.readManifest({ root: directory.path })
      if (!("revision" in before)) throw new Error("Expected snapshot")
      const pending = yield* Effect.forkChild(
        owner.updateManifest({
          root: directory.path,
          expectedRevision: before.revision,
          change: { ...initial, managedPathing: "pedro" },
        }),
      )
      yield* Deferred.await(checking)
      const cancelling = yield* Effect.forkChild(Fiber.interrupt(pending))
      yield* Effect.yieldNow
      yield* Deferred.succeed(release, undefined)
      yield* Fiber.join(cancelling)
      expect(yield* Effect.promise(() => fs.readFile(filename, "utf8"))).toBe(beforeBytes)
      expect(yield* Effect.promise(() => fs.readdir(directory.path))).toEqual(["ftc-project.json"])
    }),
  )
})

test("an unchanged manifest update emits no revision event", async () => {
  await using directory = await tmpdir()
  await run((filesystem) =>
    Effect.gen(function* () {
      const owner = yield* ManifestRepository.make({ filesystem })
      const before = yield* owner.updateManifest({ root: directory.path, expectedRevision: null, change: initial })
      const collected = yield* Effect.forkChild(Stream.runCollect(Stream.take(owner.events, 1)))
      yield* Effect.yieldNow
      const unchanged = yield* owner.updateManifest({
        root: directory.path,
        expectedRevision: before.revision,
        change: initial,
      })
      expect(unchanged).toEqual(before)
      yield* owner.updateManifest({
        root: directory.path,
        expectedRevision: before.revision,
        change: { ...initial, managedPathing: "pedro" },
      })
      const result = Array.from(yield* Fiber.join(collected))
      const observed = result[0]?.result
      if (!observed || !("revision" in observed)) throw new Error("Expected manifest event")
      expect(observed.manifest.managedPathing).toBe("pedro")
      expect(result[0]?.previousRevision).toBe(before.revision)
    }),
  )
})

test.each(["symlink", "replacement"])(
  "root relocation cannot make scoped cleanup remove a foreign directory %s",
  async (mode) => {
    await using directory = await tmpdir()
    const root = path.join(directory.path, "project")
    const moved = path.join(directory.path, "moved")
    const foreign = path.join(directory.path, "foreign")
    await fs.mkdir(root)
    await fs.mkdir(foreign)
    await fs.writeFile(path.join(root, "ftc-project.json"), JSON.stringify(initial))
    const protectedFiles: string[] = []
    await run((filesystem) =>
      Effect.gen(function* () {
        const owner = yield* ManifestRepository.make({
          filesystem: {
            ...filesystem,
            writeFile: (file, bytes, options) =>
              filesystem.writeFile(file, bytes, options).pipe(
                Effect.andThen(
                  Effect.promise(async () => {
                    const name = path.basename(path.dirname(file))
                    await fs.rename(root, moved)
                    if (mode === "symlink") await fs.symlink(foreign, root)
                    if (mode === "replacement") await fs.mkdir(root)
                    const target = mode === "symlink" ? foreign : root
                    await fs.mkdir(path.join(target, name))
                    const protectedFile = path.join(target, name, "team-owned.txt")
                    await fs.writeFile(protectedFile, "keep team data")
                    protectedFiles.push(protectedFile)
                  }),
                ),
              ),
          },
        })
        const before = yield* owner.readManifest({ root })
        if (!("revision" in before)) throw new Error("Expected snapshot")
        expect(
          (yield* owner
            .updateManifest({
              root,
              expectedRevision: before.revision,
              change: { ...initial, managedPathing: "pedro" },
            })
            .pipe(Effect.flip)).code,
        ).toBe(mode === "symlink" ? "path_outside_project" : "revision_conflict")
        expect(yield* Effect.promise(() => fs.readFile(protectedFiles[0], "utf8"))).toBe("keep team data")
        expect(yield* Effect.promise(() => fs.readFile(path.join(moved, "ftc-project.json"), "utf8"))).toBe(
          JSON.stringify(initial),
        )
      }),
    )
  },
)
