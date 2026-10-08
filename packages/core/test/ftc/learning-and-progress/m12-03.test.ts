import { expect, test } from "bun:test"
import path from "node:path"
import { SqliteClient } from "@effect/sql-sqlite-bun"
import { EffectDrizzleSqlite } from "@opencode-ai/effect-drizzle-sqlite"
import { FtcKnowledge } from "@opencode-ai/schema/ftc-knowledge"
import { FtcLearning } from "@opencode-ai/schema/ftc-learning"
import { Project } from "@opencode-ai/schema/project"
import { Deferred, Effect, Fiber, Result } from "effect"
import { sql } from "drizzle-orm"
import {
  Service,
  layer,
  type Interface,
  type LessonLookup,
  RequestExerciseCommand,
  ExerciseRequest,
  ExerciseResult,
  ExerciseProjectSnapshot,
  Track,
} from "../../../src/ftc/learning"
import { tmpdir } from "../../fixture/tmpdir"

// All course declarations and content below are synthetic supplied port fixtures.
function document(courseID = "generic", language: "en" | "zh" = "en"): FtcKnowledge.ContentDocument {
  return {
    id: courseID,
    version: "1.0.0",
    language,
    body: "Synthetic course",
    lessons: [
      {
        id: "lesson",
        version: "1.0.0",
        topic: "synthetic",
        title: "Lesson",
        body: "Synthetic lesson",
        exercises: [
          {
            id: "exercise",
            prompt: "Explain and apply",
            requiresExplanation: true,
            requiresProjectApplication: true,
            explanationCriteria: "Explain the decision",
            projectApplicationCriteria: "Apply in your project",
          },
        ],
      },
    ],
  }
}
function content(doc: FtcKnowledge.ContentDocument): FtcKnowledge.ContentResult {
  return {
    kind: "found",
    records: [
      {
        id: doc.id,
        version: doc.version,
        language: doc.language,
        topic: "synthetic",
        sdkRange: "11.1.0",
        ...(doc.id === "generic"
          ? {}
          : { library: doc.id === "rr" ? "Road Runner" : "PedroPathing", libraryRange: "1.0.0" }),
        source: "https://example.com/synthetic",
        license: "Synthetic fixture",
        localPath: `${doc.language}/fixture.json`,
        digest: "a".repeat(64),
        provenance: "synthetic",
        codeTokens: [],
        locallyAvailable: true,
        document: doc,
      },
    ],
  }
}
function command(
  courseID = "generic",
  selection: "neither" | "pedro" | "road-runner" = "neither",
): FtcLearning.RequestExerciseCommand {
  return {
    courseID,
    lessonID: "lesson",
    language: "en" as const,
    projectSnapshot: {
      projectID: Project.ID.make("project-a"),
      sdkVersion: "11.1.0",
      ...(selection === "neither"
        ? {}
        : { library: selection === "pedro" ? "PedroPathing" : "Road Runner", libraryVersion: "1.0.0" }),
    },
    configuration: {
      revision: "a".repeat(64),
      manifest: { schemaVersion: 1 as const, hardware: [], managedPathing: selection },
    },
  }
}
function ports(): {
  lessons: LessonLookup["lessons"]
  exercise: {
    binding: NonNullable<LessonLookup["exercise"]>["binding"]
    lookup: NonNullable<LessonLookup["exercise"]>["lookup"]
  }
} {
  return {
    lessons: (input: { courseID: string }) => Effect.succeed(document(input.courseID).lessons!),
    exercise: {
      binding: (request: ReturnType<typeof command>) =>
        Effect.succeed({
          request,
          courseVersion: "1.0.0",
          track:
            request.courseID === "generic"
              ? ("foundations" as const)
              : request.courseID === "rr"
                ? ("road-runner" as const)
                : ("pedro" as const),
          ...(request.courseID === "generic"
            ? {}
            : {
                contentLibrary: request.courseID === "rr" ? "Road Runner" : "PedroPathing",
                contentLibraryVersion: "1.0.0",
              }),
        }),
      lookup: (query: FtcKnowledge.ContentQuery) => Effect.succeed(content(document(query.id, query.language))),
    },
  }
}
function run<A, E>(
  filename: string,
  body: (service: Interface, db: EffectDrizzleSqlite.EffectSQLiteDatabase) => Effect.Effect<A, E>,
  port: LessonLookup = ports(),
) {
  return Effect.runPromise(
    Effect.gen(function* () {
      const db = yield* EffectDrizzleSqlite.makeWithDefaults()
      yield* db.run(
        sql`CREATE TABLE ftc_learning_attempt (course_id TEXT, lesson_id TEXT, lesson_version TEXT, attempt_id TEXT, project_id TEXT, configuration_revision TEXT, outcome TEXT, evidence_json TEXT, explanation TEXT)`,
      )
      yield* db.run(sql`CREATE TABLE ftc_learning_entry (course_id TEXT, course_version TEXT, entry_level TEXT)`)
      yield* db.run(
        sql`CREATE TABLE ftc_learning_skip (course_id TEXT, course_version TEXT, lesson_id TEXT, lesson_version TEXT)`,
      )
      return yield* Effect.gen(function* () {
        const service = yield* Service
        return yield* body(service, db)
      }).pipe(Effect.provide(layer(port, db)))
    }).pipe(Effect.provide(SqliteClient.layer({ filename })), Effect.scoped),
  )
}

test("neither permits foundations but blocks autonomous track", async () => {
  await using tmp = await tmpdir()
  const operationCalls = 0
  await run(path.join(tmp.path, "personal.sqlite"), (service, db) =>
    Effect.gen(function* () {
      const javaExercise = yield* service.requestExercise(command())
      const autonomous = yield* service.requestExercise(command("autonomous"))
      expect(javaExercise.kind).toBe("exercise")
      expect(autonomous.kind).toBe("pathing_required")
      expect(operationCalls).toBe(0)
      expect(yield* db.all(sql`SELECT * FROM ftc_learning_attempt`)).toEqual([])
      expect(yield* db.all(sql`SELECT * FROM ftc_learning_entry`)).toEqual([])
      expect(yield* db.all(sql`SELECT * FROM ftc_learning_skip`)).toEqual([])
    }),
  )
})

for (const row of [
  { course: "generic", selection: "neither", track: "foundations" },
  { course: "generic", selection: "pedro", track: "foundations" },
  { course: "generic", selection: "road-runner", track: "foundations" },
  { course: "autonomous", selection: "pedro", track: "pedro" },
  { course: "rr", selection: "road-runner", track: "road-runner" },
] as const) {
  test(`exercise request binds ${row.course} to ${row.selection} without navigation metadata`, async () => {
    await using tmp = await tmpdir()
    const port = ports()
    const queries: FtcKnowledge.ContentQuery[] = []
    port.exercise.lookup = (query) =>
      Effect.sync(() => {
        queries.push(query)
        const doc = document(query.id, query.language)
        return content({
          ...doc,
          lessons: doc.lessons!.map((lesson) => ({
            ...lesson,
            exercises: [
              ...lesson.exercises,
              { ...lesson.exercises[0], id: "physical", requiresPhysicalValidation: true },
              { ...lesson.exercises[0], id: "nonphysical", requiresPhysicalValidation: false },
            ],
          })),
        })
      })
    port.lessons = (input) =>
      Effect.succeed(
        document(input.courseID).lessons!.map((lesson) => ({
          ...lesson,
          exercises: [
            ...lesson.exercises,
            { ...lesson.exercises[0], id: "physical", requiresPhysicalValidation: true },
            { ...lesson.exercises[0], id: "nonphysical", requiresPhysicalValidation: false },
          ],
        })),
      )
    await run(
      path.join(tmp.path, "personal.sqlite"),
      (service, db) =>
        Effect.gen(function* () {
          const requested = { ...command(row.course, row.selection), language: "zh" as const }
          const before = JSON.stringify(requested)
          const result = yield* service.requestExercise(requested)
          expect(result.kind).toBe("exercise")
          if (result.kind !== "exercise") return
          expect(result).toMatchObject({
            courseID: row.course,
            courseVersion: "1.0.0",
            lessonID: "lesson",
            lessonVersion: "1.0.0",
            projectID: "project-a",
            configurationRevision: "a".repeat(64),
            sdkVersion: "11.1.0",
            managedPathing: row.selection,
            track: row.track,
            language: "zh",
          })
          expect(result.requiredEvidence.map((exercise) => exercise.id)).toEqual([
            "exercise",
            "physical",
            "nonphysical",
          ])
          expect(result.requiredEvidence[0]).toEqual({
            id: "exercise",
            prompt: "Explain and apply",
            requiresExplanation: true,
            requiresProjectApplication: true,
            explanationCriteria: "Explain the decision",
            projectApplicationCriteria: "Apply in your project",
          })
          expect(result.requiredEvidence.slice(1).map((exercise) => exercise.requiresPhysicalValidation)).toEqual([
            true,
            false,
          ])
          expect(queries).toEqual([
            {
              id: row.course,
              language: "zh",
              localOnly: true,
              sdkVersion: "11.1.0",
              ...(row.selection === "neither"
                ? {}
                : { library: row.selection === "pedro" ? "PedroPathing" : "Road Runner", libraryVersion: "1.0.0" }),
            },
          ])
          expect(JSON.stringify(requested)).toBe(before)
          expect(yield* db.all(sql`SELECT * FROM ftc_learning_attempt`)).toEqual([])
          expect(yield* db.all(sql`SELECT * FROM ftc_learning_entry`)).toEqual([])
          expect(yield* db.all(sql`SELECT * FROM ftc_learning_skip`)).toEqual([])
          expect("completion" in result).toBe(false)
        }),
      port,
    )
  })
}

for (const row of [
  { selection: "road-runner", code: "course_unavailable" },
  { selection: "pedro", code: "course_unavailable", version: "2.0.0" },
] as const)
  test(`incompatible installed selection ${row.selection} ${"version" in row ? row.version : ""} fails before lookup`, async () => {
    await using tmp = await tmpdir()
    const port = ports()
    let queries = 0
    port.exercise.lookup = () =>
      Effect.sync(() => {
        queries++
        return content(document("autonomous"))
      })
    await run(
      path.join(tmp.path, "personal.sqlite"),
      (service, db) =>
        Effect.gen(function* () {
          const input = command("autonomous", row.selection)
          const result = yield* service
            .requestExercise({
              ...input,
              projectSnapshot: {
                ...input.projectSnapshot,
                ...("version" in row ? { libraryVersion: row.version } : {}),
              },
            })
            .pipe(Effect.result)
          expect(Result.isFailure(result) && result.failure).toMatchObject({ code: row.code, reason: "incompatible" })
          expect(queries).toBe(0)
          expect(yield* db.all(sql`SELECT * FROM ftc_learning_attempt`)).toEqual([])
        }),
      port,
    )
  })

for (const reason of ["not_found", "missing_translation", "not_local", "incompatible"] as const) {
  test(`neither verifies local curriculum before guidance: ${reason}`, async () => {
    await using tmp = await tmpdir()
    const port = ports()
    port.exercise.lookup = (query) =>
      Effect.sync(() => {
        expect(query).toEqual({
          id: "autonomous",
          language: "zh",
          localOnly: true,
          sdkVersion: "11.1.0",
          library: "PedroPathing",
          libraryVersion: "1.0.0",
        })
        return { kind: "missing" as const, reason, requested: query }
      })
    await run(
      path.join(tmp.path, "personal.sqlite"),
      (service) =>
        Effect.gen(function* () {
          const result = yield* service
            .requestExercise({ ...command("autonomous"), language: "zh" })
            .pipe(Effect.result)
          expect(Result.isFailure(result) && result.failure).toEqual({
            code: "course_unavailable",
            courseID: "autonomous",
            reason,
            recovery: "refresh_lessons",
          })
        }),
      port,
    )
  })
}

test("canonical facade identities stay exact", () => {
  expect(RequestExerciseCommand).toBe(FtcLearning.RequestExerciseCommand)
  expect(ExerciseRequest).toBe(FtcLearning.ExerciseRequest)
  expect(ExerciseResult).toBe(FtcLearning.ExerciseResult)
  expect(ExerciseProjectSnapshot).toBe(FtcLearning.ExerciseProjectSnapshot)
  expect(Track).toBe(FtcLearning.Track)
})

test("canonical source records supply prompts and criteria without guessed physical or build requirements", async () => {
  await using tmp = await tmpdir()
  const port = ports()
  const doc = document()
  Object.assign(doc.lessons![0].exercises[0], {
    prompt: "Read, compile and observe this source example",
    explanationCriteria: "Source explanation criterion",
    projectApplicationCriteria: "Source application criterion",
  })
  const supplied = content(doc)
  if (supplied.kind !== "found") throw new Error("fixture must supply canonical source records")
  Object.assign(supplied.records[0], {
    provenance: "source",
    source: "https://example.com/source-course",
    license: "MIT",
  })
  const snapshot = JSON.stringify(supplied)
  port.exercise.lookup = () => Effect.succeed(supplied)
  await run(
    path.join(tmp.path, "personal.sqlite"),
    (service) =>
      Effect.gen(function* () {
        const result = yield* service.requestExercise(command())
        expect(result.kind).toBe("exercise")
        if (result.kind !== "exercise") return
        expect(result.requiredEvidence).toEqual([
          {
            id: "exercise",
            prompt: "Read, compile and observe this source example",
            requiresExplanation: true,
            requiresProjectApplication: true,
            explanationCriteria: "Source explanation criterion",
            projectApplicationCriteria: "Source application criterion",
          },
        ])
        expect("requiresPhysicalValidation" in result.requiredEvidence[0]).toBe(false)
        expect("requiresBuild" in result.requiredEvidence[0]).toBe(false)
        expect("requiresReading" in result.requiredEvidence[0]).toBe(false)
        expect(JSON.stringify(supplied)).toBe(snapshot)
      }),
    port,
  )
})

test("trusted binding reply is copied before suspended content lookup", async () => {
  await using tmp = await tmpdir()
  const port = ports()
  const supplied = {
    request: command("autonomous", "pedro"),
    courseVersion: "1.0.0",
    track: "pedro" as const,
    contentLibrary: "PedroPathing",
    contentLibraryVersion: "1.0.0",
  }
  const started = Deferred.makeUnsafe<void>()
  const resume = Deferred.makeUnsafe<void>()
  port.exercise.binding = () => Effect.succeed(supplied)
  port.exercise.lookup = (query) =>
    Effect.gen(function* () {
      yield* Deferred.succeed(started, undefined)
      yield* Deferred.await(resume)
      expect(query).toMatchObject({ library: "PedroPathing", libraryVersion: "1.0.0" })
      return content(document("autonomous"))
    })
  await run(
    path.join(tmp.path, "personal.sqlite"),
    (service) =>
      Effect.gen(function* () {
        const fiber = yield* service.requestExercise(command("autonomous", "pedro")).pipe(Effect.forkChild)
        yield* Deferred.await(started)
        Object.assign(supplied, { track: "road-runner", courseVersion: "2.0.0", contentLibraryVersion: "2.0.0" })
        Object.assign(supplied.request.projectSnapshot, { projectID: "other" })
        yield* Deferred.succeed(resume, undefined)
        const result = yield* Fiber.join(fiber)
        expect(result).toMatchObject({
          kind: "exercise",
          track: "pedro",
          projectID: "project-a",
          courseVersion: "1.0.0",
          libraryVersion: "1.0.0",
        })
      }),
    port,
  )
})

for (const field of [
  "project",
  "configuration",
  "sdk",
  "course",
  "lesson",
  "language",
  "selection",
  "classification",
  "content_pair",
  "course_version",
] as const) {
  test(`trusted binding rejects changed or missing ${field} before lookup`, async () => {
    await using tmp = await tmpdir()
    const port = ports()
    const binding = port.exercise.binding
    let queried = false
    port.exercise.binding = (input) =>
      binding(input).pipe(
        Effect.map((value) => {
          const copy = structuredClone(value)
          if (field === "project") Object.assign(copy.request.projectSnapshot, { projectID: "project-b" })
          if (field === "configuration") Object.assign(copy.request.configuration, { revision: "b".repeat(64) })
          if (field === "sdk") Object.assign(copy.request.projectSnapshot, { sdkVersion: "12.0.0" })
          if (field === "course") Object.assign(copy.request, { courseID: "other" })
          if (field === "lesson") Object.assign(copy.request, { lessonID: "other" })
          if (field === "language") Object.assign(copy.request, { language: "zh" })
          if (field === "selection") Object.assign(copy.request.configuration.manifest, { managedPathing: "pedro" })
          if (field === "classification") Reflect.deleteProperty(copy, "track")
          if (field === "content_pair") Reflect.deleteProperty(copy, "contentLibraryVersion")
          if (field === "course_version") Object.assign(copy, { courseVersion: "latest" })
          return copy
        }),
      )
    port.exercise.lookup = () =>
      Effect.sync(() => {
        queried = true
        return content(document("autonomous"))
      })
    await run(
      path.join(tmp.path, "personal.sqlite"),
      (service, db) =>
        Effect.gen(function* () {
          const result = yield* service.requestExercise(command("autonomous")).pipe(Effect.result)
          expect(Result.isFailure(result) && result.failure.code).toBe("invalid_course")
          expect(queried).toBe(false)
          expect(yield* db.all(sql`SELECT * FROM ftc_learning_attempt`)).toEqual([])
          expect(yield* db.all(sql`SELECT * FROM ftc_learning_entry`)).toEqual([])
          expect(yield* db.all(sql`SELECT * FROM ftc_learning_skip`)).toEqual([])
        }),
      port,
    )
  })
}

for (const row of [
  { name: "unknown lesson", code: "lesson_not_found" },
  { name: "document version", code: "invalid_course" },
  { name: "duplicate exercises", code: "invalid_course" },
  { name: "metadata contradicts track", code: "invalid_course" },
  { name: "SDK applicability", code: "invalid_course" },
  { name: "library applicability", code: "invalid_course" },
  { name: "lesson version", code: "course_snapshot_changed" },
  { name: "local flag", code: "course_unavailable" },
  { name: "missing echo mismatch", code: "invalid_course" },
] as const)
  test(`neither never guides past invalid content: ${row.name}`, async () => {
    await using tmp = await tmpdir()
    const port = ports()
    port.exercise.lookup = (query) =>
      Effect.sync(() => {
        if (row.name === "missing echo mismatch")
          return { kind: "missing", reason: "not_local", requested: { ...query, language: "zh" } }
        const doc = document("autonomous")
        if (row.name === "document version") Object.assign(doc, { version: "2.0.0" })
        if (row.name === "duplicate exercises")
          Object.assign(doc.lessons![0], { exercises: [doc.lessons![0].exercises[0], doc.lessons![0].exercises[0]] })
        if (row.name === "lesson version") Object.assign(doc.lessons![0], { version: "2.0.0" })
        const result = content(doc)
        if (result.kind === "found") {
          if (row.name === "metadata contradicts track") {
            Reflect.deleteProperty(result.records[0], "library")
            Reflect.deleteProperty(result.records[0], "libraryRange")
          }
          if (row.name === "SDK applicability") Object.assign(result.records[0], { sdkRange: "12.0.0" })
          if (row.name === "library applicability") Object.assign(result.records[0], { libraryRange: "2.0.0" })
          if (row.name === "local flag") Object.assign(result.records[0], { locallyAvailable: false })
        }
        return result
      })
    await run(
      path.join(tmp.path, "personal.sqlite"),
      (service, db) =>
        Effect.gen(function* () {
          const result = yield* service
            .requestExercise({
              ...command("autonomous"),
              ...(row.name === "unknown lesson" ? { lessonID: "absent" } : {}),
            })
            .pipe(Effect.result)
          expect(Result.isFailure(result) && result.failure.code).toBe(row.code)
          expect(yield* db.all(sql`SELECT * FROM ftc_learning_attempt`)).toEqual([])
          expect(yield* db.all(sql`SELECT * FROM ftc_learning_entry`)).toEqual([])
          expect(yield* db.all(sql`SELECT * FROM ftc_learning_skip`)).toEqual([])
        }),
      port,
    )
  })

test("missing exercise capability and invalid project facts fail closed", async () => {
  await using tmp = await tmpdir()
  const cases = [
    command("generic", "pedro"),
    { ...command(), projectSnapshot: { ...command().projectSnapshot, sdkVersion: "11.+" } },
    {
      ...command(),
      projectSnapshot: { ...command().projectSnapshot, library: "PedroPathing", libraryVersion: "1.0.0" },
    },
  ]
  await run(
    path.join(tmp.path, "personal.sqlite"),
    (service) =>
      Effect.gen(function* () {
        const unavailable = yield* service.requestExercise(command()).pipe(Effect.result)
        expect(Result.isFailure(unavailable) && unavailable.failure).toMatchObject({
          code: "course_unavailable",
          reason: "course_lookup_unavailable",
        })
        const partial = structuredClone(cases[0])
        Reflect.deleteProperty(partial.projectSnapshot, "libraryVersion")
        const missing = structuredClone(cases[0])
        Reflect.deleteProperty(missing.projectSnapshot, "library")
        Reflect.deleteProperty(missing.projectSnapshot, "libraryVersion")
        for (const input of [partial, missing, ...cases.slice(1)]) {
          const result = yield* service.requestExercise(input).pipe(Effect.result)
          expect(Result.isFailure(result) && result.failure.code).toBe("invalid_input")
        }
      }),
    { lessons: ports().lessons },
  )
})

test("captured command and returned content resist mutation at asynchronous boundaries", async () => {
  await using tmp = await tmpdir()
  const bindingStarted = Deferred.makeUnsafe<void>()
  const bindingResume = Deferred.makeUnsafe<void>()
  const lessonsStarted = Deferred.makeUnsafe<void>()
  const lessonsResume = Deferred.makeUnsafe<void>()
  const port = ports()
  const original = port.exercise.binding
  const caller = structuredClone(command())
  const supplied = document()
  port.exercise.binding = (input) =>
    Effect.gen(function* () {
      expect(Reflect.set(input.configuration.manifest, "managedPathing", "pedro")).toBe(false)
      expect(Object.isFrozen(input.configuration.manifest.hardware)).toBe(true)
      yield* Deferred.succeed(bindingStarted, undefined)
      yield* Deferred.await(bindingResume)
      return yield* original(input)
    })
  port.exercise.lookup = () => Effect.succeed(content(supplied))
  port.lessons = () =>
    Effect.gen(function* () {
      yield* Deferred.succeed(lessonsStarted, undefined)
      yield* Deferred.await(lessonsResume)
      return document().lessons!
    })
  await run(
    path.join(tmp.path, "personal.sqlite"),
    (service, db) =>
      Effect.gen(function* () {
        const fiber = yield* service.requestExercise(caller).pipe(Effect.forkChild)
        yield* Deferred.await(bindingStarted)
        Object.assign(caller, { courseID: "other", lessonID: "other", language: "zh" })
        Object.assign(caller.projectSnapshot, { projectID: "project-b", sdkVersion: "12.0.0" })
        Object.assign(caller.configuration, { revision: "b".repeat(64) })
        Object.assign(caller.configuration.manifest, { managedPathing: "pedro" })
        yield* Deferred.succeed(bindingResume, undefined)
        yield* Deferred.await(lessonsStarted)
        Object.assign(supplied.lessons![0].exercises[0], {
          id: "changed",
          prompt: "changed",
          requiresPhysicalValidation: true,
        })
        yield* Deferred.succeed(lessonsResume, undefined)
        const result = yield* Fiber.join(fiber)
        expect(result).toMatchObject({
          kind: "exercise",
          courseID: "generic",
          lessonID: "lesson",
          language: "en",
          projectID: "project-a",
          sdkVersion: "11.1.0",
          configurationRevision: "a".repeat(64),
          managedPathing: "neither",
        })
        if (result.kind === "exercise")
          expect(result.requiredEvidence[0]).toEqual({
            id: "exercise",
            prompt: "Explain and apply",
            requiresExplanation: true,
            requiresProjectApplication: true,
            explanationCriteria: "Explain the decision",
            projectApplicationCriteria: "Apply in your project",
          })
        const other = {
          ...command(),
          projectSnapshot: { projectID: Project.ID.make("project-b"), sdkVersion: "11.1.0" },
          configuration: { ...command().configuration, revision: "b".repeat(64) },
        }
        port.exercise.lookup = (query) => Effect.succeed(content(document(query.id, query.language)))
        const second = yield* service.requestExercise(other)
        expect(second).toMatchObject({ projectID: "project-b", configurationRevision: "b".repeat(64) })
        expect(yield* db.all(sql`SELECT * FROM ftc_learning_attempt`)).toEqual([])
      }),
    port,
  )
})

for (const stage of ["binding", "lookup", "lessons"] as const)
  for (const outcome of ["success", "failure", "interrupt"] as const) {
    test(`supplied ${stage} cleanup is awaited on ${outcome}; borrowed database stays usable`, async () => {
      await using tmp = await tmpdir()
      const port = ports()
      const started = Deferred.makeUnsafe<void>()
      const cleaned = Deferred.makeUnsafe<void>()
      const scoped = <A, E>(effect: Effect.Effect<A, E>) =>
        Effect.scoped(
          Effect.gen(function* () {
            yield* Effect.addFinalizer(() => Deferred.succeed(cleaned, undefined))
            yield* Deferred.succeed(started, undefined)
            if (outcome === "interrupt") return yield* Effect.never
            if (outcome === "failure") return yield* Effect.fail("supplied failure")
            return yield* effect
          }),
        )
      if (stage === "binding") {
        const original = port.exercise.binding
        port.exercise.binding = (input) => scoped(original(input))
      }
      if (stage === "lookup") {
        const original = port.exercise.lookup
        port.exercise.lookup = (input) => scoped(original(input))
      }
      if (stage === "lessons") {
        const original = port.lessons
        port.lessons = (input) => scoped(original(input))
      }
      await run(
        path.join(tmp.path, "personal.sqlite"),
        (service, db) =>
          Effect.gen(function* () {
            if (outcome === "interrupt") {
              const fiber = yield* service.requestExercise(command()).pipe(Effect.forkChild)
              yield* Deferred.await(started)
              yield* Fiber.interrupt(fiber)
            } else {
              const result = yield* service.requestExercise(command()).pipe(Effect.result)
              expect(Result.isSuccess(result)).toBe(outcome === "success")
              if (Result.isFailure(result))
                expect(result.failure.code).toBe(stage === "lessons" ? "lesson_lookup_failed" : "course_lookup_failed")
            }
            expect(yield* Deferred.isDone(cleaned)).toBe(true)
            expect(yield* db.all(sql`SELECT * FROM ftc_learning_attempt`)).toEqual([])
            expect(yield* db.all(sql`SELECT * FROM ftc_learning_entry`)).toEqual([])
            expect(yield* db.all(sql`SELECT * FROM ftc_learning_skip`)).toEqual([])
            expect(yield* db.all(sql`SELECT 1 AS usable`)).toEqual([{ usable: 1 }])
          }),
        port,
      )
    })
  }

test("caller interruption waits for asynchronous producer cleanup", async () => {
  await using tmp = await tmpdir()
  const port = ports()
  const started = Deferred.makeUnsafe<void>()
  const cleanupStarted = Deferred.makeUnsafe<void>()
  const cleanupResume = Deferred.makeUnsafe<void>()
  const cleaned = Deferred.makeUnsafe<void>()
  const interrupted = Deferred.makeUnsafe<void>()
  port.exercise.lookup = () =>
    Effect.scoped(
      Effect.gen(function* () {
        yield* Effect.addFinalizer(() =>
          Effect.gen(function* () {
            yield* Deferred.succeed(cleanupStarted, undefined)
            yield* Deferred.await(cleanupResume)
            yield* Deferred.succeed(cleaned, undefined)
          }),
        )
        yield* Deferred.succeed(started, undefined)
        return yield* Effect.never
      }),
    )
  await run(
    path.join(tmp.path, "personal.sqlite"),
    (service, db) =>
      Effect.gen(function* () {
        const request = yield* service.requestExercise(command()).pipe(Effect.forkChild)
        yield* Deferred.await(started)
        const cancellation = yield* Fiber.interrupt(request).pipe(
          Effect.tap(() => Deferred.succeed(interrupted, undefined)),
          Effect.forkChild,
        )
        yield* Deferred.await(cleanupStarted)
        expect(yield* Deferred.isDone(interrupted)).toBe(false)
        expect(yield* Deferred.isDone(cleaned)).toBe(false)
        yield* Deferred.succeed(cleanupResume, undefined)
        yield* Fiber.join(cancellation)
        expect(yield* Deferred.isDone(interrupted)).toBe(true)
        expect(yield* Deferred.isDone(cleaned)).toBe(true)
        expect(yield* db.all(sql`SELECT * FROM ftc_learning_attempt`)).toEqual([])
        expect(yield* db.all(sql`SELECT 1 AS usable`)).toEqual([{ usable: 1 }])
      }),
    port,
  )
})
