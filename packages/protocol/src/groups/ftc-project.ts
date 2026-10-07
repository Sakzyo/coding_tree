import { ConflictError, SessionNotFoundError, ServiceUnavailableError } from "../errors"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/unstable/httpapi"

export class ProjectError extends Schema.TaggedErrorClass<ProjectError>()(
  "FtcProjectApiError",
  {
    reason: Schema.Union([
      FtcProject.AssociationError,
      FtcProject.ChatError,
      FtcProject.GateError,
      FtcProject.ExecutionUnavailable,
    ]),
  },
  { httpApiStatus: 409 },
) {}

const root = "/api/ftc/project"
export const FtcProjectGroup = HttpApiGroup.make("server.ftcProject")
  .add(
    HttpApiEndpoint.post("ftcProject.create", root, {
      payload: FtcProject.FolderRequest,
      success: FtcProject.ProjectContext,
      error: [ProjectError, ConflictError, SessionNotFoundError, ServiceUnavailableError],
    }),
  )
  .add(
    HttpApiEndpoint.post("ftcProject.open", `${root}/open`, {
      payload: FtcProject.FolderRequest,
      success: FtcProject.ProjectContext,
      error: [ProjectError, ConflictError, SessionNotFoundError, ServiceUnavailableError],
    }),
  )
  .add(
    HttpApiEndpoint.post("ftcProject.read", `${root}/read`, {
      payload: FtcProject.ProjectRequest,
      success: FtcProject.ProjectContext,
      error: [ProjectError, ConflictError, SessionNotFoundError, ServiceUnavailableError],
    }),
  )
  .add(
    HttpApiEndpoint.post("ftcProject.createChat", `${root}/chat`, {
      payload: FtcProject.ProjectRequest,
      success: FtcProject.ChatRef,
      error: [ProjectError, ConflictError, SessionNotFoundError, ServiceUnavailableError],
    }),
  )
  .add(
    HttpApiEndpoint.post("ftcProject.listChats", `${root}/chats`, {
      payload: FtcProject.ProjectRequest,
      success: Schema.Array(FtcProject.ChatRef),
      error: [ProjectError, ConflictError, SessionNotFoundError, ServiceUnavailableError],
    }),
  )
  .add(
    HttpApiEndpoint.post("ftcProject.readChat", `${root}/chat/read`, {
      payload: FtcProject.ChatRef,
      success: FtcProject.ChatRef,
      error: [ProjectError, ConflictError, SessionNotFoundError, ServiceUnavailableError],
    }),
  )
  .add(
    HttpApiEndpoint.post("ftcProject.submit", `${root}/submit`, {
      payload: FtcProject.SubmitPrompt,
      success: FtcProject.SubmitResult,
      error: [ProjectError, ConflictError, SessionNotFoundError, ServiceUnavailableError],
    }),
  )
  .add(
    HttpApiEndpoint.post("ftcProject.resume", `${root}/resume`, {
      payload: FtcProject.ChatRef,
      success: FtcProject.ResumeResult,
      error: [ProjectError, ConflictError, SessionNotFoundError, ServiceUnavailableError],
    }),
  )
  .add(
    HttpApiEndpoint.post("ftcProject.stop", `${root}/stop`, {
      payload: FtcProject.ChatRef,
      success: HttpApiSchema.NoContent,
      error: [ProjectError, ConflictError, SessionNotFoundError, ServiceUnavailableError],
    }),
  )
  .add(
    HttpApiEndpoint.post("ftcProject.active", `${root}/active`, {
      payload: FtcProject.ProjectRequest,
      success: FtcProject.OwnerStatus,
      error: [ProjectError, ConflictError, SessionNotFoundError, ServiceUnavailableError],
    }),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "FTC projects",
      description:
        "Project and chat associations. Managed execution is unavailable until action isolation is enforced.",
    }),
  )
