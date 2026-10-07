import { expect, test } from "bun:test"
import { Context, Effect } from "effect"
import { HttpApiApp } from "../../src/server/routes/instance/httpapi/server"
import { AppRuntime } from "../../src/effect/app-runtime"
import { Database } from "@opencode-ai/core/database/database"
import { ProjectV2 } from "@opencode-ai/core/project"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { ProjectAssociations } from "@opencode-ai/core/ftc/projects/sql"
import { FtcProjectAdapters } from "@opencode-ai/core/ftc/projects/adapters"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { SessionPrompt } from "../../src/session/prompt"
import { SessionID, MessageID } from "../../src/session/schema"
import { ModelV2 } from "@opencode-ai/core/model"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { provideInstanceEffect, tmpdir, disposeAllInstances } from "../fixture/fixture"

const context = Context.makeUnsafe<unknown>(new Map())

test("actual OpenCode host denies unfenced activation and all managed legacy execution entrances", async () => {
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
    expect(opening.status).toBe(409)
    expect(await opening.json()).toMatchObject({ reason: { code: "activation_unavailable" } })
    const legacy = await call("/session", {})
    expect(legacy.status).toBe(200)
    const saved = await legacy.json()
    // Seed only the existing association fixture, without claiming host activation succeeded.
    const project = await AppRuntime.runPromise(
      Effect.gen(function* () {
        const database = yield* Database.Service
        const host = yield* ProjectV2.Service.pipe(Effect.provide(AppNodeBuilder.build(ProjectV2.node)))
        const folder = yield* FtcProjectAdapters.folders(host).resolve({ root: AbsolutePath.make(tmp.path) })
        return yield* ProjectAssociations.make(database.db).associate(folder)
      }),
    )
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
        ])
      }).pipe(provideInstanceEffect(tmp.path)),
    )
    expect(results).toHaveLength(4)
    results.forEach((error) => expect(error).toMatchObject({ code: "legacy_execution_disabled" }))
  } finally {
    await disposeAllInstances()
    await web.dispose()
  }
}, 30000)
