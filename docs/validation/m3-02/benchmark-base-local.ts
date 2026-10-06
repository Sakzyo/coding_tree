import { Cause, Effect, Layer } from "../../../packages/core/node_modules/effect/dist/index.js"
import { LocationServiceMap } from "/Users/dylanxu/coding_tree/packages/core/src/location-service-map"
import { makeGlobalNode } from "/Users/dylanxu/coding_tree/packages/core/src/effect/app-node"
import { SessionRunCoordinator } from "./benchmark-base-coordinator"
import { SessionRunner } from "/Users/dylanxu/coding_tree/packages/core/src/session/runner"
import { SessionSchema } from "/Users/dylanxu/coding_tree/packages/core/src/session/schema"
import { SessionStore } from "/Users/dylanxu/coding_tree/packages/core/src/session/store"
import { SessionExecution } from "/Users/dylanxu/coding_tree/packages/core/src/session/execution"

/** Current-process routing for implicit-local Locations. Future remote placement belongs here. */
export const make = (input) => Effect.gen(function* () {
    const store = input.store
    const locations = input.locations
    const coordinator = yield* SessionRunCoordinator.make<SessionSchema.ID, SessionRunner.RunError>({
      drain: Effect.fnUntraced(function* (sessionID: SessionSchema.ID, force) {
        const session = yield* store.get(sessionID)
        if (!session) return yield* Effect.die(`Session not found: ${sessionID}`)
        return yield* SessionRunner.Service.use((runner) => runner.run({ sessionID, force })).pipe(
          Effect.provide(locations.get(session.location)),
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
