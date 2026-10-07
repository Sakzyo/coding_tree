// Scoped lifecycle benchmark; no renderer, model stream, filesystem, or robot timing.
import { Effect, Layer, LayerMap } from "../../../packages/core/node_modules/effect/dist/index.js"
import { SessionExecutionLocal } from "../../../packages/core/src/session/execution/local"
import { SessionRunner } from "../../../packages/core/src/session/runner"
import { FtcAgentGate } from "../../../packages/core/src/ftc/agent/gate"
import { make } from "./benchmark-base-local"

const trials = 10
const iterations = 1000
const session = { id: "ses_benchmark", location: { directory: "/benchmark" } }
const chat = { projectID: "association", chatID: "chat_benchmark", sessionID: session.id }
const managed = {
  resolve: () => Effect.succeed({ kind: "managed", chat }),
  acquire: () => Effect.succeed({ kind: "acquired", lease: { projectKey: "/benchmark", ...chat, token: "gate_benchmark" } }),
  release: () => Effect.void,
}
const samples: Record<string, number[]> = { baseline: [], unmanaged: [], managed: [], tracked: [] }

for (let trial = -1; trial < trials; trial++) {
  for (const mode of trial % 2 === 0 ? ["baseline", "unmanaged", "managed", "tracked"] : ["tracked", "managed", "unmanaged", "baseline"]) {
    const elapsed = await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const locations = yield* LayerMap.make(() => Layer.succeed(SessionRunner.Service, {run: () => Effect.void}))
      const input = { store: {get: () => Effect.succeed(session)}, locations, gate: (mode === "managed" || mode === "tracked") ? managed : FtcAgentGate.unmanaged }
      const execution = yield* (mode === "baseline" ? make(input) : SessionExecutionLocal.make(input))
      const start = performance.now()
      for (let index = 0; index < iterations; index++) {
        if (index % 2 === 0) yield* (mode === "tracked" ? execution.wakeWithSettlement(session.id, () => Effect.void) : execution.wake(session.id))
        yield* execution.resume(session.id)
      }
      return performance.now() - start
    })))
    if (trial >= 0) samples[mode].push(elapsed)
  }
}
console.log(JSON.stringify({
  trials, iterations, measurement: "1000 sequential local lifecycles per sample, alternating explicit resume and advisory wake plus resume join; tracked mode attaches 500 terminal callbacks per sample",
  baseline: "6620d1bc1 dispatch current local implementation and coordinator",
  samples_ms: samples,
  medians_ms: Object.fromEntries(Object.entries(samples).map(([mode, values]) => {
    const sorted = [...values].sort((a,b)=>a-b)
    return [mode, (sorted[4] + sorted[5])/2]
  })),
  environment: {bun: Bun.version, platform: process.platform, arch: process.arch},
}, null, 2))
