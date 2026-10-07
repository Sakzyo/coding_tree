export * as FtcLearning from "./ftc-learning"

import { Schema } from "effect"
import { Project } from "./project"
import { ascending } from "./identifier"
import { optional, statics } from "./schema"

const Text = Schema.String.check(Schema.isMinLength(1), Schema.isTrimmed())

export const AttemptID = Text.check(Schema.isStartsWith("attempt_"))
  .pipe(Schema.brand("FtcLearning.AttemptID"))
  .annotate({ identifier: "FtcLearning.AttemptID" })
  .pipe(statics((schema) => ({ create: () => schema.make(`attempt_${ascending()}`) })))
export type AttemptID = typeof AttemptID.Type

// References are recorded provenance supplied by a producer, never an M12 verification award.
export const EvidenceProvenance = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("owner_reference"), owner: Text, referenceID: Text, revision: Text }),
  Schema.Struct({ kind: Schema.Literal("student_observation"), observation: Text }),
]).annotate({ identifier: "FtcLearning.EvidenceProvenance" })
export type EvidenceProvenance = typeof EvidenceProvenance.Type

export interface Evidence extends Schema.Schema.Type<typeof Evidence> {}
export const Evidence = Schema.Struct({
  kind: Schema.Literals(["reading", "code", "build", "physical"]),
  source: Text,
  timestamp: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  provenance: EvidenceProvenance,
}).annotate({ identifier: "FtcLearning.Evidence" })

export interface Attempt extends Schema.Schema.Type<typeof Attempt> {}
export const Attempt = Schema.Struct({
  attemptID: AttemptID,
  courseID: Text,
  lessonID: Text,
  lessonVersion: Text,
  projectID: Project.ID,
  configurationRevision: Text,
  outcome: Schema.Literals(["submitted", "failed", "cancelled", "unknown"]),
  evidence: Schema.Array(Evidence),
  explanation: Schema.String,
}).annotate({ identifier: "FtcLearning.Attempt" })

export interface ProgressRequest extends Schema.Schema.Type<typeof ProgressRequest> {}
export const ProgressRequest = Schema.Struct({ courseID: Text }).annotate({ identifier: "FtcLearning.ProgressRequest" })

export interface LessonProgress extends Schema.Schema.Type<typeof LessonProgress> {}
export const LessonProgress = Schema.Struct({
  lessonID: Text,
  lessonVersion: Text,
  status: Schema.Literals(["not_started", "recorded"]),
  attemptIDs: Schema.Array(AttemptID),
}).annotate({ identifier: "FtcLearning.LessonProgress" })

export interface Progress extends Schema.Schema.Type<typeof Progress> {}
export const Progress = Schema.Struct({
  courseID: Text,
  lessons: Schema.Array(LessonProgress),
  attempts: Schema.Array(Attempt),
}).annotate({ identifier: "FtcLearning.Progress" })

export interface LearningError extends Schema.Schema.Type<typeof LearningError> {}
export const LearningError = Schema.Struct({
  code: Schema.Literals([
    "invalid_input",
    "lesson_lookup_failed",
    "invalid_lessons",
    "course_not_found",
    "lesson_not_found",
    "lesson_version_changed",
    "attempt_conflict",
    "progress_store_failed",
    "invalid_stored_attempt",
  ]),
  courseID: optional(Text),
  lessonID: optional(Text),
  attemptID: optional(AttemptID),
  recovery: Schema.Literals(["correct_input", "refresh_lessons", "retry"]),
}).annotate({ identifier: "FtcLearning.LearningError" })
