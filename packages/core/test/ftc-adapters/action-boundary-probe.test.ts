import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

const fixture = path.join(import.meta.dir, "fixtures/action-boundary/process.ts")
const profile = "(version 1)(allow default)(deny network*)(deny iokit*)"
const sandbox = process.platform === "darwin" && process.env.M9_SANDBOX_EXEC === "1"

async function run(command: string[], restricted = false, env: Record<string, string> = {}) {
  const child = Bun.spawn(restricted ? ["/usr/bin/sandbox-exec", "-p", profile, ...command] : command, {
    env: { PATH: "/usr/bin:/bin", ...env },
    stdout: "pipe",
    stderr: "pipe",
  })
  const timeout = setTimeout(() => child.kill(), 15000)
  try {
    const [exit, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    return { exit, stdout, stderr }
  } finally {
    clearTimeout(timeout)
    child.kill()
  }
}

// The endpoints and payloads are fixtures; children, sockets and OS restrictions are real.
async function probe(mode: "http" | "websocket", restricted: boolean, gradle?: string) {
  const received: string[] = []
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
  const directory = await mkdtemp(path.join(tmpdir(), "m9-07-"))
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
    })
    console.log(JSON.stringify({ mode, restricted, launcher: gradle ? "gradle" : "absolute-bun", ...result, received }))
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
    await rm(directory, { recursive: true, force: true })
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
