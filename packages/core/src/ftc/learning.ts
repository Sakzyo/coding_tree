export * as FtcLearning from "./learning"

import { FtcKnowledge } from "@opencode-ai/schema/ftc-knowledge"
import { FtcLearning } from "@opencode-ai/schema/ftc-learning"
import { optional } from "@opencode-ai/schema/schema"
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

export const RequestExerciseCommand = FtcLearning.RequestExerciseCommand
export type RequestExerciseCommand = FtcLearning.RequestExerciseCommand
export const ExerciseProjectSnapshot = FtcLearning.ExerciseProjectSnapshot
export type ExerciseProjectSnapshot = FtcLearning.ExerciseProjectSnapshot
export const Track = FtcLearning.Track
export type Track = FtcLearning.Track
export const ExerciseRequest = FtcLearning.ExerciseRequest
export type ExerciseRequest = FtcLearning.ExerciseRequest
export const ExerciseResult = FtcLearning.ExerciseResult
export type ExerciseResult = FtcLearning.ExerciseResult

const ExerciseBinding = Schema.Struct({
  request: RequestExerciseCommand,
  courseVersion: Schema.String,
  track: Track,
  // Curriculum applicability can exist while the project has selected neither.
  contentLibrary: optional(Schema.String.check(Schema.isMinLength(1), Schema.isTrimmed())),
  contentLibraryVersion: optional(Schema.String),
})

export interface LessonLookup {
  readonly exercise?: {
    readonly binding: (input: RequestExerciseCommand) => Effect.Effect<typeof ExerciseBinding.Type, unknown>
    readonly lookup: (input: FtcKnowledge.ContentQuery) => Effect.Effect<FtcKnowledge.ContentResult, unknown>
  }
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
  readonly requestExercise: (input: RequestExerciseCommand) => Effect.Effect<ExerciseResult, LearningError>
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
  const contentCourse = Effect.fn("FtcLearning.contentCourse")(function* (
    requested: NextLessonRequest,
    supplied?: {
      readonly binding: {
        readonly courseVersion: string
        readonly sdkVersion: string
        readonly library?: string
        readonly libraryVersion?: string
      }
      readonly lookup: NonNullable<LessonLookup["course"]>["lookup"]
      readonly track?: Track
    },
  ) {
    const unavailable = (reason: FtcLearning.UnavailableReason) => ({
      kind: "unavailable" as const,
      ...requested,
      reason,
    })
    const port = supplied ?? lookup.course
    if (!port) return unavailable("course_lookup_unavailable")
    const binding =
      typeof port.binding === "function"
        ? yield* port.binding(Object.freeze({ courseID: requested.courseID })).pipe(
            Effect.map((value) => ({ ...value })),
            Effect.mapError((): LearningError => ({ code: "course_lookup_failed", recovery: "retry" })),
          )
        : port.binding
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
    const result = yield* port.lookup(Object.freeze(query)).pipe(
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
      (supplied?.track === "foundations" && (record.library !== undefined || record.libraryRange !== undefined)) ||
      (supplied?.track !== undefined && supplied.track !== "foundations" && record.library === undefined) ||
      !semver.validRange(record.sdkRange) ||
      !semver.satisfies(binding.sdkVersion, record.sdkRange) ||
      (record.library === undefined) !== (record.libraryRange === undefined) ||
      (record.libraryRange !== undefined &&
        (record.library !== binding.library ||
          binding.libraryVersion === undefined ||
          !semver.validRange(record.libraryRange) ||
          !semver.satisfies(binding.libraryVersion, record.libraryRange)))
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
    return {
      kind: "course" as const,
      courseID: requested.courseID,
      courseVersion: document.version,
      language: requested.language,
      lessons: document.lessons,
      entryPoints: document.entryPoints,
    }
  })
  const course = Effect.fn("FtcLearning.course")(function* (requested: NextLessonRequest) {
    const current = yield* contentCourse(requested)
    if (current.kind === "unavailable") return current
    if (!current.entryPoints)
      return { kind: "unavailable" as const, ...requested, reason: "missing_entry_points" as const }
    return { ...current, entryPoints: current.entryPoints }
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
    requestExercise: Effect.fn("FtcLearning.requestExercise")(function* (input: RequestExerciseCommand) {
      const requested = yield* capture(RequestExerciseCommand, input).pipe(
        Effect.map(deepFreeze),
        Effect.mapError((): LearningError => ({ code: "invalid_input", recovery: "correct_input" })),
      )
      const project = requested.projectSnapshot
      const selection = requested.configuration.manifest.managedPathing
      if (
        !concreteVersion(project.sdkVersion) ||
        (project.library === undefined) !== (project.libraryVersion === undefined) ||
        (project.libraryVersion !== undefined && !concreteVersion(project.libraryVersion)) ||
        (selection === "neither" ? project.library !== undefined : project.library === undefined)
      )
        return yield* Effect.fail({ code: "invalid_input", recovery: "correct_input" } satisfies LearningError)
      if (!lookup.exercise)
        return yield* Effect.fail({
          code: "course_unavailable",
          courseID: requested.courseID,
          reason: "course_lookup_unavailable",
          recovery: "refresh_lessons",
        } satisfies LearningError)
      const binding = yield* lookup.exercise.binding(requested).pipe(
        Effect.mapError((): LearningError => ({ code: "course_lookup_failed", recovery: "retry" })),
        Effect.flatMap((value) =>
          capture(ExerciseBinding, value).pipe(
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
      if (
        JSON.stringify(binding.request) !== JSON.stringify(requested) ||
        !concreteVersion(binding.courseVersion) ||
        (binding.track === "foundations"
          ? binding.contentLibrary !== undefined || binding.contentLibraryVersion !== undefined
          : binding.contentLibrary === undefined || !concreteVersion(binding.contentLibraryVersion))
      )
        return yield* Effect.fail({
          code: "invalid_course",
          courseID: requested.courseID,
          recovery: "refresh_lessons",
        } satisfies LearningError)
      if (
        binding.track !== "foundations" &&
        selection !== "neither" &&
        (binding.track !== selection ||
          binding.contentLibrary !== project.library ||
          binding.contentLibraryVersion !== project.libraryVersion)
      )
        return yield* Effect.fail({
          code: "course_unavailable",
          courseID: requested.courseID,
          reason: "incompatible",
          recovery: "refresh_lessons",
        } satisfies LearningError)
      const current = yield* contentCourse(
        { courseID: requested.courseID, language: requested.language },
        {
          binding: {
            courseVersion: binding.courseVersion,
            sdkVersion: project.sdkVersion,
            ...(binding.track === "foundations"
              ? project.library === undefined
                ? {}
                : { library: project.library, libraryVersion: project.libraryVersion }
              : { library: binding.contentLibrary, libraryVersion: binding.contentLibraryVersion }),
          },
          lookup: lookup.exercise.lookup,
          track: binding.track,
        },
      )
      if (current.kind === "unavailable")
        return yield* Effect.fail({
          code: "course_unavailable",
          courseID: requested.courseID,
          reason: current.reason,
          recovery: "refresh_lessons",
        } satisfies LearningError)
      const lesson = current.lessons.find((lesson) => lesson.id === requested.lessonID)
      if (!lesson)
        return yield* Effect.fail({
          code: "lesson_not_found",
          courseID: requested.courseID,
          lessonID: requested.lessonID,
          recovery: "refresh_lessons",
        } satisfies LearningError)
      if (binding.track !== "foundations" && selection === "neither") return { kind: "pathing_required" as const }
      return {
        kind: "exercise" as const,
        courseID: requested.courseID,
        courseVersion: current.courseVersion,
        lessonID: lesson.id,
        lessonVersion: lesson.version,
        language: requested.language,
        projectID: project.projectID,
        configurationRevision: requested.configuration.revision,
        sdkVersion: project.sdkVersion,
        managedPathing: selection,
        track: binding.track,
        ...(project.library === undefined ? {} : { library: project.library, libraryVersion: project.libraryVersion }),
        requiredEvidence: lesson.exercises,
      }
    }),
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

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
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
