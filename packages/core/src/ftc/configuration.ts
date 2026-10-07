export * as Configuration from "./configuration"

import { Context, Effect, Layer, Option, Result, Schema } from "effect"
import { FtcConfiguration } from "@opencode-ai/schema/ftc-configuration"
import { ManifestRepository } from "./configuration/manifest"

export {
  Device,
  Hub,
  Manifest,
  Revision,
  ManifestSnapshot,
  InitializationProposal,
  ReadResult,
  ManifestError,
  ManifestEvent,
  HardwareChange,
  DeviceCatalog,
  HardwareError,
} from "@opencode-ai/schema/ftc-configuration"
export type { Filesystem, Ports } from "./configuration/manifest"

export interface Interface extends ManifestRepository.Interface {
  readonly updateHardware: (input: {
    readonly root: string
    readonly expectedRevision: string
    readonly change: unknown
    readonly deviceCatalog: unknown
  }) => Effect.Effect<
    FtcConfiguration.ManifestSnapshot,
    FtcConfiguration.ManifestError | FtcConfiguration.HardwareError
  >
}

export class Service extends Context.Service<Service, Interface>()("@opencode/FtcConfiguration") {}

export const layer = (ports: ManifestRepository.Ports) =>
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const owner = yield* ManifestRepository.make(ports)
      return {
        ...owner,
        updateHardware: Effect.fn("Configuration.updateHardware")(function* (input) {
          if (!Schema.is(FtcConfiguration.Revision)(input.expectedRevision))
            return yield* Effect.fail({ code: "invalid_manifest" } satisfies FtcConfiguration.ManifestError)
          // Validate and copy before I/O so mutable caller values cannot change the admitted replacement.
          const hardware = yield* Effect.fromResult(validateHardware(input.change, input.deviceCatalog))
          const current = yield* owner.readManifest({ root: input.root })
          if (!("revision" in current))
            return yield* Effect.fail({
              code: "manifest_missing",
              field: ["hardware"],
            } satisfies FtcConfiguration.HardwareError)
          if (current.revision !== input.expectedRevision)
            return yield* Effect.fail({
              code: "revision_conflict",
              expectedRevision: input.expectedRevision,
              actualRevision: current.revision,
            } satisfies FtcConfiguration.ManifestError)
          return yield* owner.updateManifest({
            root: input.root,
            expectedRevision: input.expectedRevision,
            change: { ...current.manifest, hardware },
          })
        }),
      } satisfies Interface
    }),
  )

function validateHardware(
  change: unknown,
  catalog: unknown,
): Result.Result<readonly FtcConfiguration.Hub[], FtcConfiguration.HardwareError> {
  const failure = (code: FtcConfiguration.HardwareError["code"], field: FtcConfiguration.HardwareError["field"]) =>
    Result.fail({ code, field })
  // Ingress may omit names; persisted Device remains strict and nonempty.
  if (typeof change === "object" && change !== null && "hardware" in change && Array.isArray(change.hardware)) {
    for (const [hubIndex, hub] of change.hardware.entries()) {
      if (typeof hub !== "object" || hub === null || !("devices" in hub) || !Array.isArray(hub.devices)) continue
      for (const [deviceIndex, device] of hub.devices.entries()) {
        if (typeof device !== "object" || device === null) continue
        if (!("name" in device) || (typeof device.name === "string" && device.name.trim().length === 0))
          return failure("missing_name", ["hardware", hubIndex, "devices", deviceIndex, "name"])
      }
    }
  }
  const decoded = Schema.decodeUnknownOption(FtcConfiguration.HardwareChange)(change)
  if (Option.isNone(decoded)) return failure("invalid_hardware", ["hardware"])
  const rules = Schema.decodeUnknownOption(FtcConfiguration.DeviceCatalog)(catalog)
  if (Option.isNone(rules)) return failure("invalid_catalog", ["deviceCatalog"])
  const hubs = new Set<string>()
  const names = new Set<string>()
  for (const [hubIndex, hub] of decoded.value.hardware.entries()) {
    const field = ["hardware", hubIndex] as const
    if (hubs.has(hub.id)) return failure("duplicate_hub", [...field, "id"])
    hubs.add(hub.id)
    const rule = rules.value.hubs.find((item) => item.id === hub.id)
    if (!rule) return failure("invalid_hub", [...field, "id"])
    const occupied = new Map<string, Set<number>>()
    for (const [deviceIndex, device] of hub.devices.entries()) {
      const field = ["hardware", hubIndex, "devices", deviceIndex] as const
      if (names.has(device.name)) return failure("duplicate_name", [...field, "name"])
      names.add(device.name)
      const category = rule.categories.find((item) => item.category === device.category)
      if (!category) return failure("invalid_category", [...field, "category"])
      if (!category.ports.includes(device.port)) return failure("invalid_port", [...field, "port"])
      if (!category.types.includes(device.type)) return failure("invalid_type", [...field, "type"])
      if (occupied.get(device.category)?.has(device.port)) return failure("occupied_port", [...field, "port"])
      const ports = occupied.get(device.category) ?? new Set<number>()
      ports.add(device.port)
      occupied.set(device.category, ports)
    }
  }
  return Result.succeed(
    decoded.value.hardware.map((hub) => ({ ...hub, devices: hub.devices.map((device) => ({ ...device })) })),
  )
}
