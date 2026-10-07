export * as Java from "./java"

import { Context, Layer } from "effect"
import { JavaDocuments } from "./java/documents"

export {
  DocumentID,
  DocumentSnapshot,
  DocumentEvent,
  DocumentError,
  Revision,
  SaveRequest,
  EditProposal,
  EditConflict,
  EditResult,
} from "@opencode-ai/schema/ftc-java"
export type { Filesystem, Projects, CodeChanges, Ports, Interface } from "./java/documents"

export class Service extends Context.Service<Service, JavaDocuments.Interface>()("@opencode/FtcJava") {}

// Application wiring supplies authorized canonical project records and the filesystem port.
export const layer = (ports: JavaDocuments.Ports) => Layer.effect(Service, JavaDocuments.make(ports))
