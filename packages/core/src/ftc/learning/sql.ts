export * as LearningAttempts from "./sql"

import type { EffectDrizzleSqlite } from "@opencode-ai/effect-drizzle-sqlite"
import { FtcLearning } from "@opencode-ai/schema/ftc-learning"
import { Project } from "@opencode-ai/schema/project"
import { and, eq } from "drizzle-orm"
import { primaryKey, text, sqliteTable } from "drizzle-orm/sqlite-core"
import { Effect, Schema } from "effect"

export const AttemptTable = sqliteTable(
  "ftc_learning_attempt",
  {
    course_id: text().notNull(),
    lesson_id: text().notNull(),
    lesson_version: text().notNull(),
    attempt_id: text().$type<FtcLearning.AttemptID>().notNull(),
    project_id: text().$type<Project.ID>().notNull(),
    configuration_revision: text().notNull(),
    outcome: text().$type<FtcLearning.Attempt["outcome"]>().notNull(),
    evidence_json: text().notNull(),
    explanation: text().notNull(),
  },
  (table) => [primaryKey({ columns: [table.course_id, table.lesson_id, table.lesson_version, table.attempt_id] })],
)

// Module-owned repository; only learning.ts consumes it. No cross-module table access or ownership FK.
export function make(db: EffectDrizzleSqlite.EffectSQLiteDatabase) {
  const get = (attempt: FtcLearning.Attempt) =>
    db
      .select()
      .from(AttemptTable)
      .where(
        and(
          eq(AttemptTable.course_id, attempt.courseID),
          eq(AttemptTable.lesson_id, attempt.lessonID),
          eq(AttemptTable.lesson_version, attempt.lessonVersion),
          eq(AttemptTable.attempt_id, attempt.attemptID),
        ),
      )
      .get()
      .pipe(
        Effect.flatMap((row) => (row ? decode(row) : Effect.succeed(undefined))),
        Effect.mapError(storeError),
      )
  return {
    get,
    record: (attempt: FtcLearning.Attempt) =>
      db
        .transaction((tx) =>
          Effect.gen(function* () {
            const [row] = yield* tx
              .insert(AttemptTable)
              .values({
                course_id: attempt.courseID,
                lesson_id: attempt.lessonID,
                lesson_version: attempt.lessonVersion,
                attempt_id: attempt.attemptID,
                project_id: attempt.projectID,
                configuration_revision: attempt.configurationRevision,
                outcome: attempt.outcome,
                evidence_json: JSON.stringify(attempt.evidence),
                explanation: attempt.explanation,
              })
              .onConflictDoNothing()
              .returning()
              .all()
            if (row) return yield* decode(row)
            const existing = yield* get(attempt)
            if (existing && JSON.stringify(existing) === JSON.stringify(attempt)) return existing
            return yield* Effect.fail({
              code: "attempt_conflict",
              courseID: attempt.courseID,
              lessonID: attempt.lessonID,
              attemptID: attempt.attemptID,
              recovery: "correct_input",
            } satisfies FtcLearning.LearningError)
          }),
        )
        .pipe(Effect.mapError(storeError)),
    list: (courseID: string) =>
      db
        .select()
        .from(AttemptTable)
        .where(eq(AttemptTable.course_id, courseID))
        .orderBy(AttemptTable.lesson_id, AttemptTable.lesson_version, AttemptTable.attempt_id)
        .all()
        .pipe(
          Effect.flatMap((rows) => Effect.forEach(rows, decode)),
          Effect.mapError(storeError),
        ),
  }
}

function decode(row: typeof AttemptTable.$inferSelect) {
  return Schema.decodeUnknownEffect(Schema.UnknownFromJsonString)(row.evidence_json).pipe(
    Effect.flatMap((evidence) =>
      Schema.decodeUnknownEffect(FtcLearning.Attempt, { onExcessProperty: "error" })({
        attemptID: row.attempt_id,
        courseID: row.course_id,
        lessonID: row.lesson_id,
        lessonVersion: row.lesson_version,
        projectID: row.project_id,
        configurationRevision: row.configuration_revision,
        outcome: row.outcome,
        evidence,
        explanation: row.explanation,
      }),
    ),
    Effect.mapError((): FtcLearning.LearningError => ({ code: "invalid_stored_attempt", recovery: "retry" })),
  )
}

function storeError(cause: unknown): FtcLearning.LearningError {
  if (Schema.is(FtcLearning.LearningError)(cause)) return cause
  return { code: "progress_store_failed", recovery: "retry" }
}
