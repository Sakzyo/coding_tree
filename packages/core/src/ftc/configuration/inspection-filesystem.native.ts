export * as NativeInspectionFilesystem from "./inspection-filesystem.native"

import type { NativeInspectionReader } from "@opencode-ai/inspection-reader-native"
import { FtcConfiguration } from "@opencode-ai/schema/ftc-configuration"
import { Effect, Fiber } from "effect"
import type { InspectionFilesystem } from "./inspection-filesystem"

export function make(): InspectionFilesystem.Interface {
  return {
    openProject: Effect.fn("NativeInspectionFilesystem.openProject")(function* (input) {
      const requested = input.root
      const scope = yield* Effect.scope
      const native = yield* Effect.tryPromise({
        try: async () => {
          const { NativeInspectionReader } = await import("@opencode-ai/inspection-reader-native")
          return NativeInspectionReader.load()
        },
        catch: failure,
      })
      const root = yield* Effect.acquireRelease(
        work(() => native.root(requested)),
        (root) => Effect.promise(() => native.close(root)),
      )
      const canonicalRoot = root.canonicalRoot
      const identity = root.identity
      let closed = false
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          closed = true
        }),
      )
      const run = <A>(body: Effect.Effect<A, FtcConfiguration.InspectionError>) =>
        Effect.suspend(
          (): Effect.Effect<A, FtcConfiguration.InspectionError> =>
            closed
              ? Effect.fail({ code: "owner_closed" } satisfies FtcConfiguration.InspectionError)
              : Effect.acquireUseRelease(Effect.forkIn(body, scope), join, Fiber.interrupt),
        )
      const read = <A>(
        relative: string,
        kind: "file" | "directory",
        body: (resource: NativeInspectionReader.Resource) => Effect.Effect<A, FtcConfiguration.InspectionError>,
      ) =>
        run(
          Effect.scoped(
            Effect.gen(function* () {
              const resource = yield* Effect.acquireRelease(
                work(() => native.open(root, relative, kind)),
                (resource) => (resource ? Effect.promise(() => native.close(resource)) : Effect.void),
              )
              return resource ? yield* body(resource) : undefined
            }),
          ),
        )
      return Object.freeze({
        canonicalRoot,
        identity,
        verify: () => run(work(() => native.verify(root))),
        readFile: (relative: string) =>
          read(relative, "file", (resource) =>
            Effect.gen(function* () {
              const chunks: Uint8Array[] = []
              let length = 0
              while (true) {
                const chunk = yield* work(() => native.read(resource))
                if (!chunk.length) break
                chunks.push(chunk)
                length += chunk.length
              }
              const bytes = new Uint8Array(length)
              let offset = 0
              yield* Effect.forEach(
                chunks,
                (chunk) =>
                  Effect.sync(() => {
                    bytes.set(chunk, offset)
                    offset += chunk.length
                  }).pipe(Effect.andThen(Effect.yieldNow)),
                { discard: true },
              )
              return bytes
            }),
          ),
        readDirectory: (relative: string) =>
          read(relative, "directory", (resource) =>
            Effect.gen(function* () {
              const entries: { readonly name: string; readonly type: "file" | "directory" }[] = []
              while (true) {
                const chunk = yield* work(() => native.list(resource))
                if (!chunk.length) return entries
                entries.push(...chunk)
              }
            }),
          ),
      })
    }),
  }
}

function work<A>(start: () => NativeInspectionReader.Job<A>) {
  return Effect.gen(function* () {
    const job = yield* Effect.try({ try: start, catch: failure })
    return yield* Effect.callback<A, FtcConfiguration.InspectionError>((resume) => {
      job.promise.then(
        (value) => resume(Effect.succeed(value)),
        (error) => resume(Effect.fail(failure(error))),
      )
      // Interruption cancels pending native work and joins its completion before release.
      return Effect.promise(async () => {
        job.cancel()
        await job.promise.catch(() => undefined)
      })
    })
  })
}

function failure(error: unknown): FtcConfiguration.InspectionError {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined
  return {
    code:
      code === "owner_closed" ||
      code === "path_outside_project" ||
      code === "unsupported_reader" ||
      code === "file_unavailable"
        ? code
        : "reader_unavailable",
  }
}

function join<A, E>(fiber: Fiber.Fiber<A, E>) {
  return Effect.callback<A, E>((resume) => {
    // beta.83 iterates a mutable observer list. Defer removal until notification ends,
    // so the concurrent Scope closer cannot lose its own retirement notification.
    const remove = fiber.addObserver((exit) => queueMicrotask(() => resume(exit)))
    return Effect.sync(remove)
  })
}
