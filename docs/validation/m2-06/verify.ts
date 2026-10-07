import { mkdir, open } from "node:fs/promises"
import path from "node:path"

const root = path.resolve(import.meta.dir, "../../..")
const bun = "/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun"
const records: object[] = []
const environment = {
  ...process.env,
  PATH: path.dirname(bun) + ":" + process.env.PATH,
  OPENCODE_DISABLE_MODELS_FETCH: "true",
  OPENCODE_DISABLE_DEFAULT_PLUGINS: "true",
}
async function check(pkg: string, name: string, args: string[]) {
  const prefix = "/private/tmp/m2-06-freeze/" + pkg
  const env = {
    ...environment,
    OPENCODE_TEST_HOME: prefix + "/home",
    XDG_DATA_HOME: prefix + "/data",
    XDG_CACHE_HOME: prefix + "/cache",
    XDG_CONFIG_HOME: prefix + "/config",
    XDG_STATE_HOME: prefix + "/state",
  }
  await mkdir(prefix, { recursive: true })
  const cwd = path.join(root, "packages", pkg)
  const log = path.join(import.meta.dir, "freeze-" + name + ".log")
  const file = await open(log, "w")
  const child = Bun.spawn([bun, ...args], { cwd, env, stdout: file.fd, stderr: file.fd })
  const exit = await child.exited
  await file.close()
  records.push({
    cwd,
    command: [bun, ...args],
    environment: Object.fromEntries(
      Object.entries(env).filter(([key]) => /^(OPENCODE_TEST_HOME|XDG_|OPENCODE_DISABLE_)/.test(key)),
    ),
    exit,
    log: path.relative(root, log),
  })
  console.log(JSON.stringify({ name, exit }))
}
await check("client", "generate", ["run", "generate"])
await Promise.all(
  ["core", "schema", "protocol", "server", "opencode", "client", "sdk-next"].map((pkg) =>
    check(pkg, pkg + "-types", ["typecheck"]),
  ),
)
await check("core", "core-tests", [
  "test",
  "./test/ftc-integration/m2-06.test.ts",
  "./test/session-tracked-wake.test.ts",
  "./test/ftc/projects-and-chats/m2-01.test.ts",
  "./test/ftc/projects-and-chats/m2-02.test.ts",
  "./test/ftc/projects-and-chats/m2-03.test.ts",
  "./test/ftc/projects-and-chats/m2-04.test.ts",
  "./test/ftc/projects-and-chats/m2-05.test.ts",
  "./test/ftc/agent-and-context/m3-02.test.ts",
  "./test/session-prompt.test.ts",
  "./test/session-runner.test.ts",
  "./test/session-run-coordinator.test.ts",
  "./test/session-runner-recorded.test.ts",
])
await check("schema", "schema-tests", [
  "test",
  "./test/ftc-project-api.test.ts",
  "./test/ftc-submission.test.ts",
  "./test/contract-hygiene.test.ts",
  "./test/v1-isolation.test.ts",
])
await check("schema", "schema-baseline", ["test", "./test/event-manifest.test.ts"])
await check("server", "server-tests", ["test", "./test/ftc-project.test.ts"])
await check("opencode", "opencode-host", ["test", "./test/server/httpapi-ftc-project.test.ts"])
await check("client", "client-tests", ["test", "./test"])
await check("sdk-next", "sdk-tests", ["test", "./test/ftc-project.test.ts"])
await Bun.write(path.join(import.meta.dir, "freeze-commands.json"), JSON.stringify(records, null, 2) + "\n")
