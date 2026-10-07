export * as SessionRunCoordinator from "./benchmark-base-coordinator"

import { Deferred, Effect, Exit, Fiber, FiberSet, Scope } from "../../../packages/core/node_modules/effect/dist/index.js"

/** Serializes execution for each key while allowing different keys to run concurrently. */
export interface Coordinator<Key, E> {
  /** Snapshots keys with an execution owned by this coordinator. */
  readonly active: Effect.Effect<ReadonlySet<Key>>
  /** Starts execution while idle or joins the active execution. */
  readonly run: (key: Key) => Effect.Effect<void, E>
  /** Registers one coalesced follow-up after newly recorded work. */
  readonly wake: (key: Key) => Effect.Effect<void>
  /** Stops active execution and waits for its cleanup. */
  readonly interrupt: (key: Key) => Effect.Effect<void>
}

type Entry<E> = {
  readonly done: Deferred.Deferred<void, E>
  owner?: Fiber.Fiber<void, never>
  pendingWake: boolean
  stopping: boolean
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
    ): Entry<E> => ({
      done: Deferred.makeUnsafe<void, E>(),
      pendingWake: false,
      stopping: false,
      ownership,
    })

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
          const successor = makeEntry(entry.ownership)
          active.set(key, successor)
          start(key, successor, false, true)
          Deferred.doneUnsafe(entry.done, exit)
          return Effect.void
        }

        // Keep the entry visible while asynchronous release runs. New wakes become a
        // fresh chain after release; they cannot resurrect this closed scope.
        return (entry.ownership ? Scope.close(entry.ownership.scope, exit) : Effect.void).pipe(
          Effect.ensuring(
            Effect.sync(() => {
              if (!closed && entry.pendingWake) {
                const successor = makeEntry()
                active.set(key, successor)
                start(key, successor, false, true)
                Deferred.doneUnsafe(entry.done, exit)
                return
              }
              active.delete(key)
              Deferred.doneUnsafe(entry.done, exit)
            }),
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

    const wake = (key: Key) =>
      Effect.sync(() => {
        if (closed) return
        const entry = active.get(key)
        if (entry !== undefined) {
          entry.pendingWake = true
          return
        }

        const next = makeEntry()
        active.set(key, next)
        start(key, next, false)
      })

    const interrupt = (key: Key): Effect.Effect<void> =>
      Effect.suspend(() => {
        const entry = active.get(key)
        if (entry?.owner === undefined) return Effect.void
        entry.stopping = true
        entry.pendingWake = false
        return Fiber.interrupt(entry.owner)
      })

    return { active: Effect.sync(() => new Set(active.keys())), run, wake, interrupt }
  })
