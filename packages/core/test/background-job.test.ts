import { describe, expect } from "bun:test"
import { BackgroundJob } from "@opencode-ai/core/background-job"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Deferred, Effect, Exit, Fiber, Scope } from "effect"
import { it } from "./lib/effect"

const jobsLayer = LayerNode.compile(BackgroundJob.node)

describe("BackgroundJob", () => {
  it.live("tracks process-local work through explicit observation", () =>
    Effect.gen(function* () {
      const jobs = yield* BackgroundJob.Service
      const latch = yield* Deferred.make<void>()
      const job = yield* jobs.start({
        type: "test",
        metadata: { durable: false },
        run: Deferred.await(latch).pipe(Effect.as("done")),
      })

      expect(job).toMatchObject({ type: "test", status: "running", metadata: { durable: false } })
      expect(yield* jobs.wait({ id: job.id, timeout: 0 })).toMatchObject({
        timedOut: true,
        info: { status: "running" },
      })

      yield* Deferred.succeed(latch, undefined)
      expect(yield* jobs.wait({ id: job.id })).toMatchObject({
        timedOut: false,
        info: { status: "completed", output: "done" },
      })
    }).pipe(Effect.provide(jobsLayer)),
  )

  it.live("publishes jobs before starting immediately settling work", () =>
    Effect.gen(function* () {
      const jobs = yield* BackgroundJob.Service

      yield* Effect.forEach(Array.from({ length: 100 }), (_, index) => {
        const id = `job_immediate_start_${index}`
        return Effect.gen(function* () {
          const job = yield* jobs.start({
            id,
            type: "test",
            run: jobs
              .get(id)
              .pipe(
                Effect.flatMap((info) =>
                  info?.status === "running"
                    ? Effect.succeed(`done-${index}`)
                    : Effect.fail("job started before publish"),
                ),
              ),
          })

          expect(yield* jobs.wait({ id: job.id })).toMatchObject({
            timedOut: false,
            info: { status: "completed", output: `done-${index}` },
          })
        })
      })
    }).pipe(Effect.provide(jobsLayer)),
  )

  it.live("increments pending work before starting immediately settling extensions", () =>
    Effect.gen(function* () {
      const jobs = yield* BackgroundJob.Service

      yield* Effect.forEach(Array.from({ length: 100 }), (_, index) =>
        Effect.gen(function* () {
          const first = yield* Deferred.make<void>()
          const job = yield* jobs.start({
            type: "test",
            run: Deferred.await(first).pipe(Effect.as(`first-${index}`)),
          })

          expect(yield* jobs.extend({ id: job.id, run: Effect.succeed(`second-${index}`) })).toBe(true)
          expect((yield* jobs.get(job.id))?.status).toBe("running")

          yield* Deferred.succeed(first, undefined)
          expect(yield* jobs.wait({ id: job.id })).toMatchObject({
            timedOut: false,
            info: { status: "completed", output: `second-${index}` },
          })
        }),
      )
    }).pipe(Effect.provide(jobsLayer)),
  )

  it.live("interrupts live work without promising settlement after the owning process-local scope closes", () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const interrupted = yield* Deferred.make<void>()
      const jobs = yield* BackgroundJob.make.pipe(Scope.provide(scope))
      const job = yield* jobs.start({
        type: "test",
        run: Effect.never.pipe(Effect.ensuring(Deferred.succeed(interrupted, undefined))),
      })

      yield* Scope.close(scope, Exit.void)

      yield* Deferred.await(interrupted).pipe(Effect.timeout("1 second"))
      // The abandoned in-memory registry is not a durable observation channel.
      expect((yield* jobs.get(job.id))?.status).toBe("running")
    }),
  )
})

it.live("ownership outlives completed publication and parallel job finalizers", () =>
  Effect.gen(function* () {
    const scope = yield* Scope.make()
    const jobs = yield* BackgroundJob.make.pipe(Scope.provide(scope))
    const held = new Set<object>()
    const finish = yield* Deferred.make<void>()
    const cleanup = yield* Deferred.make<void>()
    const closing = yield* Deferred.make<void>()
    yield* Effect.gen(function* () {
      const job = yield* jobs.start({
        type: "ownership",
        ownership: Effect.sync(() => {
          const token = {}
          held.add(token)
          return {
            release: Effect.sync(() => {
              held.delete(token)
            }),
            retain: Effect.die("Unused"),
          }
        }),
        run: Effect.gen(function* () {
          yield* Effect.addFinalizer(() =>
            Deferred.succeed(closing, undefined).pipe(Effect.andThen(Deferred.await(cleanup))),
          )
          yield* Deferred.await(finish)
          return "done"
        }),
      })
      expect(held.size).toBe(1)
      yield* Deferred.succeed(finish, undefined)
      expect((yield* jobs.wait({ id: job.id })).info?.status).toBe("completed")
      yield* Deferred.await(closing)
      expect(held.size).toBe(1)
      yield* Deferred.succeed(cleanup, undefined)
    }).pipe(Effect.ensuring(Deferred.succeed(cleanup, undefined)))
    yield* Scope.close(scope, Exit.void)
    expect(held.size).toBe(0)
  }),
)

it.live("promotion retains ownership outside a completed job and cancellation settles the callback", () =>
  Effect.gen(function* () {
    const scope = yield* Scope.make()
    const jobs = yield* BackgroundJob.make.pipe(Scope.provide(scope))
    const finish = yield* Deferred.make<void>()
    const promoted = yield* Deferred.make<void>()
    const stopCallback = yield* Deferred.make<void>()
    const interrupted = yield* Deferred.make<void>()
    const held = new Set<object>()
    const acquire: Effect.Effect<BackgroundJob.Ownership> = Effect.sync(() => {
      const token = {}
      held.add(token)
      return {
        release: Effect.sync(() => {
          held.delete(token)
        }),
        retain: acquire,
      }
    })
    yield* Effect.gen(function* () {
      const job = yield* jobs.start({
        type: "promotion",
        ownership: acquire,
        run: Deferred.await(finish).pipe(Effect.as("done")),
        onPromote: Deferred.succeed(promoted, undefined).pipe(
          Effect.andThen(Deferred.await(stopCallback)),
          Effect.onInterrupt(() => Deferred.succeed(interrupted, undefined)),
        ),
      })
      const promotion = yield* jobs.promote(job.id).pipe(Effect.forkChild)
      yield* Deferred.await(promoted)
      yield* Deferred.succeed(finish, undefined)
      yield* jobs.wait({ id: job.id })
      expect(held.size).toBeGreaterThan(0)
      const cancelled = yield* Fiber.interrupt(promotion).pipe(Effect.forkChild)
      yield* Deferred.await(interrupted).pipe(Effect.timeout("500 millis"))
      yield* Fiber.join(cancelled)
    }).pipe(
      Effect.ensuring(
        Effect.all([Deferred.succeed(stopCallback, undefined), Deferred.succeed(finish, undefined)], { discard: true }),
      ),
    )
    yield* Scope.close(scope, Exit.void)
    expect(held.size).toBe(0)
  }),
)

it.live("accepted extension owns waiting work, duplicate/rejected work owns nothing, and shutdown releases all", () =>
  Effect.gen(function* () {
    const scope = yield* Scope.make()
    const jobs = yield* BackgroundJob.make.pipe(Scope.provide(scope))
    const held = new Set<object>()
    const acquire: Effect.Effect<BackgroundJob.Ownership> = Effect.sync(() => {
      const token = {}
      held.add(token)
      return {
        release: Effect.sync(() => {
          held.delete(token)
        }),
        retain: acquire,
      }
    })
    const entered = yield* Deferred.make<void>()
    const job = yield* jobs.start({
      id: "same",
      type: "ownership",
      ownership: acquire,
      run: Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never)),
    })
    yield* Deferred.await(entered)
    yield* jobs.start({ id: job.id, type: "duplicate", ownership: acquire, run: Effect.die("Duplicate ran") })
    expect(held.size).toBe(1)
    expect(yield* jobs.extend({ id: "missing", ownership: acquire, run: Effect.die("Missing ran") })).toBe(false)
    expect(held.size).toBe(1)
    expect(
      yield* jobs.extend({ id: job.id, ownership: acquire, run: Effect.die("Queued work ran before predecessor") }),
    ).toBe(true)
    expect(held.size).toBe(2)
    expect(yield* jobs.get(job.id)).not.toHaveProperty("ownership")
    yield* Scope.close(scope, Exit.void)
    expect(held.size).toBe(0)
  }),
)

it.live("old generation cleanup cannot release a replacement job's ownership", () =>
  Effect.gen(function* () {
    const scope = yield* Scope.make()
    const jobs = yield* BackgroundJob.make.pipe(Scope.provide(scope))
    const held = new Set<object>()
    const acquire: Effect.Effect<BackgroundJob.Ownership> = Effect.sync(() => {
      const token = {}
      held.add(token)
      return {
        release: Effect.sync(() => {
          held.delete(token)
        }),
        retain: acquire,
      }
    })
    const cleanup = yield* Deferred.make<void>()
    const closing = yield* Deferred.make<void>()
    yield* Effect.gen(function* () {
      const first = yield* jobs.start({
        id: "reused",
        type: "old",
        ownership: acquire,
        run: Effect.gen(function* () {
          yield* Effect.addFinalizer(() =>
            Deferred.succeed(closing, undefined).pipe(Effect.andThen(Deferred.await(cleanup))),
          )
          return yield* Effect.fail("controlled failure")
        }),
      })
      expect((yield* jobs.wait({ id: first.id })).info?.status).toBe("error")
      yield* Deferred.await(closing)
      yield* jobs.start({ id: first.id, type: "new", ownership: acquire, run: Effect.never })
      expect(held.size).toBe(2)
      yield* Deferred.succeed(cleanup, undefined)
      yield* Effect.yieldNow.pipe(Effect.repeat({ until: () => held.size === 1 }), Effect.timeout("1 second"))
      expect((yield* jobs.get(first.id))?.type).toBe("new")
      expect((yield* jobs.get(first.id))?.status).toBe("running")
      yield* jobs.cancel(first.id)
      expect(held.size).toBe(0)
    }).pipe(Effect.ensuring(Deferred.succeed(cleanup, undefined)), Effect.ensuring(Scope.close(scope, Exit.void)))
  }),
)
