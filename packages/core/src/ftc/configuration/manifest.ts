export * as ManifestRepository from "./manifest"

import { FtcConfiguration } from "@opencode-ai/schema/ftc-configuration"
import { AbsolutePath } from "@opencode-ai/schema/schema"
import { createHash } from "node:crypto"
import path from "node:path"
import { Effect, Fiber, Option, PubSub, Result, Schema, Scope, Stream } from "effect"
import { KeyedMutex } from "../../effect/keyed-mutex"
import { FSUtil } from "../../fs-util"

export type Filesystem = Pick<
  FSUtil.Interface,
  "realPath" | "readFile" | "makeTempDirectory" | "stat" | "remove" | "writeFile" | "rename" | "link"
>

export interface Ports {
  readonly filesystem: Filesystem
}

export interface Interface {
  readonly readManifest: (input: {
    readonly root: string
  }) => Effect.Effect<FtcConfiguration.ReadResult, FtcConfiguration.ManifestError>
  readonly updateManifest: (input: {
    readonly root: string
    readonly expectedRevision: string | null
    readonly change: FtcConfiguration.Manifest
  }) => Effect.Effect<FtcConfiguration.ManifestSnapshot, FtcConfiguration.ManifestError>
  readonly events: Stream.Stream<FtcConfiguration.ManifestEvent>
}

export const make = (ports: Ports): Effect.Effect<Interface, never, Scope.Scope> =>
  Effect.gen(function* () {
    const fs = ports.filesystem
    const locks = KeyedMutex.makeUnsafe<string>()
    const observed = new Map<string, string | null>()
    const events = yield* PubSub.unbounded<FtcConfiguration.ManifestEvent>()
    let closed = false
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        closed = true
        observed.clear()
      }).pipe(Effect.andThen(PubSub.shutdown(events))),
    )
    const active = () =>
      Effect.suspend(() =>
        closed ? Effect.fail({ code: "owner_closed" } satisfies FtcConfiguration.ManifestError) : Effect.void,
      )
    const canonical = Effect.fn("ManifestRepository.canonical")(function* (root: string) {
      yield* active()
      if (typeof root !== "string" || !path.isAbsolute(root) || root.includes("\0"))
        return yield* Effect.fail({ code: "path_outside_project" } satisfies FtcConfiguration.ManifestError)
      return yield* fs
        .realPath(root)
        .pipe(Effect.mapError(() => ({ code: "file_unavailable" }) satisfies FtcConfiguration.ManifestError))
    })
    const current = Effect.fn("ManifestRepository.current")(function* (requested: string, root: string) {
      if ((yield* canonical(requested)) !== root)
        return yield* Effect.fail({ code: "path_outside_project" } satisfies FtcConfiguration.ManifestError)
      const filename = path.join(root, "ftc-project.json")
      const target = yield* fs.realPath(filename).pipe(
        Effect.catchReason("PlatformError", "NotFound", () => Effect.succeed(undefined)),
        Effect.mapError(() => ({ code: "file_unavailable" }) satisfies FtcConfiguration.ManifestError),
      )
      if (target !== undefined && target !== filename)
        return yield* Effect.fail({ code: "path_outside_project" } satisfies FtcConfiguration.ManifestError)
      const bytes = yield* fs.readFile(filename).pipe(
        Effect.catchReason("PlatformError", "NotFound", () => Effect.succeed(undefined)),
        Effect.mapError(() => ({ code: "file_unavailable" }) satisfies FtcConfiguration.ManifestError),
      )
      if ((yield* canonical(requested)) !== root)
        return yield* Effect.fail({ code: "path_outside_project" } satisfies FtcConfiguration.ManifestError)
      const after = yield* fs.realPath(filename).pipe(
        Effect.catchReason("PlatformError", "NotFound", () => Effect.succeed(undefined)),
        Effect.mapError(() => ({ code: "file_unavailable" }) satisfies FtcConfiguration.ManifestError),
      )
      if (after !== target)
        return yield* Effect.fail({ code: "path_outside_project" } satisfies FtcConfiguration.ManifestError)
      return bytes
    })
    const record = Effect.fn("ManifestRepository.record")(function* (
      root: string,
      result: FtcConfiguration.ReadResult,
      updated = false,
    ) {
      const revision = "revision" in result ? result.revision : null
      const previous = observed.get(root)
      observed.set(root, revision)
      if (previous === revision || (!updated && previous === undefined)) return
      yield* PubSub.publish(events, {
        type: updated ? "updated" : "external_changed",
        root: AbsolutePath.make(root),
        previousRevision: previous ?? null,
        result,
      } satisfies FtcConfiguration.ManifestEvent)
    })
    return {
      readManifest: Effect.fn("ManifestRepository.readManifest")(function* (input) {
        const requested = input.root
        const root = yield* canonical(requested)
        return yield* locks.withLock(root)(
          Effect.gen(function* () {
            const bytes = yield* current(requested, root)
            const result =
              bytes === undefined
                ? proposal()
                : { revision: digest(bytes), manifest: yield* Effect.fromResult(decodeBytes(bytes)) }
            yield* active()
            yield* record(root, result)
            return result
          }),
        )
      }),
      updateManifest: Effect.fn("ManifestRepository.updateManifest")(function* (input) {
        const requested = input.root
        const expected = input.expectedRevision
        if (expected !== null && !Schema.is(FtcConfiguration.Revision)(expected))
          return yield* Effect.fail({ code: "invalid_manifest" } satisfies FtcConfiguration.ManifestError)
        // Decode before yielding so caller mutation cannot change the staged proposal.
        const manifest = yield* Effect.fromResult(decodeManifest(input.change))
        const content = new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`)
        const root = yield* canonical(requested)
        return yield* locks.withLock(root)(
          Effect.scoped(
            Effect.gen(function* () {
              const before = yield* current(requested, root)
              if (before !== undefined) yield* Effect.fromResult(decodeBytes(before))
              const revision = before === undefined ? null : digest(before)
              if (revision !== expected)
                return yield* Effect.fail({
                  code: "revision_conflict",
                  expectedRevision: expected,
                  actualRevision: revision,
                } satisfies FtcConfiguration.ManifestError)
              const staging = yield* acquireStaging(fs, root).pipe(
                Effect.mapError(() => ({ code: "file_unavailable" }) satisfies FtcConfiguration.ManifestError),
              )
              const staged = path.join(staging, "manifest.json")
              yield* fs
                .writeFile(staged, content, { flag: "wx" })
                .pipe(Effect.mapError(() => ({ code: "file_unavailable" }) satisfies FtcConfiguration.ManifestError))
              const latest = yield* current(requested, root)
              const actual = latest === undefined ? null : digest(latest)
              if (actual !== expected)
                return yield* Effect.fail({
                  code: "revision_conflict",
                  expectedRevision: expected,
                  actualRevision: actual,
                } satisfies FtcConfiguration.ManifestError)
              return yield* Effect.uninterruptible(
                Effect.gen(function* () {
                  yield* active()
                  // Exclusive linking prevents initialization from replacing a concurrent create.
                  // Replacement has an unavoidable external-writer last-check/rename race.
                  yield* (
                    expected === null
                      ? fs.link(staged, path.join(root, "ftc-project.json"))
                      : fs.rename(staged, path.join(root, "ftc-project.json"))
                  ).pipe(
                    Effect.catchReason("PlatformError", "AlreadyExists", () =>
                      Effect.fail({
                        code: "revision_conflict",
                        expectedRevision: expected,
                      } satisfies FtcConfiguration.ManifestError),
                    ),
                    Effect.mapError(
                      (error): FtcConfiguration.ManifestError =>
                        "code" in error ? error : { code: "file_unavailable" },
                    ),
                  )
                  const snapshot = { revision: digest(content), manifest }
                  observed.set(root, revision)
                  yield* record(root, snapshot, true)
                  return snapshot
                }),
              )
            }),
          ),
        )
      }),
      events: Stream.fromPubSub(events),
    }
  })

function digest(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex")
}

function acquireStaging(fs: Filesystem, root: string) {
  return Effect.acquireRelease(
    Effect.gen(function* () {
      const parent = yield* fs.stat(root)
      const directory = yield* fs.makeTempDirectory({ directory: root, prefix: ".ftc-manifest-" })
      const identity = yield* fs.stat(directory).pipe(Effect.catch(() => Effect.succeed(undefined)))
      return { directory, parent, identity }
    }),
    // Join a fresh child so interrupted-parent continuations cannot influence identity checks.
    (staging) =>
      Effect.forkChild(
        Effect.uninterruptible(
          Effect.gen(function* () {
            // An unverifiable or relocated directory is retained rather than removing a foreign path.
            if (!staging.identity || Option.isNone(staging.identity.ino) || Option.isNone(staging.parent.ino)) return
            const canonical = yield* fs.realPath(root).pipe(Effect.catch(() => Effect.succeed(undefined)))
            if (canonical !== root) return
            const parent = yield* fs.stat(root).pipe(Effect.catch(() => Effect.succeed(undefined)))
            if (
              !parent ||
              Option.isNone(parent.ino) ||
              parent.dev !== staging.parent.dev ||
              parent.ino.value !== staging.parent.ino.value
            )
              return
            const current = yield* fs.stat(staging.directory).pipe(Effect.catch(() => Effect.succeed(undefined)))
            if (
              !current ||
              Option.isNone(current.ino) ||
              current.dev !== staging.identity.dev ||
              current.ino.value !== staging.identity.ino.value
            )
              return
            const target = yield* fs.realPath(staging.directory).pipe(Effect.catch(() => Effect.succeed(undefined)))
            if (target !== staging.directory) return
            yield* fs.remove(staging.directory, { recursive: true }).pipe(Effect.orDie)
          }),
        ),
      ).pipe(Effect.flatMap(Fiber.join)),
  ).pipe(Effect.map((staging) => staging.directory))
}

function proposal(): FtcConfiguration.InitializationProposal {
  return {
    kind: "initialization_proposal",
    filename: "ftc-project.json",
    expectedRevision: null,
    manifest: { schemaVersion: 1, hardware: [], managedPathing: "neither" },
  }
}

function decodeManifest(value: unknown): Result.Result<FtcConfiguration.Manifest, FtcConfiguration.ManifestError> {
  if (
    typeof value === "object" &&
    value !== null &&
    "schemaVersion" in value &&
    typeof value.schemaVersion === "number" &&
    value.schemaVersion > 1
  )
    return Result.fail({ code: "unsupported_schema_version" } satisfies FtcConfiguration.ManifestError)
  const decoded = Schema.decodeUnknownOption(FtcConfiguration.Manifest, { onExcessProperty: "error" })(value)
  return Option.isSome(decoded)
    ? Result.succeed(decoded.value)
    : Result.fail({ code: "invalid_manifest" } satisfies FtcConfiguration.ManifestError)
}

function decodeBytes(bytes: Uint8Array): Result.Result<FtcConfiguration.Manifest, FtcConfiguration.ManifestError> {
  const json = Schema.decodeUnknownOption(Schema.UnknownFromJsonString)(
    new TextDecoder("utf-8", { fatal: false }).decode(bytes),
  )
  return Option.isSome(json)
    ? decodeManifest(json.value)
    : Result.fail({ code: "invalid_manifest" } satisfies FtcConfiguration.ManifestError)
}
