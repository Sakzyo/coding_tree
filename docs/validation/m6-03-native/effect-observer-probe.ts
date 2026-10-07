import { Deferred, Effect, Exit, Fiber, Scope } from "../../../packages/core/node_modules/effect/dist/index.js"

// Runtime scheduling diagnostic only, not a substitute native-reader safety test.
for (const deferred of [false, true]) {
  const trace: string[] = []
  const result = Effect.runPromise(
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const started = yield* Deferred.make<void>()
      const worker = yield* Effect.forkIn(
        Deferred.succeed(started, undefined).pipe(
          Effect.andThen(Effect.never),
          Effect.onInterrupt(() =>
            Effect.promise(async () => {
              await Bun.sleep(1)
              trace.push("asynchronous-resource-retired")
            }),
          ),
        ),
        scope,
      )
      yield* Effect.forkChild(
        Effect.acquireUseRelease(
          Effect.succeed(worker),
          (fiber) =>
            deferred
              ? Effect.callback((resume) => {
                  const remove = fiber.addObserver((exit) => queueMicrotask(() => resume(exit)))
                  return Effect.sync(remove)
                })
              : Fiber.join(fiber),
          Fiber.interrupt,
        ),
      )
      yield* Deferred.await(started)
      yield* Effect.yieldNow
      yield* Scope.close(scope, Exit.void)
      trace.push("scope-closed")
    }),
  )
  const outcome = await Promise.race([
    result.then(() => "completed"),
    Bun.sleep(100).then(() => "not-completed-in-diagnostic-window"),
  ])
  console.log(JSON.stringify({ deferred, outcome, trace }))
}
