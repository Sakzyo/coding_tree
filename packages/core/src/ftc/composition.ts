export * as FtcComposition from "./composition"

import { Context, Effect, Scope } from "effect"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import type { SessionV2 } from "../session"
import type { SessionExecution } from "../session/execution"
import type { SessionExecutionLocal } from "../session/execution/local"
import { FtcProjects } from "./projects"
import { ProjectGate } from "./projects/gate"
import { FtcProjectAdapters } from "./projects/adapters"
import { FtcProjectExecution } from "./projects/execution"
import type { ProjectAssociations } from "./projects/sql"

export interface Ports {
  readonly repository: ProjectAssociations.Lookup
  readonly folders: FtcProjects.FolderIdentity
  readonly store: Parameters<typeof SessionExecutionLocal.make>[0]["store"]
  readonly locations: Parameters<typeof SessionExecutionLocal.make>[0]["locations"]
  readonly changed: (status: FtcProject.OwnerStatus) => Effect.Effect<void>
  readonly activate: FtcProjectAdapters.Association
}

export interface Interface {
  readonly execution: SessionExecution.Interface & SessionExecution.TrackedInterface
  readonly guard: SessionV2.AdmissionGuard
  readonly bind: Effect.Success<ReturnType<typeof FtcProjectExecution.controlled>>["bind"]
  readonly projects: (session: SessionV2.Interface) => FtcProjects.Interface
  readonly legacy: (request: FtcProject.FolderRequest) => Effect.Effect<void, FtcProject.ExecutionUnavailable>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/FtcComposition") {}

/** Production hosts cannot enable managed execution through configuration or request JSON. */
export const disabled = (input: Ports) => make(input, FtcProjectExecution.disabled)

/** Test composition must explicitly supply its own controlled runner/location ports. */
export const controlled = (input: Ports) => make(input, FtcProjectExecution.controlled)

const make = (
  input: Ports,
  adapter: typeof FtcProjectExecution.disabled,
): Effect.Effect<Interface, never, Scope.Scope> =>
  Effect.gen(function* () {
    const membership = FtcProjectAdapters.membership({
      folders: input.folders,
      repository: input.repository,
      sessions: { getSession: input.store.get },
    })
    const gate = yield* ProjectGate.make(membership)
    const runtime = yield* adapter({
      gate,
      resolve: membership.resolve,
      execution: () => execution,
      changed: input.changed,
    })
    const { SessionExecutionLocal } = yield* Effect.promise(() => import("../session/execution/local"))
    const execution: SessionExecution.Interface & SessionExecution.TrackedInterface = yield* SessionExecutionLocal.make(
      {
        store: input.store,
        locations: input.locations,
        gate: runtime.gatePort,
      },
    )
    return {
      execution,
      guard: runtime.guard,
      bind: runtime.bind,
      projects: (session) =>
        FtcProjects.make(input.folders, FtcProjectAdapters.activation(input.repository, input.activate), {
          createSession: session.create,
          getSession: input.store.get,
        }),
      legacy: FtcProjectAdapters.guardLegacy(input.repository),
    }
  })
