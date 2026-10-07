export * as FtcProjects from "./projects"

import { Context, Deferred, Effect, Exit, Layer, Schema } from "effect"
import path from "node:path"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { Location } from "@opencode-ai/schema/location"
import { Session } from "@opencode-ai/schema/session"
import { SessionInput } from "@opencode-ai/schema/session-input"
import type { SessionV2 } from "../session"
import type { ProjectGate } from "./projects/gate"

export {
  ProjectContext,
  FolderRequest,
  AssociationError,
  ChatID,
  ChatRef,
  ProjectRequest,
  ChatError,
  SubmitPrompt,
  SubmitResult,
  ExecutionUnavailable,
  OwnerChanged,
  OwnerStatus,
  GateError,
} from "@opencode-ai/schema/ftc-project"

export interface Submission {
  readonly gate: {
    readonly acquire: (
      chat: FtcProject.ChatRef,
    ) => Effect.Effect<FtcProject.GateResult, FtcProject.GateError | FtcProject.ChatError>
    readonly release: (lease: FtcProject.GateLease) => Effect.Effect<void>
  }
  readonly admission: {
    readonly prompt: (
      input: Parameters<SessionV2.Interface["prompt"]>[0],
      lease?: FtcProject.GateLease,
    ) => ReturnType<SessionV2.Interface["prompt"]>
  }
  /** Success accepts exact-token responsibility before wake. Failure leaves no accepted claim or scheduled wake.
   * This bounded registration must not await model execution or terminal settlement. The adapter releases only after
   * execution has acquired a distinct claim or terminal settlement, never on wake return. */
  readonly handoff: (input: {
    readonly chat: FtcProject.ChatRef
    readonly receipt: SessionInput.Admitted
    readonly lease: FtcProject.GateLease
  }) => Effect.Effect<void, FtcProject.GateError>
}

export const submitter = (input: Submission) => ({
  submitPrompt: Effect.fn("FtcProjects.submitPrompt")((request: FtcProject.SubmitPrompt) =>
    Effect.scoped(
      Effect.uninterruptibleMask((restore) =>
        Effect.gen(function* () {
          const chat = Object.freeze({ ...request.chat })
          const ownership = { accepted: false }
          const reserved = yield* Effect.acquireRelease(
            restore(input.gate.acquire(chat)),
            (result) =>
              result.kind === "acquired" && !ownership.accepted ? input.gate.release(result.lease) : Effect.void,
            { interruptible: true },
          )
          if (reserved.kind === "busy") return reserved
          const receipt = yield* restore(
            input.admission.prompt(
              {
                sessionID: chat.sessionID,
                prompt: request.prompt,
                id: request.id,
                delivery: request.delivery,
                resume: false,
              },
              reserved.lease,
            ),
          )
          if (request.resume !== false) {
            // Accept exact-token ownership before interruption can observe success. Wake is not settlement.
            yield* input.handoff({ chat, receipt, lease: reserved.lease })
            ownership.accepted = true
          }
          return { kind: "admitted", receipt } as const
        }),
      ),
    ),
  ),
})

export interface ExecutionLifecycle {
  /** Bounded registration/scheduling. The host must later notify the exact admission lease's terminal chain,
   * including no-work/rejection/cancellation without execution acquisition. Wake return is not settlement. */
  readonly wake: Submission["handoff"]
  readonly interrupt: (sessionID: Session.ID) => Effect.Effect<void>
}

/** Admission and execution tokens are independent. The integration adapter associates each admission
 * with its actual terminal chain; an older execution notification never settles later admission. */
export const lifecycle = (input: {
  readonly gate: Pick<ProjectGate.Interface, "acquire" | "release" | "held" | "activeChat">
  readonly execution: ExecutionLifecycle
}) =>
  Effect.gen(function* () {
    const claims = new Map<
      FtcProject.GateToken,
      { readonly lease: FtcProject.GateLease; pending?: Deferred.Deferred<void>; terminal: boolean }
    >()
    let closed = false
    const settled = (lease: FtcProject.GateLease): Effect.Effect<void> =>
      Effect.suspend(() => {
        if (!Schema.is(FtcProject.GateLease)(lease)) return Effect.void
        const claim = claims.get(lease.token)
        if (
          !claim ||
          claim.lease.projectKey !== lease.projectKey ||
          claim.lease.chatID !== lease.chatID ||
          claim.lease.sessionID !== lease.sessionID
        )
          return Effect.void
        if (claim.pending) {
          claim.terminal = true
          return Effect.void
        }
        claims.delete(lease.token)
        return input.gate.release(claim.lease)
      }).pipe(Effect.uninterruptible)
    const awaitPending = (sessionID?: Session.ID): Effect.Effect<void> =>
      Effect.suspend(() => {
        const pending = [...claims.values()].flatMap((claim) =>
          claim.pending && (sessionID === undefined || claim.lease.sessionID === sessionID) ? [claim.pending] : [],
        )
        return pending.length === 0
          ? Effect.void
          : Effect.forEach(pending, Deferred.await).pipe(Effect.andThen(awaitPending(sessionID)))
      })
    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        closed = true
        yield* awaitPending()
        const sessions = new Set([...claims.values()].map((claim) => claim.lease.sessionID))
        yield* Effect.forEach(sessions, input.execution.interrupt, { concurrency: "unbounded" }).pipe(
          Effect.ensuring(Effect.forEach([...claims.values()], (claim) => settled(claim.lease))),
        )
      }),
    )
    return {
      acquire: Effect.fn("FtcProjects.acquireExecution")((chat: FtcProject.ChatRef) =>
        Effect.scoped(
          Effect.uninterruptibleMask((restore) =>
            Effect.gen(function* () {
              if (closed)
                return yield* Effect.fail({ code: "gate_closed", recovery: "retry" } satisfies FtcProject.GateError)
              const ownership = { accepted: false }
              const result = yield* Effect.acquireRelease(
                restore(input.gate.acquire(chat)),
                (result) =>
                  result.kind === "acquired" && !ownership.accepted ? input.gate.release(result.lease) : Effect.void,
                { interruptible: true },
              )
              if (result.kind === "busy") return result
              if (closed)
                return yield* Effect.fail({ code: "gate_closed", recovery: "retry" } satisfies FtcProject.GateError)
              claims.set(result.lease.token, { lease: result.lease, terminal: false })
              ownership.accepted = true
              return result
            }),
          ),
        ),
      ),
      handoff: Effect.fn("FtcProjects.handoff")((request: Parameters<Submission["handoff"]>[0]) =>
        Effect.uninterruptible(
          Effect.gen(function* () {
            if (closed)
              return yield* Effect.fail({ code: "gate_closed", recovery: "retry" } satisfies FtcProject.GateError)
            const lease = Object.freeze({ ...request.lease })
            const chat = Object.freeze({ ...request.chat })
            if (
              !Schema.is(FtcProject.ChatRef)(chat) ||
              chat.chatID !== lease.chatID ||
              chat.sessionID !== lease.sessionID ||
              request.receipt.sessionID !== lease.sessionID ||
              !(yield* input.gate.held(lease)) ||
              claims.has(lease.token)
            )
              return yield* Effect.fail({
                code: "invalid_chat",
                recovery: "reopen_project",
              } satisfies FtcProject.GateError)
            if (closed)
              return yield* Effect.fail({ code: "gate_closed", recovery: "retry" } satisfies FtcProject.GateError)
            const pending = Deferred.makeUnsafe<void>()
            const claim = { lease, pending: pending as Deferred.Deferred<void> | undefined, terminal: false }
            claims.set(lease.token, claim)
            return yield* input.execution.wake({ ...request, chat, lease }).pipe(
              Effect.onExit((exit) =>
                Effect.gen(function* () {
                  claim.pending = undefined
                  if (Exit.isFailure(exit) || claim.terminal) yield* settled(lease)
                  yield* Deferred.succeed(pending, undefined)
                }),
              ),
            )
          }),
        ),
      ),
      settled,
      stopRun: Effect.fn("FtcProjects.stopRun")((request: { readonly chat: FtcProject.ChatRef }) =>
        Effect.uninterruptible(
          Effect.gen(function* () {
            if (closed) return yield* Effect.void
            const chat = Object.freeze({ ...request.chat })
            if (!Schema.is(FtcProject.ChatRef)(chat))
              return yield* Effect.fail({
                code: "invalid_chat",
                recovery: "reopen_project",
              } satisfies FtcProject.GateError)
            yield* awaitPending(chat.sessionID)
            if (closed) return yield* Effect.void
            const active = yield* input.gate.activeChat(chat)
            if (active?.chatID !== chat.chatID || active.sessionID !== chat.sessionID) return yield* Effect.void
            return yield* input.execution.interrupt(chat.sessionID)
          }),
        ),
      ),
    }
  })

/** Resolves symlink/case aliases, inspects directory access, and supplies existing host identity without file edits. */
export interface FolderIdentity {
  readonly resolve: (
    input: FtcProject.FolderRequest,
  ) => Effect.Effect<Omit<FtcProject.ProjectContext, "projectID">, FtcProject.AssociationError>
}

export interface Repository {
  readonly associate: (
    folder: Omit<FtcProject.ProjectContext, "projectID">,
  ) => Effect.Effect<FtcProject.ProjectContext, FtcProject.AssociationError>
  readonly getProject: (
    input: FtcProject.ProjectRequest,
  ) => Effect.Effect<FtcProject.ProjectContext | undefined, FtcProject.ChatError>
  readonly addChat: (
    project: FtcProject.ProjectContext,
    chat: FtcProject.ChatRef,
  ) => Effect.Effect<FtcProject.ChatRef, FtcProject.ChatError>
  readonly listChats: (
    input: FtcProject.ProjectRequest,
  ) => Effect.Effect<readonly FtcProject.ChatRef[], FtcProject.ChatError>
}

export interface SessionAccess {
  readonly createSession: (input: {
    readonly location: Location.Ref
  }) => Effect.Effect<Session.Info, FtcProject.ChatError>
  readonly getSession: (id: Session.ID) => Effect.Effect<Session.Info | undefined, FtcProject.ChatError>
}

export interface Interface {
  readonly getChat: (
    chat: FtcProject.ChatRef,
  ) => Effect.Effect<FtcProject.ChatRef, FtcProject.ChatError | FtcProject.GateError>
  readonly getProject: (
    input: FtcProject.ProjectRequest,
  ) => Effect.Effect<FtcProject.ProjectContext, FtcProject.ChatError>
  readonly createProject: (
    input: FtcProject.FolderRequest,
  ) => Effect.Effect<FtcProject.ProjectContext, FtcProject.AssociationError>
  readonly openProject: (
    input: FtcProject.FolderRequest,
  ) => Effect.Effect<FtcProject.ProjectContext, FtcProject.AssociationError>
  readonly createChat: (input: FtcProject.ProjectRequest) => Effect.Effect<FtcProject.ChatRef, FtcProject.ChatError>
  readonly listChats: (
    input: FtcProject.ProjectRequest,
  ) => Effect.Effect<readonly FtcProject.ChatRef[], FtcProject.ChatError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/FtcProjects") {}

/**
 * Construct within the owning Location scope; the caller owns the injected repository connection.
 * Interruption before association leaves no row. Once the atomic write commits, retry reconciles by root.
 */
export const make = (folders: FolderIdentity, repository: Repository, sessions: SessionAccess): Interface => {
  const associate = Effect.fn("FtcProjects.associate")(function* (input: FtcProject.FolderRequest) {
    const folder = yield* folders.resolve(input)
    if (
      !path.isAbsolute(folder.canonicalRoot) ||
      folder.location.directory !== folder.canonicalRoot ||
      !path.isAbsolute(folder.location.project.directory) ||
      folder.location.workspaceID !== undefined
    )
      return yield* Effect.fail({
        code: "invalid_folder_identity",
        root: input.root,
        recovery: "select_accessible_folder",
      } satisfies FtcProject.AssociationError)
    return yield* repository.associate(folder)
  })
  const read = reader(repository, sessions)
  return {
    getProject: read.getProject,
    getChat: (chat) =>
      read.listChats(chat).pipe(
        Effect.flatMap((chats) => {
          const found = chats.find((item) => item.chatID === chat.chatID && item.sessionID === chat.sessionID)
          return found
            ? Effect.succeed(found)
            : Effect.fail({
                code: "chat_not_found",
                projectID: chat.projectID,
                recovery: "reopen_project",
              } satisfies FtcProject.GateError)
        }),
      ),
    createProject: associate,
    openProject: associate,
    createChat: Effect.fn("FtcProjects.createChat")(function* (input) {
      const project = yield* read.getProject(input)
      const session = yield* sessions.createSession({ location: { directory: project.location.directory } })
      if (!matches(project, session))
        return yield* Effect.fail({
          code: "session_mismatch",
          projectID: project.projectID,
          sessionID: session.id,
          recovery: "reopen_project",
        } satisfies FtcProject.ChatError)
      yield* read.lookup(project, session.id)
      // Session creation and M2 persistence have separate owners. Failed/interrupted membership
      // may leave an unassociated Session; M2 must never delete Session-owned data as compensation.
      return yield* repository.addChat(project, {
        projectID: project.projectID,
        chatID: FtcProject.ChatID.create(),
        sessionID: session.id,
      })
    }),
    listChats: read.listChats,
  }
}

export const layer = (folders: FolderIdentity, repository: Repository, sessions: SessionAccess) =>
  Layer.succeed(Service, make(folders, repository, sessions))

export const reader = (repository: Repository, sessions: Pick<SessionAccess, "getSession">) => {
  const getProject = Effect.fn("FtcProjects.getProject")(function* (input: FtcProject.ProjectRequest) {
    const project = yield* repository.getProject(input)
    if (!project)
      return yield* Effect.fail({
        code: "project_not_found",
        projectID: input.projectID,
        recovery: "reopen_project",
      } satisfies FtcProject.ChatError)
    if (!validProjectContext(project, input))
      return yield* Effect.fail({
        code: "project_changed",
        projectID: input.projectID,
        recovery: "reopen_project",
      } satisfies FtcProject.ChatError)
    return project
  })
  const lookup = Effect.fn("FtcProjects.lookup")(function* (project: FtcProject.ProjectContext, sessionID: Session.ID) {
    const session = yield* sessions.getSession(sessionID)
    if (!session)
      return yield* Effect.fail({
        code: "session_not_found",
        projectID: project.projectID,
        sessionID,
        recovery: "reopen_project",
      } satisfies FtcProject.ChatError)
    if (session.id !== sessionID || !matches(project, session))
      return yield* Effect.fail({
        code: "session_mismatch",
        projectID: project.projectID,
        sessionID,
        recovery: "reopen_project",
      } satisfies FtcProject.ChatError)
    return session
  })
  return {
    getProject,
    lookup,
    listChats: Effect.fn("FtcProjects.listChats")(function* (input: FtcProject.ProjectRequest) {
      const project = yield* getProject(input)
      const chats = yield* repository.listChats(input)
      yield* Effect.forEach(chats, (chat) => lookup(project, chat.sessionID))
      return chats
    }),
  }
}

export function validProjectContext(project: FtcProject.ProjectContext, input: FtcProject.ProjectRequest) {
  return (
    Schema.is(FtcProject.ProjectContext)(project) &&
    path.isAbsolute(project.canonicalRoot) &&
    path.isAbsolute(project.location.project.directory) &&
    project.projectID === input.projectID &&
    project.location.directory === project.canonicalRoot &&
    project.location.workspaceID === undefined
  )
}

function matches(project: FtcProject.ProjectContext, session: Session.Info) {
  return (
    session.projectID === project.location.project.id &&
    session.location.directory === project.location.directory &&
    session.location.workspaceID === project.location.workspaceID
  )
}
