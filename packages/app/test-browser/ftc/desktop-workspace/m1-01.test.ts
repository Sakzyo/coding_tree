import { afterEach, expect, test } from "bun:test"
import { createRequire } from "node:module"
import { createComponent, render } from "solid-js/web"
import { createEffect, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { Project } from "@opencode-ai/schema/project"
import { Session } from "@opencode-ai/schema/session"
import { SessionInput } from "@opencode-ai/schema/session-input"
import { SessionMessage } from "@opencode-ai/schema/session-message"
import { DateTime } from "effect"
import { Location } from "@opencode-ai/schema/location"
import { AbsolutePath } from "@opencode-ai/schema/schema"
import type { WorkspaceChatView, WorkspaceLanguage, WorkspacePorts } from "../../../src/ftc/facades"
import { dict } from "../../../src/i18n/en"
const zh = await import("../../../src/i18n/zh")

const compiler = createRequire(import.meta.resolve("vite-plugin-solid"))
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
const { FtcWorkspace } = await import("../../../src/ftc/workspace")

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

test("busy project identifies active chat without submitting drafts", async () => {
  const view = fixture()
  await flush()
  expect(view.host.querySelector("article")?.getAttribute("data-active-chat")).toBe(a2.chatID)
  view.draft("unsent")
  expect(view.submittedDrafts).toEqual([])
  expect(view.button(`[data-project-id="${b.projectID}"]`).disabled).toBe(false)
  expect(view.button('[data-action="send"]').disabled).toBe(true)
  view.button(`[data-project-id="${b.projectID}"]`).click()
  await flush()
  expect(view.button('[data-action="send"]').disabled).toBe(false)
  expect(view.host.querySelector("output")?.getAttribute("data-history")).toBe(b1.sessionID)
})

const idle: WorkspacePorts["active"] = async (request) => ({ projectID: request.projectID })
const admitted = (request: FtcProject.SubmitPrompt): FtcProject.SubmitResult => ({
  kind: "admitted",
  receipt: SessionInput.Admitted.make({
    admittedSeq: 1,
    id: SessionMessage.ID.make("msg_admitted"),
    sessionID: request.chat.sessionID,
    prompt: { text: request.prompt.text },
    delivery: "steer",
    timeCreated: DateTime.makeUnsafe(0),
  }),
})

test("idle transitions retain drafts and only an explicit send admits once", async () => {
  const requests: FtcProject.SubmitPrompt[] = []
  const view = fixture({
    submit: async (request) => {
      requests.push(request)
      return admitted(request)
    },
  })
  await flush()
  view.draft("local draft")
  view.listeners.get(a.projectID)!({ projectID: a.projectID })
  await flush()
  expect(view.host.querySelector("textarea")?.value).toBe("local draft")
  expect(requests).toEqual([])
  view.button('[data-action="send"]').click()
  await flush()
  expect(requests).toEqual([{ chat: a1, prompt: { text: "local draft" } }])
  expect(view.host.querySelector("textarea")?.value).toBe("")
})

test("project and chat selection restore independent drafts and exact Session presentation", async () => {
  const view = fixture({ active: idle })
  await flush()
  view.draft("first")
  view.button(`[data-chat-id="${a2.chatID}"]`).click()
  view.draft("second")
  expect(view.host.querySelector("output")?.textContent).toBe(`history:${a2.sessionID}`)
  view.button(`[data-project-id="${b.projectID}"]`).click()
  await flush()
  view.draft("other")
  expect(view.host.querySelector("output")?.textContent).toBe(`history:${b1.sessionID}`)
  expect(view.host.querySelectorAll("output")).toHaveLength(1)
  view.button(`[data-project-id="${a.projectID}"]`).click()
  await flush()
  expect(view.host.querySelector("textarea")?.value).toBe("second")
  view.button(`[data-chat-id="${a1.chatID}"]`).click()
  expect(view.host.querySelector("textarea")?.value).toBe("first")
  expect(view.disposed).toContain(b1.sessionID)
  expect(view.submittedDrafts).toEqual([])
})

test("same owner can deliberately submit with canonical delivery options", async () => {
  const requests: FtcProject.SubmitPrompt[] = []
  const view = fixture({
    submit: async (request) => {
      requests.push(request)
      return admitted(request)
    },
  })
  await flush()
  view.button(`[data-chat-id="${a2.chatID}"]`).click()
  view.draft("steer")
  view.views.at(-1)!.onSubmit({ delivery: "queue", resume: false, id: SessionMessage.ID.make("msg_exact") })
  await flush()
  expect(requests).toEqual([{ chat: a2, prompt: { text: "steer" }, delivery: "queue", resume: false, id: "msg_exact" }])
  expect(requests[0].chat.projectID).not.toBe(a.location.project.id)
})

test("stop captures the displayed owner and never infers idle on completion", async () => {
  const stop = Promise.withResolvers<void>()
  const targets: FtcProject.ChatRef[] = []
  const view = fixture({
    stop: (target) => {
      targets.push(target)
      return stop.promise
    },
  })
  await flush()
  view.button('[data-action="stop"]').click()
  view.button(`[data-project-id="${b.projectID}"]`).click()
  await flush()
  stop.resolve()
  await flush()
  expect(targets).toEqual([a2])
  view.button(`[data-project-id="${a.projectID}"]`).click()
  await flush()
  expect(view.host.querySelector("article")?.getAttribute("data-active-chat")).toBe(a2.chatID)
  expect(view.button('[data-action="send"]').disabled).toBe(true)
})

test("raced busy submission preserves original draft and never retries on idle", async () => {
  const view = fixture({ active: idle })
  await flush()
  view.draft("raced")
  view.button('[data-action="send"]').click()
  await flush()
  expect(view.submittedDrafts).toEqual([{ chat: a1, prompt: { text: "raced" } }])
  expect(view.host.querySelector("textarea")?.value).toBe("raced")
  expect(view.host.querySelector("article")?.getAttribute("data-active-chat")).toBe(a2.chatID)
  view.listeners.get(a.projectID)!({ projectID: a.projectID })
  await flush()
  expect(view.submittedDrafts).toHaveLength(1)
})

test("deferred admission clears only unchanged original text despite later selection", async () => {
  const submit = Promise.withResolvers<FtcProject.SubmitResult>()
  const requests: FtcProject.SubmitPrompt[] = []
  const view = fixture({
    active: idle,
    submit: (request) => {
      requests.push(request)
      return submit.promise
    },
  })
  await flush()
  view.draft("original")
  view.button('[data-action="send"]').click()
  view.button('[data-action="send"]').click()
  view.draft("edited")
  view.button(`[data-project-id="${b.projectID}"]`).click()
  await flush()
  view.draft("b draft")
  submit.resolve(admitted(requests[0]))
  await flush()
  expect(requests).toEqual([{ chat: a1, prompt: { text: "original" } }])
  expect(view.host.querySelector("textarea")?.value).toBe("b draft")
  expect(view.host.querySelector("article")?.getAttribute("data-project")).toBe(b.projectID)
  view.button(`[data-project-id="${a.projectID}"]`).click()
  await flush()
  expect(view.host.querySelector("textarea")?.value).toBe("edited")
})

test("edit and revert while admission waits still preserves the user's edit", async () => {
  const submit = Promise.withResolvers<FtcProject.SubmitResult>()
  const requests: FtcProject.SubmitPrompt[] = []
  const view = fixture({
    active: idle,
    submit: (request) => {
      requests.push(request)
      return submit.promise
    },
  })
  await flush()
  view.draft("same")
  view.button('[data-action="send"]').click()
  view.draft("changed")
  view.draft("same")
  await flush()
  submit.resolve(admitted(requests[0]))
  await flush()
  expect(view.host.querySelector("textarea")?.value).toBe("same")
})

test("deferred failure belongs to the original chat and leaves the later chat untouched", async () => {
  const submit = Promise.withResolvers<FtcProject.SubmitResult>()
  const view = fixture({ active: idle, submit: () => submit.promise })
  await flush()
  view.draft("original")
  view.button('[data-action="send"]').click()
  view.button(`[data-project-id="${b.projectID}"]`).click()
  await flush()
  view.draft("other")
  submit.reject(new Error("untrusted backend detail"))
  await flush()
  expect(view.host.querySelector('[role="alert"]')).toBeNull()
  expect(view.host.querySelector("textarea")?.value).toBe("other")
  view.button(`[data-project-id="${a.projectID}"]`).click()
  await flush()
  expect(view.host.querySelector("textarea")?.value).toBe("original")
  expect(view.host.textContent).toContain("Could not send. Your draft is still here.")
  expect(view.host.textContent).not.toContain("untrusted backend detail")
})

test.each(["project_changed", "session_mismatch", "chat_session_conflict"] as const)(
  "structured %s retains draft and requests explicit reopen",
  async (code) => {
    const view = fixture({
      active: idle,
      submit: async () => {
        throw FtcProject.ChatError.make({ code, projectID: a.projectID, recovery: "reopen_project" })
      },
    })
    await flush()
    view.draft("retained")
    view.button('[data-action="send"]').click()
    await flush()
    expect(view.host.querySelector("textarea")?.value).toBe("retained")
    expect(view.host.textContent).toContain("The project or session changed.")
    expect(view.button('[data-action="reopen"]').textContent).toBe("Reopen project")
    expect(view.host.querySelector("output")?.getAttribute("data-history")).toBe(a1.sessionID)
  },
)

test("execution unavailable retains input with localized recovery", async () => {
  const view = fixture({
    active: idle,
    submit: async () => {
      throw new FtcProject.ExecutionUnavailable({ code: "execution_disabled" })
    },
  })
  await flush()
  view.draft("disabled")
  view.button('[data-action="send"]').click()
  await flush()
  expect(view.host.querySelector("textarea")?.value).toBe("disabled")
  expect(view.host.textContent).toContain("Could not send.")
  expect(view.button('[data-action="retry"]').textContent).toBe("Retry")
})

test("owner event supersedes an older initial snapshot", async () => {
  const active = Promise.withResolvers<FtcProject.OwnerStatus>()
  const view = fixture({ active: () => active.promise })
  await flush()
  expect(view.button('[data-action="send"]').disabled).toBe(true)
  expect(view.host.textContent).toContain("Loading")
  view.listeners.get(a.projectID)!({ projectID: a.projectID, active: a2 })
  active.resolve({ projectID: a.projectID })
  await flush()
  expect(view.host.querySelector("article")?.getAttribute("data-active-chat")).toBe(a2.chatID)
  expect(view.button('[data-action="send"]').disabled).toBe(true)
})

test("obsolete target queries abort and late data or rejection cannot replace current view", async () => {
  const list = Promise.withResolvers<readonly FtcProject.ChatRef[]>()
  const active = Promise.withResolvers<FtcProject.OwnerStatus>()
  const signals: AbortSignal[] = []
  const view = fixture({
    listChats: (request, signal) => {
      signals.push(signal)
      return request.projectID === a.projectID ? list.promise : Promise.resolve([b1])
    },
    active: (request, signal) => {
      signals.push(signal)
      return request.projectID === a.projectID ? active.promise : Promise.resolve({ projectID: b.projectID })
    },
  })
  await flush()
  view.button(`[data-project-id="${b.projectID}"]`).click()
  await flush()
  expect(signals.slice(0, 2).every((signal) => signal.aborted)).toBe(true)
  list.resolve([a1, a2])
  active.reject(new Error("obsolete"))
  await flush()
  expect(view.host.querySelector("article")?.getAttribute("data-chat")).toBe(b1.chatID)
  expect(view.host.querySelector('[role="alert"]')).toBeNull()
  expect(view.submittedDrafts).toEqual([])
})

test.each(["active", "listChats"] as const)(
  "%s failure is not idle and explicit retry only rechecks",
  async (method) => {
    const calls: string[] = []
    const view = fixture({
      active: idle,
      [method]: async () => {
        calls.push(method)
        throw new Error("private query detail")
      },
    })
    await flush()
    expect(view.host.textContent).toContain("Could not load project status or sessions.")
    expect(view.host.textContent).not.toContain("private query detail")
    expect(view.host.querySelector<HTMLButtonElement>('[data-action="send"]')?.disabled ?? true).toBe(true)
    view.button('[data-action="retry"]').click()
    await flush()
    expect(calls).toHaveLength(2)
    expect(view.submittedDrafts).toEqual([])
  },
)

test("invalid chat or owner membership is never presented as a runnable identity", async () => {
  const view = fixture({ listChats: async () => [b1], active: async () => ({ projectID: a.projectID, active: b1 }) })
  await flush()
  expect(view.host.querySelector("article")).toBeNull()
  expect(view.host.textContent).toContain("Could not load project status or sessions.")
  expect(view.submittedDrafts).toEqual([])
})

test.each(["create", "open"] as const)(
  "explicit %s forwards exact selected folder then canonical context",
  async (action) => {
    const calls: unknown[] = []
    const view = fixture(
      {
        selectFolder: async (kind) => {
          calls.push(kind)
          return { root: b.canonicalRoot }
        },
        [action]: async (request) => {
          calls.push(request)
          return b
        },
      },
      [a],
    )
    await flush()
    expect(calls).toEqual([])
    view.button(`[data-action="${action}"]`).click()
    await flush()
    expect(calls).toEqual([action, { root: b.canonicalRoot }])
    expect(view.host.querySelector("article")?.getAttribute("data-project")).toBe(b.projectID)
    expect(view.submittedDrafts).toEqual([])
  },
)

test("new chat uses association ID and selects only canonical success", async () => {
  const calls: FtcProject.ProjectRequest[] = []
  const view = fixture({
    active: idle,
    createChat: async (request) => {
      calls.push(request)
      return a2
    },
  })
  await flush()
  view.button('[data-action="new-chat"]').click()
  await flush()
  expect(calls).toEqual([{ projectID: a.projectID }])
  expect(view.host.querySelector("article")?.getAttribute("data-chat")).toBe(a2.chatID)
  expect(a1.chatID).toBe("chat_a1")
  expect(a1.sessionID).toBe("ses_a1")
  expect(view.submittedDrafts).toEqual([])
})

test.each(["create", "open", "createChat", "stop"] as const)(
  "%s rejection does not fabricate success or lose drafts",
  async (method) => {
    const view = fixture({
      [method]: async () => {
        throw new Error("backend-private")
      },
    })
    await flush()
    view.draft("keep")
    view.button(`[data-action="${method === "createChat" ? "new-chat" : method}"]`).click()
    await flush()
    expect(view.host.querySelector("textarea")?.value).toBe("keep")
    expect(view.host.querySelector("article")?.getAttribute("data-project")).toBe(a.projectID)
    expect(view.host.textContent).toContain("Request failed")
    expect(view.host.textContent).not.toContain("backend-private")
  },
)

test("late new-chat success cannot retarget a later project selection", async () => {
  const result = Promise.withResolvers<FtcProject.ChatRef>()
  const view = fixture({ createChat: () => result.promise })
  await flush()
  view.button('[data-action="new-chat"]').click()
  view.button(`[data-project-id="${b.projectID}"]`).click()
  await flush()
  result.resolve(a2)
  await flush()
  expect(view.host.querySelector("article")?.getAttribute("data-chat")).toBe(b1.chatID)
})

test("language switching localizes controls, ownership, guidance and accessibility without resetting draft", async () => {
  const view = fixture()
  await flush()
  view.draft("unchanged")
  view.setChinese()
  await flush()
  expect(view.host.textContent).toContain("正在运行的会话：chat_a2")
  expect(view.host.textContent).toContain("草稿不会自动发送")
  expect(view.button('[data-action="open"]').textContent).toBe("打开项目")
  expect(view.host.querySelector("textarea")?.getAttribute("aria-label")).toBe("随便问点什么...")
  expect(view.host.querySelector("textarea")?.value).toBe("unchanged")
  expect(view.submittedDrafts).toEqual([])
})

test("unmount cancels observations and pending commands without stopping execution", async () => {
  const submit = Promise.withResolvers<FtcProject.SubmitResult>()
  const owner = Promise.withResolvers<FtcProject.OwnerStatus>()
  const signals: AbortSignal[] = []
  const view = fixture({
    active: (request, signal) => {
      signals.push(signal)
      return owner.promise
    },
    submit: (_request, signal) => {
      signals.push(signal)
      return submit.promise
    },
  })
  await flush()
  const lateEvent = view.listeners.get(a.projectID)!
  lateEvent({ projectID: a.projectID })
  view.draft("pending")
  view.button('[data-action="send"]').click()
  const oldView = view.views.at(-1)!
  await flush()
  view.close()
  expect(view.listeners.size).toBe(0)
  expect(signals.every((signal) => signal.aborted)).toBe(true)
  expect(view.disposed).toEqual([a1.sessionID])
  lateEvent({ projectID: a.projectID, active: a2 })
  owner.reject(new Error("retired owner"))
  submit.reject(new Error("retired submit"))
  oldView.onSubmit()
  await flush()
  expect(view.stopped).toEqual([])
  expect(view.host.textContent).toBe("")
})

test("fresh component scopes have independent drafts and subscriptions", async () => {
  const first = fixture()
  await flush()
  first.draft("first only")
  first.close()
  const second = fixture()
  await flush()
  expect(second.host.querySelector("textarea")?.value).toBe("")
  expect(first.listeners.size).toBe(0)
  expect(second.listeners.size).toBe(1)
  expect(second.submittedDrafts).toEqual([])
})

test("unmount before scheduled invocation retires the pending submit", async () => {
  const requests: FtcProject.SubmitPrompt[] = []
  const view = fixture({
    active: idle,
    submit: async (request) => {
      requests.push(request)
      return admitted(request)
    },
  })
  await flush()
  view.draft("pending")
  view.button('[data-action="send"]').click()
  view.close()
  await flush()
  expect(requests).toEqual([])
  expect(view.stopped).toEqual([])
})

test("reopen recovery sends the displayed canonical folder without choosing a different target", async () => {
  const roots: FtcProject.FolderRequest[] = []
  const selectedFolders: string[] = []
  const view = fixture({
    active: idle,
    submit: async () => {
      throw FtcProject.ChatError.make({ code: "project_changed", projectID: a.projectID, recovery: "reopen_project" })
    },
    selectFolder: async (action) => {
      selectedFolders.push(action)
      return { root: b.canonicalRoot }
    },
    open: async (request) => {
      roots.push(request)
      return a
    },
  })
  await flush()
  view.draft("kept")
  view.button('[data-action="send"]').click()
  await flush()
  view.button('[data-action="reopen"]').click()
  await flush()
  expect(roots).toEqual([{ root: a.canonicalRoot }])
  expect(selectedFolders).toEqual([])
  expect(view.host.querySelector("textarea")?.value).toBe("kept")
})

test("mutable supplied project and owner records cannot retarget presentation or stop", async () => {
  const context = {
    ...a,
    location: {
      directory: a.location.directory,
      workspaceID: a.location.workspaceID,
      project: { ...a.location.project },
    },
  }
  const view = fixture({}, [context, b])
  await flush()
  context.canonicalRoot = b.canonicalRoot
  context.location.project.id = b.location.project.id
  const event = { projectID: a.projectID, active: { ...a2 } }
  view.listeners.get(a.projectID)!(event)
  event.active.sessionID = b1.sessionID
  expect(view.button(`[data-project-id="${a.projectID}"]`).textContent).toBe(a.canonicalRoot)
  view.button('[data-action="stop"]').click()
  await flush()
  expect(view.stopped).toEqual([a2])
})

test("newer owner event wins over an older busy submit result", async () => {
  const response = Promise.withResolvers<FtcProject.SubmitResult>()
  const view = fixture({ active: idle, submit: () => response.promise })
  await flush()
  view.draft("old busy result")
  view.button('[data-action="send"]').click()
  view.listeners.get(a.projectID)!({ projectID: a.projectID })
  response.resolve({ kind: "busy", active: a2 })
  await flush()
  expect(view.host.querySelector("article")?.getAttribute("data-active-chat")).toBeNull()
  expect(view.host.querySelector("textarea")?.value).toBe("old busy result")
})

test("foreign busy result or admission receipt retains original draft and membership", async () => {
  const foreign = fixture({ active: idle, submit: async () => ({ kind: "busy", active: b1 }) })
  await flush()
  foreign.draft("foreign busy")
  foreign.button('[data-action="send"]').click()
  await flush()
  expect(foreign.host.querySelector("textarea")?.value).toBe("foreign busy")
  expect(foreign.host.textContent).toContain("The project or session changed.")
  const receipt = fixture({ active: idle, submit: async (request) => admitted({ ...request, chat: b1 }) })
  await flush()
  receipt.draft("foreign receipt")
  receipt.button('[data-action="send"]').click()
  await flush()
  expect(receipt.host.querySelector("textarea")?.value).toBe("foreign receipt")
  expect(receipt.host.textContent).toContain("The project or session changed.")
})

test("conflicting new-chat mapping retains selected identity", async () => {
  const view = fixture({ createChat: async () => ({ ...a1, sessionID: a2.sessionID }) })
  await flush()
  view.draft("same identity")
  view.button('[data-action="new-chat"]').click()
  await flush()
  expect(view.host.querySelector("article")?.getAttribute("data-chat")).toBe(a1.chatID)
  expect(view.host.querySelector("textarea")?.value).toBe("same identity")
  expect(view.host.textContent).toContain("The project or session changed.")
})

test("cancelled folder selection performs no association command", async () => {
  const calls: string[] = []
  const view = fixture({
    selectFolder: async () => undefined,
    create: async () => {
      calls.push("create")
      return b
    },
  })
  await flush()
  view.button('[data-action="create"]').click()
  await flush()
  expect(calls).toEqual([])
  expect(view.host.querySelector("article")?.getAttribute("data-project")).toBe(a.projectID)
})

test("folder selection finishing after unmount cannot open an association", async () => {
  const folder = Promise.withResolvers<FtcProject.FolderRequest | undefined>()
  const calls: FtcProject.FolderRequest[] = []
  const view = fixture({
    selectFolder: () => folder.promise,
    open: async (request) => {
      calls.push(request)
      return b
    },
  })
  await flush()
  view.button('[data-action="open"]').click()
  await flush()
  view.close()
  folder.resolve({ root: b.canonicalRoot })
  await flush()
  expect(calls).toEqual([])
})

test("Chinese failures and recovery use complete phrases", async () => {
  const view = fixture({
    active: idle,
    submit: async () => {
      throw FtcProject.ChatError.make({ code: "session_mismatch", projectID: a.projectID, recovery: "reopen_project" })
    },
  })
  await flush()
  view.setChinese()
  view.draft("保留")
  view.button('[data-action="send"]').click()
  await flush()
  expect(view.host.textContent).toContain("项目或会话已更改。请重新打开项目；草稿仍保留在此处。")
  expect(view.button('[data-action="reopen"]').textContent).toBe("重新打开项目")
  const query = fixture({
    active: async () => {
      throw new Error("failed")
    },
  })
  await flush()
  query.setChinese()
  await flush()
  expect(query.host.textContent).toContain("无法加载项目状态或会话。请重试。")
  expect(query.button('[data-action="retry"]').textContent).toBe("重试")
})

test("supplied chat stop handler targets the displayed owner and retires with its view", async () => {
  const view = fixture()
  await flush()
  const slot = view.views.at(-1)!
  slot.onStop()
  await flush()
  expect(view.stopped).toEqual([a2])
  view.close()
  slot.onStop()
  await flush()
  expect(view.stopped).toEqual([a2])
})

test("structured list membership failure retains prior presentation and offers exact reopen", async () => {
  const calls: string[] = []
  const view = fixture({
    listChats: async (request) => {
      calls.push(request.projectID)
      if (calls.length > 1)
        throw FtcProject.ChatError.make({
          code: "project_changed",
          projectID: request.projectID,
          recovery: "reopen_project",
        })
      return [a1, a2]
    },
  })
  await flush()
  view.draft("prior draft")
  view.listeners.get(a.projectID)!({ projectID: a.projectID, active: b1 })
  view.button('[data-action="retry"]').click()
  await flush()
  expect(view.host.querySelector("textarea")?.value).toBe("prior draft")
  expect(view.host.querySelector("output")?.getAttribute("data-history")).toBe(a1.sessionID)
  expect(view.button('[data-action="reopen"]').textContent).toBe("Reopen project")
  expect(view.button('[data-action="send"]').disabled).toBe(true)
})

test("an empty project catalog still displays association failure and allows explicit retry", async () => {
  const calls: string[] = []
  const view = fixture(
    {
      create: async () => {
        calls.push("create")
        throw new Error("private")
      },
    },
    [],
  )
  view.button('[data-action="create"]').click()
  await flush()
  expect(view.host.textContent).toContain("Request failed")
  expect(view.button('[data-action="create"]').disabled).toBe(false)
  view.button('[data-action="create"]').click()
  await flush()
  expect(calls).toEqual(["create", "create"])
})

test("a successful owner event recovers failed observation without sending its draft", async () => {
  const view = fixture({
    active: async () => {
      throw new Error("owner query failed")
    },
  })
  await flush()
  view.draft("never automatic")
  expect(view.host.querySelector('[role="alert"]')).not.toBeNull()
  view.listeners.get(a.projectID)!({ projectID: a.projectID })
  await flush()
  expect(view.host.querySelector('[role="alert"]')).toBeNull()
  expect(view.button('[data-action="send"]').disabled).toBe(false)
  expect(view.host.querySelector("textarea")?.value).toBe("never automatic")
  expect(view.submittedDrafts).toEqual([])
})

test("a pre-create list snapshot preserves the new canonical chat selection and draft", async () => {
  const list = Promise.withResolvers<readonly FtcProject.ChatRef[]>()
  const view = fixture({ listChats: () => list.promise, active: idle, createChat: async () => a2 })
  await flush()
  expect(view.button('[data-action="new-chat"]').disabled).toBe(false)
  view.button('[data-action="new-chat"]').click()
  await flush()
  expect(view.host.querySelector("article")?.getAttribute("data-chat")).toBe(a2.chatID)
  view.draft("new chat draft")
  list.resolve([a1])
  await flush()
  expect(view.host.querySelector("article")?.getAttribute("data-chat")).toBe(a2.chatID)
  expect(view.host.querySelector("textarea")?.value).toBe("new chat draft")
  expect(view.host.querySelector<HTMLButtonElement>(`[data-chat-id="${a1.chatID}"]`)).not.toBeNull()
  expect(view.button('[data-action="send"]').disabled).toBe(false)
  expect(view.submittedDrafts).toEqual([])
})

const conflictingOwners = [
  { kind: "chat-to-Session", reference: { ...a2, sessionID: b1.sessionID } },
  { kind: "Session-to-chat", reference: { ...a2, chatID: chat(a, "different").chatID } },
]

test.each(conflictingOwners)("$kind conflict in an owner event cannot become a stop target", async ({ reference }) => {
  const view = fixture()
  await flush()
  view.draft("valid selected draft")
  view.listeners.get(a.projectID)!({ projectID: a.projectID, active: reference })
  await flush()
  view.host.querySelector<HTMLButtonElement>('[data-action="stop"]')?.click()
  await flush()
  expect(view.stopped).toEqual([])
  expect(view.host.querySelector("article")?.getAttribute("data-chat")).toBe(a1.chatID)
  expect(view.host.querySelector("textarea")?.value).toBe("valid selected draft")
  expect(view.host.textContent).toContain("The project or session changed.")
  expect(view.button('[data-action="send"]').disabled).toBe(true)
})

test.each(conflictingOwners)("$kind conflict in a later owner snapshot is quarantined", async ({ reference }) => {
  const active = Promise.withResolvers<FtcProject.OwnerStatus>()
  const view = fixture({ active: () => active.promise })
  await flush()
  view.draft("snapshot draft")
  active.resolve({ projectID: a.projectID, active: reference })
  await flush()
  view.host.querySelector<HTMLButtonElement>('[data-action="stop"]')?.click()
  await flush()
  expect(view.stopped).toEqual([])
  expect(view.host.querySelector("textarea")?.value).toBe("snapshot draft")
  expect(view.host.textContent).toContain("The project or session changed.")
})

test.each(conflictingOwners)(
  "list arrival after a $kind owner conflict preserves canonical presentation and blocks stop",
  async ({ reference }) => {
    const list = Promise.withResolvers<readonly FtcProject.ChatRef[]>()
    const view = fixture({
      listChats: () => list.promise,
      active: async () => ({ projectID: a.projectID, active: reference }),
    })
    await flush()
    list.resolve([a1, a2])
    await flush()
    view.draft("canonical list draft")
    view.host.querySelector<HTMLButtonElement>('[data-action="stop"]')?.click()
    await flush()
    expect(view.stopped).toEqual([])
    expect(view.host.querySelector("output")?.getAttribute("data-history")).toBe(a1.sessionID)
    expect(view.host.querySelector("textarea")?.value).toBe("canonical list draft")
    expect(view.host.textContent).toContain("The project or session changed.")
    expect(view.button('[data-action="send"]').disabled).toBe(true)
  },
)

test.each(conflictingOwners)(
  "$kind conflict in a busy-submit result retains input and blocks stop",
  async ({ reference }) => {
    const view = fixture({ active: idle, submit: async () => ({ kind: "busy", active: reference }) })
    await flush()
    view.draft("busy result draft")
    view.button('[data-action="send"]').click()
    await flush()
    view.host.querySelector<HTMLButtonElement>('[data-action="stop"]')?.click()
    await flush()
    expect(view.stopped).toEqual([])
    expect(view.host.querySelector("textarea")?.value).toBe("busy result draft")
    expect(view.host.querySelector("article")?.getAttribute("data-chat")).toBe(a1.chatID)
    expect(view.host.textContent).toContain("The project or session changed.")
    expect(view.button('[data-action="send"]').disabled).toBe(true)
  },
)

test("nonconflicting unlisted owner remains an exact supplied-port stop target", async () => {
  const reference = chat(a, "unlisted")
  const view = fixture({ active: async () => ({ projectID: a.projectID, active: reference }) })
  await flush()
  expect(view.host.querySelector("article")?.getAttribute("data-active-chat")).toBe(reference.chatID)
  view.button('[data-action="stop"]').click()
  await flush()
  expect(view.stopped).toEqual([reference])
  expect(view.host.querySelector("article")?.getAttribute("data-chat")).toBe(a1.chatID)
})

test("nonconflicting unlisted busy owner retains its draft and exact stop target", async () => {
  const reference = chat(a, "busy-new")
  const view = fixture({ active: idle, submit: async () => ({ kind: "busy", active: reference }) })
  await flush()
  view.draft("retained unknown owner")
  view.button('[data-action="send"]').click()
  await flush()
  expect(view.host.querySelector("article")?.getAttribute("data-active-chat")).toBe(reference.chatID)
  view.button('[data-action="stop"]').click()
  await flush()
  expect(view.stopped).toEqual([reference])
  expect(view.host.querySelector("textarea")?.value).toBe("retained unknown owner")
})

test("an owner event preceding the canonical list is reconciled when membership arrives", async () => {
  const list = Promise.withResolvers<readonly FtcProject.ChatRef[]>()
  const active = Promise.withResolvers<FtcProject.OwnerStatus>()
  const view = fixture({ listChats: () => list.promise, active: () => active.promise })
  await flush()
  view.listeners.get(a.projectID)!({ projectID: a.projectID, active: { ...a2, sessionID: b1.sessionID } })
  list.resolve([a1, a2])
  active.resolve({ projectID: a.projectID })
  await flush()
  view.draft("event-before-list")
  view.host.querySelector<HTMLButtonElement>('[data-action="stop"]')?.click()
  await flush()
  expect(view.stopped).toEqual([])
  expect(view.host.querySelector("textarea")?.value).toBe("event-before-list")
  expect(view.host.textContent).toContain("The project or session changed.")
})

test("a Session already mapped to another supplied project cannot become this project's owner", async () => {
  const view = fixture({ active: idle })
  await flush()
  view.button(`[data-project-id="${b.projectID}"]`).click()
  await flush()
  view.button(`[data-project-id="${a.projectID}"]`).click()
  await flush()
  view.draft("a remains selected")
  view.listeners.get(a.projectID)!({ projectID: a.projectID, active: { ...a2, sessionID: b1.sessionID } })
  view.host.querySelector<HTMLButtonElement>('[data-action="stop"]')?.click()
  await flush()
  expect(view.stopped).toEqual([])
  expect(view.host.querySelector("textarea")?.value).toBe("a remains selected")
  expect(view.host.textContent).toContain("The project or session changed.")
})

test.each(["chat", "Session"] as const)(
  "successive unlisted owner observations cannot remap a known %s identity",
  async (identity) => {
    const first = chat(a, "first-unlisted")
    const second =
      identity === "chat"
        ? { ...first, sessionID: chat(a, "second-unlisted").sessionID }
        : { ...first, chatID: chat(a, "second-unlisted").chatID }
    const view = fixture({ active: idle })
    await flush()
    view.draft("known owner draft")
    view.listeners.get(a.projectID)!({ projectID: a.projectID, active: first })
    view.listeners.get(a.projectID)!({ projectID: a.projectID })
    view.listeners.get(a.projectID)!({ projectID: a.projectID, active: second })
    view.host.querySelector<HTMLButtonElement>('[data-action="stop"]')?.click()
    await flush()
    expect(view.stopped).toEqual([])
    expect(view.host.querySelector("textarea")?.value).toBe("known owner draft")
    expect(view.host.textContent).toContain("The project or session changed.")
  },
)

test("canonical list membership supersedes an earlier incompatible owner observation and permits recovery", async () => {
  const list = Promise.withResolvers<readonly FtcProject.ChatRef[]>()
  const view = fixture({
    listChats: () => list.promise,
    active: async () => ({ projectID: a.projectID, active: { ...a2, sessionID: b1.sessionID } }),
  })
  await flush()
  list.resolve([a1, a2])
  await flush()
  view.draft("still canonical")
  view.listeners.get(a.projectID)!({ projectID: a.projectID, active: a2 })
  await flush()
  expect(view.host.textContent).not.toContain("The project or session changed.")
  view.button('[data-action="stop"]').click()
  await flush()
  expect(view.stopped).toEqual([a2])
  expect(view.host.querySelector("textarea")?.value).toBe("still canonical")
})
