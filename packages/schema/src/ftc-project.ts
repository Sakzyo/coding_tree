export * as FtcProject from "./ftc-project"

import { Schema } from "effect"
import { Location } from "./location"
import { Project } from "./project"
import { Session } from "./session"
import { ascending } from "./identifier"
import { AbsolutePath, optional, statics } from "./schema"

export interface ProjectContext extends Schema.Schema.Type<typeof ProjectContext> {}
export const ProjectContext = Schema.Struct({
  // Local association ID. Never pass this to legacy Project APIs; use location.project.id.
  projectID: Project.ID,
  // Execution ownership is keyed by this canonical root, independent of the host project ID.
  canonicalRoot: AbsolutePath,
  location: Location.Info,
}).annotate({ identifier: "FtcProject.ProjectContext" })

export interface FolderRequest extends Schema.Schema.Type<typeof FolderRequest> {}
export const FolderRequest = Schema.Struct({ root: AbsolutePath }).annotate({ identifier: "FtcProject.FolderRequest" })

export interface AssociationError extends Schema.Schema.Type<typeof AssociationError> {}
export const AssociationError = Schema.Struct({
  code: Schema.Literals(["folder_unavailable", "invalid_folder_identity", "association_store_failed"]),
  root: optional(AbsolutePath),
  detail: optional(Schema.String),
  recovery: Schema.Literals(["select_accessible_folder", "retry"]),
}).annotate({ identifier: "FtcProject.AssociationError" })

export const ChatID = Schema.String.check(Schema.isStartsWith("chat_"))
  .pipe(Schema.brand("FtcProject.ChatID"))
  .annotate({ identifier: "FtcProject.ChatID" })
  .pipe(statics((schema) => ({ create: () => schema.make(`chat_${ascending()}`) })))
export type ChatID = typeof ChatID.Type

export interface ChatRef extends Schema.Schema.Type<typeof ChatRef> {}
export const ChatRef = Schema.Struct({
  projectID: Project.ID,
  chatID: ChatID,
  sessionID: Session.ID,
}).annotate({ identifier: "FtcProject.ChatRef" })

export interface ProjectRequest extends Schema.Schema.Type<typeof ProjectRequest> {}
export const ProjectRequest = Schema.Struct({ projectID: Project.ID }).annotate({
  identifier: "FtcProject.ProjectRequest",
})

export interface ChatError extends Schema.Schema.Type<typeof ChatError> {}
export const ChatError = Schema.Struct({
  code: Schema.Literals([
    "project_not_found",
    "project_changed",
    "session_not_found",
    "session_mismatch",
    "session_access_failed",
    "chat_session_conflict",
    "chat_store_failed",
  ]),
  projectID: Project.ID,
  sessionID: optional(Session.ID),
  detail: optional(Schema.String),
  recovery: Schema.Literals(["reopen_project", "retry"]),
}).annotate({ identifier: "FtcProject.ChatError" })

// Process-local claim identity. Never persist or use as an approval credential.
export const GateToken = Schema.String.check(Schema.isStartsWith("gate_"))
  .pipe(Schema.brand("FtcProject.GateToken"))
  .annotate({ identifier: "FtcProject.GateToken" })
export type GateToken = typeof GateToken.Type

export interface GateLease extends Schema.Schema.Type<typeof GateLease> {}
export const GateLease = Schema.Struct({
  projectKey: AbsolutePath.check(Schema.isPattern(/^(?:\/|[a-zA-Z]:[\\/]|\\\\)/)),
  chatID: ChatID,
  sessionID: Session.ID,
  token: GateToken,
}).annotate({ identifier: "FtcProject.GateLease" })

export const GateResult = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("acquired"), lease: GateLease }),
  Schema.Struct({ kind: Schema.Literal("busy"), active: ChatRef }),
]).annotate({ identifier: "FtcProject.GateResult" })
export type GateResult = typeof GateResult.Type

export interface GateError extends Schema.Schema.Type<typeof GateError> {}
export const GateError = Schema.Struct({
  code: Schema.Literals(["invalid_chat", "chat_not_found", "invalid_project", "gate_closed"]),
  projectID: optional(Project.ID),
  recovery: Schema.Literals(["reopen_project", "retry"]),
}).annotate({ identifier: "FtcProject.GateError" })
