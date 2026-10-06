import { expect, test } from "bun:test"
import { ContentDocument, Manifest } from "@opencode-ai/schema/ftc-knowledge"
import { Effect, Schema } from "effect"
import { FtcKnowledge } from "../../../src/ftc/knowledge"
import { Hash } from "../../../src/util/hash"

const root = new URL("../../../resources/ftc/content/", import.meta.url)

async function pack() {
  const manifest = Schema.decodeUnknownSync(Manifest)(await Bun.file(new URL("manifest.json", root)).json())
  const files = await Promise.all(
    manifest.records.map(async (record: FtcKnowledge.ContentRecord) => ({
      localPath: record.localPath,
      bytes: Array.from(new Uint8Array(await Bun.file(new URL(record.localPath, root)).arrayBuffer())),
    })),
  )
  return { manifest, files }
}

test("foundation lessons require explanation and project application", async () => {
  const snapshot = await pack()
  expect(FtcKnowledge.validatePack(snapshot).kind).toBe("valid")
  for (const language of ["en", "zh"] as const) {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* FtcKnowledge.Service
        return yield* service.lookup({ id: "foundations", sdkVersion: "11.1.0", language, localOnly: true })
      }).pipe(
        Effect.provide(
          FtcKnowledge.layer({
            repository: { read: () => Effect.succeed(snapshot), available: () => Effect.succeed(true) },
            search: { matches: () => Effect.succeed(false) },
          }),
        ),
      ),
    )
    const lessons = result.kind === "found" ? (result.records[0].document?.lessons ?? []) : []
    const missingRequiredTopics = [
      "java-fundamentals",
      "opmode-lifecycle",
      "hardware-gamepads-telemetry",
      "code-organization",
    ].filter((topic) => !lessons.some((lesson) => lesson.topic === topic))
    expect(missingRequiredTopics).toEqual([])
    expect(lessons).toHaveLength(4)
    lessons.forEach((lesson) => {
      expect(lesson.body.length).toBeGreaterThan(100)
      expect(lesson.exercises.length).toBeGreaterThan(0)
      lesson.exercises.forEach((exercise) => {
        expect(exercise.requiresExplanation).toBe(true)
        expect(exercise.requiresProjectApplication).toBe(true)
        expect(exercise.explanationCriteria.length).toBeGreaterThan(40)
        expect(exercise.projectApplicationCriteria.length).toBeGreaterThan(40)
      })
    })
  }
})

async function edited(language: "en" | "zh", change: (document: ContentDocument) => unknown) {
  const snapshot = await pack()
  const record = snapshot.manifest.records.find((record) => record.language === language)!
  const document = Schema.decodeUnknownSync(ContentDocument)(await Bun.file(new URL(record.localPath, root)).json())
  const bytes = Buffer.from(JSON.stringify(change(document)))
  return {
    manifest: {
      ...snapshot.manifest,
      records: snapshot.manifest.records.map((entry) =>
        entry.localPath === record.localPath ? { ...entry, digest: Hash.sha256(bytes) } : entry,
      ),
    },
    files: snapshot.files.map((entry) =>
      entry.localPath === record.localPath ? { ...entry, bytes: Array.from(bytes) } : entry,
    ),
  }
}

test("foundation criteria and identifiers are validated from actual bytes", async () => {
  const changes: { reason: string; change: (document: ContentDocument) => unknown }[] = [
    {
      reason: "malformed_content",
      change: (document) => ({ ...document, lessons: [] }),
    },
    {
      reason: "duplicate_id",
      change: (document) => ({ ...document, lessons: [...document.lessons!, document.lessons![0]] }),
    },
    {
      reason: "invalid_record",
      change: (document) => ({
        ...document,
        lessons: document.lessons!.map((lesson, index) => (index ? lesson : { ...lesson, version: "v1.0.0" })),
      }),
    },
    {
      reason: "translation_mismatch",
      change: (document) => ({ ...document, lessons: document.lessons!.toReversed() }),
    },
    ...["id", "version", "topic"].map((field) => ({
      reason: "translation_mismatch",
      change: (document: ContentDocument) => ({
        ...document,
        lessons: document.lessons!.map((lesson, index) =>
          index ? lesson : { ...lesson, [field]: field === "version" ? "1.0.1" : "changed-identifier" },
        ),
      }),
    })),
    ...[
      "requiresExplanation",
      "requiresProjectApplication",
      "explanationCriteria",
      "projectApplicationCriteria",
      "id",
    ].map((field) => ({
      reason: field === "id" ? "translation_mismatch" : "malformed_content",
      change: (document: ContentDocument) => ({
        ...document,
        lessons: document.lessons!.map((lesson, index) =>
          index
            ? lesson
            : {
                ...lesson,
                exercises: lesson.exercises.map((exercise) => ({
                  ...exercise,
                  [field]: field.startsWith("requires") ? false : field === "id" ? "changed-exercise" : " ",
                })),
              },
        ),
      }),
    })),
    {
      reason: "duplicate_id",
      change: (document) => ({
        ...document,
        lessons: document.lessons!.map((lesson) => ({
          ...lesson,
          exercises: lesson.exercises.map((exercise) => ({ ...exercise, id: "same-exercise" })),
        })),
      }),
    },
    ...["body", "title", "prompt", "explanationCriteria", "projectApplicationCriteria"].map((field) => ({
      reason: "identifier_mismatch",
      change: (document: ContentDocument) => ({
        ...document,
        lessons: document.lessons!.map((lesson, index) =>
          index
            ? lesson
            : field === "body" || field === "title"
              ? { ...lesson, [field]: `${lesson[field]}\n\n\`changedApi\`` }
              : {
                  ...lesson,
                  exercises: lesson.exercises.map((exercise) => ({ ...exercise, [field]: "Changed `changedApi`" })),
                },
        ),
      }),
    })),
  ]
  for (const change of changes) {
    const result = FtcKnowledge.validatePack(await edited("zh", change.change))
    expect(result.kind).toBe("invalid")
    if (result.kind === "invalid") expect(result.errors.map((error): string => error.reason)).toContain(change.reason)
  }
})

test("foundation queries preserve source metadata and explicit local/version/language selection", async () => {
  const snapshot = await pack()
  const run = (available: boolean) =>
    Effect.gen(function* () {
      const service = yield* FtcKnowledge.Service
      return [
        yield* service.lookup({ id: "foundations", sdkVersion: "11.1.0", language: "zh", localOnly: true }),
        yield* service.lookup({ id: "foundations", sdkVersion: "11.0.0", language: "en", localOnly: true }),
        yield* service.search({
          query: { topic: "foundations", sdkVersion: "11.1.0", language: "zh", localOnly: true },
          text: "生命周期",
        }),
      ]
    }).pipe(
      Effect.provide(
        FtcKnowledge.layer({
          repository: { read: () => Effect.succeed(snapshot), available: () => Effect.succeed(available) },
          search: { matches: (input) => Effect.succeed(JSON.stringify(input.document).includes(input.text)) },
        }),
      ),
    )
  const results = await Effect.runPromise(run(true))
  expect(results.map((result) => result.kind)).toEqual(["found", "missing", "found"])
  expect(results[1]).toMatchObject({ reason: "incompatible" })
  if (results[0].kind === "found") {
    expect(results[0].records[0]).toMatchObject({ ...snapshot.manifest.records[1], locallyAvailable: true })
    expect(results[0].records[0].document?.language).toBe("zh")
    expect(results[0].records[0].document?.lessons?.map((lesson) => lesson.version)).toEqual(Array(4).fill("1.0.0"))
    expect(results[0].records[0].source).toContain("203c2d373765f0c66d121e3ec1cc3a18835f6534")
    expect(results[0].records[0].license).toContain("MIT (original")
  }
  const missing = await Effect.runPromise(run(false))
  expect(missing[0]).toMatchObject({ kind: "missing", reason: "not_local" })
  expect(missing[2]).toMatchObject({ kind: "missing", reason: "not_local" })
})

test("bilingual foundation references and examples preserve source and device placeholders", async () => {
  const documents = await Promise.all(
    ["en", "zh"].map(async (language) =>
      Schema.decodeUnknownSync(ContentDocument)(await Bun.file(new URL(`${language}/foundations.json`, root)).json()),
    ),
  )
  const references = documents.map((document) =>
    Array.from(document.body.matchAll(/\]\((https:[^)]+)\)/g), (match) => match[1]),
  )
  expect(references[0]).toEqual(references[1])
  expect(references[0]).toContain(
    "https://repo.maven.apache.org/maven2/org/firstinspires/ftc/RobotCore/11.1.0/RobotCore-11.1.0-sources.jar",
  )
  documents.forEach((document) => {
    const hardware = document.lessons!.find((lesson) => lesson.topic === "hardware-gamepads-telemetry")!
    expect(hardware.body).toContain('"REPLACE_WITH_DS_MOTOR_NAME"')
    expect(hardware.body).toContain("observedMotor.getCurrentPosition()")
    expect(hardware.body).not.toContain(".setPower(")
    expect(document.body).toContain("Driver Station")
  })
})
