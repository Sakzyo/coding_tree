import { Effect } from "../../../packages/core/node_modules/effect/dist/index.js"
import { make } from "./fix1-benchmark-base-coordinator"
import { SessionRunCoordinator } from "../../../packages/core/src/session/run-coordinator"

const samples: Record<string, number[]> = { reviewed: [], repaired: [] }
for (let trial = -1; trial < 10; trial++) {
  for (const mode of trial % 2 === 0 ? ["reviewed", "repaired"] : ["repaired", "reviewed"]) {
    const elapsed = await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const coordinator = yield* (mode === "reviewed" ? make : SessionRunCoordinator.make)({
        acquire: () => Effect.addFinalizer(() => Effect.void),
        drain: () => Effect.void,
      })
      const started = performance.now()
      for (let index = 0; index < 1000; index++) {
        if (index % 2 === 0) yield* coordinator.wakeWithSettlement("session", () => Effect.void)
        yield* coordinator.run("session")
      }
      return performance.now() - started
    })))
    if (trial >= 0) samples[mode].push(elapsed)
  }
}
console.log(JSON.stringify({
  baseline: "7dd70f8ae reviewed coordinator; only snapshot imports adjusted",
  measurement: "1000 sequential scoped coordinator lifecycles, 500 bounded tracked callbacks, 10 alternating samples after warmup",
  environment: { bun: Bun.version, platform: process.platform, arch: process.arch },
  samples_ms: samples,
  medians_ms: Object.fromEntries(Object.entries(samples).map(([name, values]) => {
    const sorted = [...values].sort((a, b) => a - b)
    return [name, (sorted[4] + sorted[5]) / 2]
  })),
}, null, 2))

