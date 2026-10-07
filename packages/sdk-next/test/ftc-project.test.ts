import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Effect } from "effect"
import { create } from "../src/opencode"
import { AbsolutePath } from "@opencode-ai/core/schema"

test("generated Client reaches the disabled embedded FTC host", async () => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "m2-06-sdk-")))
  try {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const client = yield* create()
          const project = yield* client.ftcProjects.open({ root: AbsolutePath.make(root) })
          const chat = yield* client.ftcProjects.createChat({ projectID: project.projectID })
          expect(yield* client.ftcProjects.listChats({ projectID: project.projectID })).toEqual([chat])
          expect(yield* client.ftcProjects.active({ projectID: project.projectID })).toEqual({
            projectID: project.projectID,
          })
          const denied = yield* client.ftcProjects
            .submit({ chat, prompt: { text: "must not execute" }, resume: false })
            .pipe(Effect.flip)
          expect(denied).toMatchObject({ _tag: "FtcProjectApiError", reason: { code: "execution_disabled" } })
          yield* client.ftcProjects.stop(chat)
        }),
      ),
    )
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
}, 20000)
