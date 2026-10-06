import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

const fixture = path.join(import.meta.dir, "fixtures/action-boundary/process.ts")
const profile = "(version 1)(allow default)(deny network*)(deny iokit*)"
const sandbox = process.platform === "darwin" && process.env.M9_SANDBOX_EXEC === "1"

async function run(
  command: string[],
  restricted = false,
  env: Record<string, string> = {},
  options: { timeout?: number; signal?: AbortSignal } = {},
) {
  // Windows needs a separately evaluated Job Object adapter; never claim tree cleanup there.
  if (process.platform === "win32") throw new Error("windows_process_tree_not_evaluated")
  const child = Bun.spawn(restricted ? ["/usr/bin/sandbox-exec", "-p", profile, ...command] : command, {
    detached: true,
    env: { PATH: "/usr/bin:/bin", ...env },
    stdout: "pipe",
    stderr: "pipe",
  })
  const cleanup: { pending?: Promise<void> } = {}
  const stop = () =>
    (cleanup.pending ??= stopGroup(child.pid).catch((cause) => {
      throw new Error("probe_process_group_cleanup_failed", { cause })
    }))
  const cancelled = Promise.withResolvers<never>()
  const cancel = () => {
    void stop().then(() => cancelled.reject(new Error("probe_cancelled")), cancelled.reject)
  }
  const timeout = setTimeout(cancel, options.timeout ?? 15000)
  options.signal?.addEventListener("abort", cancel, { once: true })
  process.once("SIGINT", cancel)
  process.once("SIGTERM", cancel)
  if (options.signal?.aborted) cancel()
  try {
    const [exit, stdout, stderr] = await Promise.race([
      Promise.all([
        // A leader may exit while its descendants retain our output pipes.
        child.exited.then(async (exit) => {
          await stop()
          return exit
        }),
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]),
      cancelled.promise,
    ])
    return { exit, stdout, stderr }
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener("abort", cancel)
    process.removeListener("SIGINT", cancel)
    process.removeListener("SIGTERM", cancel)
    await stop()
  }
}

async function stopGroup(pid: number) {
  if (!signalProcess(-pid, "SIGTERM")) return
  await Bun.sleep(100)
  signalProcess(-pid, "SIGKILL")
  const deadline = Date.now() + 1000
  while (signalProcess(-pid, 0)) {
    if (Date.now() >= deadline) throw new Error("probe_process_group_cleanup_timeout")
    await Bun.sleep(10)
  }
}

function signalProcess(pid: number, signal: 0 | "SIGTERM" | "SIGKILL") {
  try {
    process.kill(pid, signal)
    return true
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ESRCH") return false
    throw error
  }
}

test.skipIf(process.platform === "win32").each(["exit", "timeout", "abort"])(
  "owned process tree is gone after %s, including TERM-resistant inherited-pipe descendants",
  async (mode) => {
    const directory = await mkdtemp(path.join(tmpdir(), "m9-07-tree-"))
    const file = path.join(directory, "pids")
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 150)
    const running = run(
      ["/bin/sh", path.join(import.meta.dir, "fixtures/action-boundary/tree.sh"), file, mode],
      false,
      {},
      { timeout: mode === "timeout" ? 150 : 15000, signal: mode === "abort" ? controller.signal : undefined },
    )
    try {
      const outcome = await Promise.race([
        running.then(
          () => "finished",
          () => "finished",
        ),
        Bun.sleep(2000).then(() => "stalled"),
      ])
      expect(outcome).toBe("finished")
      const pids = (await Bun.file(file).text()).trim().split(" ").map(Number)
      expect(pids).toHaveLength(2)
      for (const pid of pids) expect(() => process.kill(pid, 0)).toThrow()
    } finally {
      clearTimeout(timer)
      // Independent safety cleanup also prevents the intentionally failing RED run leaking a child.
      if (await Bun.file(file).exists()) {
        for (const pid of (await Bun.file(file).text()).trim().split(" ").map(Number)) {
          signalProcess(pid, "SIGKILL")
        }
      }
      await running.catch(() => undefined)
      await rm(directory, { recursive: true, force: true })
    }
  },
  10000,
)

// The endpoints and payloads are fixtures; children, sockets and OS restrictions are real.
async function probe(mode: "http" | "websocket", restricted: boolean, gradle?: string) {
  const received: string[] = []
  const directory = await mkdtemp(path.join(tmpdir(), "m9-07-"))
  const cleanup = { safe: true }
  try {
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request, server) {
        if (server.upgrade(request)) return undefined
        received.push(`${request.method} ${new URL(request.url).pathname}`)
        return new Response(null, { status: 204 })
      },
      websocket: {
        message(socket, message) {
          received.push(String(message))
          socket.send("received")
        },
      },
    })
    try {
      const endpoint = `${mode === "http" ? "http" : "ws"}://127.0.0.1:${server.port}/broker`
      const command = gradle
        ? [gradle, "--offline", "--no-daemon", "--console=plain", "-g", directory, "-p", directory, "boundaryProbe"]
        : [process.execPath, fixture, mode, endpoint]
      if (gradle) {
        await Bun.write(path.join(directory, "settings.gradle"), "rootProject.name = 'm9-07-probe'\n")
        await Bun.write(
          path.join(directory, "build.gradle"),
          "tasks.register('boundaryProbe') { doLast { def c = new URI(System.getenv('M9_ENDPOINT')).toURL().openConnection(); c.requestMethod = 'POST'; c.connectTimeout = 2000; c.readTimeout = 2000; assert c.responseCode == 204 } }\n",
        )
      }
      const result = await run(command, restricted, {
        M9_ENDPOINT: endpoint,
        ...(process.env.M9_JAVA_HOME ? { JAVA_HOME: process.env.M9_JAVA_HOME } : {}),
      }).catch((error) => {
        if (error instanceof Error && error.message === "probe_process_group_cleanup_failed") {
          cleanup.safe = false
          console.error(`Unconfirmed process cleanup; retaining fixture directory: ${directory}`)
        }
        throw error
      })
      console.log(
        JSON.stringify({ mode, restricted, launcher: gradle ? "gradle" : "absolute-bun", ...result, received }),
      )
      if (!restricted) {
        expect(result.exit).toBe(0)
        expect(received).toEqual([mode === "http" ? "POST /broker" : "probe"])
        return
      }
      // Reject failure to launch the sandbox: it is not evidence of a denied operation.
      expect(result.stderr).not.toContain("sandbox_apply")
      expect(result.stdout.trim()).toBe("probe_ready")
      expect(result.stderr).toContain(mode === "http" ? "FailedToOpenSocket" : "websocket_denied")
      expect(result.exit).not.toBe(0)
      expect(received).toEqual([])
    } finally {
      await server.stop(true)
    }
  } finally {
    if (cleanup.safe) await rm(directory, { recursive: true, force: true })
  }
}

test("unrestricted absolute binary reaches owned HTTP broker despite filtered PATH", () => probe("http", false))
test("unrestricted process can send a dashboard-style WebSocket write", () => probe("websocket", false))

test.skipIf(!sandbox)("macOS candidate permits local development subprocess execution", async () => {
  const result = await run([process.execPath, "-e", "console.log(6 * 7)"], true)
  console.log(JSON.stringify({ control: "sandbox-startup", ...result }))
  expect(result.exit).toBe(0)
  expect(result.stdout.trim()).toBe("42")
})

test.skipIf(!sandbox)("macOS candidate denies HTTP access to owned controller/broker fixture", () =>
  probe("http", true),
)
test.skipIf(!sandbox)("macOS candidate denies dashboard-style WebSocket writes", () => probe("websocket", true))

test.skipIf(!process.env.M9_ADB)("real absolute ADB binary executes with filtered PATH (version only)", async () => {
  const result = await run([process.env.M9_ADB!, "version"])
  console.log(JSON.stringify({ control: "adb-version-only", ...result }))
  expect(result.exit).toBe(0)
  expect(result.stdout).toContain("Android Debug Bridge version")
})

test.skipIf(!process.env.M9_GRADLE)(
  "real offline Gradle task reaches owned broker fixture without isolation",
  () => probe("http", false, process.env.M9_GRADLE),
  30000,
)

// These release gates need separate assets/hosts. They must never become a fixture pass.
test.skip("NOT RUN: Windows process, USB, controller/broker and embedded dashboard isolation", () => {})
test.skip("NOT RUN: macOS physical USB API and real controller HTTP/WebSocket denial", () => {})
test.skip("NOT RUN: production extension/MCP descendants and broker capability isolation", () => {})
test.skip("NOT RUN: real Electron embedded controls, preload/IPC, navigation and permissions", () => {})
