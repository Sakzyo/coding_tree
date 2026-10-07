export * as InspectionLifecycle from "./inspection-lifecycle"

import { Effect, Fiber } from "effect"

export function join<A, E>(fiber: Fiber.Fiber<A, E>) {
  return Effect.callback<A, E>((resume) => {
    // beta.83 iterates a mutable observer list. Defer removal until notification ends,
    // so the concurrent Scope closer cannot lose its own retirement notification.
    const remove = fiber.addObserver((exit) => queueMicrotask(() => resume(exit)))
    return Effect.sync(remove)
  })
}
