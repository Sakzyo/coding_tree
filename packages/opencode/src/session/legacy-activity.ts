import { lazy } from "@opencode-ai/core/util/lazy"
import { Context, Deferred, Effect, Layer, Scope, Semaphore } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { memoMap } from "@opencode-ai/core/effect/memo-map"
import { FtcProjectAdapters } from "@opencode-ai/core/ftc/projects/adapters"
import { FtcProjects } from "@opencode-ai/core/ftc/projects"
import type { BackgroundJob } from "@opencode-ai/core/background-job"
import type { Database } from "@opencode-ai/core/database/database"
import { AbsolutePath } from "@opencode-ai/core/schema"
import type { Session } from "./session"
import type { SessionID } from "./schema"

const claim = Symbol("LegacyActivity.Claim")
export interface Claim {
  readonly [claim]: true
}
export interface Interface {
  readonly acquire: (
    root: AbsolutePath,
    verify: Effect.Effect<void, FtcProjects.ExecutionUnavailable>,
  ) => Effect.Effect<Claim, FtcProjects.ExecutionUnavailable>
  readonly retain: (lease: Claim) => Effect.Effect<Claim, FtcProjects.ExecutionUnavailable>
  readonly release: (lease: Claim) => Effect.Effect<void>
  readonly withAssociation: FtcProjectAdapters.Association
}
export class Service extends Context.Service<Service, Interface>()("@opencode/LegacyActivity") {}

/** Volatile current-process ownership only; callers supply M2's canonical identity and live check. */
export const make = Effect.gen(function* () {
  const roots = new Map<AbsolutePath, { lock: Semaphore.Semaphore; claims: Set<Claim>; pending: number }>()
  const claims = new Map<Claim, AbsolutePath>()
  const drained = yield* Deferred.make<void>()
  let closed = false
  let pending = 0
  const rootState = (root: AbsolutePath) => {
    const existing = roots.get(root)
    if (existing) return existing
    const state = { lock: Semaphore.makeUnsafe(1), claims: new Set<Claim>(), pending: 0 }
    roots.set(root, state)
    return state
  }
  const settle = (root: AbsolutePath) =>
    Effect.gen(function* () {
      const state = roots.get(root)
      if (state && state.pending === 0 && state.claims.size === 0) roots.delete(root)
      if (closed && claims.size === 0 && pending === 0) yield* Deferred.succeed(drained, undefined)
    })
  const withRoot = <A, E>(root: AbsolutePath, work: Effect.Effect<A, E>) =>
    Effect.acquireUseRelease(
      Effect.sync(() => {
        const state = rootState(root)
        state.pending++
        pending++
        return state
      }),
      (state) => state.lock.withPermits(1)(work),
      (state) =>
        Effect.gen(function* () {
          state.pending--
          pending--
          yield* settle(root)
        }),
    )
  const publish = (root: AbsolutePath): Claim => {
    const lease: Claim = Object.freeze({ [claim]: true as const })
    claims.set(lease, root)
    rootState(root).claims.add(lease)
    return lease
  }
  const unavailable = () => new FtcProjects.ExecutionUnavailable({ code: "membership_unavailable" })
  const acquire: Interface["acquire"] = (root, verify) =>
    Effect.suspend(() =>
      withRoot(
        root,
        Effect.uninterruptibleMask((restore) =>
          Effect.gen(function* () {
            if (closed) return yield* unavailable()
            yield* restore(verify)
            if (closed) return yield* unavailable()
            return publish(root)
          }),
        ),
      ),
    )
  const retain: Interface["retain"] = (lease) =>
    Effect.suspend(() => {
      const root = claims.get(lease)
      if (closed || !root) return Effect.fail(unavailable())
      return Effect.succeed(publish(root))
    })
  const release: Interface["release"] = (lease) =>
    Effect.gen(function* () {
      const root = claims.get(lease)
      if (!root) return
      claims.delete(lease)
      rootState(root).claims.delete(lease)
      yield* settle(root)
    })
  const withAssociation: Interface["withAssociation"] = (folder, commit) =>
    Effect.suspend(() => {
      const root = folder.canonicalRoot
      return withRoot(
        root,
        Effect.gen(function* () {
          if (closed || rootState(root).claims.size > 0)
            return yield* Effect.fail({
              code: "activation_unavailable",
              root,
              recovery: "retry",
            } satisfies FtcProjects.AssociationError)
          return yield* commit
        }),
      )
    })
  yield* Effect.addFinalizer(() =>
    Effect.gen(function* () {
      closed = true
      if (claims.size > 0 || pending > 0) yield* Deferred.await(drained)
      roots.clear()
    }),
  )
  return Service.of({ acquire, retain, release, withAssociation })
})

export const layer = Layer.effect(Service, make)
// MemoMap evicts before awaiting finalizers. A successor must wait for the old owner's claims to drain.
const generations = lazy(() => Semaphore.makeUnsafe(1))
const shared = Layer.effect(
  Service,
  Effect.gen(function* () {
    yield* Effect.acquireRelease(Effect.interruptible(generations().take(1)), () => generations().release(1))
    return yield* make
  }),
)
export const live = Layer.effect(
  Service,
  Effect.gen(function* () {
    const scope = yield* Scope.Scope
    return Context.get(yield* Layer.buildWithMemoMap(shared, memoMap, scope), Service)
  }),
)
export const node = LayerNode.make({ service: Service, layer: live, deps: [] })

/** Retains exact accepted claims for generic engines, without exposing root authority in job metadata. */
export const ownership = (owner: Interface, leases: readonly Claim[]): Effect.Effect<BackgroundJob.Ownership> =>
  Effect.uninterruptible(
    Effect.gen(function* () {
      const held: Claim[] = []
      yield* Effect.forEach(
        leases,
        (lease) => owner.retain(lease).pipe(Effect.tap((next) => Effect.sync(() => held.push(next)))),
        { discard: true },
      ).pipe(
        Effect.onError(() => Effect.forEach(held, owner.release, { discard: true })),
        Effect.orDie,
      )
      return {
        release: Effect.forEach(held, owner.release, { discard: true }),
        retain: Effect.suspend(() => ownership(owner, held)),
      }
    }),
  )

export const sessions = (
  owner: Interface,
  session: Pick<Session.Interface, "get">,
  database: Pick<Database.Interface, "db">,
) => {
  const verify = FtcProjectAdapters.legacy(database.db)
  const acquire = (id: SessionID) =>
    Effect.gen(function* () {
      const recorded = yield* session.get(id).pipe(Effect.orDie)
      const root = yield* FtcProjectAdapters.canonical({ root: AbsolutePath.make(recorded.directory) }).pipe(
        Effect.mapError(() => new FtcProjects.ExecutionUnavailable({ code: "membership_unavailable" })),
      )
      return yield* owner.acquire(root, verify({ root }))
    })
  const scoped = (id: SessionID) => Effect.acquireRelease(acquire(id), owner.release)
  const fork = <A, E, R>(id: SessionID, work: Effect.Effect<A, E, R>, scope: Scope.Scope) =>
    Effect.uninterruptibleMask((restore) =>
      Effect.gen(function* () {
        const lease = yield* restore(acquire(id))
        const owned = yield* Scope.fork(scope, "sequential")
        yield* Scope.addFinalizer(owned, owner.release(lease))
        return yield* work.pipe(
          Scope.provide(owned),
          Effect.onExit((exit) => Scope.close(owned, exit)),
          Effect.interruptible,
          Effect.forkIn(scope),
        )
      }),
    )
  return { acquire, scoped, fork }
}

export * as LegacyActivity from "./legacy-activity"
