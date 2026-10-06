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
  // Ordered exact contents of Markdown code spans/fences, including API/device/domain identifiers.
  codeTokens: Schema.Array(Schema.String.check(Schema.isMinLength(1))),
}).annotate({ identifier: "FtcKnowledge.ContentRecord" })

export interface ContentDocument extends Schema.Schema.Type<typeof ContentDocument> {}
export const ContentDocument = Schema.Struct({
  id: Text,
  version: Text,
  language: Language,
  body: Text,
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
