import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { FtcKnowledge } from "@opencode-ai/schema/ftc-knowledge"
import { Service, layer, type LessonLookup } from "../../../src/ftc/learning"
import { FtcLearning } from "@opencode-ai/schema/ftc-learning"
import { Project } from "@opencode-ai/schema/project"
import { Deferred, Effect, Fiber, Layer, Result } from "effect"
import { sql } from "drizzle-orm"
import { Database } from "../../../src/database/database"
import { DatabaseMigration } from "../../../src/database/migration"
import { migrations } from "../../../src/database/migration.gen"
import { tmpdir } from "../../fixture/tmpdir"

// Synthetic, complete content-port record; no M11 runtime or installed course pack.
const lesson: FtcKnowledge.Lesson = {
  id: "opmode-lifecycle",
  version: "1.0.0",
  topic: "opmode-lifecycle",
  title: "OpMode lifecycle",
  body: "Explain init and loop before applying them in a project.",
  exercises: [
    {
      id: "explain-loop",
      prompt: "Explain how the loop uses the gamepad.",
      requiresExplanation: true,
      requiresProjectApplication: true,
      explanationCriteria: "Explain repeated calls.",
      projectApplicationCriteria: "Apply the idea in project Java.",
    },
  ],
}

test("importing learning starts no application-state or database I/O", async () => {
  await using tmp = await tmpdir()
  const child = Bun.spawn(
    [
      process.execPath,
      "-e",
      `await import(${JSON.stringify(new URL("../../../src/ftc/learning.ts", import.meta.url).href)})`,
    ],
    {
      env: {
        ...process.env,
        OPENCODE_TEST_HOME: tmp.path,
        BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0",
        OPENCODE_DB: path.join(tmp.path, "personal.sqlite"),
        XDG_DATA_HOME: path.join(tmp.path, "data"),
        XDG_CONFIG_HOME: path.join(tmp.path, "config"),
        XDG_CACHE_HOME: path.join(tmp.path, "cache"),
        XDG_STATE_HOME: path.join(tmp.path, "state"),
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  )
  const output = await new Response(child.stderr).text()
  expect({ exit: await child.exited, output }).toEqual({ exit: 0, output: "" })
  expect(await fs.readdir(tmp.path)).toEqual([])
})

test("progress survives reopen and language changes", async () => {
  await using tmp = await tmpdir()
  const manifest = path.join(tmp.path, "ftc-project.json")
  const bytes = '{"hardware":[],"pathing":"neither"}\n'
  await Bun.write(manifest, bytes)
  const before = await fs.stat(manifest)
  const attempt = {
    attemptID: FtcLearning.AttemptID.create(),
    courseID: "foundations",
    lessonID: lesson.id,
    lessonVersion: lesson.version,
    projectID: Project.ID.make("ftc_project_a"),
    configurationRevision: "config-a-1",
    outcome: "submitted" as const,
    evidence: [
      {
        kind: "reading" as const,
        source: "lesson-page",
        timestamp: 123,
        provenance: { kind: "student_observation" as const, observation: "Read the page." },
      },
    ],
    explanation: "init runs once and loop repeats.",
  }
  const run = (language: "en" | "zh", record: boolean) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* Service
        if (record) expect(yield* service.recordAttempt(attempt)).toEqual(attempt)
        return yield* service.progress({ courseID: "foundations" })
      }).pipe(
        Effect.provide(
          learningLayer({
            lessons: () =>
              Effect.succeed([{ ...lesson, title: language === "en" ? "OpMode lifecycle" : "OpMode 生命周期" }]),
          }),
        ),
        Effect.provide(Database.layerFromPath(path.join(tmp.path, "personal.sqlite"))),
        Effect.scoped,
      ),
    )
  const savedProgress = await run("en", true)
  expect(savedProgress).toEqual({
    courseID: "foundations",
    lessons: [
      { lessonID: "opmode-lifecycle", lessonVersion: "1.0.0", status: "recorded", attemptIDs: [attempt.attemptID] },
    ],
    attempts: [attempt],
  })
  const reopenedProgress = await run("en", false)
  const englishProgress = reopenedProgress
  const chineseProgress = await run("zh", false)
  expect(reopenedProgress).toEqual(savedProgress)
  expect(chineseProgress).toEqual(englishProgress)
  expect(await Bun.file(manifest).text()).toBe(bytes)
  const manifestWrites = (await fs.stat(manifest)).mtimeMs === before.mtimeMs ? 0 : 1
  expect(manifestWrites).toBe(0)
})

test("older lesson versions retain provenance without crediting the current version", async () => {
  await using tmp = await tmpdir()
  const attempt = {
    attemptID: FtcLearning.AttemptID.create(),
    courseID: "foundations",
    lessonID: lesson.id,
    lessonVersion: "1.0.0",
    projectID: Project.ID.make("ftc_project_a"),
    configurationRevision: "config-a-1",
    outcome: "submitted" as const,
    evidence: [
      {
        kind: "physical" as const,
        source: "student",
        timestamp: 0,
        provenance: { kind: "student_observation" as const, observation: "Observed the robot." },
      },
    ],
    explanation: "My observation is recorded, not an award.",
  }
  const run = (version: string, record: boolean) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* Service
        if (record) yield* service.recordAttempt(attempt)
        return yield* service.progress({ courseID: "foundations" })
      }).pipe(
        Effect.provide(learningLayer({ lessons: () => Effect.succeed([{ ...lesson, version }]) })),
        Effect.provide(Database.layerFromPath(path.join(tmp.path, "personal.sqlite"))),
        Effect.scoped,
      ),
    )
  await run("1.0.0", true)
  const updated = await run("2.0.0", true)
  expect(updated.lessons).toEqual([
    { lessonID: "opmode-lifecycle", lessonVersion: "2.0.0", status: "not_started", attemptIDs: [] },
  ])
  expect(updated.attempts).toEqual([attempt])
  expect(updated).not.toHaveProperty("completed")
  const currentAttempt = { ...attempt, attemptID: FtcLearning.AttemptID.create(), lessonVersion: "2.0.0" }
  const current = await Effect.runPromise(
    Effect.gen(function* () {
      const service = yield* Service
      yield* service.recordAttempt(currentAttempt)
      return yield* service.progress({ courseID: "foundations" })
    }).pipe(
      Effect.provide(learningLayer({ lessons: () => Effect.succeed([{ ...lesson, version: "2.0.0" }]) })),
      Effect.provide(Database.layerFromPath(path.join(tmp.path, "personal.sqlite"))),
      Effect.scoped,
    ),
  )
  expect(current.lessons).toEqual([
    {
      lessonID: "opmode-lifecycle",
      lessonVersion: "2.0.0",
      status: "recorded",
      attemptIDs: [currentAttempt.attemptID],
    },
  ])
  expect(current.attempts).toEqual([attempt, currentAttempt])
})

function attempt(overrides: Partial<FtcLearning.Attempt> = {}): FtcLearning.Attempt {
  return {
    attemptID: FtcLearning.AttemptID.create(),
    courseID: "foundations",
    lessonID: lesson.id,
    lessonVersion: lesson.version,
    projectID: Project.ID.make("ftc_project_a"),
    configurationRevision: "config-a-1",
    outcome: "submitted",
    evidence: [
      {
        kind: "build",
        source: "build-result",
        timestamp: 456,
        provenance: { kind: "owner_reference", owner: "M5", referenceID: "build-a-1", revision: "saved-source-a-1" },
      },
    ],
    explanation: "Built the saved Java source.",
    ...overrides,
  }
}

function learningLayer(lookup: LessonLookup) {
  return Layer.unwrap(
    Effect.gen(function* () {
      const database = yield* Database.Service
      return layer(lookup, database.db)
    }),
  )
}

function database<A, E>(filename: string, effect: Effect.Effect<A, E, Database.Service>) {
  return Effect.runPromise(effect.pipe(Effect.provide(Database.layerFromPath(filename)), Effect.scoped))
}

function run<A, E>(
  filename: string,
  effect: Effect.Effect<A, E, Service>,
  lookup: LessonLookup = {
    lessons: (input) => Effect.succeed(input.courseID === "foundations" ? [lesson] : []),
  },
) {
  return database(filename, effect.pipe(Effect.provide(learningLayer(lookup))))
}

const progress = Effect.gen(function* () {
  const service = yield* Service
  return yield* service.progress({ courseID: "foundations" })
})

const record = (input: FtcLearning.Attempt) =>
  Effect.gen(function* () {
    const service = yield* Service
    return yield* service.recordAttempt(input)
  })

test("cross-project attempts preserve outcomes, evidence references and configuration revisions", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "personal.sqlite")
  const records = [
    attempt(),
    attempt({
      projectID: Project.ID.make("ftc_project_b"),
      configurationRevision: "config-b-2",
      outcome: "failed",
      explanation: "Compiler failed.",
    }),
    attempt({ outcome: "cancelled", evidence: [], explanation: "Cancelled by student." }),
    attempt({ outcome: "unknown", evidence: [], explanation: "Robot disconnected." }),
  ]
  await run(filename, Effect.forEach(records, record))
  const saved = await run(filename, progress)
  expect(saved.attempts).toEqual(records)
  expect(saved.lessons).toEqual([
    {
      lessonID: "opmode-lifecycle",
      lessonVersion: "1.0.0",
      status: "recorded",
      attemptIDs: records.map((entry) => entry.attemptID),
    },
  ])
  expect(saved).not.toHaveProperty("completed")
  expect((await run(path.join(tmp.path, "other-user.sqlite"), progress)).attempts).toEqual([])
})

test("concurrent connections reconcile exact retries and preserve independent attempts", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "personal.sqlite")
  const first = attempt()
  await run(filename, progress)
  const retries = await Promise.all(Array.from({ length: 6 }, () => run(filename, record(first))))
  expect(retries).toEqual(Array(6).fill(first))
  const independent = Array.from({ length: 4 }, () => attempt())
  await Promise.all(independent.map((input) => run(filename, record(input))))
  expect((await run(filename, progress)).attempts).toEqual([first, ...independent])
})

test("concurrent conflicting reuse produces one durable winner without rewriting provenance", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "personal.sqlite")
  await run(filename, progress)
  const first = attempt()
  const second = { ...first, configurationRevision: "config-a-2", explanation: "Changed submission." }
  const results = await Promise.all([first, second].map((input) => run(filename, record(input).pipe(Effect.result))))
  expect(results.filter(Result.isSuccess)).toHaveLength(1)
  expect(results.filter(Result.isFailure).map((result) => result.failure.code)).toEqual(["attempt_conflict"])
  const winner = results.find(Result.isSuccess)!
  expect((await run(filename, progress)).attempts).toEqual([winner.success])
})

test.each([
  { change: { lessonID: "unknown" }, want: "lesson_not_found" },
  { change: { lessonVersion: "2.0.0" }, want: "lesson_version_changed" },
  { change: { courseID: "unknown" }, want: "course_not_found" },
  { change: { configurationRevision: "" }, want: "invalid_input" },
  { change: { completed: true }, want: "invalid_input" },
] as const)("rejects $want without storing an attempt", async ({ change, want }) => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "personal.sqlite")
  const result = await run(filename, record(attempt(change)).pipe(Effect.result))
  expect(Result.isFailure(result) && result.failure.code).toBe(want)
  expect((await run(filename, progress)).attempts).toEqual([])
})

test("Core facade exposes the canonical Schema contract identities", async () => {
  const { Attempt, AttemptID, Progress, ProgressRequest, LearningError } = await import("../../../src/ftc/learning")
  expect(Attempt).toBe(FtcLearning.Attempt)
  expect(AttemptID).toBe(FtcLearning.AttemptID)
  expect(Progress).toBe(FtcLearning.Progress)
  expect(ProgressRequest).toBe(FtcLearning.ProgressRequest)
  expect(LearningError).toBe(FtcLearning.LearningError)
})

test("lookup failure, malformed or duplicate current lessons cannot become empty successful progress", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "personal.sqlite")
  const ports: LessonLookup[] = [
    { lessons: () => Effect.fail("content unavailable") },
    { lessons: () => Effect.succeed([{ ...lesson, version: "" }]) },
    { lessons: () => Effect.succeed([lesson, { ...lesson, version: "2.0.0" }]) },
  ]
  const results = await Promise.all(ports.map((lookup) => run(filename, progress.pipe(Effect.result), lookup)))
  expect(results.map((result) => Result.isFailure(result) && result.failure.code)).toEqual([
    "lesson_lookup_failed",
    "invalid_lessons",
    "invalid_lessons",
  ])
  expect((await run(filename, progress)).attempts).toEqual([])
})

test("SQLite read-only failure keeps personal progress unchanged and releases the connection", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "personal.sqlite")
  const first = attempt()
  await run(filename, record(first))
  const result = await database(
    filename,
    Effect.gen(function* () {
      const database = yield* Database.Service
      yield* database.db.run(sql`PRAGMA query_only = ON`)
      return yield* record(attempt()).pipe(
        Effect.provide(learningLayer({ lessons: () => Effect.succeed([lesson]) })),
        Effect.result,
      )
    }),
  )
  expect(Result.isFailure(result) && result.failure.code).toBe("progress_store_failed")
  expect((await run(filename, progress)).attempts).toEqual([first])
  await run(filename, record(attempt()))
  expect((await run(filename, progress)).attempts).toHaveLength(2)
})

test("malformed persisted evidence is reported rather than silently losing progress", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "personal.sqlite")
  await run(filename, record(attempt()))
  await database(
    filename,
    Effect.gen(function* () {
      const database = yield* Database.Service
      yield* database.db.run(sql`UPDATE ftc_learning_attempt SET evidence_json = ${"{broken"}`)
    }),
  )
  const result = await run(filename, progress.pipe(Effect.result))
  expect(Result.isFailure(result) && result.failure.code).toBe("invalid_stored_attempt")
})

test("cancelling lesson lookup releases its scope and writes no attempt", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "personal.sqlite")
  const started = Deferred.makeUnsafe<void>()
  const released = Deferred.makeUnsafe<void>()
  const lookup: LessonLookup = {
    lessons: () =>
      Effect.scoped(
        Effect.gen(function* () {
          yield* Effect.addFinalizer(() => Deferred.succeed(released, undefined))
          yield* Deferred.succeed(started, undefined)
          return yield* Effect.never
        }),
      ),
  }
  await run(
    filename,
    Effect.gen(function* () {
      const fiber = yield* record(attempt()).pipe(Effect.forkChild)
      yield* Deferred.await(started)
      yield* Fiber.interrupt(fiber)
      expect(yield* Deferred.isDone(released)).toBe(true)
    }),
    lookup,
  )
  expect((await run(filename, progress)).attempts).toEqual([])
  await run(filename, record(attempt()))
  expect((await run(filename, progress)).attempts).toHaveLength(1)
})

test("tracked learning migration upgrades a populated database, preserves host rows and reopens", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "upgrade.sqlite")
  const index = migrations.findIndex((migration) => migration.id.endsWith("_ftc-learning-progress"))
  expect(index).toBeGreaterThan(0)
  // Use the real migration lifecycle on a fresh file, stopping before this task's migration.
  const { SqliteClient } = await import("@effect/sql-sqlite-bun")
  const { EffectDrizzleSqlite } = await import("@opencode-ai/effect-drizzle-sqlite")
  await Effect.runPromise(
    Effect.gen(function* () {
      const db = yield* EffectDrizzleSqlite.makeWithDefaults()
      yield* DatabaseMigration.applyOnly(db, migrations.slice(0, index))
      yield* db.run(
        sql`INSERT INTO project (id, worktree, time_created, time_updated, sandboxes) VALUES (${"host-preserved"}, ${"/fixture"}, ${1}, ${2}, ${"[]"})`,
      )
      const before = yield* db.all(sql`SELECT * FROM project`)
      yield* DatabaseMigration.apply(db)
      yield* DatabaseMigration.apply(db)
      expect(yield* db.all(sql`SELECT * FROM project`)).toEqual(before)
      expect(yield* db.all(sql`SELECT * FROM ftc_learning_attempt`)).toEqual([])
      expect(yield* db.all(sql`SELECT id FROM migration WHERE id = ${migrations[index].id}`)).toEqual([
        { id: migrations[index].id },
      ])
    }).pipe(Effect.provide(SqliteClient.layer({ filename })), Effect.scoped),
  )
  const input = attempt()
  await run(filename, record(input))
  expect((await run(filename, progress)).attempts).toEqual([input])
  const cleanup = await tmpdir()
  const removed = cleanup.path
  await run(path.join(removed, "cleanup.sqlite"), record(attempt()))
  await cleanup[Symbol.asyncDispose]()
  expect(await Bun.file(path.join(removed, "cleanup.sqlite")).exists()).toBe(false)
})
