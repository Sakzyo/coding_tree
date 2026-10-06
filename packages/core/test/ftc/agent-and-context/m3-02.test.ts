import { expect, test } from "bun:test"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { Project } from "@opencode-ai/schema/project"
import { FtcAgentGate } from "@opencode-ai/core/ftc/agent/gate"
import { Location } from "@opencode-ai/core/location"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { SessionExecutionLocal } from "@opencode-ai/core/session/execution/local"
import { SessionRunner } from "@opencode-ai/core/session/runner"
import { SessionSchema } from "@opencode-ai/core/session/schema"
import { Database } from "@opencode-ai/core/database/database"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { ProjectV2 } from "@opencode-ai/core/project"
import { SessionV2 } from "@opencode-ai/core/session"
import { SessionExecution } from "@opencode-ai/core/session/execution"
import { SessionInput } from "@opencode-ai/core/session/input"
import { SessionMessage } from "@opencode-ai/core/session/message"
import { SessionStore } from "@opencode-ai/core/session/store"
import { Prompt } from "@opencode-ai/core/session/prompt"
import { tmpdir } from "../../fixture/tmpdir"
import { Cause, DateTime, Deferred, Effect, Exit, Fiber, Layer, LayerMap, Scope } from "effect"

const fixture = (
  options: {
    run?: (sessionID: SessionSchema.ID, count: number) => Effect.Effect<void, SessionRunner.RunError>
    gate?: Partial<FtcAgentGate.Port>
  } = {},
) =>
  Effect.gen(function* () {
    const sessions = ["first", "alias", "other", "legacy"].map((name) => ({
      id: SessionSchema.ID.create(),
      projectID: Project.ID.make("host-project"),
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      time: { created: DateTime.makeUnsafe(0), updated: DateTime.makeUnsafe(0) },
      title: name,
      location: Location.Ref.make({ directory: AbsolutePath.make(`/fixture/${name}`) }),
    }))
    const chats = sessions.map((session, index) => ({
      projectID: Project.ID.make(`association-${index === 1 ? 0 : index}`),
      chatID: FtcProject.ChatID.create(),
      sessionID: session.id,
    }))
    const acquired: FtcProject.GateLease[] = []
    const released: FtcProject.GateLease[] = []
    const owners = new Map<string, FtcProject.GateLease>()
    const resolved: { sessionID: SessionSchema.ID; location: Location.Ref }[] = []
    const routed: Location.Ref[] = []
    const starts: { sessionID: SessionSchema.ID; force: boolean }[] = []
    const started = yield* Effect.all(sessions.map(() => Deferred.make<void>()))
    const finish = yield* Effect.all(sessions.map(() => Deferred.make<void>()))
    const counts = new Map<SessionSchema.ID, number>()
    const gate: FtcAgentGate.Port = {
      resolve: (input) =>
        Effect.sync(() => {
          resolved.push(input)
          const index = sessions.findIndex((session) => session.id === input.sessionID)
          return index === 3 ? { kind: "unmanaged" } : { kind: "managed", chat: chats[index] }
        }),
      acquire: (chat) =>
        Effect.sync(() => {
          const projectKey = AbsolutePath.make(`/canonical/${chat.projectID}`)
          const active = owners.get(projectKey)
          if (active) return { kind: "busy", active: chats.find((item) => item.chatID === active.chatID)! }
          const lease = {
            projectKey,
            chatID: chat.chatID,
            sessionID: chat.sessionID,
            token: FtcProject.GateToken.make(`gate_${acquired.length}`),
          }
          owners.set(projectKey, lease)
          acquired.push(lease)
          return { kind: "acquired", lease }
        }),
      release: (lease) =>
        Effect.sync(() => {
          released.push(lease)
          if (owners.get(lease.projectKey)?.token === lease.token) owners.delete(lease.projectKey)
        }),
      ...options.gate,
    }
    const locations = yield* LayerMap.make((ref: Location.Ref) =>
      Layer.effect(
        SessionRunner.Service,
        Effect.sync(() => {
          routed.push(ref)
          return SessionRunner.Service.of({
            run: (input) =>
              Effect.gen(function* () {
                starts.push(input)
                const count = (counts.get(input.sessionID) ?? 0) + 1
                counts.set(input.sessionID, count)
                const index = sessions.findIndex((session) => session.id === input.sessionID)
                yield* Deferred.succeed(started[index], undefined)
                yield* options.run ? options.run(input.sessionID, count) : Deferred.await(finish[index])
              }),
          })
        }),
      ),
    )
    const execution = yield* SessionExecutionLocal.make({
      store: { get: (id) => Effect.succeed(sessions.find((session) => session.id === id)) },
      locations,
      gate,
    })
    return {
      execution,
      locations,
      sessions,
      chats,
      acquired,
      released,
      owners,
      resolved,
      routed,
      starts,
      started,
      finish,
      gate,
    }
  })

const run = <A, E>(effect: Effect.Effect<A, E, Scope.Scope>) => Effect.runPromise(Effect.scoped(effect))

test("resume wake and prompt cannot overlap different chats in one project", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const first = yield* f.execution.resume(f.sessions[0].id).pipe(Effect.forkChild)
      yield* Deferred.await(f.started[0])
      // The prompt admission integration below exercises the same error-free advisory boundary.
      yield* f.execution.wake(f.sessions[1].id)
      yield* Effect.yieldNow
      const blocked = yield* f.execution.resume(f.sessions[1].id).pipe(Effect.exit, Effect.forkChild)
      yield* Effect.yieldNow
      const other = yield* f.execution.resume(f.sessions[2].id).pipe(Effect.forkChild)
      yield* Deferred.await(f.started[2])
      const blockedDrainStarts = f.starts.filter((item) => item.sessionID === f.sessions[1].id).length
      const otherProjectDrainStarts = f.starts.filter((item) => item.sessionID === f.sessions[2].id).length
      const releaseBeforeCleanup = f.released.length !== 0
      expect(blockedDrainStarts).toBe(0)
      expect(otherProjectDrainStarts).toBe(1)
      expect(releaseBeforeCleanup).toBe(false)
      const exit = yield* Fiber.join(blocked)
      expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toMatchObject({
        _tag: "FtcAgentGate.Blocked",
        reason: { kind: "busy", active: f.chats[0] },
      })
      yield* Deferred.succeed(f.finish[0], undefined)
      yield* Deferred.succeed(f.finish[2], undefined)
      yield* Effect.all([Fiber.join(first), Fiber.join(other)])
      expect(f.released).toEqual(f.acquired)
      expect(f.owners.size).toBe(0)
      expect(f.routed).toEqual([f.sessions[0].location, f.sessions[2].location])
      expect(f.resolved[0]).toEqual({ sessionID: f.sessions[0].id, location: f.sessions[0].location })
    }),
  ))

test("same Session joins and coalesced wakes retain one lease across drains", () =>
  run(
    Effect.gen(function* () {
      const gate = yield* Deferred.make<void>()
      const second = yield* Deferred.make<void>()
      const f = yield* fixture({
        run: (_id, count) =>
          count === 1 ? Deferred.await(gate) : Deferred.succeed(second, undefined).pipe(Effect.asVoid),
      })
      const first = yield* f.execution.resume(f.sessions[0].id).pipe(Effect.forkChild)
      yield* Deferred.await(f.started[0])
      const joined = yield* f.execution.resume(f.sessions[0].id).pipe(Effect.forkChild)
      const cancelled = yield* f.execution.resume(f.sessions[0].id).pipe(Effect.forkChild)
      yield* Effect.yieldNow
      yield* Fiber.interrupt(cancelled)
      yield* f.execution.wake(f.sessions[0].id)
      yield* f.execution.wake(f.sessions[0].id)
      expect(f.acquired).toHaveLength(1)
      expect(f.released).toHaveLength(0)
      yield* Deferred.succeed(gate, undefined)
      yield* Deferred.await(second)
      yield* Effect.all([Fiber.join(first), Fiber.join(joined)])
      expect(f.starts.map((item) => item.force)).toEqual([true, false])
      expect(f.acquired).toHaveLength(1)
      expect(f.released).toEqual(f.acquired)
    }),
  ))

test("tool and approval waits retain ownership through interruption cleanup and successor", () =>
  run(
    Effect.gen(function* () {
      const tool = yield* Deferred.make<void>()
      const approval = yield* Deferred.make<void>()
      const cleanup = yield* Deferred.make<void>()
      const cleaned = yield* Deferred.make<void>()
      const successor = yield* Deferred.make<void>()
      const finish = yield* Deferred.make<void>()
      const f = yield* fixture({
        run: (_id, count) =>
          count === 1
            ? Deferred.await(tool).pipe(
                Effect.andThen(Deferred.succeed(approval, undefined)),
                Effect.andThen(Effect.never),
                Effect.ensuring(Deferred.succeed(cleanup, undefined).pipe(Effect.andThen(Deferred.await(cleaned)))),
              )
            : Deferred.succeed(successor, undefined).pipe(Effect.andThen(Deferred.await(finish))),
      })
      yield* f.execution.wake(f.sessions[0].id)
      yield* Deferred.await(f.started[0])
      expect(f.released).toHaveLength(0)
      yield* Deferred.succeed(tool, undefined)
      yield* Deferred.await(approval)
      expect(f.released).toHaveLength(0)
      const stop = yield* f.execution.interrupt(f.sessions[0].id).pipe(Effect.forkChild)
      yield* Deferred.await(cleanup)
      yield* f.execution.wake(f.sessions[0].id)
      expect(f.released).toHaveLength(0)
      expect(yield* f.execution.resume(f.sessions[1].id).pipe(Effect.flip)).toBeInstanceOf(FtcAgentGate.Blocked)
      yield* Deferred.succeed(cleaned, undefined)
      yield* Fiber.join(stop)
      yield* Deferred.await(successor)
      expect(f.acquired).toHaveLength(1)
      expect(f.released).toHaveLength(0)
      const joined = yield* f.execution.resume(f.sessions[0].id).pipe(Effect.forkChild)
      yield* Deferred.succeed(finish, undefined)
      yield* Fiber.join(joined)
      expect(f.released).toEqual(f.acquired)
      expect(Array.from(yield* f.execution.active)).toEqual([])
    }),
  ))

test("failed drain transfers ownership to its pending successor", () =>
  run(
    Effect.gen(function* () {
      const fail = yield* Deferred.make<void>()
      const next = yield* Deferred.make<void>()
      const finish = yield* Deferred.make<void>()
      const f = yield* fixture({
        run: (_id, count) =>
          count === 1
            ? Deferred.await(fail).pipe(Effect.andThen(Effect.die("controlled runner failure")))
            : Deferred.succeed(next, undefined).pipe(Effect.andThen(Deferred.await(finish))),
      })
      const first = yield* f.execution.resume(f.sessions[0].id).pipe(Effect.exit, Effect.forkChild)
      yield* Deferred.await(f.started[0])
      yield* f.execution.wake(f.sessions[0].id)
      yield* Deferred.succeed(fail, undefined)
      expect(Exit.isFailure(yield* Fiber.join(first))).toBe(true)
      yield* Deferred.await(next)
      expect(f.acquired).toHaveLength(1)
      expect(f.released).toHaveLength(0)
      const joined = yield* f.execution.resume(f.sessions[0].id).pipe(Effect.forkChild)
      yield* Deferred.succeed(finish, undefined)
      yield* Fiber.join(joined)
      expect(f.released).toEqual(f.acquired)
    }),
  ))

test("managed membership rejection never falls back to legacy execution", () =>
  run(
    Effect.gen(function* () {
      const error: FtcProject.GateError = { code: "chat_not_found", recovery: "reopen_project" }
      const f = yield* fixture({ gate: { resolve: () => Effect.fail(error) } })
      expect(yield* f.execution.resume(f.sessions[0].id).pipe(Effect.flip)).toMatchObject({
        reason: { kind: "rejected", error },
      })
      yield* f.execution.wake(f.sessions[0].id)
      yield* Effect.yieldNow
      expect(f.starts).toHaveLength(0)
      expect(f.routed).toHaveLength(0)
      expect(f.acquired).toHaveLength(0)
      expect(Array.from(yield* f.execution.active)).toEqual([])
    }),
  ))

test("unmanaged Sessions retain legacy execution with no gate claim", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const resumed = yield* f.execution.resume(f.sessions[3].id).pipe(Effect.forkChild)
      yield* Deferred.await(f.started[3])
      yield* Deferred.succeed(f.finish[3], undefined)
      yield* Fiber.join(resumed)
      expect(f.acquired).toHaveLength(0)
      expect(f.starts).toEqual([{ sessionID: f.sessions[3].id, force: true }])
      expect(f.routed).toEqual([f.sessions[3].location])
    }),
  ))

test("acquisition failure or cancellation cleans ownership without starting a runner", () =>
  run(
    Effect.gen(function* () {
      const error: FtcProject.GateError = { code: "gate_closed", recovery: "retry" }
      const failed = yield* fixture({ gate: { acquire: () => Effect.fail(error) } })
      expect(yield* failed.execution.resume(failed.sessions[0].id).pipe(Effect.flip)).toMatchObject({
        reason: { kind: "rejected", error },
      })
      expect(Array.from(yield* failed.execution.active)).toEqual([])
      const acquiring = yield* Deferred.make<void>()
      const cancelled = yield* Deferred.make<void>()
      const f = yield* fixture({
        gate: {
          acquire: () =>
            Deferred.succeed(acquiring, undefined).pipe(
              Effect.andThen(Effect.never),
              Effect.onInterrupt(() => Deferred.succeed(cancelled, undefined)),
            ),
        },
      })
      yield* f.execution.wake(f.sessions[0].id)
      yield* Deferred.await(acquiring)
      yield* f.execution.interrupt(f.sessions[0].id)
      yield* Deferred.await(cancelled)
      expect(f.starts).toHaveLength(0)
      expect(f.released).toHaveLength(0)
      expect(Array.from(yield* f.execution.active)).toEqual([])
    }),
  ))

test("scope disposal awaits runner cleanup before exact lease release", async () => {
  const releases: FtcProject.GateLease[] = []
  let clean = false
  const f = await run(
    Effect.gen(function* () {
      const f = yield* fixture({
        run: () =>
          Effect.never.pipe(
            Effect.ensuring(
              Effect.sync(() => {
                clean = true
              }),
            ),
          ),
        gate: {
          release: (lease) =>
            Effect.sync(() => {
              expect(clean).toBe(true)
              releases.push(lease)
            }),
        },
      })
      yield* f.execution.wake(f.sessions[0].id)
      yield* Deferred.await(f.started[0])
      return f
    }),
  )
  expect(releases).toEqual(f.acquired)
  expect(Array.from(await Effect.runPromise(f.execution.active))).toEqual([])
})

test("real Session prompt admits before local wake and a busy chat never reaches its Location runner", async () => {
  await using tmp = await tmpdir()
  await run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const id = SessionMessage.ID.create()
      const replacements = [
        [Database.node, Database.layerFromPath(`${tmp.path}/session.sqlite`)],
        [
          ProjectV2.node,
          Layer.succeed(ProjectV2.Service, {
            resolve: (directory) => Effect.succeed({ id: Project.ID.make("host-project"), directory }),
            directories: () => Effect.die("unused"),
            commit: () => Effect.die("unused"),
          }),
        ],
      ] satisfies LayerNode.Replacements
      const local = Layer.effect(
        SessionExecution.Service,
        Effect.gen(function* () {
          const store = yield* SessionStore.Service
          const database = yield* Database.Service
          const execution = yield* SessionExecutionLocal.make({ store, locations: f.locations, gate: f.gate })
          return SessionExecution.Service.of({
            ...execution,
            wake: (sessionID) =>
              Effect.gen(function* () {
                expect(yield* SessionInput.find(database.db, id)).toMatchObject({ id, sessionID })
                yield* execution.wake(sessionID)
              }),
          })
        }),
      ).pipe(Layer.provide(AppNodeBuilder.build(LayerNode.group([Database.node, SessionStore.node]), replacements)))
      yield* Effect.gen(function* () {
        const session = yield* SessionV2.Service
        const database = yield* Database.Service
        yield* session.create({ id: f.sessions[0].id, location: f.sessions[0].location })
        yield* session.create({ id: f.sessions[1].id, location: f.sessions[1].location })
        const first = yield* session.resume(f.sessions[0].id).pipe(Effect.forkChild)
        yield* Deferred.await(f.started[0])
        const receipt = yield* session.prompt({
          sessionID: f.sessions[1].id,
          id,
          prompt: Prompt.make({ text: "Already admitted Session input" }),
        })
        expect(receipt.id).toBe(id)
        yield* Effect.yieldNow
        expect(f.starts.filter((item) => item.sessionID === f.sessions[1].id)).toHaveLength(0)
        expect(yield* SessionInput.find(database.db, id)).toMatchObject({ id, sessionID: f.sessions[1].id })
        expect(f.released).toHaveLength(0)
        yield* Deferred.succeed(f.finish[0], undefined)
        yield* Fiber.join(first)
        // Busy advisory work is not automatically replayed when a different chat settles.
        yield* Effect.yieldNow
        expect(f.starts).toHaveLength(1)
        yield* Deferred.succeed(f.finish[1], undefined)
        yield* session.resume(f.sessions[1].id)
        expect(f.starts).toHaveLength(2)
      }).pipe(
        Effect.provide(
          AppNodeBuilder.build(LayerNode.group([Database.node, SessionV2.node]), [
            ...replacements,
            [SessionExecution.node, local],
          ]),
        ),
      )
    }),
  )
})

test("wake during terminal release acquires a fresh claim and stale release cannot unlock it", () =>
  run(
    Effect.gen(function* () {
      const releasing = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const next = yield* Deferred.make<void>()
      const finish = yield* Deferred.make<void>()
      const notifications: FtcProject.GateLease[] = []
      const f = yield* fixture({
        run: (_id, count) =>
          count === 1 ? Effect.void : Deferred.succeed(next, undefined).pipe(Effect.andThen(Deferred.await(finish))),
      })
      const releaseClaim = f.gate.release
      const gated = {
        ...f.gate,
        release: (lease: FtcProject.GateLease) =>
          Effect.gen(function* () {
            notifications.push(lease)
            if (notifications.length === 1) {
              yield* Deferred.succeed(releasing, undefined)
              yield* Deferred.await(release)
            }
            yield* releaseClaim(lease)
          }),
      }
      const execution = yield* SessionExecutionLocal.make({
        store: { get: (id) => Effect.succeed(f.sessions.find((session) => session.id === id)) },
        locations: f.locations,
        gate: gated,
      })
      const first = yield* execution.resume(f.sessions[0].id).pipe(Effect.forkChild)
      yield* Deferred.await(releasing)
      expect(Array.from(yield* execution.active)).toEqual([f.sessions[0].id])
      yield* execution.wake(f.sessions[0].id)
      expect(f.acquired).toHaveLength(1)
      yield* Deferred.succeed(release, undefined)
      yield* Fiber.join(first)
      yield* Deferred.await(next)
      expect(f.acquired).toHaveLength(2)
      expect(f.acquired[0].token).not.toBe(f.acquired[1].token)
      yield* releaseClaim(f.acquired[0])
      expect(f.owners.get(f.acquired[1].projectKey)).toEqual(f.acquired[1])
      expect(yield* execution.resume(f.sessions[1].id).pipe(Effect.flip)).toBeInstanceOf(FtcAgentGate.Blocked)
      const joined = yield* execution.resume(f.sessions[0].id).pipe(Effect.forkChild)
      yield* Deferred.succeed(finish, undefined)
      yield* Fiber.join(joined)
      expect(notifications).toEqual(f.acquired)
      expect(f.owners.size).toBe(0)
    }),
  ))

test("Location construction failure releases its acquired claim and missing Session never resolves membership", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const local = yield* SessionExecutionLocal.make({
        store: { get: (id) => Effect.succeed(f.sessions.find((session) => session.id === id)) },
        locations: { get: () => Layer.effect(SessionRunner.Service, Effect.die("Location construction failed")) },
        gate: f.gate,
      })
      expect(Exit.isFailure(yield* local.resume(f.sessions[0].id).pipe(Effect.exit))).toBe(true)
      expect(f.released).toEqual(f.acquired)
      expect(f.starts).toHaveLength(0)
      const resolutions = f.resolved.length
      expect(Exit.isFailure(yield* local.resume(SessionSchema.ID.create()).pipe(Effect.exit))).toBe(true)
      expect(f.resolved).toHaveLength(resolutions)
      expect(Array.from(yield* local.active)).toEqual([])
    }),
  ))

test("resume during successful asynchronous release joins the settling execution", () =>
  run(
    Effect.gen(function* () {
      const releasing = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const f = yield* fixture({
        run: () => Effect.void,
        gate: { release: () => Deferred.succeed(releasing, undefined).pipe(Effect.andThen(Deferred.await(release))) },
      })
      const first = yield* f.execution.resume(f.sessions[0].id).pipe(Effect.forkChild)
      yield* Deferred.await(releasing)
      const joined = yield* f.execution.resume(f.sessions[0].id).pipe(Effect.forkChild)
      yield* Effect.yieldNow
      yield* Deferred.succeed(release, undefined)
      yield* Effect.all([Fiber.join(first), Fiber.join(joined)])
      expect(f.starts).toHaveLength(1)
      expect(f.acquired).toHaveLength(1)
    }),
  ))

test("Location initialization and its interruption cleanup remain inside the gate claim", () =>
  run(
    Effect.gen(function* () {
      const initializing = yield* Deferred.make<void>()
      const cleaning = yield* Deferred.make<void>()
      const cleanup = yield* Deferred.make<void>()
      const f = yield* fixture()
      const local = yield* SessionExecutionLocal.make({
        store: { get: (id) => Effect.succeed(f.sessions.find((session) => session.id === id)) },
        locations: {
          get: () =>
            Layer.effect(
              SessionRunner.Service,
              Deferred.succeed(initializing, undefined).pipe(
                Effect.andThen(Effect.never),
                Effect.ensuring(Deferred.succeed(cleaning, undefined).pipe(Effect.andThen(Deferred.await(cleanup)))),
              ),
            ),
        },
        gate: f.gate,
      })
      yield* local.wake(f.sessions[0].id)
      yield* Deferred.await(initializing)
      expect(f.acquired).toHaveLength(1)
      expect(f.released).toHaveLength(0)
      const stop = yield* local.interrupt(f.sessions[0].id).pipe(Effect.forkChild)
      yield* Deferred.await(cleaning)
      expect(yield* f.execution.resume(f.sessions[1].id).pipe(Effect.flip)).toBeInstanceOf(FtcAgentGate.Blocked)
      expect(f.released).toHaveLength(0)
      yield* Deferred.succeed(cleanup, undefined)
      yield* Fiber.join(stop)
      expect(f.starts).toHaveLength(0)
      expect(f.released).toEqual(f.acquired)
      expect(Array.from(yield* local.active)).toEqual([])
    }),
  ))
