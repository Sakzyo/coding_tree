import { Global } from "@opencode-ai/core/global"
import { LegacyActivity } from "../../src/session/legacy-activity"
import { HttpRouter } from "effect/unstable/http"
import { SessionCompaction } from "../../src/session/compaction"
import { expect, test } from "bun:test"
import { Context, Effect, Layer } from "effect"
import { HttpApiApp } from "../../src/server/routes/instance/httpapi/server"
import { AppRuntime } from "../../src/effect/app-runtime"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { SessionPrompt } from "../../src/session/prompt"
import { SessionID, MessageID } from "../../src/session/schema"
import { ModelV2 } from "@opencode-ai/core/model"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { provideInstanceEffect, tmpdir, disposeAllInstances } from "../fixture/fixture"

const context = Context.makeUnsafe<unknown>(new Map())

test("actual OpenCode host activates an idle root and denies all managed legacy execution entrances", async () => {
  await using tmp = await tmpdir()
  const web = HttpApiApp.webHandler()
  const call = (route: string, payload?: unknown) =>
    web.handler(
      new Request(`http://localhost${route}`, {
        method: payload === undefined ? "GET" : "POST",
        headers: { "content-type": "application/json", "x-opencode-directory": tmp.path },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      }),
      context,
    )
  try {
    const opening = await call("/api/ftc/project/open", { root: tmp.path })
    expect(opening.status).toBe(200)
    const activated = await opening.json()
    expect(activated.canonicalRoot).toBe(tmp.path)
    const legacy = await call("/session", {})
    expect(legacy.status).toBe(200)
    const saved = await legacy.json()
    const project = activated
    expect((await call("/api/ftc/project/open", { root: tmp.path })).status).toBe(200)
    const chatResponse = await call("/api/ftc/project/chat", { projectID: project.projectID })
    expect(chatResponse.status).toBe(200)
    const chat = await chatResponse.json()
    expect((await call("/api/ftc/project/submit", { chat, prompt: { text: "disabled" } })).status).toBe(409)
    const raw = await call(`/api/session/${chat.sessionID}/prompt`, { prompt: { text: "disabled" }, resume: false })
    expect(raw.status).toBeGreaterThanOrEqual(400)
    expect(await raw.json()).toMatchObject({ code: "execution_disabled" })
    const model = { providerID: "test", modelID: "test" }
    const calls = [
      ["message", { parts: [{ type: "text", text: "disabled" }], model }],
      ["prompt_async", { parts: [{ type: "text", text: "disabled" }], model }],
      ["command", { command: "init", arguments: "", model: "test/test" }],
      ["shell", { command: "must-not-run", model, agent: "build" }],
      ["summarize", model],
      ["init", { ...model, messageID: MessageID.ascending() }],
    ] as const
    for (const [route, payload] of calls)
      expect((await call(`/session/${saved.id}/${route}`, payload)).status).toBe(400)
    expect((await call(`/session/${saved.id}`)).status).toBe(200)
    const history = await call(`/session/${saved.id}/message`)
    expect(history.status).toBe(200)
    expect(await history.json()).toEqual([])
    const results = await AppRuntime.runPromise(
      Effect.gen(function* () {
        const prompts = yield* SessionPrompt.Service
        const compaction = yield* SessionCompaction.Service
        const sessionID = SessionID.make(saved.id)
        return yield* Effect.all([
          prompts.prompt({ sessionID, parts: [{ type: "text", text: "disabled" }], noReply: true }).pipe(Effect.flip),
          prompts.loop({ sessionID }).pipe(Effect.flip),
          prompts
            .shell({
              sessionID,
              command: "must-not-run",
              agent: "build",
              model: { providerID: ProviderV2.ID.make("test"), modelID: ModelV2.ID.make("test") },
            })
            .pipe(Effect.flip),
          prompts.command({ sessionID, command: "init", arguments: "" }).pipe(Effect.flip),
          compaction
            .create({
              sessionID,
              agent: "build",
              model: { providerID: ProviderV2.ID.make("test"), modelID: ModelV2.ID.make("test") },
              auto: false,
            })
            .pipe(Effect.flip),
          compaction
            .process({ sessionID, parentID: MessageID.ascending(), messages: [], auto: false })
            .pipe(Effect.flip),
        ])
      }).pipe(provideInstanceEffect(tmp.path)),
    )
    expect(results).toHaveLength(6)
    results.forEach((error) => expect(error).toMatchObject({ code: "legacy_execution_disabled" }))
  } finally {
    await disposeAllInstances()
    await web.dispose()
  }
}, 30000)

test("actual AppRuntime and fresh listener graph exclude association while web handler keeps its owner", async () => {
  await using tmp = await tmpdir()
  const web = HttpApiApp.webHandler()
  const fresh = HttpRouter.toWebHandler(HttpApiApp.createRoutes(), {
    memoMap: Layer.makeMemoMapUnsafe(),
    disableLogger: true,
  })
  const owner = await AppRuntime.runPromise(LegacyActivity.Service)
  const root = AbsolutePath.make(tmp.path)
  const lease = await AppRuntime.runPromise(owner.acquire(root, Effect.void))
  const call = (handler: typeof web.handler) =>
    handler(
      new Request("http://localhost/api/ftc/project/open", {
        method: "POST",
        headers: { "content-type": "application/json", "x-opencode-directory": tmp.path },
        body: JSON.stringify({ root }),
      }),
      context,
    )
  try {
    expect((await call(fresh.handler)).status).toBe(409)
    expect((await call(web.handler)).status).toBe(409)
    await fresh.dispose()
    expect((await call(web.handler)).status).toBe(409)
    await AppRuntime.runPromise(owner.release(lease))
    expect((await call(web.handler)).status).toBe(200)
  } finally {
    await AppRuntime.runPromise(owner.release(lease))
    await fresh.dispose()
    await disposeAllInstances()
    await web.dispose()
  }
}, 30000)

test("actual prompt_async holds accepted work through paused admission and noReply completion", async () => {
  await using tmp = await tmpdir({
    init: async (directory) => {
      await Bun.write(`${Global.Path.config}/node_modules/.fixture`, "local fixture")
      await Bun.write(
        `${Global.Path.config}/package-lock.json`,
        JSON.stringify({ packages: { "": { dependencies: { "@opencode-ai/plugin": "local" } } } }),
      )
      const plugin = `${directory}/pause.mjs`
      await Bun.write(
        plugin,
        `export default async () => ({ "chat.message": async () => { await Bun.write(${JSON.stringify(directory + "/entered")}, "ready"); while (!(await Bun.file(${JSON.stringify(directory + "/release")}).exists())) await Bun.sleep(5) } })`,
      )
      await Bun.write(`${directory}/opencode.json`, JSON.stringify({ plugin: [`file://${plugin}`] }))
    },
  })
  const web = HttpRouter.toWebHandler(HttpApiApp.createRoutes(), {
    memoMap: Layer.makeMemoMapUnsafe(),
    disableLogger: true,
  })
  const call = (route: string, payload?: unknown) =>
    web.handler(
      new Request(`http://localhost${route}`, {
        method: payload === undefined ? "GET" : "POST",
        headers: { "content-type": "application/json", "x-opencode-directory": tmp.path },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      }),
      context,
    )
  try {
    const session = await (await call("/session", {})).json()
    const accepted = await call(`/session/${session.id}/prompt_async`, {
      noReply: true,
      model: { providerID: "test", modelID: "test" },
      parts: [{ type: "text", text: "accepted" }],
    })
    expect(accepted.status).toBe(204)
    expect((await call("/api/ftc/project/open", { root: tmp.path })).status).toBe(409)
    await Effect.runPromise(
      Effect.promise(() => Bun.file(`${tmp.path}/entered`).exists()).pipe(
        Effect.repeat({ until: (ready) => ready, schedule: undefined }),
        Effect.timeout("5 seconds"),
      ),
    )
    expect((await call("/api/ftc/project/open", { root: tmp.path })).status).toBe(409)
    await Bun.write(`${tmp.path}/release`, "release")
    await Effect.runPromise(
      Effect.promise(async () => (await call(`/session/${session.id}/message`)).json()).pipe(
        Effect.repeat({ until: (messages) => messages.length === 1 }),
        Effect.timeout("5 seconds"),
      ),
    )
    const opened = await call("/api/ftc/project/open", { root: tmp.path })
    expect(opened.status).toBe(200)
  } finally {
    await Bun.write(`${tmp.path}/release`, "release")
    await disposeAllInstances()
    await web.dispose()
  }
}, 15000)
