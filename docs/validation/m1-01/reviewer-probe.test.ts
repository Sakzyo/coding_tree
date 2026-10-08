import { afterEach, expect, test } from "bun:test"
import { createRequire } from "node:module"
import { createComponent, render } from "/Users/dylanxu/coding_tree/packages/app/node_modules/solid-js/web/dist/web.js"
import { createEffect, onCleanup } from "/Users/dylanxu/coding_tree/packages/app/node_modules/solid-js/dist/solid.js"
import { createStore } from "/Users/dylanxu/coding_tree/packages/app/node_modules/solid-js/store/dist/store.js"
import { FtcProject } from "/Users/dylanxu/coding_tree/packages/schema/src/ftc-project"
import { Project } from "/Users/dylanxu/coding_tree/packages/schema/src/project"
import { Session } from "/Users/dylanxu/coding_tree/packages/schema/src/session"
import { SessionInput } from "/Users/dylanxu/coding_tree/packages/schema/src/session-input"
import { SessionMessage } from "/Users/dylanxu/coding_tree/packages/schema/src/session-message"
import { DateTime } from "/Users/dylanxu/coding_tree/packages/app/node_modules/effect"
import { Location } from "/Users/dylanxu/coding_tree/packages/schema/src/location"
import { AbsolutePath } from "/Users/dylanxu/coding_tree/packages/schema/src/schema"
import type { WorkspaceChatView, WorkspaceLanguage, WorkspacePorts } from "/Users/dylanxu/coding_tree/packages/app/src/ftc/facades"
import { dict } from "/Users/dylanxu/coding_tree/packages/app/src/i18n/en"
const zh = await import("/Users/dylanxu/coding_tree/packages/app/src/i18n/zh")

const compiler = createRequire(createRequire("/Users/dylanxu/coding_tree/packages/app/package.json").resolve("vite-plugin-solid"))
const babel = compiler("@babel/core")
Bun.plugin({
  name: "m1-01-solid-dom",
  setup(build) {
    build.onLoad({ filter: /\/packages\/app\/src\/ftc\/workspace\.tsx$/ }, async (args) => {
      const result = babel.transformSync(await Bun.file(args.path).text(), {
        filename: args.path,
        babelrc: false,
        configFile: false,
        presets: [
          [compiler.resolve("babel-preset-solid"), { generate: "dom", hydratable: false }],
          compiler.resolve("@babel/preset-typescript"),
        ],
      })
      if (!result?.code) throw new Error("Missing compiled workspace")
      return { contents: result.code, loader: "js" }
    })
  },
})
const { FtcWorkspace } = await import("/Users/dylanxu/coding_tree/packages/app/src/ftc/workspace")

const project = (name: string) =>
  FtcProject.ProjectContext.make({
    projectID: Project.ID.make(`project_${name}`),
    canonicalRoot: AbsolutePath.make(`/prepared/${name}`),
    location: new Location.Info({
      directory: AbsolutePath.make(`/prepared/${name}`),
      project: { id: Project.ID.make(`host_${name}`), directory: AbsolutePath.make(`/prepared/${name}`) },
    }),
  })
const a = project("a")
const b = project("b")
const chat = (context: FtcProject.ProjectContext, name: string) =>
  FtcProject.ChatRef.make({
    projectID: context.projectID,
    chatID: FtcProject.ChatID.make(`chat_${name}`),
    sessionID: Session.ID.make(`ses_${name}`),
  })
const a1 = chat(a, "a1")
const a2 = chat(a, "a2")
const b1 = chat(b, "b1")
const flush = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0))
}
const cleanups: (() => void)[] = []
afterEach(() => cleanups.splice(0).forEach((dispose) => dispose()))

function fixture(options: Partial<WorkspacePorts> = {}, projects = [a, b]) {
  const submittedDrafts: FtcProject.SubmitPrompt[] = []
  const stopped: FtcProject.ChatRef[] = []
  const listeners = new Map<string, (status: FtcProject.OwnerStatus) => void>()
  const histories: string[] = []
  const disposed: string[] = []
  const views: WorkspaceChatView[] = []
  const [locale, setLocale] = createStore({ chinese: false })
  const language: WorkspaceLanguage = {
    t: (key, params) => {
      const source: Record<string, string> = locale.chinese ? zh.dict : dict
      const value = source[key] ?? key
      return Object.entries(params ?? {}).reduce(
        (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
        value,
      )
    },
  }
  const ports: WorkspacePorts = {
    selectFolder: async () => ({ root: b.canonicalRoot }),
    create: async () => b,
    open: async () => b,
    listChats: async (request) => (request.projectID === a.projectID ? [a1, a2] : [b1]),
    createChat: async () => a2,
    active: async (request) => ({
      projectID: request.projectID,
      active: request.projectID === a.projectID ? a2 : undefined,
    }),
    subscribeOwner: (request, receive) => {
      listeners.set(request.projectID, receive)
      return () => listeners.delete(request.projectID)
    },
    submit: async (request) => {
      submittedDrafts.push(request)
      return { kind: "busy", active: a2 }
    },
    stop: async (target) => {
      stopped.push(target)
    },
    ...options,
  }
  const host = document.createElement("div")
  document.body.append(host)
  const slot = (view: WorkspaceChatView) => {
    views.push(view)
    histories.push(view.chat.sessionID)
    onCleanup(() => disposed.push(view.chat.sessionID))
    const region = document.createElement("article")
    const textarea = document.createElement("textarea")
    textarea.addEventListener("input", () => view.onDraft(textarea.value))
    const send = document.createElement("button")
    send.dataset.action = "send"
    send.addEventListener("click", () => view.onSubmit())
    const history = document.createElement("output")
    history.dataset.history = view.chat.sessionID
    history.textContent = `history:${view.chat.sessionID}`
    createEffect(() => {
      textarea.value = view.draft
      textarea.setAttribute("aria-label", language.t("prompt.placeholder.simple"))
      send.textContent = language.t("prompt.action.send")
      send.disabled = !view.canSubmit
      view.activeChatID
        ? region.setAttribute("data-active-chat", view.activeChatID)
        : region.removeAttribute("data-active-chat")
      region.dataset.chat = view.chat.chatID
      region.dataset.project = view.project.projectID
    })
    region.append(textarea, send, history)
    return region
  }
  const dispose = render(() => createComponent(FtcWorkspace, { projects, ports, language, chat: slot }), host)
  const close = () => {
    dispose()
    host.remove()
  }
  cleanups.push(close)
  return {
    host,
    ports,
    listeners,
    histories,
    disposed,
    views,
    submittedDrafts,
    stopped,
    close,
    setChinese: () => setLocale("chinese", true),
    button: (selector: string) => host.querySelector<HTMLButtonElement>(selector)!,
    draft: (text: string) => {
      const textarea = host.querySelector("textarea")!
      textarea.value = text
      textarea.dispatchEvent(new Event("input", { bubbles: true }))
    },
  }
}


// Review-only probes use the candidate fixture unchanged above; no existing tests are copied.
test("review: pending list cannot erase a successfully created selected chat", async () => {
  const list = Promise.withResolvers<readonly FtcProject.ChatRef[]>()
  const view = fixture({listChats: () => list.promise, active: async () => ({projectID:a.projectID}), createChat: async () => a2})
  await flush()
  view.button('[data-action="new-chat"]').click()
  await flush()
  expect(view.host.querySelector("article")?.getAttribute("data-chat")).toBe(a2.chatID)
  view.draft("new chat draft")
  list.resolve([a1])
  await flush()
  expect(view.host.querySelector("article")?.getAttribute("data-chat")).toBe(a2.chatID)
  expect(view.host.querySelector("textarea")?.value).toBe("new chat draft")
})

test("review: conflicting owner mapping must not become a stop target", async () => {
  const view = fixture()
  await flush()
  view.listeners.get(a.projectID)!({projectID:a.projectID, active:{...a2,sessionID:b1.sessionID}})
  await flush()
  view.button('[data-action="stop"]')?.click()
  await flush()
  expect(view.stopped).toEqual([])
})
