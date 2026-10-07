export * as FtcLearning from "./learning"

import { FtcKnowledge } from "@opencode-ai/schema/ftc-knowledge"
import { FtcLearning } from "@opencode-ai/schema/ftc-learning"
import { Context, Effect, Layer, Schema } from "effect"
import type { EffectDrizzleSqlite } from "@opencode-ai/effect-drizzle-sqlite"
import { LearningAttempts } from "./learning/sql"

export const Attempt = FtcLearning.Attempt
export type Attempt = FtcLearning.Attempt
export const AttemptID = FtcLearning.AttemptID
export type AttemptID = FtcLearning.AttemptID
export const Progress = FtcLearning.Progress
export type Progress = FtcLearning.Progress
export const ProgressRequest = FtcLearning.ProgressRequest
export type ProgressRequest = FtcLearning.ProgressRequest
export const LearningError = FtcLearning.LearningError
export type LearningError = FtcLearning.LearningError

export interface LessonLookup {
  // Returns one current canonical version per stable lesson ID. Language belongs to content presentation.
  readonly lessons: (input: FtcLearning.ProgressRequest) => Effect.Effect<readonly FtcKnowledge.Lesson[], unknown>
}

export interface Interface {
  readonly recordAttempt: (input: Attempt) => Effect.Effect<Attempt, LearningError>
  readonly progress: (input: ProgressRequest) => Effect.Effect<Progress, LearningError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/FtcLearning") {}

// Construct per Location. The caller owns the local user's injected database connection and its scope.
export const layer = (lookup: LessonLookup, db: EffectDrizzleSqlite.EffectSQLiteDatabase) => {
  const repository = LearningAttempts.make(db)
  const lessons = Effect.fn("FtcLearning.lessons")(function* (input: ProgressRequest) {
    const records = yield* lookup
      .lessons(input)
      .pipe(
        Effect.mapError(
          (): LearningError => ({ code: "lesson_lookup_failed", courseID: input.courseID, recovery: "retry" }),
        ),
      )
    const decoded = yield* Schema.decodeUnknownEffect(Schema.Array(FtcKnowledge.Lesson), {
      onExcessProperty: "error",
    })(records).pipe(
      Effect.mapError(
        (): LearningError => ({ code: "invalid_lessons", courseID: input.courseID, recovery: "refresh_lessons" }),
      ),
    )
    if (!decoded.length)
      return yield* Effect.fail({
        code: "course_not_found",
        courseID: input.courseID,
        recovery: "refresh_lessons",
      } satisfies LearningError)
    if (new Set(decoded.map((lesson) => lesson.id)).size !== decoded.length)
      return yield* Effect.fail({
        code: "invalid_lessons",
        courseID: input.courseID,
        recovery: "refresh_lessons",
      } satisfies LearningError)
    return decoded
  })
  return Layer.succeed(Service, {
    recordAttempt: Effect.fn("FtcLearning.recordAttempt")(function* (input: Attempt) {
      const attempt = yield* Schema.decodeUnknownEffect(Attempt, { onExcessProperty: "error" })(input).pipe(
        Effect.mapError((): LearningError => ({ code: "invalid_input", recovery: "correct_input" })),
      )
      const existing = yield* repository.get(attempt)
      // An exact historical retry survives a content upgrade; it never records new-version progress.
      if (existing) {
        if (JSON.stringify(existing) === JSON.stringify(attempt)) return existing
        return yield* Effect.fail({
          code: "attempt_conflict",
          courseID: attempt.courseID,
          lessonID: attempt.lessonID,
          attemptID: attempt.attemptID,
          recovery: "correct_input",
        } satisfies LearningError)
      }
      const current = (yield* lessons({ courseID: attempt.courseID })).find((lesson) => lesson.id === attempt.lessonID)
      if (!current)
        return yield* Effect.fail({
          code: "lesson_not_found",
          courseID: attempt.courseID,
          lessonID: attempt.lessonID,
          recovery: "refresh_lessons",
        } satisfies LearningError)
      if (current.version !== attempt.lessonVersion)
        return yield* Effect.fail({
          code: "lesson_version_changed",
          courseID: attempt.courseID,
          lessonID: attempt.lessonID,
          recovery: "refresh_lessons",
        } satisfies LearningError)
      return yield* repository.record(attempt)
    }),
    progress: Effect.fn("FtcLearning.progress")(function* (input: ProgressRequest) {
      const requested = yield* Schema.decodeUnknownEffect(ProgressRequest, { onExcessProperty: "error" })(input).pipe(
        Effect.mapError((): LearningError => ({ code: "invalid_input", recovery: "correct_input" })),
      )
      const current = yield* lessons(requested)
      const attempts = yield* repository.list(requested.courseID)
      return {
        courseID: requested.courseID,
        lessons: current.map((lesson) => {
          const attemptIDs = attempts
            .filter((attempt) => attempt.lessonID === lesson.id && attempt.lessonVersion === lesson.version)
            .map((attempt) => attempt.attemptID)
          return {
            lessonID: lesson.id,
            lessonVersion: lesson.version,
            status: attemptIDs.length ? ("recorded" as const) : ("not_started" as const),
            attemptIDs,
          }
        }),
        attempts,
      }
    }),
  } satisfies Interface)
}
