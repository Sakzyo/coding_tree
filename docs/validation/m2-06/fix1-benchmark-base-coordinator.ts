export * as SessionRunCoordinator from "./fix1-benchmark-base-coordinator"

import { Deferred, Effect, Exit, Fiber, FiberSet, Scope } from "../../../packages/core/node_modules/effect/dist/index.js"

/** Serializes execution for each key while allowing different keys to run concurrently. */
export interface Coordinator<Key, E> {
  /** Snapshots keys with an execution owned by this coordinator. */
  readonly active: Effect.Effect<ReadonlySet<Key>>
  /** Starts execution while idle or joins the active execution. */
  readonly run: (key: Key) => Effect.Effect<void, E>
  /** Registers one coalesced follow-up after newly recorded work. */
  readonly wake: (key: Key) => Effect.Effect<void>
  /** Atomically registers a bounded, runtime-only terminal notification before scheduling advisory work. */
  readonly wakeWithSettlement: (key: Key, settled: () => Effect.Effect<void>) => Effect.Effect<void>
  /** Stops active execution and waits for its cleanup. */
  readonly interrupt: (key: Key) => Effect.Effect<void>
}

type Entry<E> = {
  readonly done: Deferred.Deferred<void, E>
  owner?: Fiber.Fiber<void, never>
  pendingWake: boolean
  stopping: boolean
  closing: boolean
  readonly notifications: Array<() => Effect.Effect<void>>
  readonly freshNotifications: Array<() => Effect.Effect<void>>
  readonly ownership?: { readonly scope: Scope.Closeable; acquired: boolean }
}

export const make = <Key, E>(options: {
  readonly drain: (key: Key, force: boolean) => Effect.Effect<void, E>
  /** Acquires resources once for the entire chain, including coalesced and pending successor drains. */
  readonly acquire?: (key: Key) => Effect.Effect<unknown, E, Scope.Scope>
}): Effect.Effect<Coordinator<Key, E>, never, Scope.Scope> =>
  Effect.gen(function* () {
    const active = new Map<Key, Entry<E>>()
    const fork = yield* FiberSet.makeRuntime<never, void, never>()
    let closed = false
    // Finalizers run in reverse order: disable successors before FiberSet interrupts owners.
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        closed = true
      }),
    )

    const makeEntry = (
      ownership = options.acquire ? { scope: Scope.makeUnsafe(), acquired: false } : undefined,
      notifications: Array<() => Effect.Effect<void>> = [],
    ): Entry<E> => ({
      done: Deferred.makeUnsafe<void, E>(),
      pendingWake: false,
      stopping: false,
      closing: false,
      notifications,
      freshNotifications: [],
      ownership,
    })

    // A defective notification must not prevent the remaining exact claims from settling.
    const notify = (callbacks: Array<() => Effect.Effect<void>>) =>
      Effect.forEach(callbacks, (callback) => Effect.suspend(callback).pipe(Effect.exit), { discard: true })

    const start = (key: Key, entry: Entry<E>, force: boolean, successor = false) => {
      const ready = Deferred.makeUnsafe<void>()
      const owner = fork(
        (successor ? Effect.yieldNow : Deferred.await(ready)).pipe(
          Effect.andThen(
            Effect.suspend(() => {
              if (!entry.ownership || entry.ownership.acquired || !options.acquire) return Effect.void
              const ownership = entry.ownership
              const acquire = options.acquire
              return Effect.uninterruptibleMask((restore) =>
                restore(acquire(key).pipe(Effect.provideService(Scope.Scope, ownership.scope))).pipe(
                  Effect.tap(() =>
                    Effect.sync(() => {
                      ownership.acquired = true
                    }),
                  ),
                ),
              )
            }),
          ),
          Effect.andThen(Effect.suspend(() => options.drain(key, force))),
          Effect.onExit((exit) => settle(key, entry, exit)),
          Effect.exit,
          Effect.asVoid,
        ),
      )
      entry.owner = owner
      if (!successor) Deferred.doneUnsafe(ready, Effect.void)
    }

    const settle = (key: Key, entry: Entry<E>, exit: Exit.Exit<void, E>): Effect.Effect<void> =>
      Effect.suspend(() => {
        if (!closed && Exit.isSuccess(exit) && !entry.stopping && entry.pendingWake) {
          entry.pendingWake = false
          start(key, entry, false, true)
          return Effect.void
        }

        // A pending successor inherits ownership before old waiters are settled.
        if (!closed && entry.pendingWake) {
          const successor = makeEntry(entry.ownership, entry.notifications)
          active.set(key, successor)
          start(key, successor, false, true)
          Deferred.doneUnsafe(entry.done, exit)
          return Effect.void
        }

        // Keep the entry visible while asynchronous release runs. New wakes become a
        // fresh chain after release; they cannot resurrect this closed scope.
        entry.closing = true
        return (entry.ownership ? Scope.close(entry.ownership.scope, exit) : Effect.void).pipe(
          Effect.ensuring(
            notify(entry.notifications).pipe(
              Effect.andThen(
                Effect.suspend(() => {
                  if (!closed && entry.pendingWake) {
                    const successor = makeEntry(undefined, entry.freshNotifications)
                    // Explicit undefined uses makeEntry's fresh ownership default.
                    active.set(key, successor)
                    start(key, successor, false, true)
                    Deferred.doneUnsafe(entry.done, exit)
                    return Effect.void
                  }
                  return notify(entry.freshNotifications).pipe(
                    Effect.andThen(
                      Effect.sync(() => {
                        active.delete(key)
                        Deferred.doneUnsafe(entry.done, exit)
                      }),
                    ),
                  )
                }),
              ),
            ),
          ),
        )
      })

    const run = (key: Key): Effect.Effect<void, E> =>
      Effect.uninterruptibleMask((restore) => {
        if (closed) return restore(Effect.interrupt)
        const entry = active.get(key)
        if (entry !== undefined) {
          if (entry.stopping) return restore(Deferred.await(entry.done).pipe(Effect.andThen(run(key))))
          return restore(Deferred.await(entry.done))
        }

        const next = makeEntry()
        active.set(key, next)
        start(key, next, true)
        return restore(Deferred.await(next.done))
      })

    const schedule = (key: Key, callback?: () => Effect.Effect<void>) =>
      Effect.uninterruptible(
        Effect.suspend(() => {
          if (closed) return callback ? notify([callback]) : Effect.void
          const entry = active.get(key)
          if (entry !== undefined) {
            entry.pendingWake = true
            if (callback) (entry.closing ? entry.freshNotifications : entry.notifications).push(callback)
            return Effect.void
          }

          const next = makeEntry()
          if (callback) next.notifications.push(callback)
          active.set(key, next)
          start(key, next, false)
          return Effect.void
        }),
      )

    const wake = (key: Key) => schedule(key)
    const wakeWithSettlement = (key: Key, callback: () => Effect.Effect<void>) => schedule(key, callback)

    const interrupt = (key: Key): Effect.Effect<void> =>
      Effect.suspend(() => {
        const entry = active.get(key)
        if (entry?.owner === undefined) return Effect.void
        entry.stopping = true
        entry.pendingWake = false
        return Fiber.interrupt(entry.owner)
      })

    return { active: Effect.sync(() => new Set(active.keys())), run, wake, wakeWithSettlement, interrupt }
  })
