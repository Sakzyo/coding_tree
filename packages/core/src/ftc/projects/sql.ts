export * as ProjectAssociations from "./sql"

import type { EffectDrizzleSqlite } from "@opencode-ai/effect-drizzle-sqlite"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { Location } from "@opencode-ai/schema/location"
import { Project } from "@opencode-ai/schema/project"
import { text, sqliteTable } from "drizzle-orm/sqlite-core"
import { Effect } from "effect"
import { absoluteColumn } from "../../database/path"
import type { FtcProjects } from "../projects"

export const ProjectAssociationTable = sqliteTable("ftc_project_association", {
  canonical_root: absoluteColumn().primaryKey(),
  project_id: text().$type<Project.ID>().notNull().unique(),
  host_project_id: text().$type<Project.ID>().notNull(),
  host_project_directory: absoluteColumn().notNull(),
})

export function make(db: EffectDrizzleSqlite.EffectSQLiteDatabase): FtcProjects.Repository {
  return {
    associate: (folder) =>
      Effect.gen(function* () {
        const [row] = yield* db
          .insert(ProjectAssociationTable)
          .values({
            canonical_root: folder.canonicalRoot,
            project_id: Project.ID.make(`ftc_${crypto.randomUUID()}`),
            host_project_id: folder.location.project.id,
            host_project_directory: folder.location.project.directory,
          })
          .onConflictDoUpdate({
            target: ProjectAssociationTable.canonical_root,
            set: {
              host_project_id: folder.location.project.id,
              host_project_directory: folder.location.project.directory,
            },
          })
          .returning()
          .all()
        return {
          projectID: row.project_id,
          canonicalRoot: row.canonical_root,
          location: new Location.Info({
            directory: row.canonical_root,
            project: { id: row.host_project_id, directory: row.host_project_directory },
          }),
        }
      }).pipe(
        Effect.mapError(
          (cause): FtcProject.AssociationError => ({
            code: "association_store_failed",
            root: folder.canonicalRoot,
            detail: cause.message,
            recovery: "retry",
          }),
        ),
      ),
  }
}
