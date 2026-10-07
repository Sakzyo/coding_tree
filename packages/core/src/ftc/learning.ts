export * as FtcLearning from "./learning"

import { FtcKnowledge } from "@opencode-ai/schema/ftc-knowledge"
import { FtcLearning } from "@opencode-ai/schema/ftc-learning"
import semver from "semver"
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

export const EntryLevel = FtcLearning.EntryLevel
export type EntryLevel = FtcLearning.EntryLevel
export const SelectEntryRequest = FtcLearning.SelectEntryRequest
export type SelectEntryRequest = FtcLearning.SelectEntryRequest
export const SkipLessonRequest = FtcLearning.SkipLessonRequest
export type SkipLessonRequest = FtcLearning.SkipLessonRequest
export const NextLessonRequest = FtcLearning.NextLessonRequest
export type NextLessonRequest = FtcLearning.NextLessonRequest
export const LessonResult = FtcLearning.LessonResult
export type LessonResult = FtcLearning.LessonResult

export interface LessonLookup {
  readonly course?: {
    // Trusted caller pins applicability and current version; no implicit latest content or SDK.
    readonly binding: (input: ProgressRequest) => Effect.Effect<
      {
        readonly courseVersion: string
        readonly sdkVersion: string
        readonly library?: string
        readonly libraryVersion?: string
      },
      unknown
    >
    readonly lookup: (input: FtcKnowledge.ContentQuery) => Effect.Effect<FtcKnowledge.ContentResult, unknown>
  }
  // Returns one current canonical version per stable lesson ID. Language belongs to content presentation.
  readonly lessons: (input: FtcLearning.ProgressRequest) => Effect.Effect<readonly FtcKnowledge.Lesson[], unknown>
}

export interface Interface {
  readonly selectEntry: (input: SelectEntryRequest) => Effect.Effect<Progress, LearningError>
  readonly skipLesson: (input: SkipLessonRequest) => Effect.Effect<Progress, LearningError>
  readonly nextLesson: (input: NextLessonRequest) => Effect.Effect<LessonResult, LearningError>
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
    return structuredClone(decoded)
  })
  const course = Effect.fn("FtcLearning.course")(function* (requested: NextLessonRequest) {
    const unavailable = (reason: FtcLearning.UnavailableReason) => ({
      kind: "unavailable" as const,
      ...requested,
      reason,
    })
    if (!lookup.course) return unavailable("course_lookup_unavailable")
    const binding = yield* lookup.course.binding(Object.freeze({ courseID: requested.courseID })).pipe(
      Effect.map((value) => ({ ...value })),
      Effect.mapError((): LearningError => ({ code: "course_lookup_failed", recovery: "retry" })),
    )
    if (
      !concreteVersion(binding.courseVersion) ||
      !concreteVersion(binding.sdkVersion) ||
      (binding.library === undefined) !== (binding.libraryVersion === undefined) ||
      (binding.libraryVersion !== undefined && !concreteVersion(binding.libraryVersion))
    )
      return yield* Effect.fail({
        code: "invalid_course",
        courseID: requested.courseID,
        recovery: "refresh_lessons",
      } satisfies LearningError)
    const query = yield* capture(FtcKnowledge.ContentQuery, {
      id: requested.courseID,
      language: requested.language,
      localOnly: true,
      sdkVersion: binding.sdkVersion,
      ...(binding.library === undefined ? {} : { library: binding.library, libraryVersion: binding.libraryVersion }),
    }).pipe(Effect.mapError((): LearningError => ({ code: "invalid_course", recovery: "refresh_lessons" })))
    const result = yield* lookup.course.lookup(Object.freeze(query)).pipe(
      Effect.mapError((): LearningError => ({ code: "course_lookup_failed", recovery: "retry" })),
      Effect.flatMap((value) =>
        capture(FtcKnowledge.ContentResult, value).pipe(
          Effect.mapError(
            (): LearningError => ({
              code: "invalid_course",
              courseID: requested.courseID,
              recovery: "refresh_lessons",
            }),
          ),
        ),
      ),
    )
    if (result.kind === "missing") {
      if (JSON.stringify(result.requested) !== JSON.stringify(query))
        return yield* Effect.fail({ code: "invalid_course", recovery: "refresh_lessons" } satisfies LearningError)
      return unavailable(result.reason)
    }
    const records = result.records.filter(
      (record) =>
        record.id === requested.courseID &&
        record.version === binding.courseVersion &&
        record.language === requested.language,
    )
    if (records.length !== 1)
      return yield* Effect.fail({
        code: "invalid_course",
        courseID: requested.courseID,
        recovery: "refresh_lessons",
      } satisfies LearningError)
    const record = records[0]
    if (
      !semver.validRange(record.sdkRange) ||
      !semver.satisfies(binding.sdkVersion, record.sdkRange) ||
      record.library !== binding.library ||
      (record.libraryRange === undefined) !== (binding.libraryVersion === undefined) ||
      (record.libraryRange !== undefined &&
        (!semver.validRange(record.libraryRange) || !semver.satisfies(binding.libraryVersion!, record.libraryRange)))
    )
      return yield* Effect.fail({
        code: "invalid_course",
        courseID: requested.courseID,
        recovery: "refresh_lessons",
      } satisfies LearningError)
    if (!record.locallyAvailable || !record.document) return unavailable("not_local")
    const document = record.document
    const ids =
      document.lessons?.flatMap((lesson) => [lesson.id, ...lesson.exercises.map((exercise) => exercise.id)]) ?? []
    if (
      document.id !== record.id ||
      document.version !== record.version ||
      document.language !== record.language ||
      !document.lessons?.length ||
      document.lessons.some((lesson) => !concreteVersion(lesson.version)) ||
      new Set(ids).size !== ids.length ||
      (document.entryPoints &&
        Object.values(document.entryPoints).some((id) => !document.lessons!.some((lesson) => lesson.id === id)))
    )
      return yield* Effect.fail({
        code: "invalid_course",
        courseID: requested.courseID,
        recovery: "refresh_lessons",
      } satisfies LearningError)
    const current = yield* lessons({ courseID: requested.courseID })
    if (JSON.stringify(policy(current)) !== JSON.stringify(policy(document.lessons)))
      return yield* Effect.fail({
        code: "course_snapshot_changed",
        courseID: requested.courseID,
        recovery: "refresh_lessons",
      } satisfies LearningError)
    if (!document.entryPoints) return unavailable("missing_entry_points")
    return {
      kind: "course" as const,
      courseID: requested.courseID,
      courseVersion: document.version,
      language: requested.language,
      lessons: document.lessons,
      entryPoints: document.entryPoints,
    }
  })
  type Course = Extract<Effect.Success<ReturnType<typeof course>>, { kind: "course" }>
  const progress = (
    current: Course,
    change?: { entryLevel: EntryLevel } | { lessonID: string; lessonVersion: string },
  ) =>
    LearningAttempts.navigation(
      db,
      current,
      (state) => {
        if (
          state.skips.some((skip) =>
            current.lessons.some(
              (lesson) =>
                lesson.id === skip.lesson_id && lesson.version === skip.lesson_version && lesson.skippable !== true,
            ),
          )
        )
          return Effect.fail({ code: "invalid_stored_navigation", recovery: "retry" } satisfies LearningError)
        return Effect.succeed({
          courseID: current.courseID,
          courseVersion: current.courseVersion,
          ...(state.entryLevel === undefined ? {} : { entryLevel: state.entryLevel }),
          lessons: current.lessons.map((lesson) => {
            const attemptIDs = state.attempts
              .filter((attempt) => attempt.lessonID === lesson.id && attempt.lessonVersion === lesson.version)
              .map((attempt) => attempt.attemptID)
            return {
              lessonID: lesson.id,
              lessonVersion: lesson.version,
              status: state.skips.some((skip) => skip.lesson_id === lesson.id && skip.lesson_version === lesson.version)
                ? ("skipped" as const)
                : attemptIDs.length
                  ? ("recorded" as const)
                  : ("not_started" as const),
              attemptIDs,
            }
          }),
          attempts: state.attempts,
        } satisfies Progress)
      },
      change,
    )
  const requireCourse = (current: Effect.Success<ReturnType<typeof course>>) =>
    current.kind === "course"
      ? Effect.succeed(current)
      : Effect.fail({
          code: "course_unavailable",
          courseID: current.courseID,
          reason: current.reason,
          recovery: "refresh_lessons",
        } satisfies LearningError)
  return Layer.succeed(Service, {
    selectEntry: Effect.fn("FtcLearning.selectEntry")(function* (input: SelectEntryRequest) {
      const requested = yield* capture(SelectEntryRequest, input).pipe(
        Effect.mapError((): LearningError => ({ code: "invalid_input", recovery: "correct_input" })),
      )
      const current = yield* course({ courseID: requested.courseID, language: "en" }).pipe(
        Effect.flatMap(requireCourse),
      )
      return yield* progress(current, { entryLevel: requested.entryLevel })
    }),
    skipLesson: Effect.fn("FtcLearning.skipLesson")(function* (input: SkipLessonRequest) {
      const requested = yield* capture(SkipLessonRequest, input).pipe(
        Effect.mapError((): LearningError => ({ code: "invalid_input", recovery: "correct_input" })),
      )
      const current = yield* course({ courseID: requested.courseID, language: "en" }).pipe(
        Effect.flatMap(requireCourse),
      )
      const lesson = current.lessons.find((lesson) => lesson.id === requested.lessonID)
      if (!lesson)
        return yield* Effect.fail({
          code: "lesson_not_found",
          courseID: requested.courseID,
          lessonID: requested.lessonID,
          recovery: "refresh_lessons",
        } satisfies LearningError)
      if (lesson.skippable !== true)
        return yield* Effect.fail({
          code: "lesson_not_skippable",
          courseID: requested.courseID,
          lessonID: lesson.id,
          recovery: "refresh_lessons",
        } satisfies LearningError)
      return yield* progress(current, { lessonID: lesson.id, lessonVersion: lesson.version })
    }),
    nextLesson: Effect.fn("FtcLearning.nextLesson")(function* (input: NextLessonRequest) {
      const requested = yield* capture(NextLessonRequest, input).pipe(
        Effect.mapError((): LearningError => ({ code: "invalid_input", recovery: "correct_input" })),
      )
      const current = yield* course(requested)
      if (current.kind === "unavailable") return current
      const state = yield* progress(current)
      const start = state.entryLevel
        ? current.lessons.findIndex((lesson) => lesson.id === current.entryPoints[state.entryLevel!])
        : 0
      const lesson = current.lessons
        .slice(start)
        .find((lesson) => state.lessons.find((entry) => entry.lessonID === lesson.id)?.status !== "skipped")
      const binding = { courseID: current.courseID, courseVersion: current.courseVersion, language: requested.language }
      return lesson ? { kind: "lesson" as const, ...binding, lesson } : { kind: "no_next" as const, ...binding }
    }),
    recordAttempt: Effect.fn("FtcLearning.recordAttempt")(function* (input: Attempt) {
      const attempt = yield* capture(Attempt, input).pipe(
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
      const requested = yield* capture(ProgressRequest, input).pipe(
        Effect.mapError((): LearningError => ({ code: "invalid_input", recovery: "correct_input" })),
      )
      if (lookup.course) {
        const current = yield* course({ ...requested, language: "en" }).pipe(Effect.flatMap(requireCourse))
        return yield* progress(current)
      }
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

function concreteVersion(value: unknown): value is string {
  return typeof value === "string" && semver.valid(value) === value
}

function capture<S extends Schema.Top>(schema: S, input: unknown) {
  return Schema.decodeUnknownEffect(schema, { onExcessProperty: "error" })(input).pipe(
    Effect.map((value) => structuredClone(value)),
  )
}

function policy(lessons: readonly FtcKnowledge.Lesson[]) {
  return lessons.map((lesson) => ({
    id: lesson.id,
    version: lesson.version,
    skippable: lesson.skippable,
    exercises: lesson.exercises.map((exercise) => ({
      id: exercise.id,
      requiresExplanation: exercise.requiresExplanation,
      requiresProjectApplication: exercise.requiresProjectApplication,
      requiresPhysicalValidation: exercise.requiresPhysicalValidation,
    })),
  }))
}
