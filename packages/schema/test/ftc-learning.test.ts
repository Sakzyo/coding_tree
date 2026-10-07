import { expect, test } from "bun:test"
import { Schema } from "effect"
import { FtcLearning } from "../src/ftc-learning"
import { Project } from "../src/project"

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
