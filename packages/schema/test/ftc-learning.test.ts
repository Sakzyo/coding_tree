import { expect, test } from "bun:test"
import { Schema } from "effect"
import { FtcLearning } from "../src/ftc-learning"
import { Project } from "../src/project"
import { FtcConfiguration } from "../src/ftc-configuration"
import { FtcKnowledge } from "../src/ftc-knowledge"

const input = {
  attemptID: FtcLearning.AttemptID.create(),
  courseID: "foundations",
  lessonID: "opmode-lifecycle",
  lessonVersion: "1.0.0",
  projectID: Project.ID.make("ftc_project_a"),
  configurationRevision: "config-a-1",
  outcome: "submitted" as const,
  evidence: [],
  explanation: "",
}

test("attempt IDs require the exact generated prefix and records round-trip as serializable values", () => {
  expect(Schema.is(FtcLearning.AttemptID)(input.attemptID)).toBe(true)
  expect(Schema.is(FtcLearning.AttemptID)("attemptwrong")).toBe(false)
  const encoded = Schema.encodeSync(FtcLearning.Attempt)(input)
  expect(Schema.decodeUnknownSync(FtcLearning.Attempt)(JSON.parse(JSON.stringify(encoded)))).toEqual(input)
  expect(Schema.is(FtcLearning.Attempt)({ ...input, configurationRevision: "" })).toBe(false)
  expect(Schema.is(FtcLearning.Attempt)({ ...input, outcome: "completed" })).toBe(false)
})

test("exercise requests preserve canonical snapshots, all evidence and optional omission", () => {
  const command = {
    courseID: "generic",
    lessonID: "lesson",
    language: "en" as const,
    projectSnapshot: {
      projectID: input.projectID,
      sdkVersion: "11.1.0",
      library: undefined,
      libraryVersion: undefined,
    },
    configuration: {
      revision: "a".repeat(64),
      manifest: { schemaVersion: 1 as const, hardware: [], managedPathing: "neither" as const },
    },
  }
  const encoded = Schema.encodeSync(FtcLearning.RequestExerciseCommand)(command)
  expect(encoded.projectSnapshot).toEqual({ projectID: input.projectID, sdkVersion: "11.1.0" })
  expect(FtcLearning.RequestExerciseCommand.fields.configuration).toBe(FtcConfiguration.ManifestSnapshot)
  expect(FtcLearning.ExerciseRequest.fields.requiredEvidence.value).toBe(FtcKnowledge.Exercise)
  const request = {
    kind: "exercise" as const,
    courseID: "generic",
    courseVersion: "1.0.0",
    lessonID: "lesson",
    lessonVersion: "1.0.0",
    projectID: input.projectID,
    configurationRevision: command.configuration.revision,
    sdkVersion: "11.1.0",
    managedPathing: "neither" as const,
    language: "en" as const,
    track: "foundations" as const,
    requiredEvidence: [
      {
        id: "e",
        prompt: "Explain and apply",
        requiresExplanation: true as const,
        requiresProjectApplication: true as const,
        explanationCriteria: "Explain",
        projectApplicationCriteria: "Apply",
        requiresPhysicalValidation: undefined,
      },
    ],
    library: undefined,
    libraryVersion: undefined,
  }
  const serialized = Schema.encodeSync(FtcLearning.ExerciseRequest)(request)
  expect("library" in serialized).toBe(false)
  expect("requiresPhysicalValidation" in serialized.requiredEvidence[0]).toBe(false)
  expect(Schema.decodeUnknownSync(FtcLearning.ExerciseResult)(JSON.parse(JSON.stringify(serialized)))).toEqual(
    JSON.parse(JSON.stringify(serialized)),
  )
  expect(Schema.is(FtcLearning.RequestExerciseCommand)({ ...command, language: "fr" })).toBe(false)
  expect(Schema.is(FtcLearning.ExerciseResult)({ kind: "pathing_required" })).toBe(true)
  const values = [
    FtcLearning.ExerciseProjectSnapshot,
    FtcLearning.RequestExerciseCommand,
    FtcLearning.Track,
    FtcLearning.ExerciseRequest,
    FtcLearning.ExerciseResult,
  ]
  expect(values.map((schema) => schema.ast.annotations?.identifier)).toEqual([
    "FtcLearning.ExerciseProjectSnapshot",
    "FtcLearning.RequestExerciseCommand",
    "FtcLearning.Track",
    "FtcLearning.ExerciseRequest",
    "FtcLearning.ExerciseResult",
  ])
})

test("evidence requires labelled provenance and nonnegative timestamp, with no completion assertion", () => {
  const base = { kind: "physical", source: "student", timestamp: 0 }
  expect(Schema.is(FtcLearning.Evidence)(base)).toBe(false)
  expect(
    Schema.is(FtcLearning.Evidence)({
      ...base,
      provenance: { kind: "student_observation", observation: "Observed movement." },
    }),
  ).toBe(true)
  expect(
    Schema.is(FtcLearning.Evidence)({
      ...base,
      provenance: { kind: "owner_reference", owner: "M9", referenceID: "receipt-a", revision: "robot-generation-a" },
    }),
  ).toBe(true)
  expect(
    Schema.is(FtcLearning.Evidence)({
      ...base,
      timestamp: -1,
      provenance: { kind: "student_observation", observation: "Observed movement." },
    }),
  ).toBe(false)
  expect(
    Schema.is(FtcLearning.Evidence)({
      ...base,
      provenance: { kind: "owner_reference", owner: "M9", referenceID: "receipt-a" },
    }),
  ).toBe(false)
})

test("learning errors omit undefined properties and public identifiers remain stable and unique", () => {
  expect(
    Schema.encodeSync(FtcLearning.LearningError)({
      code: "invalid_input",
      courseID: undefined,
      recovery: "correct_input",
    }),
  ).toEqual({ code: "invalid_input", recovery: "correct_input" })
  const identifiers = [
    FtcLearning.AttemptID,
    FtcLearning.EvidenceProvenance,
    FtcLearning.Evidence,
    FtcLearning.Attempt,
    FtcLearning.ProgressRequest,
    FtcLearning.LessonProgress,
    FtcLearning.Progress,
    FtcLearning.LearningError,
  ].map((value) => ("identifier" in value ? value.identifier : value.ast.annotations?.identifier))
  expect(identifiers).toEqual([
    "FtcLearning.AttemptID",
    "FtcLearning.EvidenceProvenance",
    "FtcLearning.Evidence",
    "FtcLearning.Attempt",
    "FtcLearning.ProgressRequest",
    "FtcLearning.LessonProgress",
    "FtcLearning.Progress",
    "FtcLearning.LearningError",
  ])
  expect(new Set(identifiers).size).toBe(identifiers.length)
})

test("navigation contracts keep exact entry levels, omitted personal metadata and result bindings", () => {
  expect(Schema.is(FtcLearning.EntryLevel)("java-beginner")).toBe(true)
  expect(Schema.is(FtcLearning.EntryLevel)("ftc-beginner")).toBe(true)
  expect(Schema.is(FtcLearning.EntryLevel)("experienced")).toBe(true)
  expect(Schema.is(FtcLearning.EntryLevel)("advanced")).toBe(false)
  const progress = { courseID: "synthetic", lessons: [], attempts: [] }
  expect(
    Schema.encodeSync(FtcLearning.Progress)({ ...progress, courseVersion: undefined, entryLevel: undefined }),
  ).toEqual(progress)
  const outcome = { kind: "no_next" as const, courseID: "synthetic", courseVersion: "1.0.0", language: "zh" as const }
  expect(Schema.decodeUnknownSync(FtcLearning.LessonResult)(JSON.parse(JSON.stringify(outcome)))).toEqual(outcome)
  expect(Schema.is(FtcLearning.LessonResult)({ ...outcome, courseVersion: undefined })).toBe(false)
  expect(
    Schema.decodeUnknownSync(FtcLearning.LessonResult)({
      kind: "unavailable",
      courseID: "synthetic",
      language: "zh",
      reason: "missing_translation",
    }),
  ).toMatchObject({ reason: "missing_translation" })
  const identifiers = [
    FtcLearning.EntryLevel,
    FtcLearning.SelectEntryRequest,
    FtcLearning.SkipLessonRequest,
    FtcLearning.NextLessonRequest,
    FtcLearning.UnavailableReason,
    FtcLearning.LessonResult,
  ].map((schema) => schema.ast.annotations?.identifier)
  expect(identifiers).toEqual([
    "FtcLearning.EntryLevel",
    "FtcLearning.SelectEntryRequest",
    "FtcLearning.SkipLessonRequest",
    "FtcLearning.NextLessonRequest",
    "FtcLearning.UnavailableReason",
    "FtcLearning.LessonResult",
  ])
  expect(new Set(identifiers).size).toBe(identifiers.length)
})
