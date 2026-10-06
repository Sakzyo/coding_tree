// Source-derived, non-live protocol shapes. Asset bytes, hashes and device values
// are synthetic; see provenance.md. No upstream executable bundle is included.
import { Effect } from "effect"
import { Panels } from "../../../../src/ftc/controllers/panels"

export const input = {
  revision: "11d69a98e39c43a7d9edc5932275897c034f7a30",
  httpOrigin: "http://127.0.0.1:40001",
  dataOrigin: "ws://127.0.0.1:40002",
  evidenceKind: "source-derived-fixture" as const,
}

export function fixture() {
  const hash = "a".repeat(64)
  const details = {
    id: "com.bylazar.telemetry",
    name: "Telemetry",
    letterName: "T",
    description: "synthetic fixture",
    websiteURL: "",
    mavenURL: "",
    packageString: "",
    version: "1.0.7",
    pluginsCoreVersion: "1.1.44",
    author: "",
    components: [],
    manager: "",
    templates: [],
    includedPluginsIDs: [],
    changelog: [],
  }
  const plugins = {
    pluginID: "core",
    messageID: "pluginsDetails",
    data: { plugins: [{ details, config: { telemetryUpdateInterval: 75 } }], skippedPlugins: [] },
  }
  const resources: Record<string, { -readonly [K in keyof Panels.HttpResponse]: Panels.HttpResponse[K] }> = {
    "/": { status: 200, contentType: "text/html", body: "<!doctype html><title>synthetic Panels fixture</title>" },
    "/index.html": {
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>synthetic Panels fixture</title>",
    },
    "/api/plugins": { status: 200, contentType: "text/html", body: JSON.stringify(plugins) },
    "/api/sha256": { status: 200, contentType: "text/plain", body: hash },
    "/api/shas": {
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ "com.bylazar.telemetry": hash }),
    },
    "/api/performance": {
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        pluginID: "core",
        messageID: "performanceReadings",
        data: [{ id: "fixture", startNanos: 0, endNanos: 0, durationMillis: 0 }],
      }),
    },
    "/api/svelte/com.bylazar.telemetry": {
      status: 200,
      contentType: "application/javascript",
      contentEncoding: "gzip",
      body: "export const fixture = true;",
    },
    "/api/svelte/com.bylazar.telemetry/sha256": { status: 200, contentType: "text/plain", body: hash },
    "/api/configs/com.bylazar.telemetry": {
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(details),
    },
    "/health": { status: 200, contentType: "text/plain", body: "OK" },
  }
  const requests: string[] = []
  const frames = {
    value: JSON.stringify({ pluginID: "core", messageID: "time", data: { time: "12:00:00" } }) as string | null,
  }
  const transport: Panels.ReadTransport = {
    get: (url) =>
      Effect.sync(() => {
        requests.push(url)
        return resources[new URL(url).pathname] ?? { status: 404, contentType: "text/plain", body: "missing" }
      }),
    receive: () => Effect.succeed(frames.value),
  }
  return { resources, requests, frames, transport, plugins }
}
