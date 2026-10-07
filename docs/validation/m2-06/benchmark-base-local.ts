import { Cause, Effect, Layer } from "../../../packages/core/node_modules/effect/dist/index.js"
import { FtcAgentGate } from "/Users/dylanxu/coding_tree/packages/core/src/ftc/agent/gate"
import { Location } from "/Users/dylanxu/coding_tree/packages/core/src/location"
import { LocationServiceMap } from "/Users/dylanxu/coding_tree/packages/core/src/location-service-map"
import { makeGlobalNode } from "/Users/dylanxu/coding_tree/packages/core/src/effect/app-node"
import { SessionRunCoordinator } from "./benchmark-base-coordinator"
import { SessionRunner } from "/Users/dylanxu/coding_tree/packages/core/src/session/runner"
import { SessionSchema } from "/Users/dylanxu/coding_tree/packages/core/src/session/schema"
import { SessionStore } from "/Users/dylanxu/coding_tree/packages/core/src/session/store"
import { SessionExecution } from "/Users/dylanxu/coding_tree/packages/core/src/session/execution"

/** Current-process routing for implicit-local Locations. Future remote placement belongs here. */
export const make = (input: {
  readonly store: Pick<SessionStore.Interface, "get">
  readonly locations: {
    readonly get: (ref: Location.Ref) => Layer.Layer<SessionRunner.Service, SessionRunner.RunError>
  }
  readonly gate: FtcAgentGate.Port
}) =>
  Effect.gen(function* () {
    const coordinator = yield* SessionRunCoordinator.make<SessionSchema.ID, SessionRunner.RunError>({
      acquire: Effect.fnUntraced(function* (sessionID: SessionSchema.ID) {
        const session = yield* input.store.get(sessionID)
        if (!session) return yield* Effect.die(`Session not found: ${sessionID}`)
        const membership = yield* input.gate
          .resolve({ sessionID, location: session.location })
          .pipe(Effect.mapError((error) => new FtcAgentGate.Blocked({ reason: { kind: "rejected", error } })))
        if (membership.kind === "unmanaged") return yield* Effect.void
        return yield* Effect.acquireRelease(
          input.gate.acquire(membership.chat).pipe(
            Effect.mapError((error) => new FtcAgentGate.Blocked({ reason: { kind: "rejected", error } })),
            Effect.flatMap((result) =>
              result.kind === "busy"
                ? Effect.fail(new FtcAgentGate.Blocked({ reason: result }))
                : Effect.succeed(result.lease),
            ),
          ),
          input.gate.release,
          { interruptible: true },
        )
      }),
      drain: Effect.fnUntraced(function* (sessionID: SessionSchema.ID, force) {
        const session = yield* input.store.get(sessionID)
        if (!session) return yield* Effect.die(`Session not found: ${sessionID}`)
        return yield* SessionRunner.Service.use((runner) => runner.run({ sessionID, force })).pipe(
          Effect.provide(input.locations.get(session.location)),
          Effect.tapCause((cause) =>
            Cause.hasInterruptsOnly(cause)
              ? Effect.void
              : Effect.logError("Failed to drain Session", cause).pipe(Effect.annotateLogs({ sessionID })),
          ),
        )
      }),
    })
    return SessionExecution.Service.of({
      active: coordinator.active,
      interrupt: coordinator.interrupt,
      resume: coordinator.run,
      wake: coordinator.wake,
    })
  })

export const layerWith = (gate: FtcAgentGate.Port) =>
  Layer.effect(
    SessionExecution.Service,
    Effect.gen(function* () {
      const store = yield* SessionStore.Service
      const locations = yield* LocationServiceMap.Service
      return yield* make({ store, locations, gate })
    }),
  )

const layer = layerWith(FtcAgentGate.unmanaged)

export const node = makeGlobalNode({
  service: SessionExecution.Service,
  layer,
  deps: [SessionStore.node, LocationServiceMap.node],
})

export * as SessionExecutionLocal from "./benchmark-base-local"
