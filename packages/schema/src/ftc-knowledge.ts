export * as FtcKnowledge from "./ftc-knowledge"

import { Schema } from "effect"
import { optional } from "./schema"

const Text = Schema.String.check(Schema.isMinLength(1), Schema.isTrimmed())
const Language = Schema.Literals(["en", "zh"])
const LocalPath = Text.check(
  Schema.isPattern(/^(?![A-Za-z]:)(?!\/)[^\\:]+\.json$/),
  Schema.makeFilter((value) => value.split("/").every((part) => part !== ".." && part !== "." && part !== "")),
)

export interface ContentRecord extends Schema.Schema.Type<typeof ContentRecord> {}
export const ContentRecord = Schema.Struct({
  id: Text,
  version: Text,
  language: Language,
  topic: Text,
  sdkRange: Text,
  library: optional(Text),
  libraryRange: optional(Text),
  source: Text.check(Schema.makeFilter((value) => URL.canParse(value) && new URL(value).protocol === "https:")),
  license: Text,
  localPath: LocalPath,
  digest: Text.check(Schema.isPattern(/^[a-fA-F0-9]{64}$/)),
  provenance: Schema.Literals(["synthetic", "source"]),
  // Ordered exact Markdown code spans/fences across document and nested lesson/exercise text.
  codeTokens: Schema.Array(Schema.String.check(Schema.isMinLength(1))),
}).annotate({ identifier: "FtcKnowledge.ContentRecord" })

export interface Exercise extends Schema.Schema.Type<typeof Exercise> {}
export const Exercise = Schema.Struct({
  id: Text,
  prompt: Text,
  requiresExplanation: Schema.Literal(true),
  requiresProjectApplication: Schema.Literal(true),
  requiresPhysicalValidation: optional(Schema.Boolean),
  explanationCriteria: Text,
  projectApplicationCriteria: Text,
}).annotate({ identifier: "FtcKnowledge.Exercise" })

export interface Lesson extends Schema.Schema.Type<typeof Lesson> {}
export const Lesson = Schema.Struct({
  id: Text,
  version: Text,
  topic: Text,
  title: Text,
  body: Text,
  skippable: optional(Schema.Boolean),
  exercises: Schema.Array(Exercise).check(Schema.isMinLength(1)),
}).annotate({ identifier: "FtcKnowledge.Lesson" })

export interface ContentDocument extends Schema.Schema.Type<typeof ContentDocument> {}
export const ContentDocument = Schema.Struct({
  id: Text,
  version: Text,
  language: Language,
  body: Text,
  entryPoints: optional(
    Schema.Struct({
      "java-beginner": Text,
      "ftc-beginner": Text,
      experienced: Text,
    }),
  ),
  lessons: optional(Schema.Array(Lesson).check(Schema.isMinLength(1))),
}).annotate({ identifier: "FtcKnowledge.ContentDocument" })

export interface ContentFile extends Schema.Schema.Type<typeof ContentFile> {}
export const ContentFile = Schema.Struct({
  localPath: LocalPath,
  bytes: Schema.Array(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(255))),
}).annotate({ identifier: "FtcKnowledge.ContentFile" })

export interface Manifest extends Schema.Schema.Type<typeof Manifest> {}
export const Manifest = Schema.Struct({
  kind: Schema.Literals(["production", "synthetic"]),
  records: Schema.Array(ContentRecord),
}).annotate({ identifier: "FtcKnowledge.Manifest" })

export interface PackInput extends Schema.Schema.Type<typeof PackInput> {}
export const PackInput = Schema.Struct({
  manifest: Manifest,
  files: Schema.Array(ContentFile),
}).annotate({ identifier: "FtcKnowledge.PackInput" })

export interface PackError extends Schema.Schema.Type<typeof PackError> {}
export const PackError = Schema.Struct({
  code: Schema.Literal("invalid_content"),
  reason: Schema.Literals([
    "invalid_input",
    "invalid_record",
    "missing_source",
    "missing_license",
    "invalid_range",
    "duplicate_id",
    "duplicate_file",
    "missing_file",
    "digest_mismatch",
    "malformed_content",
    "identity_mismatch",
    "missing_translation",
    "translation_mismatch",
    "identifier_mismatch",
    "synthetic_content",
  ]),
  id: optional(Text),
  language: optional(Language),
  localPath: optional(LocalPath),
}).annotate({ identifier: "FtcKnowledge.PackError" })

export type PackResult = typeof PackResult.Type
export const PackResult = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("valid"), records: Schema.Array(ContentRecord) }),
  Schema.Struct({ kind: Schema.Literal("invalid"), errors: Schema.Array(PackError).check(Schema.isMinLength(1)) }),
]).annotate({ identifier: "FtcKnowledge.PackResult" })

export interface ContentQuery extends Schema.Schema.Type<typeof ContentQuery> {}
export const ContentQuery = Schema.Struct({
  id: optional(Text),
  topic: optional(Text),
  sdkVersion: Text,
  library: optional(Text),
  libraryVersion: optional(Text),
  language: Language,
  localOnly: Schema.Boolean,
}).annotate({ identifier: "FtcKnowledge.ContentQuery" })

export interface SearchRequest extends Schema.Schema.Type<typeof SearchRequest> {}
export const SearchRequest = Schema.Struct({ query: ContentQuery, text: Text }).annotate({
  identifier: "FtcKnowledge.SearchRequest",
})

export interface ContentReference extends Schema.Schema.Type<typeof ContentReference> {}
export const ContentReference = Schema.Struct({
  ...ContentRecord.fields,
  locallyAvailable: Schema.Boolean,
  document: optional(ContentDocument),
}).annotate({ identifier: "FtcKnowledge.ContentReference" })

export type ContentResult = typeof ContentResult.Type
export const ContentResult = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("found"),
    records: Schema.Array(ContentReference).check(Schema.isMinLength(1)),
  }),
  Schema.Struct({
    kind: Schema.Literal("missing"),
    reason: Schema.Literals(["not_found", "incompatible", "missing_translation", "not_local", "no_match"]),
    requested: ContentQuery,
  }),
]).annotate({ identifier: "FtcKnowledge.ContentResult" })

export interface QueryError extends Schema.Schema.Type<typeof QueryError> {}
export const QueryError = Schema.Struct({
  code: Schema.Literals(["invalid_input", "invalid_content", "repository_failed", "search_failed", "invalid_response"]),
  errors: optional(Schema.Array(PackError).check(Schema.isMinLength(1))),
}).annotate({ identifier: "FtcKnowledge.QueryError" })
