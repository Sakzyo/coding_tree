import type { FtcProject } from "@opencode-ai/schema/ftc-project"
import type { JSX } from "solid-js"
import type { useLanguage } from "../context/language"

export type WorkspaceLanguage = Pick<ReturnType<typeof useLanguage>, "t">

// The adapter supplies canonical records and unwraps structured domain failures.
// Aborting a view request retires its observation, never the domain execution.
export type WorkspacePorts = {
  selectFolder: (action: "create" | "open", signal: AbortSignal) => Promise<FtcProject.FolderRequest | undefined>
  create: (request: FtcProject.FolderRequest, signal: AbortSignal) => Promise<FtcProject.ProjectContext>
  open: (request: FtcProject.FolderRequest, signal: AbortSignal) => Promise<FtcProject.ProjectContext>
  listChats: (request: FtcProject.ProjectRequest, signal: AbortSignal) => Promise<readonly FtcProject.ChatRef[]>
  createChat: (request: FtcProject.ProjectRequest, signal: AbortSignal) => Promise<FtcProject.ChatRef>
  active: (request: FtcProject.ProjectRequest, signal: AbortSignal) => Promise<FtcProject.OwnerStatus>
  subscribeOwner: (request: FtcProject.ProjectRequest, receive: (status: FtcProject.OwnerStatus) => void) => () => void
  submit: (request: FtcProject.SubmitPrompt, signal: AbortSignal) => Promise<FtcProject.SubmitResult>
  stop: (chat: FtcProject.ChatRef, signal: AbortSignal) => Promise<void>
}

// The host owns conversation presentation/history. This slot receives view state
// and deliberate actions, without a second transcript or raw Session command API.
export type WorkspaceChatView = {
  project: FtcProject.ProjectContext
  chat: FtcProject.ChatRef
  draft: string
  activeChatID: FtcProject.ChatID | undefined
  canSubmit: boolean
  submitting: boolean
  onDraft: (text: string) => void
  onSubmit: (options?: Pick<FtcProject.SubmitPrompt, "delivery" | "resume" | "id">) => void
  onStop: () => void
}

export type WorkspaceProps = {
  projects: readonly FtcProject.ProjectContext[]
  ports: WorkspacePorts
  language: WorkspaceLanguage
  chat: (view: WorkspaceChatView) => JSX.Element
}
