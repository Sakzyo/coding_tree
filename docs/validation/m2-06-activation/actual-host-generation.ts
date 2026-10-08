import assert from "node:assert/strict"
import { Context, Effect, Exit, Fiber, Layer, Scope } from "../../../packages/core/node_modules/effect/dist/index.js"
import { AppLayer } from "../../../packages/opencode/src/effect/app-runtime"
import { LegacyActivity } from "../../../packages/opencode/src/session/legacy-activity"
import { AbsolutePath } from "../../../packages/core/src/schema"

await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
  const firstScope = yield* Scope.make()
  const first = Context.get(yield* Layer.buildWithMemoMap(AppLayer, Layer.makeMemoMapUnsafe(), firstScope), LegacyActivity.Service)
  const root = AbsolutePath.make("/private/tmp/m2-06-activation-home")
  const lease = yield* first.acquire(root, Effect.void)
  yield* Effect.addFinalizer(() => first.release(lease))
  const close = yield* Scope.close(firstScope, Exit.void).pipe(Effect.forkChild)
  yield* Effect.gen(function* () {
    while (true) {
      const result = yield* first.acquire(root, Effect.void).pipe(Effect.exit)
      if (Exit.isFailure(result)) return
      yield* first.release(result.value)
      yield* Effect.yieldNow
    }
  }).pipe(Effect.timeout("10 seconds"))
  assert.equal(close.pollUnsafe(), undefined)
  const cancelledScope = yield* Scope.make()
  const cancelled = yield* Layer.buildWithMemoMap(AppLayer, Layer.makeMemoMapUnsafe(), cancelledScope).pipe(Effect.forkChild)
  yield* Effect.yieldNow
  yield* Fiber.interrupt(cancelled).pipe(Effect.timeout("10 seconds"))
  yield* Scope.close(cancelledScope, Exit.void)
  const nextScope = yield* Scope.make()
  const next = yield* Layer.buildWithMemoMap(AppLayer, Layer.makeMemoMapUnsafe(), nextScope).pipe(Effect.forkChild)
  yield* Effect.yieldNow
  assert.equal(next.pollUnsafe(), undefined)
  yield* first.release(lease)
  yield* Fiber.join(close)
  const reopened = Context.get(yield* Fiber.join(next).pipe(Effect.timeout("10 seconds")), LegacyActivity.Service)
  assert.notEqual(reopened, first)
  const claim = yield* reopened.acquire(root, Effect.void)
  yield* reopened.release(claim)
  yield* Scope.close(nextScope, Exit.void)
  console.log("PASS actual AppLayer last-close, cancelled waiting graph, pending successor, exact release and reopened generation")
})))
