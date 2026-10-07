import { expect, test } from "bun:test"
import path from "node:path"
import fs from "node:fs/promises"
import { SqliteClient } from "@effect/sql-sqlite-bun"
import { EffectDrizzleSqlite } from "@opencode-ai/effect-drizzle-sqlite"
import { FtcKnowledge } from "@opencode-ai/schema/ftc-knowledge"
import { FtcLearning } from "@opencode-ai/schema/ftc-learning"
import { Project } from "@opencode-ai/schema/project"
import { Deferred, Effect, Fiber, Result } from "effect"
import { sql } from "drizzle-orm"
import { Service, layer, type Interface, type LessonLookup } from "../../../src/ftc/learning"
import { tmpdir } from "../../fixture/tmpdir"

// Supplied synthetic policy only, never production curriculum.
function document(language: "en" | "zh" = "en", version = "1.0.0"): FtcKnowledge.ContentDocument {
  return {
    id: "synthetic-course",
    version,
    language,
    body: "Synthetic course",
    entryPoints: { "java-beginner": "lesson-a", "ftc-beginner": "lesson-b", experienced: "lesson-c" },
    lessons: ["a", "b", "c"].map((id, index) => ({
      id: `lesson-${id}`,
      version,
      topic: `topic-${id}`,
      title: `${language} ${id}`,
      body: "Synthetic explanation",
      skippable: true,
      exercises: [
        {
          id: `exercise-${id}`,
          prompt: "Apply and explain",
          requiresExplanation: true,
          requiresProjectApplication: true,
          explanationCriteria: "Explain",
          projectApplicationCriteria: "Apply",
          ...(index === 0
            ? { requiresPhysicalValidation: true }
            : index === 1
              ? { requiresPhysicalValidation: false }
              : {}),
        },
      ],
    })),
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
        source: "https://example.com/synthetic",
        license: "Synthetic fixture",
        localPath: `${doc.language}/synthetic.json`,
        digest: "a".repeat(64),
        provenance: "synthetic",
        codeTokens: [],
        locallyAvailable: true,
        document: doc,
      },
    ],
  }
}
function lookup(
  version = "1.0.0",
  change: (doc: FtcKnowledge.ContentDocument) => FtcKnowledge.ContentDocument = (doc) => doc,
) {
  return {
    lessons: () => Effect.sync(() => change(document("en", version)).lessons!),
    course: {
      binding: () => Effect.succeed({ courseVersion: version, sdkVersion: "11.1.0" }),
      lookup: (query) => Effect.sync(() => content(change(document(query.language, version)))),
    },
  } satisfies LessonLookup
}
function run<A, E>(
  filename: string,
  body: (service: Interface, db: EffectDrizzleSqlite.EffectSQLiteDatabase) => Effect.Effect<A, E>,
  port: LessonLookup = lookup(),
) {
  return Effect.runPromise(
    Effect.gen(function* () {
      const db = yield* EffectDrizzleSqlite.makeWithDefaults()
      yield* db.run(
        sql`CREATE TABLE IF NOT EXISTS ftc_learning_attempt (course_id TEXT NOT NULL, lesson_id TEXT NOT NULL, lesson_version TEXT NOT NULL, attempt_id TEXT NOT NULL, project_id TEXT NOT NULL, configuration_revision TEXT NOT NULL, outcome TEXT NOT NULL, evidence_json TEXT NOT NULL, explanation TEXT NOT NULL, PRIMARY KEY(course_id, lesson_id, lesson_version, attempt_id))`,
      )
      yield* db.run(
        sql`CREATE TABLE IF NOT EXISTS ftc_learning_entry (course_id TEXT NOT NULL, course_version TEXT NOT NULL, entry_level TEXT NOT NULL, PRIMARY KEY(course_id, course_version))`,
      )
      yield* db.run(
        sql`CREATE TABLE IF NOT EXISTS ftc_learning_skip (course_id TEXT NOT NULL, course_version TEXT NOT NULL, lesson_id TEXT NOT NULL, lesson_version TEXT NOT NULL, PRIMARY KEY(course_id, course_version, lesson_id, lesson_version))`,
      )
      return yield* Effect.gen(function* () {
        const service = yield* Service
        return yield* body(service, db)
      }).pipe(Effect.provide(layer(port, db)))
    }).pipe(Effect.provide(SqliteClient.layer({ filename })), Effect.scoped),
  )
}
const courseID = "synthetic-course"
const next = { courseID, language: "zh" as const }
function attempt(outcome: FtcLearning.Attempt["outcome"] = "submitted"): FtcLearning.Attempt {
  return {
    attemptID: FtcLearning.AttemptID.create(),
    courseID,
    lessonID: "lesson-a",
    lessonVersion: "1.0.0",
    projectID: Project.ID.make("synthetic-project"),
    configurationRevision: "config-1",
    outcome,
    evidence: [],
    explanation: "Recorded only",
  }
}

test("skip records a skip without claiming exercise completion", async () => {
  await using tmp = await tmpdir()
  await run(path.join(tmp.path, "personal.sqlite"), (service, db) =>
    Effect.gen(function* () {
      const input = attempt()
      yield* service.recordAttempt(input)
      const progress = yield* service.skipLesson({ courseID, lessonID: "lesson-a" })
      expect(progress.lessons[0]).toEqual({
        lessonID: "lesson-a",
        lessonVersion: "1.0.0",
        status: "skipped",
        attemptIDs: [input.attemptID],
      })
      expect(progress.attempts).toEqual([input])
      expect(JSON.stringify(progress)).not.toMatch(/complete|competence|award/)
      expect(yield* db.all(sql`SELECT * FROM ftc_learning_attempt`)).toHaveLength(1)
      const result = yield* service.nextLesson(next)
      expect(result).toMatchObject({
        kind: "lesson",
        courseID,
        courseVersion: "1.0.0",
        language: "zh",
        lesson: { id: "lesson-b" },
      })
      if (result.kind === "lesson")
        expect(result.lesson.exercises[0]).toMatchObject({
          requiresExplanation: true,
          requiresProjectApplication: true,
          requiresPhysicalValidation: false,
        })
    }),
  )
})

test.each([
  ["java-beginner", "lesson-a"],
  ["ftc-beginner", "lesson-b"],
  ["experienced", "lesson-c"],
] as const)("entry %s uses its supplied start", async (entryLevel, lessonID) => {
  await using tmp = await tmpdir()
  await run(path.join(tmp.path, "personal.sqlite"), (service, db) =>
    Effect.gen(function* () {
      const progress = yield* service.selectEntry({ courseID, entryLevel })
      expect(progress.entryLevel).toBe(entryLevel)
      expect(progress.courseVersion).toBe("1.0.0")
      expect(progress.lessons.every((lesson) => lesson.status === "not_started")).toBe(true)
      expect(progress.attempts).toEqual([])
      for (const language of ["en", "zh"] as const) {
        const result = yield* service.nextLesson({ courseID, language })
        expect(result).toMatchObject({
          kind: "lesson",
          language,
          courseID,
          courseVersion: "1.0.0",
          lesson: { id: lessonID, version: "1.0.0" },
        })
        if (result.kind === "lesson")
          expect(result.lesson).toEqual(document(language).lessons!.find((lesson) => lesson.id === lessonID)!)
      }
      expect(yield* db.all(sql`SELECT * FROM ftc_learning_attempt`)).toEqual([])
    }),
  )
})

test("attempt outcomes never advance and no selection defaults without persisting", async () => {
  await using tmp = await tmpdir()
  await run(path.join(tmp.path, "personal.sqlite"), (service, db) =>
    Effect.gen(function* () {
      for (const outcome of ["submitted", "failed", "cancelled", "unknown"] as const)
        yield* service.recordAttempt(attempt(outcome))
      expect(yield* service.nextLesson(next)).toMatchObject({
        kind: "lesson",
        lesson: { id: "lesson-a", exercises: [{ requiresPhysicalValidation: true }] },
      })
      expect(yield* db.all(sql`SELECT * FROM ftc_learning_entry`)).toEqual([])
      yield* service.selectEntry({ courseID, entryLevel: "experienced" })
      const unknown = yield* service.nextLesson(next)
      if (unknown.kind === "lesson")
        expect(unknown.lesson.exercises[0]).not.toHaveProperty("requiresPhysicalValidation")
      yield* service.skipLesson({ courseID, lessonID: "lesson-c" })
      expect(yield* service.nextLesson(next)).toEqual({
        kind: "no_next",
        courseID,
        courseVersion: "1.0.0",
        language: "zh",
      })
    }),
  )
})

test.each([false, undefined])("skip requires explicit policy; %s rejects without writes", async (skippable) => {
  await using tmp = await tmpdir()
  await run(
    path.join(tmp.path, "personal.sqlite"),
    (service, db) =>
      Effect.gen(function* () {
        const result = yield* service.skipLesson({ courseID, lessonID: "lesson-a" }).pipe(Effect.result)
        expect(Result.isFailure(result) && result.failure.code).toBe("lesson_not_skippable")
        expect(yield* db.all(sql`SELECT * FROM ftc_learning_skip`)).toEqual([])
      }),
    lookup("1.0.0", (doc) => ({
      ...doc,
      lessons: doc.lessons!.map((lesson) =>
        (({ skippable: _, ...rest }) => (skippable === undefined ? rest : { ...rest, skippable }))(lesson),
      ),
    })),
  )
})

test("reopen, concurrent exact skips, reselection and version upgrades preserve history", async () => {
  await using tmp = await tmpdir()
  const manifest = path.join(tmp.path, "ftc-project.json")
  const bytes = '{"hardware":[],"pathing":"neither"}\n'
  await Bun.write(manifest, bytes)
  const before = await fs.stat(manifest)
  const filename = path.join(tmp.path, "personal.sqlite")
  const input = attempt()
  await run(filename, (service) =>
    Effect.gen(function* () {
      yield* service.recordAttempt(input)
      yield* service.selectEntry({ courseID, entryLevel: "ftc-beginner" })
    }),
  )
  await Promise.all(
    Array.from({ length: 5 }, () => run(filename, (service) => service.skipLesson({ courseID, lessonID: "lesson-b" }))),
  )
  const saved = await run(filename, (service, db) =>
    Effect.gen(function* () {
      expect(yield* db.all(sql`SELECT * FROM ftc_learning_skip`)).toHaveLength(1)
      expect(yield* service.nextLesson(next)).toMatchObject({ kind: "lesson", lesson: { id: "lesson-c" } })
      return yield* service.selectEntry({ courseID, entryLevel: "java-beginner" })
    }),
  )
  expect(await Bun.file(manifest).text()).toBe(bytes)
  expect((await fs.stat(manifest)).mtimeMs).toBe(before.mtimeMs)
  expect(saved.lessons[1].status).toBe("skipped")
  expect(await run(filename, (service) => service.progress({ courseID }))).toEqual(saved)
  await run(
    filename,
    (service, db) =>
      Effect.gen(function* () {
        expect(yield* service.recordAttempt(input)).toEqual(input)
        const state = yield* service.progress({ courseID })
        expect(state).not.toHaveProperty("entryLevel")
        expect(state.lessons.every((lesson) => lesson.status === "not_started")).toBe(true)
        expect(state.attempts).toEqual([input])
        const stale = yield* service
          .recordAttempt({ ...input, attemptID: FtcLearning.AttemptID.create() })
          .pipe(Effect.result)
        expect(Result.isFailure(stale) && stale.failure.code).toBe("lesson_version_changed")
        yield* service.selectEntry({ courseID, entryLevel: "experienced" })
        expect(yield* db.all(sql`SELECT * FROM ftc_learning_entry`)).toHaveLength(2)
        expect(yield* db.all(sql`SELECT * FROM ftc_learning_skip`)).toHaveLength(1)
      }),
    lookup("2.0.0"),
  )
  await run(path.join(tmp.path, "other.sqlite"), (service) =>
    Effect.gen(function* () {
      const state = yield* service.progress({ courseID })
      expect(state.attempts).toEqual([])
      expect(state).not.toHaveProperty("entryLevel")
      expect(state.lessons.every((lesson) => lesson.status === "not_started")).toBe(true)
    }),
  )
})

test.each(["not_found", "incompatible", "missing_translation", "not_local", "no_match"] as const)(
  "missing content %s remains unavailable and writes nothing",
  async (reason) => {
    await using tmp = await tmpdir()
    const port = lookup()
    port.course.lookup = (requested) => Effect.succeed({ kind: "missing", reason, requested })
    await run(
      path.join(tmp.path, "personal.sqlite"),
      (service, db) =>
        Effect.gen(function* () {
          expect(yield* service.nextLesson(next)).toEqual({ kind: "unavailable", reason, ...next })
          const result = yield* service.selectEntry({ courseID, entryLevel: "experienced" }).pipe(Effect.result)
          expect(Result.isFailure(result) && result.failure).toMatchObject({ code: "course_unavailable", reason })
          expect(yield* db.all(sql`SELECT * FROM ftc_learning_entry`)).toEqual([])
          expect(yield* db.all(sql`SELECT * FROM ftc_learning_skip`)).toEqual([])
        }),
      port,
    )
  },
)

test("missing capability and missing metadata are explicit while bare lessons preserve attempt-only progress", async () => {
  await using tmp = await tmpdir()
  for (const [port, reason] of [
    [{ lessons: lookup().lessons }, "course_lookup_unavailable"],
    [lookup("1.0.0", ({ entryPoints: _, ...doc }) => doc), "missing_entry_points"],
  ] as const) {
    await run(
      path.join(tmp.path, "personal.sqlite"),
      (service) =>
        Effect.gen(function* () {
          expect(yield* service.nextLesson(next)).toEqual({ kind: "unavailable", ...next, reason })
          const result = yield* service.skipLesson({ courseID, lessonID: "lesson-a" }).pipe(Effect.result)
          expect(Result.isFailure(result) && result.failure).toMatchObject({ code: "course_unavailable", reason })
          if (!("course" in port)) {
            const progress = yield* service.progress({ courseID })
            expect(progress).not.toHaveProperty("courseVersion")
            expect(progress).not.toHaveProperty("entryLevel")
          }
        }),
      port,
    )
  }
})

test("invalid and mixed course snapshots fail before either personal write", async () => {
  await using tmp = await tmpdir()
  const good = lookup()
  const cases: { port: LessonLookup; code: FtcLearning.LearningError["code"] }[] = [
    {
      port: { ...good, course: { ...good.course, binding: () => Effect.fail("unavailable") } },
      code: "course_lookup_failed",
    },
    {
      port: {
        ...good,
        course: { ...good.course, binding: () => Effect.succeed({ courseVersion: "latest", sdkVersion: "11.1.0" }) },
      },
      code: "invalid_course",
    },
    {
      port: {
        ...good,
        course: {
          ...good.course,
          binding: () => Effect.succeed({ courseVersion: "1.0.0", sdkVersion: "11.1.0", library: "Road Runner" }),
        },
      },
      code: "invalid_course",
    },
    {
      port: { ...good, course: { ...good.course, lookup: () => Effect.fail("unavailable") } },
      code: "course_lookup_failed",
    },
    {
      port: { ...good, lessons: () => Effect.succeed(document("en", "2.0.0").lessons!) },
      code: "course_snapshot_changed",
    },
    {
      port: { ...good, lessons: () => Effect.succeed(document().lessons!.toReversed()) },
      code: "course_snapshot_changed",
    },
    ...[
      (doc: FtcKnowledge.ContentDocument) => ({ ...doc, version: "2.0.0" }),
      (doc: FtcKnowledge.ContentDocument) => ({ ...doc, id: "other" }),
      (doc: FtcKnowledge.ContentDocument) => ({ ...doc, entryPoints: { ...doc.entryPoints!, experienced: "absent" } }),
      (doc: FtcKnowledge.ContentDocument) => ({ ...doc, lessons: [...doc.lessons!, doc.lessons![0]] }),
      (doc: FtcKnowledge.ContentDocument) => ({
        ...doc,
        lessons: doc.lessons!.map((lesson) => ({ ...lesson, version: "latest" })),
      }),
    ].map((change) => ({
      port: {
        ...good,
        course: {
          ...good.course,
          lookup: (query: FtcKnowledge.ContentQuery) => Effect.succeed(content(change(document(query.language)))),
        },
      },
      code: "invalid_course" as const,
    })),
    {
      port: {
        ...good,
        course: {
          ...good.course,
          lookup: (query) => {
            const result = content(document(query.language))
            return Effect.succeed(
              result.kind === "found" ? { ...result, records: [...result.records, ...result.records] } : result,
            )
          },
        },
      },
      code: "invalid_course",
    },
  ]
  for (const entry of cases) {
    await run(
      path.join(tmp.path, "personal.sqlite"),
      (service, db) =>
        Effect.gen(function* () {
          for (const effect of [
            service.selectEntry({ courseID, entryLevel: "experienced" }),
            service.skipLesson({ courseID, lessonID: "lesson-a" }),
          ]) {
            const result = yield* effect.pipe(Effect.result)
            expect(Result.isFailure(result) && result.failure.code).toBe(entry.code)
          }
          expect(yield* db.all(sql`SELECT * FROM ftc_learning_entry`)).toEqual([])
          expect(yield* db.all(sql`SELECT * FROM ftc_learning_skip`)).toEqual([])
        }),
      entry.port,
    )
  }
})

test("malformed stored navigation and attempts cannot be concealed by new writes", async () => {
  await using tmp = await tmpdir()
  await run(path.join(tmp.path, "personal.sqlite"), (service, db) =>
    Effect.gen(function* () {
      yield* db.run(sql`INSERT INTO ftc_learning_entry VALUES (${courseID}, '1.0.0', 'advanced')`)
      const malformed = yield* service.selectEntry({ courseID, entryLevel: "experienced" }).pipe(Effect.result)
      expect(Result.isFailure(malformed) && malformed.failure).toEqual({
        code: "invalid_stored_navigation",
        recovery: "retry",
      })
      expect(yield* db.all(sql`SELECT entry_level FROM ftc_learning_entry`)).toEqual([{ entry_level: "advanced" }])
      yield* db.run(sql`DELETE FROM ftc_learning_entry`)
      yield* db.run(sql`INSERT INTO ftc_learning_skip VALUES (${courseID}, '1.0.0', ' ', '1.0.0')`)
      const mixed = yield* service.skipLesson({ courseID, lessonID: "lesson-b" }).pipe(Effect.result)
      expect(Result.isFailure(mixed) && mixed.failure.code).toBe("invalid_stored_navigation")
      expect(yield* db.all(sql`SELECT * FROM ftc_learning_skip`)).toHaveLength(1)
      yield* db.run(sql`DELETE FROM ftc_learning_skip`)
      yield* service.recordAttempt(attempt())
      yield* db.run(sql`UPDATE ftc_learning_attempt SET evidence_json = '{broken'`)
      const result = yield* service.selectEntry({ courseID, entryLevel: "experienced" }).pipe(Effect.result)
      expect(Result.isFailure(result) && result.failure.code).toBe("invalid_stored_attempt")
      expect(yield* db.all(sql`SELECT * FROM ftc_learning_entry`)).toEqual([])
    }),
  )
})

test("read-only failures and cancellation leave personal navigation unchanged and borrowed DB usable", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "personal.sqlite")
  await run(filename, (service, db) =>
    Effect.gen(function* () {
      yield* db.run(sql`PRAGMA query_only = ON`)
      const result = yield* service.skipLesson({ courseID, lessonID: "lesson-a" }).pipe(Effect.result)
      expect(Result.isFailure(result) && result.failure.code).toBe("progress_store_failed")
      expect(yield* db.all(sql`SELECT * FROM ftc_learning_skip`)).toEqual([])
    }),
  )
  const started = Deferred.makeUnsafe<void>()
  const released = Deferred.makeUnsafe<void>()
  const port = lookup()
  port.course.lookup = () =>
    Effect.scoped(
      Effect.gen(function* () {
        yield* Effect.addFinalizer(() => Deferred.succeed(released, undefined))
        yield* Deferred.succeed(started, undefined)
        return yield* Effect.never
      }),
    )
  await run(
    filename,
    (service, db) =>
      Effect.gen(function* () {
        const fiber = yield* service.selectEntry({ courseID, entryLevel: "experienced" }).pipe(Effect.forkChild)
        yield* Deferred.await(started)
        yield* Fiber.interrupt(fiber)
        expect(yield* Deferred.isDone(released)).toBe(true)
        expect(yield* db.all(sql`SELECT * FROM ftc_learning_entry`)).toEqual([])
      }),
    port,
  )
  await run(filename, (service) => service.skipLesson({ courseID, lessonID: "lesson-a" }))
})

test("ingress and content are captured before delayed lookup boundaries", async () => {
  await using tmp = await tmpdir()
  const started = Deferred.makeUnsafe<void>()
  const resume = Deferred.makeUnsafe<void>()
  const input = { courseID, entryLevel: "experienced" as FtcLearning.EntryLevel }
  const supplied = document()
  const port = lookup()
  port.course.lookup = () => Effect.succeed(content(supplied))
  port.lessons = () =>
    Effect.gen(function* () {
      yield* Deferred.succeed(started, undefined)
      yield* Deferred.await(resume)
      return document().lessons!
    })
  await run(
    path.join(tmp.path, "personal.sqlite"),
    (service) =>
      Effect.gen(function* () {
        const fiber = yield* service.selectEntry(input).pipe(Effect.forkChild)
        yield* Deferred.await(started)
        input.entryLevel = "java-beginner"
        Object.assign(supplied.entryPoints!, { experienced: "lesson-a" })
        yield* Deferred.succeed(resume, undefined)
        expect((yield* Fiber.join(fiber)).entryLevel).toBe("experienced")
      }),
    port,
  )
})

test("new facade contracts use the exact canonical Schema identities", async () => {
  const core = await import("../../../src/ftc/learning")
  for (const name of [
    "EntryLevel",
    "SelectEntryRequest",
    "SkipLessonRequest",
    "NextLessonRequest",
    "LessonResult",
  ] as const)
    expect(core[name]).toBe(FtcLearning[name])
})

// Separate composed integration: actual predecessor migrations, not the module fixture DDL above.
test("actual generated navigation migration preserves a populated predecessor and reopens", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "migration.sqlite")
  const { DatabaseMigration } = await import("../../../src/database/migration")
  const { migrations } = await import("../../../src/database/migration.gen")
  const index = migrations.findIndex((migration) => migration.id.endsWith("_ftc-learning-navigation"))
  expect(index).toBeGreaterThan(0)
  const input = attempt()
  await Effect.runPromise(
    Effect.gen(function* () {
      const db = yield* EffectDrizzleSqlite.makeWithDefaults()
      yield* DatabaseMigration.applyOnly(db, migrations.slice(0, index))
      yield* db.run(
        sql`INSERT INTO project (id, worktree, time_created, time_updated, sandboxes) VALUES ('m12-host-row', '/synthetic', 1, 2, '[]')`,
      )
      yield* Effect.gen(function* () {
        const service = yield* Service
        yield* service.recordAttempt(input)
      }).pipe(Effect.provide(layer({ lessons: lookup().lessons }, db)))
      const attempts = yield* db.all(sql`SELECT * FROM ftc_learning_attempt`)
      const hosts = yield* db.all(sql`SELECT * FROM project`)
      yield* DatabaseMigration.apply(db)
      yield* DatabaseMigration.apply(db)
      expect(yield* db.all(sql`SELECT * FROM project`)).toEqual(hosts)
      expect(yield* db.all(sql`SELECT * FROM ftc_learning_attempt`)).toEqual(attempts)
      expect(yield* db.all(sql`SELECT * FROM ftc_learning_entry`)).toEqual([])
      expect(yield* db.all(sql`SELECT * FROM ftc_learning_skip`)).toEqual([])
      expect(yield* db.all(sql`SELECT id FROM migration WHERE id = ${migrations[index].id}`)).toEqual([
        { id: migrations[index].id },
      ])
      yield* Effect.gen(function* () {
        const service = yield* Service
        yield* service.selectEntry({ courseID, entryLevel: "ftc-beginner" })
        yield* service.skipLesson({ courseID, lessonID: "lesson-b" })
      }).pipe(Effect.provide(layer(lookup(), db)))
      expect(yield* db.all(sql`SELECT * FROM ftc_learning_entry`)).toHaveLength(1)
    }).pipe(Effect.provide(SqliteClient.layer({ filename })), Effect.scoped),
  )
  await Effect.runPromise(
    Effect.gen(function* () {
      const db = yield* EffectDrizzleSqlite.makeWithDefaults()
      yield* Effect.gen(function* () {
        const service = yield* Service
        const progress = yield* service.progress({ courseID })
        expect(progress.entryLevel).toBe("ftc-beginner")
        expect(progress.lessons[1].status).toBe("skipped")
        expect(progress.attempts).toEqual([input])
        expect(yield* service.nextLesson(next)).toMatchObject({
          kind: "lesson",
          language: "zh",
          lesson: { id: "lesson-c" },
        })
      }).pipe(Effect.provide(layer(lookup(), db)))
      // Layer disposal leaves the caller's DB open until its enclosing scope is released.
      expect(yield* db.all(sql`SELECT id FROM project`)).toEqual([{ id: "m12-host-row" }])
    }).pipe(Effect.provide(SqliteClient.layer({ filename })), Effect.scoped),
  )
})

test("missing query binding compares values independently of object key order", async () => {
  await using tmp = await tmpdir()
  const port = lookup()
  port.course.lookup = (query) =>
    Effect.succeed({
      kind: "missing",
      reason: "not_local",
      requested: {
        localOnly: query.localOnly,
        language: query.language,
        sdkVersion: query.sdkVersion,
        id: query.id,
      },
    })
  expect(await run(path.join(tmp.path, "personal.sqlite"), (service) => service.nextLesson(next), port)).toEqual({
    kind: "unavailable",
    ...next,
    reason: "not_local",
  })
})

test("invalid navigation commands reject before writing either table", async () => {
  await using tmp = await tmpdir()
  await run(path.join(tmp.path, "personal.sqlite"), (service, db) =>
    Effect.gen(function* () {
      const badLevel = yield* service
        .selectEntry({
          courseID,
          // @ts-expect-error Deliberately exercise runtime validation of an unsupported entry level.
          entryLevel: "advanced",
        })
        .pipe(Effect.result)
      expect(Result.isFailure(badLevel) && badLevel.failure.code).toBe("invalid_input")
      const missingLesson = yield* service.skipLesson({ courseID, lessonID: "absent" }).pipe(Effect.result)
      expect(Result.isFailure(missingLesson) && missingLesson.failure.code).toBe("lesson_not_found")
      const extra = yield* service
        .selectEntry({ courseID, entryLevel: "experienced", completed: true } as FtcLearning.SelectEntryRequest)
        .pipe(Effect.result)
      expect(Result.isFailure(extra) && extra.failure.code).toBe("invalid_input")
      expect(yield* db.all(sql`SELECT * FROM ftc_learning_entry`)).toEqual([])
      expect(yield* db.all(sql`SELECT * FROM ftc_learning_skip`)).toEqual([])
    }),
  )
})

test("current course snapshot survives mutable port objects across a later await", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "personal.sqlite")
  await run(filename, (service) => service.selectEntry({ courseID, entryLevel: "experienced" }))
  const started = Deferred.makeUnsafe<void>()
  const resume = Deferred.makeUnsafe<void>()
  const supplied = document("zh")
  const port = lookup()
  port.course.lookup = () => Effect.succeed(content(supplied))
  port.lessons = () =>
    Effect.gen(function* () {
      yield* Deferred.succeed(started, undefined)
      yield* Deferred.await(resume)
      return document().lessons!
    })
  await run(
    filename,
    (service) =>
      Effect.gen(function* () {
        const fiber = yield* service.nextLesson(next).pipe(Effect.forkChild)
        yield* Deferred.await(started)
        Object.assign(supplied.entryPoints!, { experienced: "lesson-a" })
        Object.assign(supplied.lessons![2], { title: "mutated" })
        yield* Deferred.succeed(resume, undefined)
        expect(yield* Fiber.join(fiber)).toMatchObject({ kind: "lesson", lesson: { id: "lesson-c", title: "zh c" } })
      }),
    port,
  )
})

test("concurrent entry reselections each return their transaction result and retain a single preference", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "personal.sqlite")
  await run(filename, (service) => service.progress({ courseID }))
  const choices = ["java-beginner", "ftc-beginner", "experienced"] as const
  const results = await Promise.all(
    choices.map((entryLevel) => run(filename, (service) => service.selectEntry({ courseID, entryLevel }))),
  )
  expect(results.map((progress) => progress.entryLevel)).toEqual([...choices])
  await run(filename, (service, db) =>
    Effect.gen(function* () {
      expect(yield* db.all(sql`SELECT * FROM ftc_learning_entry`)).toHaveLength(1)
      expect(choices).toContain((yield* service.progress({ courseID })).entryLevel!)
      expect(yield* db.all(sql`SELECT * FROM ftc_learning_attempt`)).toEqual([])
    }),
  )
})

test("a lesson-only upgrade ignores historical skips while retaining course-bound entry and old attempts", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "personal.sqlite")
  const input = attempt()
  await run(filename, (service) =>
    Effect.gen(function* () {
      yield* service.recordAttempt(input)
      yield* service.selectEntry({ courseID, entryLevel: "ftc-beginner" })
      yield* service.skipLesson({ courseID, lessonID: "lesson-b" })
    }),
  )
  await run(
    filename,
    (service, db) =>
      Effect.gen(function* () {
        expect(yield* service.recordAttempt(input)).toEqual(input)
        const progress = yield* service.progress({ courseID })
        expect(progress.courseVersion).toBe("1.0.0")
        expect(progress.entryLevel).toBe("ftc-beginner")
        expect(progress.lessons[1]).toEqual({
          lessonID: "lesson-b",
          lessonVersion: "2.0.0",
          status: "not_started",
          attemptIDs: [],
        })
        expect(progress.attempts).toEqual([input])
        expect(yield* service.nextLesson(next)).toMatchObject({
          kind: "lesson",
          lesson: { id: "lesson-b", version: "2.0.0" },
        })
        expect(yield* db.all(sql`SELECT lesson_id, lesson_version FROM ftc_learning_skip`)).toEqual([
          { lesson_id: "lesson-b", lesson_version: "1.0.0" },
        ])
        yield* service.skipLesson({ courseID, lessonID: "lesson-b" })
        expect(yield* db.all(sql`SELECT * FROM ftc_learning_skip`)).toHaveLength(2)
      }),
    lookup("1.0.0", (doc) => ({ ...doc, lessons: doc.lessons!.map((lesson) => ({ ...lesson, version: "2.0.0" })) })),
  )
})

function libraryLookup(applicability: { library?: string; libraryRange?: string }): LessonLookup {
  return {
    lessons: lookup().lessons,
    course: {
      binding: () =>
        Effect.succeed({
          courseVersion: "1.0.0",
          sdkVersion: "11.1.0",
          library: "Road Runner",
          libraryVersion: "1.0.0",
        }),
      lookup: (query) => {
        expect(query).toEqual({
          id: courseID,
          sdkVersion: "11.1.0",
          library: "Road Runner",
          libraryVersion: "1.0.0",
          language: query.language,
          localOnly: true,
        })
        const result = content(document(query.language))
        return Effect.succeed(
          result.kind === "found"
            ? { ...result, records: result.records.map((record) => ({ ...record, ...applicability })) }
            : result,
        )
      },
    },
  }
}

test.each([
  { name: "SDK-wide", applicability: {} },
  { name: "matching library-specific", applicability: { library: "Road Runner", libraryRange: "^1.0.0" } },
])("explicit library binding permits $name courses through every navigation command", async ({ applicability }) => {
  await using tmp = await tmpdir()
  await run(
    path.join(tmp.path, "personal.sqlite"),
    (service, db) =>
      Effect.gen(function* () {
        const results = [
          yield* service.selectEntry({ courseID, entryLevel: "ftc-beginner" }).pipe(Effect.result),
          yield* service.skipLesson({ courseID, lessonID: "lesson-a" }).pipe(Effect.result),
          yield* service.nextLesson(next).pipe(Effect.result),
          yield* service.progress({ courseID }).pipe(Effect.result),
        ]
        expect(results.map((result) => ("success" in result ? "success" : result.failure.code))).toEqual([
          "success",
          "success",
          "success",
          "success",
        ])
        expect(results[0]).toMatchObject({ success: { courseID, courseVersion: "1.0.0", entryLevel: "ftc-beginner" } })
        expect(results[1]).toMatchObject({
          success: {
            lessons: [
              { lessonID: "lesson-a", status: "skipped" },
              { lessonID: "lesson-b", status: "not_started" },
              { lessonID: "lesson-c", status: "not_started" },
            ],
            attempts: [],
          },
        })
        expect(results[2]).toMatchObject({
          success: { kind: "lesson", courseID, courseVersion: "1.0.0", language: "zh", lesson: { id: "lesson-b" } },
        })
        expect(results[3]).toEqual(results[1])
        expect(yield* db.all(sql`SELECT * FROM ftc_learning_entry`)).toHaveLength(1)
        expect(yield* db.all(sql`SELECT * FROM ftc_learning_skip`)).toHaveLength(1)
        expect(yield* db.all(sql`SELECT * FROM ftc_learning_attempt`)).toEqual([])
      }),
    libraryLookup(applicability),
  )
})

test.each([
  { name: "different library", applicability: { library: "PedroPathing", libraryRange: "^1.0.0" } },
  { name: "incompatible library version", applicability: { library: "Road Runner", libraryRange: "^2.0.0" } },
  { name: "invalid library range", applicability: { library: "Road Runner", libraryRange: "invalid" } },
  { name: "missing library range", applicability: { library: "Road Runner" } },
  { name: "missing library identity", applicability: { libraryRange: "^1.0.0" } },
])(
  "explicit library binding rejects $name through every navigation command without writes",
  async ({ applicability }) => {
    await using tmp = await tmpdir()
    await run(
      path.join(tmp.path, "personal.sqlite"),
      (service, db) =>
        Effect.gen(function* () {
          const results = [
            yield* service.selectEntry({ courseID, entryLevel: "ftc-beginner" }).pipe(Effect.result),
            yield* service.skipLesson({ courseID, lessonID: "lesson-a" }).pipe(Effect.result),
            yield* service.nextLesson(next).pipe(Effect.result),
            yield* service.progress({ courseID }).pipe(Effect.result),
          ]
          expect(results.map((result) => "failure" in result && result.failure.code)).toEqual([
            "invalid_course",
            "invalid_course",
            "invalid_course",
            "invalid_course",
          ])
          expect(yield* db.all(sql`SELECT * FROM ftc_learning_entry`)).toEqual([])
          expect(yield* db.all(sql`SELECT * FROM ftc_learning_skip`)).toEqual([])
          expect(yield* db.all(sql`SELECT * FROM ftc_learning_attempt`)).toEqual([])
        }),
      libraryLookup(applicability),
    )
  },
)
