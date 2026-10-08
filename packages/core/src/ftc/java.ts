export * as Java from "./java"

import { Context, Effect, Layer } from "effect"
import { JavaDocuments } from "./java/documents"
import { JavaBuild } from "./java/build"

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
  BuildID,
  BuildRequest,
  BuildExclusion,
  BuildLog,
  BuildEvidence,
  BuildError,
  BuildQuery,
  BuildRecord,
} from "@opencode-ai/schema/ftc-java"
export type { Filesystem, Projects, CodeChanges, Ports } from "./java/documents"
export type { BuildRun } from "./java/build"

export interface Interface extends JavaDocuments.Interface, JavaBuild.Interface {}
export class Service extends Context.Service<Service, Interface>()("@opencode/FtcJava") {}

// Application wiring supplies authorized canonical project records and the filesystem port.
export const layer = (ports: JavaDocuments.Ports) =>
  Layer.effect(
    Service,
    JavaDocuments.make(ports).pipe(
      Effect.map((documents) => ({
        ...documents,
        build: unavailable,
        startBuild: unavailable,
        readBuild: unavailable,
      })),
    ),
  )

const unavailable = () => Effect.fail({ code: "build_unavailable" as const })

export const layerWithBuilds = (ports: { readonly documents: JavaDocuments.Ports; readonly builds: JavaBuild.Ports }) =>
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const documents = yield* JavaDocuments.make(ports.documents)
      const builds = yield* JavaBuild.make(ports.builds)
      return { ...documents, ...builds }
    }),
  )
