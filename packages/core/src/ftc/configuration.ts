export * as Configuration from "./configuration"

import { Context, Layer } from "effect"
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
} from "@opencode-ai/schema/ftc-configuration"
export type { Filesystem, Ports, Interface } from "./configuration/manifest"

export class Service extends Context.Service<Service, ManifestRepository.Interface>()("@opencode/FtcConfiguration") {}

export const layer = (ports: ManifestRepository.Ports) => Layer.effect(Service, ManifestRepository.make(ports))
