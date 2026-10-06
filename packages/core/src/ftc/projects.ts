export * as FtcProjects from "./projects"

import { Context, Effect, Layer } from "effect"
import path from "node:path"
import { FtcProject } from "@opencode-ai/schema/ftc-project"

export { ProjectContext, FolderRequest, AssociationError } from "@opencode-ai/schema/ftc-project"

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
}

export interface Interface {
  readonly createProject: (
    input: FtcProject.FolderRequest,
  ) => Effect.Effect<FtcProject.ProjectContext, FtcProject.AssociationError>
  readonly openProject: (
    input: FtcProject.FolderRequest,
  ) => Effect.Effect<FtcProject.ProjectContext, FtcProject.AssociationError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/FtcProjects") {}

/**
 * Construct within the owning Location scope; the caller owns the injected repository connection.
 * Interruption before association leaves no row. Once the atomic write commits, retry reconciles by root.
 */
export const layer = (folders: FolderIdentity, repository: Repository) => {
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
  return Layer.succeed(Service, { createProject: associate, openProject: associate })
}
