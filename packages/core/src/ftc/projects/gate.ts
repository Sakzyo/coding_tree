export * as ProjectGate from "./gate"

import { Context, Effect, Layer, Schema, Scope } from "effect"
import { randomUUID } from "node:crypto"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { FtcProjects } from "../projects"

export { GateToken, GateLease, GateResult, GateError } from "@opencode-ai/schema/ftc-project"

export type Projects = Pick<FtcProjects.Interface, "getProject" | "listChats">

export interface Interface {
  readonly acquire: (
    chat: FtcProject.ChatRef,
  ) => Effect.Effect<FtcProject.GateResult, FtcProject.GateError | FtcProject.ChatError>
  readonly release: (lease: FtcProject.GateLease) => Effect.Effect<void>
  readonly held: (lease: FtcProject.GateLease) => Effect.Effect<boolean>
  readonly activeChat: (
    input: FtcProject.ProjectRequest,
  ) => Effect.Effect<FtcProject.ChatRef | undefined, FtcProject.GateError | FtcProject.ChatError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ProjectGate") {}

/**
 * Every same-chat acquisition owns a distinct claim. Release only that claim; the last
 * release frees the root. Callers bracket failure/cancellation or explicitly transfer
 * successful claims to their execution owner. Closing this scope invalidates all claims.
 */
export const make = (projects: Projects): Effect.Effect<Interface, never, Scope.Scope> =>
  Effect.gen(function* () {
    const owners = new Map<string, { readonly chat: FtcProject.ChatRef; readonly tokens: Set<FtcProject.GateToken> }>()
    let closed = false
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        closed = true
        owners.clear()
      }),
    )
    const resolve = Effect.fn("ProjectGate.resolve")(function* (input: FtcProject.ProjectRequest) {
      if (closed) return yield* Effect.fail({ code: "gate_closed", recovery: "retry" } satisfies FtcProject.GateError)
      const project = yield* projects.getProject(input)
      if (!FtcProjects.validProjectContext(project, input))
        return yield* Effect.fail({
          code: "invalid_project",
          projectID: input.projectID,
          recovery: "reopen_project",
        } satisfies FtcProject.GateError)
      return project
    })
    return {
      acquire: Effect.fn("ProjectGate.acquire")(function* (chat) {
        if (!Schema.is(FtcProject.ChatRef)(chat))
          return yield* Effect.fail({ code: "invalid_chat", recovery: "reopen_project" } satisfies FtcProject.GateError)
        // Snapshot caller input before asynchronous lookup; it is not membership authority.
        const requested = Object.freeze({ ...chat })
        const project = yield* resolve(requested)
        const members = yield* projects.listChats(requested)
        if (
          !members.some(
            (member) =>
              member.projectID === requested.projectID &&
              member.chatID === requested.chatID &&
              member.sessionID === requested.sessionID,
          )
        )
          return yield* Effect.fail({
            code: "chat_not_found",
            projectID: requested.projectID,
            recovery: "reopen_project",
          } satisfies FtcProject.GateError)
        // One synchronous step checks and allocates. Lookups may race; ownership cannot.
        return yield* Effect.suspend((): Effect.Effect<FtcProject.GateResult, FtcProject.GateError> => {
          if (closed) return Effect.fail({ code: "gate_closed", recovery: "retry" } satisfies FtcProject.GateError)
          const owner = owners.get(project.canonicalRoot)
          if (owner && (owner.chat.chatID !== requested.chatID || owner.chat.sessionID !== requested.sessionID))
            return Effect.succeed({ kind: "busy", active: owner.chat } as const)
          const token = FtcProject.GateToken.make(`gate_${randomUUID()}`)
          const entry = owner ?? { chat: requested, tokens: new Set<FtcProject.GateToken>() }
          entry.tokens.add(token)
          owners.set(project.canonicalRoot, entry)
          return Effect.succeed({
            kind: "acquired",
            lease: Object.freeze({
              projectKey: project.canonicalRoot,
              chatID: requested.chatID,
              sessionID: requested.sessionID,
              token,
            }),
          } as const)
        }).pipe(Effect.uninterruptible)
      }),
      release: (lease) =>
        Effect.sync(() => {
          if (!Schema.is(FtcProject.GateLease)(lease)) return
          const owner = owners.get(lease.projectKey)
          if (
            !owner ||
            owner.chat.chatID !== lease.chatID ||
            owner.chat.sessionID !== lease.sessionID ||
            !owner.tokens.delete(lease.token)
          )
            return
          if (owner.tokens.size === 0) owners.delete(lease.projectKey)
        }),
      held: (lease) =>
        Effect.sync(() => {
          if (!Schema.is(FtcProject.GateLease)(lease)) return false
          const owner = owners.get(lease.projectKey)
          return (
            owner !== undefined &&
            owner.chat.chatID === lease.chatID &&
            owner.chat.sessionID === lease.sessionID &&
            owner.tokens.has(lease.token)
          )
        }),
      activeChat: Effect.fn("ProjectGate.activeChat")(function* (input) {
        const project = yield* resolve(input)
        return yield* Effect.suspend(() =>
          closed
            ? Effect.fail({ code: "gate_closed", recovery: "retry" } satisfies FtcProject.GateError)
            : Effect.succeed(owners.get(project.canonicalRoot)?.chat),
        )
      }),
    }
  })

export const layer = (projects: Projects) => Layer.effect(Service, make(projects))
