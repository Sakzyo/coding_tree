export * as Panels from "./panels"

import { Effect, Option, Schema, Scope } from "effect"
import { FtcController } from "@opencode-ai/schema/ftc-controller"

export interface HttpResponse {
  readonly status: number
  readonly contentType: string
  // The transport supplies decoded text, preserving original response metadata.
  readonly body: string
  readonly contentEncoding?: string
}

export interface ReadTransport {
  // Host must enforce GET, no redirects and bounded reads. This is not a raw fetch capability.
  readonly get: (url: string) => Effect.Effect<HttpResponse, FtcController.EndpointError, Scope.Scope>
  // Receive one frame or null at a bounded deadline; never send, queue or reconnect.
  // The host must close its owned socket on scope exit, including cancellation.
  readonly receive: (url: string) => Effect.Effect<string | null, FtcController.EndpointError, Scope.Scope>
}

export function readEndpoints(
  input: {
    readonly revision: string
    readonly httpOrigin: string
    readonly dataOrigin: string
    readonly evidenceKind: "source-derived-fixture" | "controller-observation"
  },
  transport: ReadTransport,
): Effect.Effect<FtcController.ProtocolEvidence, FtcController.EndpointError> {
  return Effect.scoped(
    Effect.gen(function* () {
      if (input.revision !== "11d69a98e39c43a7d9edc5932275897c034f7a30")
        return yield* Effect.fail({ code: "protocol_unknown" as const })
      if (!validOrigin(input.httpOrigin, "http:") || !validOrigin(input.dataOrigin, "ws:"))
        return yield* Effect.fail({ code: "endpoint_invalid" as const })
      const resources: { path: string; state: "observed" | "missing" }[] = []
      const read = (path: string, origin = input.httpOrigin) =>
        transport.get(`${origin}${path}`).pipe(
          Effect.flatMap((response) => {
            if (response.status !== 200) return Effect.fail({ code: "resource_missing" as const, resource: path })
            resources.push({ path, state: "observed" })
            return Effect.succeed(response)
          }),
        )
      for (const path of ["/", "/index.html"]) {
        const page = yield* read(path)
        if (!page.contentType.startsWith("text/html") || !/<(?:!doctype html|html)/i.test(page.body))
          return yield* Effect.fail({ code: "resource_invalid" as const, resource: path })
      }
      const manifest = yield* read("/api/plugins")
      const plugins = yield* json(Plugins, manifest.body, "/api/plugins")
      const digest = yield* read("/api/sha256")
      if (digest.body !== "null" && !/^[a-f0-9]{64}$/.test(digest.body))
        return yield* Effect.fail({ code: "resource_invalid" as const, resource: "/api/sha256" })
      const hashes = yield* read("/api/shas")
      const shas = yield* json(
        Schema.Record(Schema.String, Schema.NullOr(Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)))),
        hashes.body,
        "/api/shas",
      )
      const performance = yield* read("/api/performance")
      yield* json(Performance, performance.body, "/api/performance")
      const records: FtcController.ProtocolEvidence["plugins"][number][] = []
      const blockedPlugins: string[] = []
      if (new Set(plugins.data.plugins.map((plugin) => plugin.details.id)).size !== plugins.data.plugins.length)
        return yield* Effect.fail({ code: "resource_invalid" as const, resource: "/api/plugins" })
      for (const plugin of plugins.data.plugins) {
        const id = plugin.details.id
        if (!knownPlugins.includes(id)) {
          blockedPlugins.push(id)
          continue
        }
        if (plugin.details.pluginsCoreVersion !== "1.1.44")
          return yield* Effect.fail({ code: "protocol_unknown" as const, resource: id })
        const configPath = `/api/configs/${id}`
        const config = yield* read(configPath)
        const details = yield* json(Details, config.body, configPath)
        if (details.id !== id || details.version !== plugin.details.version || details.pluginsCoreVersion !== "1.1.44")
          return yield* Effect.fail({ code: "resource_invalid" as const, resource: configPath })
        const hash = shas[id]
        if (hash === undefined) return yield* Effect.fail({ code: "resource_invalid" as const, resource: "/api/shas" })
        const path = `/api/svelte/${id}`
        if (hash === null) resources.push({ path, state: "missing" })
        if (hash !== null) {
          const bundle = yield* read(path)
          if (
            !bundle.contentType.startsWith("application/javascript") ||
            bundle.contentEncoding !== "gzip" ||
            !bundle.body.trim() ||
            /^\s*</.test(bundle.body)
          )
            return yield* Effect.fail({ code: "resource_invalid" as const, resource: path })
          const checksum = yield* read(`${path}/sha256`)
          if (checksum.body !== hash)
            return yield* Effect.fail({ code: "resource_invalid" as const, resource: `${path}/sha256` })
        }
        records.push({
          id,
          version: plugin.details.version,
          frontendVersion: plugin.details.pluginsCoreVersion,
          svelteHash: hash,
        })
      }
      // Health is advisory only: the pinned server returns OK before socket readiness.
      yield* read("/health", input.dataOrigin.replace(/^ws:/, "http:"))
      const frame = yield* transport.receive(`${input.dataOrigin}/`)
      const sample = frame === null ? undefined : yield* readFrame(frame)
      return {
        profileRevision: input.revision,
        evidenceKind: input.evidenceKind,
        deployment: "unverified" as const,
        identity: "unknown" as const,
        readEndpoints: {
          httpOrigin: input.httpOrigin,
          dataOrigin: input.dataOrigin,
          dashboard: "blocked_unmediated_routes" as const,
          logs: "unknown" as const,
        },
        resources,
        plugins: records,
        blockedPlugins,
        ...(sample === undefined ? {} : { sample }),
        freshness: "unknown" as const,
      }
    }),
  )
}

function validOrigin(value: string, protocol: string) {
  if (!URL.canParse(value)) return false
  const url = new URL(value)
  return (
    url.protocol === protocol &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    url.pathname === "/" &&
    url.origin === value
  )
}

function json<S extends Schema.Top & { readonly DecodingServices: never }>(schema: S, body: string, resource: string) {
  return Schema.decodeUnknownEffect(Schema.UnknownFromJsonString)(body).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(schema)),
    Effect.mapError((): FtcController.EndpointError => ({ code: "resource_invalid", resource })),
  )
}

function readFrame(body: string) {
  return Effect.gen(function* () {
    const sample = yield* json(Frame, body, "websocket").pipe(
      Effect.mapError((): FtcController.EndpointError => ({ code: "frame_invalid" })),
    )
    const key = `${sample.pluginID}/${sample.messageID}`
    const valid =
      key === "core/time"
        ? Option.isSome(
            Schema.decodeUnknownOption(
              Schema.Struct({ time: Schema.String.check(Schema.isPattern(/^\d{2}:\d{2}:\d{2}$/)) }),
            )(sample.data),
          )
        : key === "com.bylazar.telemetry/telemetryPacket"
          ? Option.isSome(Schema.decodeUnknownOption(Schema.Array(Schema.String))(sample.data))
          : key === "com.bylazar.battery/battery"
            ? typeof sample.data === "number" && Number.isFinite(sample.data)
            : undefined
    if (valid === undefined) return yield* Effect.fail({ code: "frame_unsupported" as const })
    if (!valid) return yield* Effect.fail({ code: "frame_invalid" as const })
    return sample
  })
}

const knownPlugins = [
  "com.bylazar.telemetry",
  "com.bylazar.battery",
  "com.bylazar.opmodecontrol",
  "com.bylazar.configurables",
  "com.bylazar.camerastream",
]
const Text = Schema.String.check(Schema.isMinLength(1), Schema.isTrimmed())
const Details = Schema.Struct({
  id: Text,
  version: Text,
  pluginsCoreVersion: Text,
})
const Plugins = Schema.Struct({
  pluginID: Schema.Literal("core"),
  messageID: Schema.Literal("pluginsDetails"),
  data: Schema.Struct({
    plugins: Schema.Array(Schema.Struct({ details: Details, config: Schema.Json })),
    skippedPlugins: Schema.Array(Schema.Json),
  }),
})
const Performance = Schema.Struct({
  pluginID: Schema.Literal("core"),
  messageID: Schema.Literal("performanceReadings"),
  data: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      startNanos: Schema.Number,
      endNanos: Schema.Number,
      durationMillis: Schema.Number,
    }),
  ),
})
const Frame = Schema.Struct({ pluginID: Schema.String, messageID: Schema.String, data: Schema.Json })
