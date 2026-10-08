import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { expect } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Context, Deferred, Effect, Exit, Fiber, Layer, Scope } from "effect"
import { LegacyActivity } from "../../src/session/legacy-activity"
import { Database } from "@opencode-ai/core/database/database"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { ProjectAssociations } from "@opencode-ai/core/ftc/projects/sql"
import { FtcProjectAdapters } from "@opencode-ai/core/ftc/projects/adapters"
import { FtcProjects } from "@opencode-ai/core/ftc/projects"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { ProjectV2 } from "@opencode-ai/core/project"
import { tmpdirScoped } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const it = testEffect(LayerNode.compile(LayerNode.group([Database.node, CrossSpawnSpawner.node])))
const fixture = Effect.gen(function* () {
  const tmp = yield* tmpdirScoped()
  const database = yield* Database.Service
  const owner = yield* LegacyActivity.make
  const repository = ProjectAssociations.make(database.db)
  const identity = FtcProjectAdapters.folders({
    resolve: () => Effect.succeed({ id: ProjectV2.ID.global, directory: AbsolutePath.make(path.parse(tmp).root) }),
  })
  const folder = yield* identity.resolve({ root: AbsolutePath.make(tmp) })
  const guarded = FtcProjectAdapters.activation(repository, owner.withAssociation)
  const facade = FtcProjects.make(identity, guarded, {
    createSession: () => Effect.die("Unused"),
    getSession: () => Effect.die("Unused"),
  })
  const acquire = (root = folder.canonicalRoot) => owner.acquire(root, FtcProjectAdapters.legacy(database.db)({ root }))
  return { tmp, database, owner, repository, identity, folder, guarded, facade, acquire }
})

it.live("legacy first excludes real association through symlink aliases and exact stale releases", () =>
  Effect.gen(function* () {
    const f = yield* fixture
    const alias = path.join(f.tmp, "alias")
    yield* Effect.promise(() => fs.symlink(f.tmp, alias))
    const first = yield* f.acquire()
    const retained = yield* f.owner.retain(first)
    yield* f.owner.release(first)
    yield* f.owner.release(first)
    expect(yield* f.facade.openProject({ root: AbsolutePath.make(alias) }).pipe(Effect.flip)).toMatchObject({
      code: "activation_unavailable",
    })
    expect(yield* f.repository.findRoot(f.folder.canonicalRoot)).toBeUndefined()
    yield* f.owner.release(retained)
    const created = yield* f.facade.createProject({ root: AbsolutePath.make(alias) })
    expect((yield* f.facade.openProject({ root: f.folder.canonicalRoot })).projectID).toBe(created.projectID)
    expect(yield* f.acquire().pipe(Effect.flip)).toMatchObject({ code: "legacy_execution_disabled" })
  }),
)

it.live("association holds exclusion across the actual commit and a waiting legacy check observes it", () =>
  Effect.gen(function* () {
    const f = yield* fixture
    const entered = yield* Deferred.make<void>()
    const finish = yield* Deferred.make<void>()
    const adapter = FtcProjectAdapters.activation(
      {
        ...f.repository,
        associate: (folder) =>
          Deferred.succeed(entered, undefined).pipe(
            Effect.andThen(Deferred.await(finish)),
            Effect.andThen(f.repository.associate(folder)),
          ),
      },
      f.owner.withAssociation,
    )
    yield* Effect.gen(function* () {
      const writing = yield* adapter.associate(f.folder).pipe(Effect.forkChild)
      yield* Deferred.await(entered)
      const admission = yield* f.acquire().pipe(Effect.exit, Effect.forkChild)
      yield* Effect.yieldNow
      expect(admission.pollUnsafe()).toBeUndefined()
      const other = yield* tmpdirScoped()
      const otherFolder = yield* f.identity.resolve({ root: AbsolutePath.make(other) })
      expect((yield* f.guarded.associate(otherFolder)).canonicalRoot).toBe(otherFolder.canonicalRoot)
      yield* Deferred.succeed(finish, undefined)
      yield* Fiber.join(writing)
      expect(Exit.isFailure(yield* Fiber.join(admission))).toBe(true)
    }).pipe(Effect.ensuring(Deferred.succeed(finish, undefined)))
  }),
)

it.live("failed and cancelled association commits release exclusion without losing durable reconciliation", () =>
  Effect.gen(function* () {
    const f = yield* fixture
    const entered = yield* Deferred.make<void>()
    const waiting = yield* f.owner
      .withAssociation(f.folder, Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never)))
      .pipe(Effect.forkChild)
    yield* Deferred.await(entered)
    yield* Fiber.interrupt(waiting)
    const claim = yield* f.acquire()
    yield* f.owner.release(claim)
    const failure = { code: "association_store_failed", recovery: "retry" } as const
    expect(yield* f.owner.withAssociation(f.folder, Effect.fail(failure)).pipe(Effect.flip)).toEqual(failure)
    const committed = yield* f.guarded.associate(f.folder)
    expect((yield* f.guarded.associate(f.folder)).projectID).toBe(committed.projectID)
  }),
)

it.live("narrow live layer shares fresh memo graphs until the final borrower closes; explicit factories isolate", () =>
  Effect.gen(function* () {
    const firstScope = yield* Scope.make()
    const secondScope = yield* Scope.make()
    const first = Context.get(
      yield* Layer.buildWithMemoMap(LegacyActivity.live, Layer.makeMemoMapUnsafe(), firstScope),
      LegacyActivity.Service,
    )
    const second = Context.get(
      yield* Layer.buildWithMemoMap(LegacyActivity.live, Layer.makeMemoMapUnsafe(), secondScope),
      LegacyActivity.Service,
    )
    expect(first).toBe(second)
    const independent = yield* LegacyActivity.make
    expect(independent).not.toBe(first)
    const f = yield* fixture
    const lease = yield* first.acquire(f.folder.canonicalRoot, Effect.void)
    yield* Scope.close(firstScope, Exit.void)
    expect(yield* second.withAssociation(f.folder, f.repository.associate(f.folder)).pipe(Effect.flip)).toMatchObject({
      code: "activation_unavailable",
    })
    const closing = yield* Scope.close(secondScope, Exit.void).pipe(Effect.forkChild)
    yield* Effect.yieldNow
    expect(closing.pollUnsafe()).toBeUndefined()
    const cancelledScope = yield* Scope.make()
    yield* Effect.addFinalizer(() => first.release(lease))
    const cancelled = yield* Layer.buildWithMemoMap(
      LegacyActivity.live,
      Layer.makeMemoMapUnsafe(),
      cancelledScope,
    ).pipe(Effect.forkChild)
    yield* Effect.yieldNow
    yield* Fiber.interrupt(cancelled).pipe(Effect.timeout("500 millis"))
    yield* Scope.close(cancelledScope, Exit.void)
    const nextScope = yield* Scope.make()
    yield* Effect.addFinalizer(() => first.release(lease))
    const reopening = yield* Layer.buildWithMemoMap(LegacyActivity.live, Layer.makeMemoMapUnsafe(), nextScope).pipe(
      Effect.forkChild,
    )
    yield* Effect.yieldNow
    expect(reopening.pollUnsafe()).toBeUndefined()
    yield* first.release(lease)
    yield* Fiber.join(closing)
    const next = Context.get(yield* Fiber.join(reopening), LegacyActivity.Service)
    expect(next).not.toBe(first)
    yield* Scope.close(nextScope, Exit.void)
  }),
)

it.live("shutdown waits for an in-flight association commit before retiring root exclusion", () =>
  Effect.gen(function* () {
    const f = yield* fixture
    const scope = yield* Scope.make()
    const owner = yield* LegacyActivity.make.pipe(Scope.provide(scope))
    const entered = yield* Deferred.make<void>()
    const finish = yield* Deferred.make<void>()
    yield* Effect.gen(function* () {
      const write = yield* owner
        .withAssociation(
          f.folder,
          Deferred.succeed(entered, undefined).pipe(
            Effect.andThen(Deferred.await(finish)),
            Effect.andThen(f.repository.associate(f.folder)),
          ),
        )
        .pipe(Effect.forkChild)
      yield* Deferred.await(entered)
      const close = yield* Scope.close(scope, Exit.void).pipe(Effect.forkChild)
      yield* Effect.yieldNow
      expect(close.pollUnsafe()).toBeUndefined()
      yield* Deferred.succeed(finish, undefined)
      yield* Fiber.join(write)
      yield* Fiber.join(close)
    }).pipe(Effect.ensuring(Deferred.succeed(finish, undefined)))
  }),
)

it.live("association snapshots canonical root and Location before a suspended commit", () =>
  Effect.gen(function* () {
    const f = yield* fixture
    const other = yield* tmpdirScoped()
    const alternate = yield* f.identity.resolve({ root: AbsolutePath.make(other) })
    const input = { ...f.folder }
    const entered = yield* Deferred.make<void>()
    const finish = yield* Deferred.make<void>()
    const holding = yield* f.owner
      .withAssociation(
        f.folder,
        Deferred.succeed(entered, undefined).pipe(
          Effect.andThen(Deferred.await(finish)),
          Effect.andThen(Effect.fail({ code: "association_store_failed", recovery: "retry" } as const)),
        ),
      )
      .pipe(Effect.exit, Effect.forkChild)
    yield* Deferred.await(entered)
    yield* Effect.gen(function* () {
      const writing = yield* f.guarded.associate(input).pipe(Effect.forkChild)
      yield* Effect.yieldNow
      input.canonicalRoot = alternate.canonicalRoot
      input.location = alternate.location
      yield* Deferred.succeed(finish, undefined)
      yield* Fiber.join(holding)
      const result = yield* Fiber.join(writing)
      expect(result.canonicalRoot).toBe(f.folder.canonicalRoot)
      expect(result.location.directory).toBe(f.folder.location.directory)
      expect(yield* f.repository.findRoot(alternate.canonicalRoot)).toBeUndefined()
    }).pipe(Effect.ensuring(Deferred.succeed(finish, undefined)))
  }),
)
