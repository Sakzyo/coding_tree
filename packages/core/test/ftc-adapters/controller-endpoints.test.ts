import { expect, test } from "bun:test"
import { Deferred, Effect, Fiber, Schema } from "effect"
import { FtcController } from "@opencode-ai/schema/ftc-controller"
import { Adb } from "../../src/ftc/controllers/adb"

const revision = "11d69a98e39c43a7d9edc5932275897c034f7a30"
const candidate: FtcController.ControllerCandidate = {
  transportAddress: "SYNTHETIC_USB_A",
  adbState: "device",
  authorization: "authorized",
  state: "available",
  errorCodes: [],
  guidanceCodes: [],
}

function forwards(failSecond = false) {
  const active = new Set<number>([49999])
  const requests: unknown[] = []
  const transport: Adb.ForwardTransport = {
    open: (request) =>
      Effect.suspend(() => {
        requests.push(request)
        if (failSecond && requests.length === 2) return Effect.fail({ code: "forward_conflict" as const })
        const localPort = 40000 + requests.length
        active.add(localPort)
        return Effect.succeed({
          localPort,
          close: Effect.sync(() => {
            active.delete(localPort)
          }),
        })
      }),
  }
  return { active, requests, transport }
}

test("scoped forwards select the explicit target and never rebind or remove unrelated forwards", async () => {
  const fixture = forwards()
  const result = await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const routes = yield* Adb.forwardPanels(candidate, revision, fixture.transport)
        expect(fixture.active.size).toBe(3)
        return routes
      }),
    ),
  )
  expect(result).toEqual({ httpOrigin: "http://127.0.0.1:40001", dataOrigin: "ws://127.0.0.1:40002" })
  expect(fixture.requests).toEqual([
    { serial: "SYNTHETIC_USB_A", localPort: 0, remotePort: 8001, noRebind: true },
    { serial: "SYNTHETIC_USB_A", localPort: 0, remotePort: 8002, noRebind: true },
  ])
  expect([...fixture.active]).toEqual([49999])
})

test("second-forward conflict cleans up only the first owned lease", async () => {
  const fixture = forwards(true)
  const result = await Effect.runPromise(
    Effect.scoped(Adb.forwardPanels(candidate, revision, fixture.transport)).pipe(Effect.flip),
  )
  expect(result).toEqual({ code: "forward_conflict" })
  expect([...fixture.active]).toEqual([49999])
})

test.each(["unauthorized", "offline", "unavailable"] as const)("%s candidate is never forwarded", async (state) => {
  const fixture = forwards()
  const result = await Effect.runPromise(
    Effect.scoped(Adb.forwardPanels({ ...candidate, state }, revision, fixture.transport)).pipe(Effect.flip),
  )
  expect(result.code).toBe("candidate_unavailable")
  expect(fixture.requests).toEqual([])
})

test("unknown revisions fail before assuming any controller ports", async () => {
  const fixture = forwards()
  const result = await Effect.runPromise(
    Effect.scoped(Adb.forwardPanels(candidate, "future", fixture.transport)).pipe(Effect.flip),
  )
  expect(result.code).toBe("protocol_unknown")
  expect(fixture.requests).toEqual([])
})

test("cancellation and repeated construction release owned forwards without replay", async () => {
  const fixture = forwards()
  const ready = Deferred.makeUnsafe<void>()
  await Effect.runPromise(
    Effect.gen(function* () {
      const fiber = yield* Effect.scoped(
        Adb.forwardPanels(candidate, revision, fixture.transport).pipe(
          Effect.andThen(Deferred.succeed(ready, undefined)),
          Effect.andThen(Effect.never),
        ),
      ).pipe(Effect.forkChild)
      yield* Deferred.await(ready)
      yield* Fiber.interrupt(fiber)
    }),
  )
  expect([...fixture.active]).toEqual([49999])
  await Effect.runPromise(Effect.scoped(Adb.forwardPanels(candidate, revision, fixture.transport)))
  expect([...fixture.active]).toEqual([49999])
  expect(fixture.requests).toHaveLength(4)
})

test("invalid lease ports fail and release rather than expose unusable routes", async () => {
  const closed: number[] = []
  const result = await Effect.runPromise(
    Effect.scoped(
      Adb.forwardPanels(candidate, revision, {
        open: () =>
          Effect.succeed({
            localPort: 0,
            close: Effect.sync(() => {
              closed.push(0)
            }),
          }),
      }),
    ).pipe(Effect.flip),
  )
  expect(result.code).toBe("forward_invalid")
  expect(closed).toEqual([0])
})

test("endpoint errors are serializable canonical contracts", () => {
  expect(Schema.decodeUnknownSync(FtcController.EndpointError)({ code: "forward_conflict" })).toEqual({
    code: "forward_conflict",
  })
})

import { Panels } from "../../src/ftc/controllers/panels"
import { fixture, input } from "./fixtures/controller-endpoints/fixture"

test("read endpoints record protocol observations without claiming identity, deployment or safe dashboard access", async () => {
  const source = fixture()
  const result = await Effect.runPromise(Panels.readEndpoints(input, source.transport))
  expect(result.readEndpoints).toEqual({
    httpOrigin: input.httpOrigin,
    dataOrigin: input.dataOrigin,
    dashboard: "blocked_unmediated_routes",
    logs: "unknown",
  })
  expect(result.identity).toBe("unknown")
  expect(result.deployment).toBe("unverified")
  expect(result.freshness).toBe("unknown")
  expect(result.evidenceKind).toBe("source-derived-fixture")
  expect(result.plugins[0]).toMatchObject({ id: "com.bylazar.telemetry", version: "1.0.7", frontendVersion: "1.1.44" })
  expect(result.resources).toHaveLength(10)
  expect(source.requests).toContain("http://127.0.0.1:40002/health")
  expect(Schema.decodeUnknownSync(FtcController.ProtocolEvidence)(JSON.parse(JSON.stringify(result)))).toEqual(result)
})

test.each(["/api/plugins", "/api/shas", "/api/configs/com.bylazar.telemetry", "/api/performance"])(
  "HTML fallback with 200 at %s fails validation",
  async (path) => {
    const source = fixture()
    source.resources[path] = source.resources["/"]
    expect(await Effect.runPromise(Panels.readEndpoints(input, source.transport).pipe(Effect.flip))).toMatchObject({
      code: "resource_invalid",
      resource: path,
    })
  },
)

test.each([
  "/",
  "/index.html",
  "/api/plugins",
  "/api/shas",
  "/api/svelte/com.bylazar.telemetry",
  "/api/configs/com.bylazar.telemetry",
])("missing resource %s is not a working endpoint", async (path) => {
  const source = fixture()
  source.resources[path] = { status: 404, contentType: "text/plain", body: "not found" }
  expect(await Effect.runPromise(Panels.readEndpoints(input, source.transport).pipe(Effect.flip))).toMatchObject({
    code: "resource_missing",
    resource: path,
  })
})

test("null plugin hash is missing evidence and never triggers an invented bundle route", async () => {
  const source = fixture()
  source.resources["/api/shas"].body = JSON.stringify({ "com.bylazar.telemetry": null })
  const result = await Effect.runPromise(Panels.readEndpoints(input, source.transport))
  expect(result.plugins[0]?.svelteHash).toBeNull()
  expect(result.resources).toContainEqual({ path: "/api/svelte/com.bylazar.telemetry", state: "missing" })
  expect(source.requests.some((url) => url.includes("/api/svelte/"))).toBe(false)
})

test("unknown frontend version fails rather than promote protocol compatibility", async () => {
  const source = fixture()
  source.plugins.data.plugins[0].details.pluginsCoreVersion = "2.0.0"
  source.resources["/api/plugins"].body = JSON.stringify(source.plugins)
  expect(await Effect.runPromise(Panels.readEndpoints(input, source.transport).pipe(Effect.flip))).toMatchObject({
    code: "protocol_unknown",
  })
})

test("unknown plugins are recorded but their resources are never fetched", async () => {
  const source = fixture()
  source.plugins.data.plugins[0].details.id = "unknown/../../control"
  source.resources["/api/plugins"].body = JSON.stringify(source.plugins)
  const result = await Effect.runPromise(Panels.readEndpoints(input, source.transport))
  expect(result.blockedPlugins).toEqual(["unknown/../../control"])
  expect(source.requests.some((url) => url.includes("/api/configs/") || url.includes("/api/svelte/"))).toBe(false)
})

test("healthy HTTP does not hide a disconnected data socket", async () => {
  const source = fixture()
  expect(
    await Effect.runPromise(
      Panels.readEndpoints(input, {
        ...source.transport,
        receive: () => Effect.fail({ code: "socket_disconnected" }),
      }).pipe(Effect.flip),
    ),
  ).toEqual({ code: "socket_disconnected" })
})

test.each([0, -1, 12.5])("battery value %s is preserved without inventing freshness", async (value) => {
  const source = fixture()
  source.frames.value = JSON.stringify({ pluginID: "com.bylazar.battery", messageID: "battery", data: value })
  const result = await Effect.runPromise(Panels.readEndpoints(input, source.transport))
  expect(result.sample?.data).toBe(value)
  expect(result.freshness).toBe("unknown")
})

test("missing sample is distinct from valid zero and omitted on encoding", async () => {
  const source = fixture()
  source.frames.value = null
  const result = await Effect.runPromise(Panels.readEndpoints(input, source.transport))
  expect("sample" in Schema.encodeSync(FtcController.ProtocolEvidence)(result)).toBe(false)
})

test.each([
  ["core", "pluginReloaded"],
  ["com.bylazar.opmodecontrol", "initOpMode"],
  ["com.bylazar.opmodecontrol", "startActiveOpMode"],
  ["com.bylazar.opmodecontrol", "stopActiveOpMode"],
  ["com.bylazar.configurables", "updatedConfigurable"],
  ["com.bylazar.gamepad", "gamepad0"],
  ["com.bylazar.gamepad", "gamepad1"],
  ["custom", "read"],
  ["com.bylazar.limelightproxy", "status"],
])("unsupported or mutation frame %s/%s is rejected", async (pluginID, messageID) => {
  const source = fixture()
  source.frames.value = JSON.stringify({ pluginID, messageID, data: 0 })
  expect(await Effect.runPromise(Panels.readEndpoints(input, source.transport).pipe(Effect.flip))).toMatchObject({
    code: "frame_unsupported",
  })
})

test.each([
  "not-json",
  '{"pluginID":"com.bylazar.battery","messageID":"battery","data":NaN}',
  '{"pluginID":"com.bylazar.telemetry","messageID":"telemetryPacket","data":0}',
])("malformed frame fails: %s", async (frame) => {
  const source = fixture()
  source.frames.value = frame
  expect(await Effect.runPromise(Panels.readEndpoints(input, source.transport).pipe(Effect.flip))).toMatchObject({
    code: "frame_invalid",
  })
})

test.each([
  "http://user:password@localhost:8001",
  "https://example.org/path",
  "file:///tmp/example",
  "http://localhost:8001/?command=start",
])("unsafe base endpoint %s is rejected before I/O", async (httpOrigin) => {
  const source = fixture()
  expect(
    await Effect.runPromise(Panels.readEndpoints({ ...input, httpOrigin }, source.transport).pipe(Effect.flip)),
  ).toMatchObject({ code: "endpoint_invalid" })
  expect(source.requests).toEqual([])
})

test("same local port cannot describe distinct HTTP and socket forwards", async () => {
  const closed: string[] = []
  const result = await Effect.runPromise(
    Effect.scoped(
      Adb.forwardPanels(candidate, revision, {
        open: (request) =>
          Effect.succeed({
            localPort: 40000,
            close: Effect.sync(() => {
              closed.push(String(request.remotePort))
            }),
          }),
      }),
    ).pipe(Effect.flip),
  )
  expect(result.code).toBe("forward_invalid")
  expect(closed.sort()).toEqual(["8001", "8002"])
})

test("cleanup failure cannot become successful forwarding completion", async () => {
  const exit = await Effect.runPromiseExit(
    Effect.scoped(
      Adb.forwardPanels(candidate, revision, {
        open: (request) =>
          Effect.succeed({ localPort: request.remotePort, close: Effect.fail({ code: "forward_failed" }) }),
      }),
    ),
  )
  expect(exit._tag).toBe("Failure")
})

test.each(["/api/sha256", "/api/shas", "/api/svelte/com.bylazar.telemetry/sha256"])(
  "malformed hash at %s is not accepted as version evidence",
  async (path) => {
    const source = fixture()
    source.resources[path].body = "invalid-hash"
    expect(await Effect.runPromise(Panels.readEndpoints(input, source.transport).pipe(Effect.flip))).toMatchObject({
      code: "resource_invalid",
      resource: path,
    })
  },
)

test("HTML fallback cannot masquerade as a JavaScript plugin resource", async () => {
  const source = fixture()
  source.resources["/api/svelte/com.bylazar.telemetry"] = source.resources["/"]
  expect(await Effect.runPromise(Panels.readEndpoints(input, source.transport).pipe(Effect.flip))).toMatchObject({
    code: "resource_invalid",
  })
})

test("duplicate plugin identities are not merged silently", async () => {
  const source = fixture()
  source.plugins.data.plugins.push(source.plugins.data.plugins[0])
  source.resources["/api/plugins"].body = JSON.stringify(source.plugins)
  expect(await Effect.runPromise(Panels.readEndpoints(input, source.transport).pipe(Effect.flip))).toMatchObject({
    code: "resource_invalid",
    resource: "/api/plugins",
  })
})

test("cancellation closes the scoped receive resource without reconnecting", async () => {
  const source = fixture()
  const active = new Set<object>()
  const ready = Deferred.makeUnsafe<void>()
  const opened: object[] = []
  await Effect.runPromise(
    Effect.gen(function* () {
      const fiber = yield* Panels.readEndpoints(input, {
        ...source.transport,
        receive: () =>
          Effect.acquireRelease(
            Effect.sync(() => {
              const token = {}
              active.add(token)
              opened.push(token)
              return token
            }),
            (token) =>
              Effect.sync(() => {
                active.delete(token)
              }),
          ).pipe(Effect.andThen(Deferred.succeed(ready, undefined)), Effect.andThen(Effect.never)),
      }).pipe(Effect.forkChild)
      yield* Deferred.await(ready)
      expect(active.size).toBe(1)
      yield* Fiber.interrupt(fiber)
    }),
  )
  expect(active.size).toBe(0)
  expect(opened).toHaveLength(1)
})

test("textual telemetry preserves empty packets and valid textual zero", async () => {
  const source = fixture()
  source.frames.value = JSON.stringify({
    pluginID: "com.bylazar.telemetry",
    messageID: "telemetryPacket",
    data: ["sensor: 0"],
  })
  expect((await Effect.runPromise(Panels.readEndpoints(input, source.transport))).sample?.data).toEqual(["sensor: 0"])
  source.frames.value = JSON.stringify({ pluginID: "com.bylazar.telemetry", messageID: "telemetryPacket", data: [] })
  expect((await Effect.runPromise(Panels.readEndpoints(input, source.transport))).sample?.data).toEqual([])
})

test("unrecognized read profile never probes guessed endpoints", async () => {
  const source = fixture()
  expect(
    await Effect.runPromise(Panels.readEndpoints({ ...input, revision: "future" }, source.transport).pipe(Effect.flip)),
  ).toEqual({ code: "protocol_unknown" })
  expect(source.requests).toEqual([])
})

test.each([
  ["id", " "],
  ["id", " com.bylazar.telemetry "],
  ["id", " unknown.plugin "],
  ["version", " "],
  ["version", " 1.0.7 "],
  ["version", "\t\n"],
  ["pluginsCoreVersion", " "],
  ["pluginsCoreVersion", " 1.1.44 "],
] as const)("rejects noncanonical plugin %s declaration %j without normalization", async (field, value) => {
  const source = fixture()
  source.plugins.data.plugins[0].details[field] = value
  source.resources["/api/plugins"].body = JSON.stringify(source.plugins)
  source.resources["/api/configs/com.bylazar.telemetry"].body = JSON.stringify(source.plugins.data.plugins[0].details)
  const result = await Effect.runPromiseExit(Panels.readEndpoints(input, source.transport))
  expect(result._tag).toBe("Failure")
  expect(await Effect.runPromise(Panels.readEndpoints(input, source.transport).pipe(Effect.flip))).toEqual({
    code: "resource_invalid",
    resource: "/api/plugins",
  })
})
