import { FtcComposition } from "@opencode-ai/core/ftc/composition"
import { SessionV2 } from "@opencode-ai/core/session"
import { FtcProjects } from "@opencode-ai/core/ftc/projects"
import { ProjectError } from "@opencode-ai/protocol/groups/ftc-project"
import { ConflictError, SessionNotFoundError, ServiceUnavailableError } from "@opencode-ai/protocol/errors"
import { Effect, Schema } from "effect"
import { HttpApiBuilder, HttpApiSchema } from "effect/unstable/httpapi"
import { Api } from "../api"

export const FtcProjectHandler = HttpApiBuilder.group(Api, "server.ftcProject", (handlers) =>
  Effect.gen(function* () {
    const session = yield* SessionV2.Service
    const runtime = yield* FtcComposition.Service
    const projects = runtime.projects(session)
    const execution = runtime.bind(session)
    const command = <A, E>(effect: Effect.Effect<A, E>) =>
      effect.pipe(
        Effect.mapError((error) => {
          if (error instanceof SessionV2.PromptConflictError)
            return new ConflictError({
              message: "Prompt message ID conflicts with an existing durable record",
              resource: error.messageID,
            })
          if (error instanceof SessionV2.NotFoundError)
            return new SessionNotFoundError({ sessionID: error.sessionID, message: "Session not found" })
          if (
            Schema.is(FtcProjects.AssociationError)(error) ||
            Schema.is(FtcProjects.ChatError)(error) ||
            Schema.is(FtcProjects.GateError)(error) ||
            error instanceof FtcProjects.ExecutionUnavailable
          )
            return new ProjectError({ reason: error })
          return new ServiceUnavailableError({ message: "FTC execution unavailable" })
        }),
      )
    return handlers
      .handle("ftcProject.create", ({ payload }) => command(projects.createProject(payload)))
      .handle("ftcProject.open", ({ payload }) => command(projects.openProject(payload)))
      .handle("ftcProject.read", ({ payload }) => command(projects.getProject(payload)))
      .handle("ftcProject.createChat", ({ payload }) => command(projects.createChat(payload)))
      .handle("ftcProject.listChats", ({ payload }) => command(projects.listChats(payload)))
      .handle("ftcProject.readChat", ({ payload }) => command(projects.getChat(payload)))
      .handle("ftcProject.submit", ({ payload }) => command(execution.submitPrompt(payload)))
      .handle("ftcProject.resume", ({ payload }) => command(execution.resume(payload)))
      .handle("ftcProject.stop", ({ payload }) =>
        command(execution.stop(payload)).pipe(Effect.as(HttpApiSchema.NoContent.make())),
      )
      .handle("ftcProject.active", ({ payload }) => command(execution.active(payload)))
  }),
)
