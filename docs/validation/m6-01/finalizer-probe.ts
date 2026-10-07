import { Deferred, Effect, Fiber } from "../../../packages/core/node_modules/effect/dist/index.js"
import { FSUtil } from "../../../packages/core/src/fs-util"
import { LayerNode } from "../../../packages/core/src/effect/layer-node"
import { tmpdir } from "../../../packages/core/test/fixture/tmpdir"
import fs from "node:fs/promises"
import { KeyedMutex } from "../../../packages/core/src/effect/keyed-mutex"

await using directory = await tmpdir()
for (const mode of ["direct", "direct-void", "flatmap", "joined"] as const) {
  const trace: unknown[] = []
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const filesystem = yield* FSUtil.Service
        const ready = yield* Deferred.make<void>()
        const read = () => filesystem.realPath(directory.path).pipe(Effect.catch(() => Effect.succeed(undefined)))
        const cleanup =
          mode === "flatmap"
            ? read().pipe(
                Effect.flatMap((value) =>
                  Effect.sync(() => {
                    trace.push({ boundary: "flatmap-consumer", value })
                  }),
                ),
              )
            : Effect.gen(function* () {
                const value = yield* read()
                trace.push({ boundary: "generator-consumer", value })
              })
        const suspended = Effect.scoped(
          Effect.gen(function* () {
            yield* Effect.acquireRelease(
              Effect.gen(function* () {
                yield* filesystem.stat(directory.path)
                const staging = yield* filesystem.makeTempDirectory({ directory: directory.path, prefix: "probe-" })
                yield* filesystem.stat(staging)
                return staging
              }),
              () =>
                mode === "joined"
                  ? Effect.forkChild(Effect.uninterruptible(cleanup)).pipe(Effect.flatMap(Fiber.join))
                  : cleanup,
            )
            yield* filesystem
              .writeFile(`${directory.path}/${mode}.txt`, new TextEncoder().encode("probe"))
              .pipe(
                Effect.andThen(
                  mode === "direct-void"
                    ? Deferred.succeed(ready, undefined).pipe(Effect.asVoid)
                    : Deferred.succeed(ready, undefined),
                ),
                Effect.andThen(Effect.never),
              )
          }),
        )
        const pending = yield* Effect.forkChild(KeyedMutex.makeUnsafe<string>().withLock("probe")(suspended))
        yield* Deferred.await(ready)
        yield* Fiber.interrupt(pending)
      }),
    ).pipe(Effect.provide(LayerNode.compile(FSUtil.node))),
  )
  console.log(JSON.stringify({ mode, nativeRealpath: await fs.realpath(directory.path), trace }))
}
