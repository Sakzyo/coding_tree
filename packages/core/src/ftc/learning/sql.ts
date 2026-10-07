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

export const EntryTable = sqliteTable(
  "ftc_learning_entry",
  {
    course_id: text().notNull(),
    course_version: text().notNull(),
    entry_level: text().$type<FtcLearning.EntryLevel>().notNull(),
  },
  (table) => [primaryKey({ columns: [table.course_id, table.course_version] })],
)

export const SkipTable = sqliteTable(
  "ftc_learning_skip",
  {
    course_id: text().notNull(),
    course_version: text().notNull(),
    lesson_id: text().notNull(),
    lesson_version: text().notNull(),
  },
  (table) => [primaryKey({ columns: [table.course_id, table.course_version, table.lesson_id, table.lesson_version] })],
)

const Text = Schema.String.check(Schema.isMinLength(1), Schema.isTrimmed())
const EntryRow = Schema.Struct({ course_id: Text, course_version: Text, entry_level: FtcLearning.EntryLevel })
const SkipRow = Schema.Struct({ course_id: Text, course_version: Text, lesson_id: Text, lesson_version: Text })

// Read and mutate one coherent personal snapshot. Validation in consume rolls back invalid writes.
export function navigation<A>(
  db: EffectDrizzleSqlite.EffectSQLiteDatabase,
  course: { courseID: string; courseVersion: string },
  consume: (state: {
    entryLevel?: FtcLearning.EntryLevel
    skips: readonly (typeof SkipRow.Type)[]
    attempts: readonly FtcLearning.Attempt[]
  }) => Effect.Effect<A, FtcLearning.LearningError>,
  change?: { entryLevel: FtcLearning.EntryLevel } | { lessonID: string; lessonVersion: string },
) {
  return db
    .transaction((tx) =>
      Effect.gen(function* () {
        const entries = yield* tx.select().from(EntryTable).where(eq(EntryTable.course_id, course.courseID)).all()
        const skips = yield* tx.select().from(SkipTable).where(eq(SkipTable.course_id, course.courseID)).all()
        const decodedEntries = yield* Schema.decodeUnknownEffect(Schema.Array(EntryRow))(entries).pipe(
          Effect.mapError((): FtcLearning.LearningError => ({ code: "invalid_stored_navigation", recovery: "retry" })),
        )
        const decodedSkips = yield* Schema.decodeUnknownEffect(Schema.Array(SkipRow))(skips).pipe(
          Effect.mapError((): FtcLearning.LearningError => ({ code: "invalid_stored_navigation", recovery: "retry" })),
        )
        const state = {
          entryLevel: decodedEntries.find((row) => row.course_version === course.courseVersion)?.entry_level,
          skips: decodedSkips.filter((row) => row.course_version === course.courseVersion),
          attempts: yield* make(tx).list(course.courseID),
        }
        // Validate existing state before an upsert could conceal malformed stored data.
        const current = yield* consume(state)
        if (!change) return current
        if ("entryLevel" in change) {
          yield* tx
            .insert(EntryTable)
            .values({
              course_id: course.courseID,
              course_version: course.courseVersion,
              entry_level: change.entryLevel,
            })
            .onConflictDoUpdate({
              target: [EntryTable.course_id, EntryTable.course_version],
              set: { entry_level: change.entryLevel },
            })
          return yield* consume({ ...state, entryLevel: change.entryLevel })
        }
        const row = {
          course_id: course.courseID,
          course_version: course.courseVersion,
          lesson_id: change.lessonID,
          lesson_version: change.lessonVersion,
        }
        yield* tx.insert(SkipTable).values(row).onConflictDoNothing()
        return yield* consume({ ...state, skips: [...state.skips, row] })
      }),
    )
    .pipe(Effect.mapError(storeError))
}

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
