import { Effect, Scope } from "../../../packages/core/node_modules/effect/dist/index.js"
import { Runner } from "../../../packages/opencode/src/effect/runner"
import { BackgroundJob } from "../../../packages/core/src/background-job"

const samples: Record<string, number[]> = { runner: [], background: [] }
for (let sample = -2; sample < 10; sample++) {
  for (const kind of sample % 2 === 0 ? ["runner", "background"] : ["background", "runner"]) {
    const start = performance.now()
    await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const scope = yield* Scope.Scope
      if (kind === "runner") {
        const runner = Runner.make<number>(scope)
        for (let index = 0; index < 1000; index++) yield* runner.ensureRunning(Effect.succeed(index))
        return
      }
      const jobs = yield* BackgroundJob.make
      for (let index = 0; index < 1000; index++) {
        const job = yield* jobs.start({ id: `job_${index}`, type: "benchmark", run: Effect.succeed("done") })
        yield* jobs.wait({ id: job.id })
      }
    })))
    if (sample >= 0) samples[kind].push(performance.now() - start)
  }
}
console.log(JSON.stringify({
  measurement: "1000 actual Runner ensureRunning/completion cycles and 1000 actual BackgroundJob start/wait cycles including owner-scope close; 2 warmup and 10 alternating samples",
  environment: { bun: Bun.version, platform: process.platform, arch: process.arch },
  samples_ms: samples,
  medians_ms: Object.fromEntries(Object.entries(samples).map(([kind, values]) => {
    const sorted = values.toSorted((a, b) => a - b)
    return [kind, (sorted[4] + sorted[5]) / 2]
  })),
  limits: "Local process microbenchmark only; no provider, shell, robot, UI, or production throughput claim. No runtime ownership hooks exist in the baseline."
}, null, 2))
