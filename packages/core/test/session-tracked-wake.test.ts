import { expect, test } from "bun:test"
import { Deferred, Effect, Exit, Fiber, Scope } from "effect"
import { SessionRunCoordinator } from "@opencode-ai/core/session/run-coordinator"

const run = <A, E>(effect: Effect.Effect<A, E, Scope.Scope>) => Effect.runPromise(Effect.scoped(effect))

test("tracked coalesced wakes settle after the complete ownership chain", () =>
  run(
    Effect.gen(function* () {
      const started = yield* Deferred.make<void>()
      const finish = yield* Deferred.make<void>()
      const notices: number[] = []
      let runs = 0
      const coordinator = yield* SessionRunCoordinator.make<string, never>({
        drain: () =>
          Effect.sync(() => runs++).pipe(
            Effect.andThen(Deferred.succeed(started, undefined)),
            Effect.andThen(Deferred.await(finish)),
          ),
      })
      expect(typeof coordinator.wakeWithSettlement).toBe("function")
      yield* coordinator.wakeWithSettlement("a", () =>
        Effect.sync(() => {
          notices.push(1)
        }),
      )
      yield* Deferred.await(started)
      yield* coordinator.wakeWithSettlement("a", () =>
        Effect.sync(() => {
          notices.push(2)
        }),
      )
      yield* coordinator.wakeWithSettlement("a", () =>
        Effect.sync(() => {
          notices.push(3)
        }),
      )
      expect(notices).toEqual([])
      yield* Deferred.succeed(finish, undefined)
      yield* coordinator.run("a")
      expect(notices).toEqual([1, 2, 3])
      expect(runs).toBe(2)
    }),
  ))

test("wake during asynchronous scope close owns a fresh callback bucket", () =>
  run(
    Effect.gen(function* () {
      const closing = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const successor = yield* Deferred.make<void>()
      const finish = yield* Deferred.make<void>()
      const notices: number[] = []
      let acquisitions = 0
      const coordinator = yield* SessionRunCoordinator.make<string, never>({
        acquire: () =>
          Effect.acquireRelease(
            Effect.sync(() => ++acquisitions),
            (count) =>
              count === 1
                ? Deferred.succeed(closing, undefined).pipe(Effect.andThen(Deferred.await(release)))
                : Effect.void,
          ),
        drain: () =>
          acquisitions === 1
            ? Effect.void
            : Deferred.succeed(successor, undefined).pipe(Effect.andThen(Deferred.await(finish))),
      })
      expect(typeof coordinator.wakeWithSettlement).toBe("function")
      yield* coordinator.wakeWithSettlement("a", () =>
        Effect.sync(() => {
          notices.push(1)
        }),
      )
      yield* Deferred.await(closing)
      yield* coordinator.wakeWithSettlement("a", () =>
        Effect.sync(() => {
          notices.push(2)
        }),
      )
      yield* coordinator.wakeWithSettlement("a", () =>
        Effect.sync(() => {
          notices.push(3)
        }),
      )
      yield* Deferred.succeed(release, undefined)
      yield* Deferred.await(successor)
      expect(notices).toEqual([1])
      yield* Deferred.succeed(finish, undefined)
      yield* coordinator.run("a")
      expect(notices).toEqual([1, 2, 3])
      expect(acquisitions).toBe(2)
    }),
  ))

test("failed acquisition and defective callback cannot strand other callbacks", () =>
  run(
    Effect.gen(function* () {
      const acquire = yield* Deferred.make<void>()
      const settled = yield* Deferred.make<void>()
      let drains = 0
      const coordinator = yield* SessionRunCoordinator.make<string, string>({
        acquire: () => Deferred.await(acquire).pipe(Effect.andThen(Effect.fail("blocked"))),
        drain: () =>
          Effect.sync(() => {
            drains++
          }),
      })
      expect(typeof coordinator.wakeWithSettlement).toBe("function")
      yield* coordinator.wakeWithSettlement("a", () => Effect.die("notification defect"))
      yield* coordinator.wakeWithSettlement("a", () => Deferred.succeed(settled, undefined).pipe(Effect.asVoid))
      yield* Deferred.succeed(acquire, undefined)
      yield* Deferred.await(settled)
      expect(drains).toBe(0)
    }),
  ))

test("shutdown settles current and never-started fresh successor plus late registration", () =>
  run(
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const closing = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const notices: number[] = []
      let drains = 0
      const coordinator = yield* SessionRunCoordinator.make<string, never>({
        acquire: () =>
          Effect.addFinalizer(() => Deferred.succeed(closing, undefined).pipe(Effect.andThen(Deferred.await(release)))),
        drain: () =>
          Effect.sync(() => {
            drains++
          }),
      }).pipe(Effect.provideService(Scope.Scope, scope))
      expect(typeof coordinator.wakeWithSettlement).toBe("function")
      yield* coordinator.wakeWithSettlement("a", () =>
        Effect.sync(() => {
          notices.push(1)
        }),
      )
      yield* Deferred.await(closing)
      yield* coordinator.wakeWithSettlement("a", () =>
        Effect.sync(() => {
          notices.push(2)
        }),
      )
      const close = yield* Scope.close(scope, Exit.void).pipe(Effect.forkChild)
      yield* Effect.yieldNow
      yield* Deferred.succeed(release, undefined)
      yield* Fiber.join(close)
      yield* coordinator.wakeWithSettlement("a", () =>
        Effect.sync(() => {
          notices.push(3)
        }),
      )
      expect(notices).toEqual([1, 2, 3])
      expect(drains).toBe(1)
      expect((yield* coordinator.active).size).toBe(0)
    }),
  ))

test.each(["failure", "interrupt"] as const)("%s successor inherits callbacks until the new drain settles", (mode) =>
  run(
    Effect.gen(function* () {
      const started = yield* Deferred.make<void>()
      const cleanup = yield* Deferred.make<void>()
      const continueCleanup = yield* Deferred.make<void>()
      const second = yield* Deferred.make<void>()
      const finish = yield* Deferred.make<void>()
      const notices: number[] = []
      let runs = 0
      let acquired = 0
      let released = 0
      const coordinator = yield* SessionRunCoordinator.make<string, string>({
        acquire: () =>
          Effect.acquireRelease(
            Effect.sync(() => {
              acquired++
            }),
            () =>
              Effect.sync(() => {
                released++
              }),
          ),
        drain: () =>
          Effect.suspend(() =>
            ++runs === 1
              ? Deferred.succeed(started, undefined).pipe(
                  Effect.andThen(
                    mode === "failure"
                      ? Deferred.await(continueCleanup).pipe(Effect.andThen(Effect.fail("failed")))
                      : Effect.never.pipe(
                          Effect.onInterrupt(() =>
                            Deferred.succeed(cleanup, undefined).pipe(Effect.andThen(Deferred.await(continueCleanup))),
                          ),
                        ),
                  ),
                )
              : Deferred.succeed(second, undefined).pipe(Effect.andThen(Deferred.await(finish))),
          ),
      })
      expect(typeof coordinator.wakeWithSettlement).toBe("function")
      yield* coordinator.wakeWithSettlement("a", () =>
        Effect.sync(() => {
          notices.push(1)
        }),
      )
      yield* Deferred.await(started)
      const interrupt = mode === "interrupt" ? yield* coordinator.interrupt("a").pipe(Effect.forkChild) : undefined
      if (interrupt) yield* Deferred.await(cleanup)
      yield* coordinator.wakeWithSettlement("a", () =>
        Effect.sync(() => {
          notices.push(2)
        }),
      )
      yield* Deferred.succeed(continueCleanup, undefined)
      yield* Deferred.await(second)
      expect(notices).toEqual([])
      expect(acquired).toBe(1)
      expect(released).toBe(0)
      yield* Deferred.succeed(finish, undefined)
      yield* coordinator.run("a")
      if (interrupt) yield* Fiber.join(interrupt)
      expect(notices).toEqual([1, 2])
      expect(released).toBe(1)
    }),
  ),
)

test("cancellation during acquisition settles tracked reservations without draining", () =>
  run(
    Effect.gen(function* () {
      const entered = yield* Deferred.make<void>()
      let settled = 0
      let drains = 0
      const coordinator = yield* SessionRunCoordinator.make<string, never>({
        acquire: () => Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never)),
        drain: () =>
          Effect.sync(() => {
            drains++
          }),
      })
      expect(typeof coordinator.wakeWithSettlement).toBe("function")
      yield* coordinator.wakeWithSettlement("a", () =>
        Effect.sync(() => {
          settled++
        }),
      )
      yield* Deferred.await(entered)
      yield* coordinator.interrupt("a")
      expect(settled).toBe(1)
      expect(drains).toBe(0)
      expect((yield* coordinator.active).size).toBe(0)
    }),
  ))
