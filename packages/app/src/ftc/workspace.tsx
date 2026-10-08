import { createEffect, createMemo, For, onCleanup, Show, untrack } from "solid-js"
import { createStore } from "solid-js/store"
import type { FtcProject } from "@opencode-ai/schema/ftc-project"
import type { WorkspaceProps } from "./facades"

type Failure = { membership: boolean; send: boolean; reopen: boolean }
type Owner = { state: "loading" | "ready" | "error"; active?: FtcProject.ChatRef; epoch: number }

export function FtcWorkspace(props: WorkspaceProps) {
  const [store, setStore] = createStore({
    projects: props.projects.map(copyProject),
    projectID: props.projects[0]?.projectID,
    selections: {} as Record<string, FtcProject.ChatRef | undefined>,
    chats: {} as Record<string, readonly FtcProject.ChatRef[]>,
    membership: [] as readonly FtcProject.ChatRef[],
    observedOwners: [] as readonly FtcProject.ChatRef[],
    membershipRevisions: {} as Record<string, number>,
    lists: {} as Record<string, "loading" | "ready" | "error">,
    owners: {} as Record<string, Owner>,
    drafts: {} as Record<string, { text: string; revision: number }>,
    pending: {} as Record<string, boolean>,
    errors: {} as Record<string, Failure | undefined>,
    selectionRevision: 0,
    refresh: 0,
  })
  const scope = { live: true, commands: new Set<AbortController>() }
  onCleanup(() => {
    scope.live = false
    scope.commands.forEach((controller) => controller.abort())
    scope.commands.clear()
  })
  const project = createMemo(() => store.projects.find((item) => item.projectID === store.projectID))
  const selected = createMemo(() => {
    const context = project()
    if (!context) return undefined
    const selection = store.selections[context.projectID]
    return store.chats[context.projectID]?.find((item) => selection && chatKey(item) === chatKey(selection))
  })
  const owner = createMemo(() => store.projectID && store.owners[store.projectID])
  const queryFailed = createMemo(
    () => owner()?.state === "error" || (store.projectID && store.lists[store.projectID] === "error"),
  )
  const error = createMemo(() => {
    const current = selected()
    const active = owner()?.active
    return (
      (store.projectID && store.errors[`query:${store.projectID}`]) ||
      (current && store.errors[chatKey(current)]) ||
      (active && store.errors[`stop:${chatKey(active)}`]) ||
      (store.projectID && store.errors[store.projectID]) ||
      store.errors.association
    )
  })

  createEffect(() => {
    const context = project()
    store.refresh
    if (!context) return
    untrack(() => {
      const controller = new AbortController()
      const request = Object.freeze({ projectID: context.projectID })
      const membershipRevision = store.membershipRevisions[request.projectID] ?? 0
      const observation = { live: true, event: false }
      const current = () => scope.live && observation.live
      setStore("errors", `query:${request.projectID}`, undefined)
      setStore("lists", request.projectID, "loading")
      setStore("owners", request.projectID, {
        state: "loading",
        active: undefined,
        epoch: store.owners[request.projectID]?.epoch ?? 0,
      })
      const receive = (status: FtcProject.OwnerStatus) => {
        if (!current()) return
        observation.event = true
        const valid = validOwner(status, request.projectID, [...store.membership, ...store.observedOwners])
        if (valid) rememberOwner(status.active)
        if (valid && store.lists[request.projectID] !== "error")
          setStore("errors", `query:${request.projectID}`, undefined)
        if (!valid) rejectOwner(request.projectID)
        setStore("owners", request.projectID, {
          state: valid ? "ready" : "error",
          active: valid && status.active ? copyChat(status.active) : undefined,
          epoch: store.owners[request.projectID].epoch + 1,
        })
      }
      const unsubscribe = props.ports.subscribeOwner(request, receive)
      onCleanup(() => {
        observation.live = false
        controller.abort()
        unsubscribe()
      })
      void Promise.resolve()
        .then(() => {
          controller.signal.throwIfAborted()
          return props.ports.active(request, controller.signal)
        })
        .then(
          (status) => {
            if (!current() || observation.event) return
            const valid = validOwner(status, request.projectID, [...store.membership, ...store.observedOwners])
            if (valid) rememberOwner(status.active)
            if (!valid) rejectOwner(request.projectID)
            setStore("owners", request.projectID, {
              state: valid ? "ready" : "error",
              active: valid && status.active ? copyChat(status.active) : undefined,
            })
          },
          (cause: unknown) => {
            if (!current() || observation.event) return
            setStore("owners", request.projectID, "state", "error")
            setStore("errors", `query:${request.projectID}`, failure(cause, false))
          },
        )
      void Promise.resolve()
        .then(() => {
          controller.signal.throwIfAborted()
          return props.ports.listChats(request, controller.signal)
        })
        .then(
          (chats) => {
            if (!current()) return
            if (
              chats.some((chat) => chat.projectID !== request.projectID || conflicts(store.membership, chat)) ||
              new Set(chats.map((chat) => chat.chatID)).size !== chats.length ||
              new Set(chats.map((chat) => chat.sessionID)).size !== chats.length
            ) {
              setStore("lists", request.projectID, "error")
              setStore(
                "errors",
                `query:${request.projectID}`,
                failure({ code: "chat_session_conflict", recovery: "reopen_project" }, false),
              )
              return
            }
            // A list captured before a successful create cannot remove that new
            // canonical member or change the user's more recent selection.
            const members =
              membershipRevision === (store.membershipRevisions[request.projectID] ?? 0)
                ? chats
                : [
                    ...chats,
                    ...(store.chats[request.projectID] ?? []).filter(
                      (chat) => !chats.some((item) => chatKey(item) === chatKey(chat)),
                    ),
                  ]
            remember(members)
            setStore("chats", request.projectID, members.map(copyChat))
            setStore("lists", request.projectID, "ready")
            const previous = store.selections[request.projectID]
            const next = members.find((chat) => previous && chatKey(chat) === chatKey(previous)) ?? members[0]
            setStore("selections", request.projectID, next ? copyChat(next) : undefined)
          },
          (cause: unknown) => {
            if (!current()) return
            setStore("lists", request.projectID, "error")
            setStore("errors", `query:${request.projectID}`, failure(cause, false))
          },
        )
    })
  })

  function selectProject(context: FtcProject.ProjectContext) {
    setStore({ projectID: context.projectID, selectionRevision: store.selectionRevision + 1 })
  }

  function remember(chats: readonly FtcProject.ChatRef[]) {
    setStore("membership", (known) => [
      ...known,
      ...chats.filter((chat) => !known.some((item) => chatKey(item) === chatKey(chat))).map(copyChat),
    ])
    // Membership is canonical; a later list/create can expose an earlier owner
    // observation as inconsistent without discarding the valid member or draft.
    setStore("observedOwners", (owners) => owners.filter((chat) => !conflicts(store.membership, chat)))
    Object.values(store.owners).forEach((status) => {
      const active = status.active
      if (active && conflicts(store.membership, active)) rejectOwner(active.projectID)
    })
  }

  function rememberOwner(chat: FtcProject.ChatRef | undefined) {
    if (!chat || store.observedOwners.some((item) => chatKey(item) === chatKey(chat))) return
    setStore("observedOwners", (owners) => [...owners, copyChat(chat)])
  }

  function rejectOwner(projectID: FtcProject.ProjectContext["projectID"]) {
    setStore("owners", projectID, { state: "error", active: undefined })
    setStore(
      "errors",
      `query:${projectID}`,
      failure({ code: "chat_session_conflict", recovery: "reopen_project" }, false),
    )
  }

  function command<T>(
    key: string,
    execute: (signal: AbortSignal) => Promise<T>,
    accept: (result: T) => void,
    send = false,
  ) {
    if (!scope.live || store.pending[key]) return
    const controller = new AbortController()
    scope.commands.add(controller)
    setStore("pending", key, true)
    setStore("errors", key, undefined)
    void Promise.resolve()
      .then(() => {
        controller.signal.throwIfAborted()
        return execute(controller.signal)
      })
      .then((result) => {
        if (scope.live) accept(result)
      })
      .catch((cause: unknown) => {
        if (scope.live) setStore("errors", key, failure(cause, send))
      })
      .finally(() => {
        scope.commands.delete(controller)
        if (scope.live) setStore("pending", key, false)
      })
  }

  function associate(action: "create" | "open") {
    const revision = store.selectionRevision
    command(
      "association",
      async (signal) => {
        const folder = await props.ports.selectFolder(action, signal)
        if (!folder || signal.aborted) return undefined
        return props.ports[action](Object.freeze({ root: folder.root }), signal)
      },
      (result) => {
        if (!result) return
        const context = copyProject(result)
        setStore("projects", (projects) => [
          ...projects.filter((item) => item.projectID !== context.projectID),
          context,
        ])
        if (store.selectionRevision === revision) selectProject(context)
      },
    )
  }

  function newChat() {
    const context = project()
    if (!context) return
    const request = Object.freeze({ projectID: context.projectID })
    const revision = store.selectionRevision
    command(
      request.projectID,
      (signal) => props.ports.createChat(request, signal),
      (result) => {
        if (result.projectID !== request.projectID || conflicts(store.membership, result)) {
          throw { code: "chat_session_conflict", recovery: "reopen_project" }
        }
        const reference = copyChat(result)
        remember([reference])
        setStore("membershipRevisions", request.projectID, (revision = 0) => revision + 1)
        setStore("chats", request.projectID, (chats = []) => [
          ...chats.filter((chat) => chatKey(chat) !== chatKey(reference)),
          reference,
        ])
        if (store.selectionRevision === revision) setStore("selections", request.projectID, reference)
      },
    )
  }

  function reopen() {
    const context = project()
    if (!context) return
    const reference = selected()
    const request = Object.freeze({ root: context.canonicalRoot })
    command(
      context.projectID,
      (signal) => props.ports.open(request, signal),
      (result) => {
        if (result.projectID !== context.projectID || result.canonicalRoot !== context.canonicalRoot)
          throw { code: "project_changed", recovery: "reopen_project" }
        if (reference) setStore("errors", chatKey(reference), undefined)
        setStore("projects", (projects) =>
          projects.map((item) => (item.projectID === context.projectID ? copyProject(result) : item)),
        )
      },
    )
  }

  function stop() {
    const active = owner()?.active
    if (!active || owner()?.state !== "ready") return
    const reference = copyChat(active)
    command(
      `stop:${chatKey(reference)}`,
      (signal) => props.ports.stop(reference, signal),
      () => {},
    )
  }

  function canSubmit(chat: FtcProject.ChatRef) {
    const status = store.owners[chat.projectID]
    return (
      status?.state === "ready" &&
      store.lists[chat.projectID] === "ready" &&
      (!status.active || chatKey(status.active) === chatKey(chat)) &&
      !store.pending[chatKey(chat)]
    )
  }

  return (
    <section aria-label={props.language.t("sidebar.nav.projectsAndSessions")}>
      <nav aria-label={props.language.t("sidebar.nav.projectsAndSessions")}>
        <button data-action="create" disabled={store.pending.association} onClick={() => associate("create")}>
          {props.language.t("session.new.project.new")}
        </button>
        <button data-action="open" disabled={store.pending.association} onClick={() => associate("open")}>
          {props.language.t("command.project.open")}
        </button>
        <For each={store.projects}>
          {(context) => (
            <button
              data-project-id={context.projectID}
              aria-pressed={store.projectID === context.projectID}
              onClick={() => selectProject(context)}
            >
              {context.canonicalRoot}
            </button>
          )}
        </For>
      </nav>
      <Show when={!project() && store.errors.association}>
        <p role="alert">{props.language.t("common.requestFailed")}</p>
      </Show>
      <Show when={project()}>
        {(context) => (
          <>
            <button data-action="new-chat" disabled={store.pending[context().projectID]} onClick={newChat}>
              {props.language.t("command.session.new")}
            </button>
            <For each={store.chats[context().projectID]}>
              {(chat) => (
                <button
                  data-chat-id={chat.chatID}
                  aria-pressed={selected()?.chatID === chat.chatID}
                  onClick={() =>
                    setStore({
                      selections: { ...store.selections, [chat.projectID]: copyChat(chat) },
                      selectionRevision: store.selectionRevision + 1,
                    })
                  }
                >
                  {chat.chatID}
                </button>
              )}
            </For>
            <Show when={owner()?.state === "loading" || store.lists[context().projectID] === "loading"}>
              <p role="status">{props.language.t("common.loading")}</p>
            </Show>
            <Show when={queryFailed()}>
              <p role="alert">{props.language.t("ftc.workspace.queryFailed")}</p>
            </Show>
            <Show when={owner()?.active}>
              {(active) => (
                <>
                  <p role="status">{props.language.t("ftc.workspace.activeChat", { chatID: active().chatID })}</p>
                  <button
                    data-action="stop"
                    disabled={owner()?.state !== "ready" || store.pending[`stop:${chatKey(active())}`]}
                    onClick={stop}
                  >
                    {props.language.t("prompt.action.stop")}
                  </button>
                  <Show when={selected() && chatKey(selected()!) !== chatKey(active())}>
                    <p>{props.language.t("ftc.workspace.busyDraft")}</p>
                  </Show>
                </>
              )}
            </Show>
            <Show when={error()}>
              {(issue) => (
                <p role="alert">
                  {props.language.t(
                    issue().membership
                      ? "ftc.workspace.membershipFailed"
                      : issue().send
                        ? "ftc.workspace.sendFailed"
                        : "common.requestFailed",
                  )}
                </p>
              )}
            </Show>
            <Show when={error()?.reopen}>
              <button data-action="reopen" disabled={store.pending[context().projectID]} onClick={reopen}>
                {props.language.t("ftc.workspace.reopen")}
              </button>
            </Show>
            <Show when={queryFailed() || (error() && !error()?.reopen)}>
              <button
                data-action="retry"
                onClick={() => {
                  // Recovery rechecks observation only; it never retries a submitted draft.
                  setStore("refresh", store.refresh + 1)
                }}
              >
                {props.language.t("ftc.workspace.retry")}
              </button>
            </Show>
            <Show when={selected()} keyed>
              {(chat) => {
                const reference = copyChat(chat)
                const key = chatKey(reference)
                const view = { live: true }
                onCleanup(() => {
                  view.live = false
                })
                return (
                  <props.chat
                    project={copyProject(context())}
                    chat={reference}
                    draft={store.drafts[key]?.text ?? ""}
                    activeChatID={store.owners[reference.projectID]?.active?.chatID}
                    canSubmit={canSubmit(reference)}
                    submitting={store.pending[key] ?? false}
                    onStop={() => {
                      if (scope.live && view.live) stop()
                    }}
                    onDraft={(text) => {
                      if (scope.live && view.live)
                        setStore("drafts", key, { text, revision: (store.drafts[key]?.revision ?? 0) + 1 })
                    }}
                    onSubmit={(options) => {
                      if (!scope.live || !view.live || !canSubmit(reference)) return
                      const draft = store.drafts[key]
                      if (!draft?.text.trim()) return
                      const captured = { text: draft.text, revision: draft.revision }
                      const epoch = store.owners[reference.projectID].epoch
                      const request = Object.freeze({
                        chat: reference,
                        prompt: Object.freeze({ text: captured.text }),
                        ...options,
                      })
                      command(
                        key,
                        (signal) => props.ports.submit(request, signal),
                        (result) => {
                          if (result.kind === "busy") {
                            if (store.owners[reference.projectID]?.epoch !== epoch) return
                            if (
                              !validOwner(
                                { projectID: reference.projectID, active: result.active },
                                reference.projectID,
                                [...store.membership, ...store.observedOwners],
                              )
                            ) {
                              rejectOwner(reference.projectID)
                              throw { code: "chat_session_conflict", recovery: "reopen_project" }
                            }
                            rememberOwner(result.active)
                            setStore("owners", reference.projectID, {
                              state: "ready",
                              active: copyChat(result.active),
                            })
                            return
                          }
                          if (result.receipt.sessionID !== reference.sessionID)
                            throw { code: "session_mismatch", recovery: "reopen_project" }
                          if (store.drafts[key]?.revision === captured.revision)
                            setStore("drafts", key, { text: "", revision: captured.revision + 1 })
                        },
                        true,
                      )
                    }}
                  />
                )
              }}
            </Show>
          </>
        )}
      </Show>
    </section>
  )
}

function chatKey(chat: FtcProject.ChatRef) {
  return JSON.stringify([chat.projectID, chat.chatID, chat.sessionID])
}

function copyChat(chat: FtcProject.ChatRef): FtcProject.ChatRef {
  return Object.freeze({ projectID: chat.projectID, chatID: chat.chatID, sessionID: chat.sessionID })
}

function copyProject(project: FtcProject.ProjectContext): FtcProject.ProjectContext {
  return Object.freeze({
    projectID: project.projectID,
    canonicalRoot: project.canonicalRoot,
    location: Object.freeze({
      directory: project.location.directory,
      workspaceID: project.location.workspaceID,
      project: Object.freeze({ id: project.location.project.id, directory: project.location.project.directory }),
    }),
  })
}

function conflicts(known: readonly FtcProject.ChatRef[], chat: FtcProject.ChatRef) {
  return known.some(
    (item) => (item.chatID === chat.chatID || item.sessionID === chat.sessionID) && chatKey(item) !== chatKey(chat),
  )
}

function validOwner(
  status: FtcProject.OwnerStatus,
  projectID: FtcProject.ProjectContext["projectID"],
  known: readonly FtcProject.ChatRef[],
) {
  return (
    status.projectID === projectID &&
    (!status.active || (status.active.projectID === projectID && !conflicts(known, status.active)))
  )
}

function failure(cause: unknown, send: boolean): Failure {
  const code = typeof cause === "object" && cause !== null && "code" in cause ? cause.code : undefined
  const reopen =
    typeof cause === "object" && cause !== null && "recovery" in cause && cause.recovery === "reopen_project"
  return {
    membership: code === "project_changed" || code === "session_mismatch" || code === "chat_session_conflict",
    send,
    reopen,
  }
}
