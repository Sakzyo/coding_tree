export * as FtcLearning from "./ftc-learning"

import { Schema } from "effect"
import { FtcKnowledge } from "./ftc-knowledge"
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

export const EntryLevel = Schema.Literals(["java-beginner", "ftc-beginner", "experienced"]).annotate({
  identifier: "FtcLearning.EntryLevel",
})
export type EntryLevel = typeof EntryLevel.Type

export interface SelectEntryRequest extends Schema.Schema.Type<typeof SelectEntryRequest> {}
export const SelectEntryRequest = Schema.Struct({ courseID: Text, entryLevel: EntryLevel }).annotate({
  identifier: "FtcLearning.SelectEntryRequest",
})

export interface SkipLessonRequest extends Schema.Schema.Type<typeof SkipLessonRequest> {}
export const SkipLessonRequest = Schema.Struct({ courseID: Text, lessonID: Text }).annotate({
  identifier: "FtcLearning.SkipLessonRequest",
})

export interface NextLessonRequest extends Schema.Schema.Type<typeof NextLessonRequest> {}
export const NextLessonRequest = Schema.Struct({ courseID: Text, language: Schema.Literals(["en", "zh"]) }).annotate({
  identifier: "FtcLearning.NextLessonRequest",
})

export const UnavailableReason = Schema.Literals([
  "not_found",
  "incompatible",
  "missing_translation",
  "not_local",
  "no_match",
  "course_lookup_unavailable",
  "missing_entry_points",
]).annotate({ identifier: "FtcLearning.UnavailableReason" })
export type UnavailableReason = typeof UnavailableReason.Type

export const LessonResult = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("lesson"),
    courseID: Text,
    courseVersion: Text,
    language: Schema.Literals(["en", "zh"]),
    lesson: FtcKnowledge.Lesson,
  }),
  Schema.Struct({
    kind: Schema.Literal("no_next"),
    courseID: Text,
    courseVersion: Text,
    language: Schema.Literals(["en", "zh"]),
  }),
  Schema.Struct({
    kind: Schema.Literal("unavailable"),
    courseID: Text,
    language: Schema.Literals(["en", "zh"]),
    reason: UnavailableReason,
  }),
]).annotate({ identifier: "FtcLearning.LessonResult" })
export type LessonResult = typeof LessonResult.Type

export interface LessonProgress extends Schema.Schema.Type<typeof LessonProgress> {}
export const LessonProgress = Schema.Struct({
  lessonID: Text,
  lessonVersion: Text,
  status: Schema.Literals(["not_started", "recorded", "skipped"]),
  attemptIDs: Schema.Array(AttemptID),
}).annotate({ identifier: "FtcLearning.LessonProgress" })

export interface Progress extends Schema.Schema.Type<typeof Progress> {}
export const Progress = Schema.Struct({
  courseID: Text,
  courseVersion: optional(Text),
  entryLevel: optional(EntryLevel),
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
    "invalid_stored_navigation",
    "course_lookup_failed",
    "invalid_course",
    "course_snapshot_changed",
    "course_unavailable",
    "lesson_not_skippable",
  ]),
  courseID: optional(Text),
  lessonID: optional(Text),
  attemptID: optional(AttemptID),
  reason: optional(UnavailableReason),
  recovery: Schema.Literals(["correct_input", "refresh_lessons", "retry"]),
}).annotate({ identifier: "FtcLearning.LearningError" })
