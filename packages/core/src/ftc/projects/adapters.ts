export * as FtcProjectAdapters from "./adapters"

import fs from "node:fs/promises"
import { Effect } from "effect"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { AbsolutePath } from "@opencode-ai/schema/schema"
import { Location } from "@opencode-ai/schema/location"
import type { ProjectV2 } from "../../project"
import type { FtcAgentGate } from "../agent/gate"
import { FtcProjects } from "../projects"
import { ProjectAssociations } from "./sql"
import type { EffectDrizzleSqlite } from "@opencode-ai/effect-drizzle-sqlite"

const canonical = (input: FtcProject.FolderRequest) =>
  Effect.tryPromise({
    try: async () => {
      const root = await fs.realpath(input.root)
      if (!(await fs.stat(root)).isDirectory()) throw new Error("not_a_directory")
      await fs.access(root, fs.constants.R_OK)
      return AbsolutePath.make(root)
    },
    catch: (): FtcProject.AssociationError => ({
      code: "folder_unavailable",
      root: input.root,
      recovery: "select_accessible_folder",
    }),
  })

export const folders = (projects: Pick<ProjectV2.Interface, "resolve">): FtcProjects.FolderIdentity => ({
  resolve: (input) =>
    Effect.gen(function* () {
      const directory = yield* canonical(input)
      const project = yield* projects.resolve(directory)
      return {
        canonicalRoot: directory,
        location: new Location.Info({ directory, project: { id: project.id, directory: project.directory } }),
      }
    }),
})

export const membership = (input: {
  readonly folders: FtcProjects.FolderIdentity
  readonly repository: ProjectAssociations.Lookup
  readonly sessions: Pick<FtcProjects.SessionAccess, "getSession">
}) => {
  const read = FtcProjects.reader(input.repository, input.sessions)
  const resolve: FtcAgentGate.Port["resolve"] = (request) =>
    Effect.gen(function* () {
      const folder = yield* input.folders
        .resolve({ root: request.location.directory })
        .pipe(Effect.mapError((): FtcProject.GateError => ({ code: "invalid_project", recovery: "reopen_project" })))
      const project = yield* input.repository.findRoot(folder.canonicalRoot)
      const chat = yield* input.repository.findSession(request.sessionID)
      if (!project && !chat) return { kind: "unmanaged" } as const
      if (!project || !chat || project.projectID !== chat.projectID)
        return yield* Effect.fail({ code: "chat_not_found", recovery: "reopen_project" } satisfies FtcProject.GateError)
      if (
        request.location.workspaceID !== undefined ||
        folder.location.project.id !== project.location.project.id ||
        folder.location.project.directory !== project.location.project.directory
      )
        return yield* Effect.fail({
          code: "invalid_project",
          projectID: project.projectID,
          recovery: "reopen_project",
        } satisfies FtcProject.GateError)
      yield* read.lookup(project, request.sessionID)
      return { kind: "managed", chat } as const
    })
  return { ...read, resolve }
}

export const activation = (
  identity: FtcProjects.FolderIdentity,
  repository: ProjectAssociations.Lookup,
  activate: (request: FtcProject.FolderRequest) => Effect.Effect<void, FtcProject.AssociationError>,
): FtcProjects.FolderIdentity => ({
  resolve: (request) =>
    Effect.gen(function* () {
      const folder = yield* identity.resolve(request)
      const existing = yield* repository
        .findRoot(folder.canonicalRoot)
        .pipe(
          Effect.mapError((): FtcProject.AssociationError => ({ code: "association_store_failed", recovery: "retry" })),
        )
      if (!existing) yield* activate({ root: folder.canonicalRoot })
      return folder
    }),
})

export const guardLegacy = (repository: ProjectAssociations.Lookup) => (request: FtcProject.FolderRequest) =>
  canonical(request).pipe(
    Effect.flatMap(repository.findRoot),
    Effect.mapError(() => new FtcProject.ExecutionUnavailable({ code: "membership_unavailable" })),
    Effect.flatMap((project) =>
      project ? Effect.fail(new FtcProject.ExecutionUnavailable({ code: "legacy_execution_disabled" })) : Effect.void,
    ),
  )

/** Legacy hosts borrow their database; M2 owns canonical-root association queries and refusal. */
export const legacy = (db: EffectDrizzleSqlite.EffectSQLiteDatabase) => guardLegacy(ProjectAssociations.make(db))
