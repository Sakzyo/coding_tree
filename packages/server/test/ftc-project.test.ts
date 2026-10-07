import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Layer } from "effect"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { PermissionSaved } from "@opencode-ai/core/permission/saved"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { createEmbeddedRoutes } from "../src/routes"

test("actual standalone and embedded host exposes project commands and refuses managed admission", async () => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "m2-06-host-")))
  const web = HttpRouter.toWebHandler(
    createEmbeddedRoutes().pipe(
      HttpRouter.provideRequest(AppNodeBuilder.build(PermissionSaved.node)),
      Layer.provide(HttpServer.layerServices),
    ),
    {
      disableLogger: true,
    },
  )
  const call = (route: string, payload: unknown) =>
    web.handler(
      new Request(`http://localhost${route}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
    )
  try {
    const opened = await call("/api/ftc/project/open", { root })
    expect(opened.status).toBe(200)
    const project = await opened.json()
    const created = await call("/api/ftc/project/chat", { projectID: project.projectID })
    expect(created.status).toBe(200)
    const chat = await created.json()
    expect((await call("/api/ftc/project/chat/read", chat)).status).toBe(200)
    for (const resume of [true, false]) {
      const submitted = await call("/api/ftc/project/submit", { chat, prompt: { text: "refused" }, resume })
      expect(submitted.status).toBe(409)
      expect(await submitted.json()).toMatchObject({ reason: { code: "execution_disabled" } })
      const raw = await call(`/api/session/${chat.sessionID}/prompt`, { prompt: { text: "raw refused" }, resume })
      expect(raw.status).toBeGreaterThanOrEqual(400)
      expect(await raw.json()).toMatchObject({ code: "execution_disabled" })
    }
    expect((await call("/api/ftc/project/resume", chat)).status).toBe(409)
    expect((await call("/api/ftc/project/stop", chat)).status).toBe(204)
    const history = await web.handler(new Request(`http://localhost/api/session/${chat.sessionID}/message`))
    expect(history.status).toBe(200)
    expect(JSON.stringify(await history.json())).not.toContain("refused")
    const active = await call("/api/ftc/project/active", project)
    expect(await active.json()).toEqual({ projectID: project.projectID })
  } finally {
    await web.dispose()
    await fs.rm(root, { recursive: true, force: true })
  }
}, 20000)
