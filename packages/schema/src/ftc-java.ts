export * as FtcJava from "./ftc-java"

import { Schema } from "effect"
import { Project } from "./project"
import { AbsolutePath, NonNegativeInt, optional, statics } from "./schema"
import { ascending } from "./identifier"

export const DocumentID = Schema.String.check(Schema.isStartsWith("doc_"))
  .pipe(Schema.brand("FtcJava.DocumentID"))
  .annotate({ identifier: "FtcJava.DocumentID" })
  .pipe(statics((schema) => ({ create: () => schema.make(`doc_${ascending()}`) })))
export type DocumentID = typeof DocumentID.Type

export interface DocumentSnapshot extends Schema.Schema.Type<typeof DocumentSnapshot> {}
export const DocumentSnapshot = Schema.Struct({
  documentID: DocumentID,
  projectID: Project.ID,
  path: AbsolutePath.check(Schema.isPattern(/^(?:\/|[a-zA-Z]:[\\/]|\\\\)/)),
  bufferRevision: NonNegativeInt,
  // Revision of the most recently observed disk bytes; buffer revisions are independent.
  diskRevision: NonNegativeInt,
  text: Schema.String,
  dirty: Schema.Boolean,
}).annotate({ identifier: "FtcJava.DocumentSnapshot" })

export interface DocumentEvent extends Schema.Schema.Type<typeof DocumentEvent> {}
export const DocumentEvent = Schema.Struct({
  type: Schema.Literals(["opened", "changed", "saved", "disk_changed"]),
  snapshot: DocumentSnapshot,
}).annotate({ identifier: "FtcJava.DocumentEvent" })

export interface Revision extends Schema.Schema.Type<typeof Revision> {}
export const Revision = Schema.Struct({
  documentID: DocumentID,
  bufferRevision: NonNegativeInt,
  diskRevision: NonNegativeInt,
}).annotate({ identifier: "FtcJava.Revision" })

export interface SaveRequest extends Schema.Schema.Type<typeof SaveRequest> {}
export const SaveRequest = Schema.Struct({
  projectID: Project.ID,
  path: Schema.String,
  expectedRevision: Revision,
}).annotate({ identifier: "FtcJava.SaveRequest" })

export interface EditProposal extends Schema.Schema.Type<typeof EditProposal> {}
export const EditProposal = Schema.Struct({
  projectID: Project.ID,
  edits: Schema.Array(
    Schema.Struct({ path: Schema.String, expectedRevision: Revision, replacement: Schema.String }),
  ).check(Schema.isMinLength(1)),
  explanation: Schema.String,
}).annotate({ identifier: "FtcJava.EditProposal" })

// Authorization is an opaque runtime capability supplied to Core, never a serializable proposal field.
export interface EditConflict extends Schema.Schema.Type<typeof EditConflict> {}
export const EditConflict = Schema.Struct({
  path: Schema.String,
  reason: Schema.Literals(["revision", "dirty", "disk_changed"]),
  current: DocumentSnapshot,
  diskText: Schema.String,
  choices: Schema.Array(Schema.Literals(["save", "merge", "defer"])),
}).annotate({ identifier: "FtcJava.EditConflict" })

export interface DocumentError extends Schema.Schema.Type<typeof DocumentError> {}
export const DocumentError = Schema.Struct({
  code: Schema.Literals([
    "project_unauthorized",
    "path_outside_project",
    "file_unavailable",
    "document_not_open",
    "revision_conflict",
    "invalid_document_input",
    "owner_closed",
    "edit_unauthorized",
  ]),
  projectID: optional(Project.ID),
  path: optional(Schema.String),
  expectedRevision: optional(NonNegativeInt),
  actualRevision: optional(NonNegativeInt),
  conflict: optional(EditConflict),
  outcome: optional(Schema.Literals(["unknown"])),
}).annotate({ identifier: "FtcJava.DocumentError" })

export const EditResult = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("applied"),
    proposal: EditProposal,
    applied: Schema.Array(DocumentSnapshot),
  }),
  Schema.Struct({
    kind: Schema.Literal("conflict"),
    proposal: EditProposal,
    applied: Schema.Array(DocumentSnapshot),
    conflicts: Schema.Array(EditConflict).check(Schema.isMinLength(1)),
  }),
  Schema.Struct({
    kind: Schema.Literal("failed"),
    proposal: EditProposal,
    applied: Schema.Array(DocumentSnapshot),
    error: DocumentError,
    uncertainPaths: Schema.Array(Schema.String),
  }),
]).annotate({ identifier: "FtcJava.EditResult" })
export type EditResult = typeof EditResult.Type
