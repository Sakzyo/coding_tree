export * as FtcProjects from "./projects"

import { Context, Effect, Layer, Schema } from "effect"
import path from "node:path"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { Location } from "@opencode-ai/schema/location"
import { Session } from "@opencode-ai/schema/session"

export {
  ProjectContext,
  FolderRequest,
  AssociationError,
  ChatID,
  ChatRef,
  ProjectRequest,
  ChatError,
} from "@opencode-ai/schema/ftc-project"

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
export const layer = (folders: FolderIdentity, repository: Repository, sessions: SessionAccess) => {
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
  const getProject = Effect.fn("FtcProjects.getProject")(function* (input: FtcProject.ProjectRequest) {
    const project = yield* repository.getProject(input)
    if (!project)
      return yield* Effect.fail({
        code: "project_not_found",
        projectID: input.projectID,
        recovery: "reopen_project",
      } satisfies FtcProject.ChatError)
    if (
      !Schema.is(FtcProject.ProjectContext)(project) ||
      !path.isAbsolute(project.canonicalRoot) ||
      !path.isAbsolute(project.location.project.directory) ||
      project.projectID !== input.projectID ||
      project.location.directory !== project.canonicalRoot ||
      project.location.workspaceID !== undefined
    )
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
  return Layer.succeed(Service, {
    getProject,
    createProject: associate,
    openProject: associate,
    createChat: Effect.fn("FtcProjects.createChat")(function* (input) {
      const project = yield* getProject(input)
      const session = yield* sessions.createSession({ location: { directory: project.location.directory } })
      if (!matches(project, session))
        return yield* Effect.fail({
          code: "session_mismatch",
          projectID: project.projectID,
          sessionID: session.id,
          recovery: "reopen_project",
        } satisfies FtcProject.ChatError)
      yield* lookup(project, session.id)
      // Session creation and M2 persistence have separate owners. Failed/interrupted membership
      // may leave an unassociated Session; M2 must never delete Session-owned data as compensation.
      return yield* repository.addChat(project, {
        projectID: project.projectID,
        chatID: FtcProject.ChatID.create(),
        sessionID: session.id,
      })
    }),
    listChats: Effect.fn("FtcProjects.listChats")(function* (input) {
      const project = yield* getProject(input)
      const chats = yield* repository.listChats(input)
      yield* Effect.forEach(chats, (chat) => lookup(project, chat.sessionID))
      return chats
    }),
  })
}

function matches(project: FtcProject.ProjectContext, session: Session.Info) {
  return (
    session.projectID === project.location.project.id &&
    session.location.directory === project.location.directory &&
    session.location.workspaceID === project.location.workspaceID
  )
}
