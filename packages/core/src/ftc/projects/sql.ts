export * as ProjectAssociations from "./sql"

import type { EffectDrizzleSqlite } from "@opencode-ai/effect-drizzle-sqlite"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { Location } from "@opencode-ai/schema/location"
import { Project } from "@opencode-ai/schema/project"
import { Session } from "@opencode-ai/schema/session"
import { eq } from "drizzle-orm"
import { integer, text, sqliteTable } from "drizzle-orm/sqlite-core"
import { Effect } from "effect"
import { absoluteColumn } from "../../database/path"
import type { FtcProjects } from "../projects"

export const ProjectAssociationTable = sqliteTable("ftc_project_association", {
  canonical_root: absoluteColumn().primaryKey(),
  project_id: text().$type<Project.ID>().notNull().unique(),
  host_project_id: text().$type<Project.ID>().notNull(),
  host_project_directory: absoluteColumn().notNull(),
})

export const ChatTable = sqliteTable("ftc_chat", {
  sequence: integer().primaryKey({ autoIncrement: true }),
  chat_id: text().$type<FtcProject.ChatID>().notNull().unique(),
  project_id: text()
    .$type<Project.ID>()
    .notNull()
    .references(() => ProjectAssociationTable.project_id),
  session_id: text().$type<Session.ID>().notNull().unique(),
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
    getProject: (input) =>
      db
        .select()
        .from(ProjectAssociationTable)
        .where(eq(ProjectAssociationTable.project_id, input.projectID))
        .get()
        .pipe(
          Effect.map((row) => (row ? context(row) : undefined)),
          Effect.mapError(
            (cause): FtcProject.ChatError => ({
              code: "chat_store_failed",
              projectID: input.projectID,
              detail: cause.message,
              recovery: "retry",
            }),
          ),
        ),
    addChat: (project, chat) =>
      db
        .transaction((tx) =>
          Effect.gen(function* () {
            const current = yield* tx
              .select()
              .from(ProjectAssociationTable)
              .where(eq(ProjectAssociationTable.project_id, project.projectID))
              .get()
            // An open may refresh the host mapping while Session creation is pending.
            // Validate the association in the same SQLite transaction as membership insertion.
            if (
              !current ||
              current.canonical_root !== project.canonicalRoot ||
              current.host_project_id !== project.location.project.id ||
              current.host_project_directory !== project.location.project.directory
            )
              return { kind: "changed" } as const
            const [row] = yield* tx
              .insert(ChatTable)
              .values({ chat_id: chat.chatID, project_id: project.projectID, session_id: chat.sessionID })
              .onConflictDoNothing()
              .returning()
              .all()
            if (!row) return { kind: "conflict" } as const
            return { kind: "created", chat: reference(row) } as const
          }),
        )
        .pipe(
          Effect.mapError(
            (cause): FtcProject.ChatError => ({
              code: "chat_store_failed",
              projectID: project.projectID,
              sessionID: chat.sessionID,
              detail: cause.message,
              recovery: "retry",
            }),
          ),
          Effect.flatMap((result) =>
            result.kind === "created"
              ? Effect.succeed(result.chat)
              : Effect.fail({
                  code: result.kind === "changed" ? "project_changed" : "chat_session_conflict",
                  projectID: project.projectID,
                  sessionID: chat.sessionID,
                  recovery: result.kind === "changed" ? "reopen_project" : "retry",
                } satisfies FtcProject.ChatError),
          ),
        ),
    listChats: (input) =>
      db
        .select()
        .from(ChatTable)
        .where(eq(ChatTable.project_id, input.projectID))
        .orderBy(ChatTable.sequence)
        .all()
        .pipe(
          Effect.map((rows) => rows.map(reference)),
          Effect.mapError(
            (cause): FtcProject.ChatError => ({
              code: "chat_store_failed",
              projectID: input.projectID,
              detail: cause.message,
              recovery: "retry",
            }),
          ),
        ),
  }
}

function context(row: typeof ProjectAssociationTable.$inferSelect): FtcProject.ProjectContext {
  return {
    projectID: row.project_id,
    canonicalRoot: row.canonical_root,
    location: new Location.Info({
      directory: row.canonical_root,
      project: { id: row.host_project_id, directory: row.host_project_directory },
    }),
  }
}

function reference(row: typeof ChatTable.$inferSelect): FtcProject.ChatRef {
  return { projectID: row.project_id, chatID: row.chat_id, sessionID: row.session_id }
}
