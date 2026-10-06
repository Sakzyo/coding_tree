import { expect, test } from "bun:test"
import { Effect } from "effect"
import { FtcController } from "@opencode-ai/schema/ftc-controller"
import { Adb } from "../../src/ftc/controllers/adb"
import { Panels } from "../../src/ftc/controllers/panels"
import { input } from "../ftc-adapters/fixtures/controller-endpoints/fixture"
import { loopback } from "../ftc-adapters/fixtures/controller-endpoints/loopback"

const candidate: FtcController.ControllerCandidate = {
  transportAddress: "SYNTHETIC_USB_A",
  adbState: "device",
  authorization: "authorized",
  state: "available",
  errorCodes: [],
  guidanceCodes: [],
}

test("source-derived protocol resolves HTTP, gzip plugin assets and receive-only data through owned TCP forwards", async () => {
  const local = loopback()
  try {
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const routes = yield* Adb.forwardPanels(candidate, input.revision, local.forward)
          expect(local.forwards.size).toBe(2)
          return yield* Panels.readEndpoints({ ...input, ...routes }, local.reads)
        }),
      ),
    )
    expect(result.resources.filter((resource) => resource.state === "observed")).toHaveLength(10)
    expect(result.sample).toEqual({ pluginID: "core", messageID: "time", data: { time: "12:00:00" } })
    expect(result.readEndpoints.dashboard).toBe("blocked_unmediated_routes")
    expect(new URL(result.readEndpoints.httpOrigin).port).not.toBe(new URL(result.readEndpoints.dataOrigin).port)
    expect(result.evidenceKind).toBe("source-derived-fixture")
    expect(local.received).toEqual([])
    expect(local.sockets.size).toBe(0)
    expect(local.forwards.size).toBe(0)
  } finally {
    await local.close()
  }
})

test("health 200 with socket 503 fails and closes both owned forwards", async () => {
  const local = loopback(true)
  try {
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const routes = yield* Adb.forwardPanels(candidate, input.revision, local.forward)
          return yield* Panels.readEndpoints({ ...input, ...routes }, local.reads)
        }),
      ).pipe(Effect.flip),
    )
    expect(result.code).toBe("socket_disconnected")
    expect(local.sockets.size).toBe(0)
    expect(local.forwards.size).toBe(0)
    expect(local.received).toEqual([])
  } finally {
    await local.close()
  }
})

test("two synthetic controllers with identical software remain unknown identities on isolated routes", async () => {
  const first = loopback()
  const second = loopback(false, "SYNTHETIC_USB_B")
  try {
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const a = yield* Adb.forwardPanels(candidate, input.revision, first.forward)
          const b = yield* Adb.forwardPanels(
            { ...candidate, transportAddress: "SYNTHETIC_USB_B" },
            input.revision,
            second.forward,
          )
          expect(a.httpOrigin).not.toBe(b.httpOrigin)
          expect(a.dataOrigin).not.toBe(b.dataOrigin)
          return yield* Effect.all([
            Panels.readEndpoints({ ...input, ...a }, first.reads),
            Panels.readEndpoints({ ...input, ...b }, second.reads),
          ])
        }),
      ),
    )
    expect(result[0].plugins).toEqual(result[1].plugins)
    expect(result.map((entry) => entry.identity)).toEqual(["unknown", "unknown"])
    expect(first.forwards.size + second.forwards.size).toBe(0)
  } finally {
    await first.close()
    await second.close()
  }
})

test.skip("NOT RUN: real Control Hub and phone USB/Wi-Fi HTTP/WebSocket/plugin matrix", () => {})
test.skip("NOT RUN: Windows ADB forwarding, conflicts, cancellation and resource cleanup", () => {})
test.skip("NOT RUN: stable physical identity, alias convergence and deployed-build association", () => {})
test.skip("NOT RUN: real robot logs and telemetry source/freshness across disconnect", () => {})
test.skip("NOT RUN: Electron dashboard mediation, fixed-port routing, extra plugins and no-replay", () => {})
