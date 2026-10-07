import { expect, test } from "bun:test"
import { Effect } from "effect"
import { Configuration } from "../../../src/ftc/configuration"
import { FSUtil } from "../../../src/fs-util"
import { LayerNode } from "../../../src/effect/layer-node"
import { tmpdir } from "../../fixture/tmpdir"
import fs from "node:fs/promises"
import path from "node:path"

// Synthetic producer snapshot: IDs and rules make no actual SDK/device support claim.
const catalog = {
  sdkVersion: "fixture-sdk-1",
  revision: "fixture-catalog-1",
  hubs: ["hub-a", "hub-b"].map((id) => ({
    id,
    categories: [
      { category: "motor", ports: [0, 1], types: ["fixture.Motor"] },
      { category: "servo", ports: [0], types: ["fixture.Servo"] },
    ],
  })),
} as const
const device = { category: "motor", port: 0, type: "fixture.Motor", name: "drive" }
const hardware = [{ id: "hub-a", devices: [device] }]
const initial = { schemaVersion: 1, hardware: [], managedPathing: "pedro" } as const

async function run<A, E>(
  body: (service: Configuration.Interface, root: string) => Effect.Effect<A, E>,
  absent = false,
  adapt = (filesystem: FSUtil.Interface, _root: string) => filesystem,
) {
  await using directory = await tmpdir()
  if (!absent) await fs.writeFile(path.join(directory.path, "ftc-project.json"), JSON.stringify(initial))
  return await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const filesystem = yield* FSUtil.Service
        return yield* Effect.gen(function* () {
          const service = yield* Configuration.Service
          expect(typeof service.updateHardware).toBe("function")
          return yield* body(service, directory.path)
        }).pipe(Effect.provide(Configuration.layer({ filesystem: adapt(filesystem, directory.path) })))
      }),
    ).pipe(Effect.provide(LayerNode.compile(FSUtil.node))),
  )
}

function attempt(service: Configuration.Interface, root: string, change: unknown, deviceCatalog: unknown = catalog) {
  return Effect.gen(function* () {
    const current = yield* service.readManifest({ root })
    if (!("revision" in current)) throw new Error("Expected manifest")
    return yield* service.updateHardware({ root, expectedRevision: current.revision, change, deviceCatalog })
  })
}

// Removing the shared validation would allow either caller to persist invalid names/ports.
test("form and chat enforce the same port and name rules", () =>
  run((service, root) =>
    Effect.gen(function* () {
      const invalid = { hardware: [{ id: "hub-a", devices: [{ ...device, port: 2 }] }] }
      const formError = yield* attempt(service, root, invalid).pipe(Effect.flip)
      const chatError = yield* attempt(service, root, invalid).pipe(Effect.flip)
      const duplicateName = yield* attempt(service, root, {
        hardware: [hardware[0], { id: "hub-b", devices: [device] }],
      }).pipe(Effect.flip)
      expect(formError.code).toBe(chatError.code)
      expect(duplicateName.code).toBe("duplicate_name")
      expect(formError.code).toBe("invalid_port")
      expect(formError).toEqual({ code: "invalid_port", field: ["hardware", 0, "devices", 0, "port"] })
      expect(duplicateName).toEqual({ code: "duplicate_name", field: ["hardware", 1, "devices", 0, "name"] })
      expect(yield* Effect.promise(() => fs.readFile(path.join(root, "ftc-project.json"), "utf8"))).toBe(
        JSON.stringify(initial),
      )
    }),
  ))

// Removing a domain branch must permit its invalid fixture or return the wrong stable field.
test.each([
  { device: { ...device, name: "" }, code: "missing_name", field: "name" },
  { device: { category: "motor", port: 0, type: "fixture.Motor" }, code: "missing_name", field: "name" },
  { device: { ...device, name: " \t " }, code: "missing_name", field: "name" },
  { device: { ...device, category: "other" }, code: "invalid_category", field: "category" },
  { device: { ...device, type: "fixture.Servo" }, code: "invalid_type", field: "type" },
  { device: { ...device, port: -1 }, code: "invalid_hardware", field: undefined },
  { device: { ...device, port: 0.5 }, code: "invalid_hardware", field: undefined },
])("rejects $code at the offending field: $device", (fixture) =>
  run((service, root) =>
    Effect.gen(function* () {
      expect(
        yield* attempt(service, root, { hardware: [{ id: "hub-a", devices: [fixture.device] }] }).pipe(Effect.flip),
      ).toEqual({
        code: fixture.code,
        field: fixture.field ? ["hardware", 0, "devices", 0, fixture.field] : ["hardware"],
      })
      expect(yield* Effect.promise(() => fs.readFile(path.join(root, "ftc-project.json"), "utf8"))).toBe(
        JSON.stringify(initial),
      )
    }),
  ),
)

test.each([
  { hardware: [{ id: "unknown", devices: [] }], code: "invalid_hub", field: ["hardware", 0, "id"] },
  { hardware: [hardware[0], { id: "hub-a", devices: [] }], code: "duplicate_hub", field: ["hardware", 1, "id"] },
  {
    hardware: [{ id: "hub-a", devices: [device, { ...device, name: "other" }] }],
    code: "occupied_port",
    field: ["hardware", 0, "devices", 1, "port"],
  },
])("rejects hub or occupancy conflict $code", (fixture) =>
  run((service, root) =>
    attempt(service, root, { hardware: fixture.hardware }).pipe(
      Effect.flip,
      Effect.tap((failure) => Effect.sync(() => expect(failure).toEqual({ code: fixture.code, field: fixture.field }))),
    ),
  ),
)

// Normalizing identifiers, changing managedPathing, or failing to persist would break this round trip.
test("preserves identifiers and pathing while accepting distinct category ports and exact names", () =>
  run((service, root) =>
    Effect.gen(function* () {
      const change = {
        hardware: [
          {
            id: "hub-a",
            devices: [
              { ...device, name: " Drive电机 " },
              { ...device, port: 1, name: "drive电机" },
              { category: "servo", port: 0, type: "fixture.Servo", name: "arm" },
            ],
          },
        ],
      }
      const saved = yield* attempt(service, root, change)
      expect(saved.manifest).toEqual({ schemaVersion: 1, hardware: change.hardware, managedPathing: "pedro" })
      expect(yield* service.readManifest({ root })).toEqual(saved)
      expect(JSON.parse(yield* Effect.promise(() => fs.readFile(path.join(root, "ftc-project.json"), "utf8")))).toEqual(
        saved.manifest,
      )
      expect(yield* Effect.promise(() => fs.readdir(root))).toEqual(["ftc-project.json"])
    }),
  ))

// Hardcoded SDK rules would accept a port rejected by the selected version's fixture rules.
test("uses the supplied SDK catalog snapshot and rejects ambiguous or malformed catalogs", () =>
  run((service, root) =>
    Effect.gen(function* () {
      const next = {
        ...catalog,
        sdkVersion: "fixture-sdk-2",
        revision: "fixture-catalog-2",
        hubs: catalog.hubs.map((hub) => ({
          ...hub,
          categories: [{ category: "motor", ports: [1], types: ["fixture.Motor"] }],
        })),
      }
      expect((yield* attempt(service, root, { hardware }, next).pipe(Effect.flip)).code).toBe("invalid_port")
      expect(
        yield* attempt(service, root, { hardware }, { ...catalog, hubs: [catalog.hubs[0], catalog.hubs[0]] }).pipe(
          Effect.flip,
        ),
      ).toEqual({ code: "invalid_catalog", field: ["deviceCatalog"] })
      expect(yield* attempt(service, root, { hardware }, { ...catalog, sdkVersion: "" }).pipe(Effect.flip)).toEqual({
        code: "invalid_catalog",
        field: ["deviceCatalog"],
      })
      expect(yield* attempt(service, root, { hardware, managedPathing: "neither" }).pipe(Effect.flip)).toEqual({
        code: "invalid_hardware",
        field: ["hardware"],
      })
    }),
  ))

// Dropping the read/update revision checks would overwrite the externally edited pathing choice.
test("stale hardware command preserves external bytes", () =>
  run((service, root) =>
    Effect.gen(function* () {
      const before = yield* service.readManifest({ root })
      if (!("revision" in before)) throw new Error("Expected manifest")
      const external = '{"schemaVersion":1,"hardware":[],"managedPathing":"road-runner"}\n'
      yield* Effect.promise(() => fs.writeFile(path.join(root, "ftc-project.json"), external))
      const failure = yield* service
        .updateHardware({ root, expectedRevision: before.revision, change: { hardware }, deviceCatalog: catalog })
        .pipe(Effect.flip)
      expect(failure.code).toBe("revision_conflict")
      expect(yield* Effect.promise(() => fs.readFile(path.join(root, "ftc-project.json"), "utf8"))).toBe(external)
    }),
  ))

// Automatic initialization would create an unauthorized manifest on this absent-project path.
test("hardware update requires existing manifest", () =>
  run(
    (service, root) =>
      Effect.gen(function* () {
        expect(
          yield* service
            .updateHardware({ root, expectedRevision: "a".repeat(64), change: { hardware }, deviceCatalog: catalog })
            .pipe(Effect.flip),
        ).toEqual({ code: "manifest_missing", field: ["hardware"] })
        expect(yield* Effect.promise(() => fs.readdir(root))).toEqual([])
      }),
    true,
  ))

// A malformed expected revision must not escape as an unserializable conflict error.
test("rejects malformed expected revision before persistence", () =>
  run((service, root) =>
    Effect.gen(function* () {
      expect(
        yield* service
          .updateHardware({ root, expectedRevision: "stale", change: { hardware }, deviceCatalog: catalog })
          .pipe(Effect.flip),
      ).toEqual({ code: "invalid_manifest" })
      expect(yield* Effect.promise(() => fs.readFile(path.join(root, "ftc-project.json"), "utf8"))).toBe(
        JSON.stringify(initial),
      )
    }),
  ))

// Treating port rules as global would accept hub-b's unsupported port.
test("hub rules remain project-local and an empty replacement removes only hardware", () =>
  run((service, root) =>
    Effect.gen(function* () {
      const limited = {
        ...catalog,
        hubs: [
          catalog.hubs[0],
          { id: "hub-b", categories: [{ category: "motor", ports: [1], types: ["fixture.Motor"] }] },
        ],
      }
      expect(
        yield* attempt(service, root, { hardware: [{ id: "hub-b", devices: [device] }] }, limited).pipe(Effect.flip),
      ).toEqual({ code: "invalid_port", field: ["hardware", 0, "devices", 0, "port"] })
      yield* attempt(service, root, { hardware })
      expect((yield* attempt(service, root, { hardware: [] })).manifest).toEqual(initial)
    }),
  ))

// Keeping caller object references across read I/O would save the unvalidated renamed value.
test("copies admitted hardware before asynchronous manifest read", async () => {
  const change = { hardware: [{ id: "hub-a", devices: [{ ...device }] }] }
  let reads = 0
  await run(
    (service, root) =>
      Effect.gen(function* () {
        const current = yield* service.readManifest({ root })
        if (!("revision" in current)) throw new Error("Expected manifest")
        const saved = yield* service.updateHardware({
          root,
          expectedRevision: current.revision,
          change,
          deviceCatalog: catalog,
        })
        expect(saved.manifest.hardware[0].devices[0].name).toBe("drive")
        expect(change.hardware[0].devices[0].name).toBe("changed-after-admission")
      }),
    false,
    (filesystem) => ({
      ...filesystem,
      readFile: (filename) =>
        filesystem.readFile(filename).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              // The initial explicit read sees the original name; the command's next read mutates ingress.
              if (reads++ === 1) change.hardware[0].devices[0].name = "changed-after-admission"
            }),
          ),
        ),
    }),
  )
})

// Passing an unchecked revision to the owner would lose an edit arriving during staging.
test("hardware command retains owner revision protection during staging", () => {
  const external = '{"schemaVersion":1,"hardware":[],"managedPathing":"road-runner"}\n'
  return run(
    (service, root) =>
      Effect.gen(function* () {
        const failure = yield* attempt(service, root, { hardware }).pipe(Effect.flip)
        expect(failure.code).toBe("revision_conflict")
        expect(yield* Effect.promise(() => fs.readFile(path.join(root, "ftc-project.json"), "utf8"))).toBe(external)
        expect(yield* Effect.promise(() => fs.readdir(root))).toEqual(["ftc-project.json"])
      }),
    false,
    (filesystem, root) => ({
      ...filesystem,
      writeFile: (file, bytes, options) =>
        filesystem
          .writeFile(file, bytes, options)
          .pipe(Effect.andThen(Effect.promise(() => fs.writeFile(path.join(root, "ftc-project.json"), external)))),
    }),
  )
})

// Rereading the mutable root after I/O can redirect publication to a second project with identical bytes.
test("captures command envelope root before asynchronous manifest read", async () => {
  await using second = await tmpdir()
  const secondFile = path.join(second.path, "ftc-project.json")
  await fs.writeFile(secondFile, JSON.stringify(initial))
  const envelope = { root: "", expectedRevision: "", change: { hardware }, deviceCatalog: catalog }
  let armed = false
  await run(
    (service, root) =>
      Effect.gen(function* () {
        const before = yield* service.readManifest({ root })
        if (!("revision" in before)) throw new Error("Expected manifest")
        envelope.root = root
        envelope.expectedRevision = before.revision
        armed = true
        const saved = yield* service.updateHardware(envelope)
        expect(envelope.root).toBe(second.path)
        expect(saved.manifest).toEqual({ ...initial, hardware })
        expect(
          JSON.parse(yield* Effect.promise(() => fs.readFile(path.join(root, "ftc-project.json"), "utf8"))),
        ).toEqual({ ...initial, hardware })
        expect(yield* Effect.promise(() => fs.readFile(secondFile, "utf8"))).toBe(JSON.stringify(initial))
        expect(yield* Effect.promise(() => fs.readdir(second.path))).toEqual(["ftc-project.json"])
      }),
    false,
    (filesystem) => ({
      ...filesystem,
      readFile: (filename) =>
        filesystem.readFile(filename).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              if (!armed) return
              armed = false
              envelope.root = second.path
            }),
          ),
        ),
    }),
  )
})

// Rereading expectedRevision after I/O can replace a captured stale revision with the newly observed one.
test("captures command envelope revision before asynchronous manifest read", async () => {
  const envelope = { root: "", expectedRevision: "", change: { hardware }, deviceCatalog: catalog }
  let replacement = ""
  let armed = false
  await run(
    (service, root) =>
      Effect.gen(function* () {
        const before = yield* service.readManifest({ root })
        if (!("revision" in before)) throw new Error("Expected manifest")
        const external = '{"schemaVersion":1,"hardware":[],"managedPathing":"road-runner"}\n'
        yield* Effect.promise(() => fs.writeFile(path.join(root, "ftc-project.json"), external))
        const after = yield* service.readManifest({ root })
        if (!("revision" in after)) throw new Error("Expected manifest")
        envelope.root = root
        envelope.expectedRevision = before.revision
        replacement = after.revision
        armed = true
        const result = yield* service.updateHardware(envelope).pipe(Effect.result)
        expect(envelope.expectedRevision).toBe(after.revision)
        expect(result).toMatchObject({
          _tag: "Failure",
          failure: { code: "revision_conflict", expectedRevision: before.revision, actualRevision: after.revision },
        })
        expect(yield* Effect.promise(() => fs.readFile(path.join(root, "ftc-project.json"), "utf8"))).toBe(external)
        expect(yield* Effect.promise(() => fs.readdir(root))).toEqual(["ftc-project.json"])
      }),
    false,
    (filesystem) => ({
      ...filesystem,
      readFile: (filename) =>
        filesystem.readFile(filename).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              if (!armed) return
              armed = false
              envelope.expectedRevision = replacement
            }),
          ),
        ),
    }),
  )
})
