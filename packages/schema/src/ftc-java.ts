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
  // Revision of the saved bytes captured on open; external refresh/save belongs to the next task.
  diskRevision: NonNegativeInt,
  text: Schema.String,
  dirty: Schema.Boolean,
}).annotate({ identifier: "FtcJava.DocumentSnapshot" })

export interface DocumentEvent extends Schema.Schema.Type<typeof DocumentEvent> {}
export const DocumentEvent = Schema.Struct({
  type: Schema.Literals(["opened", "changed"]),
  snapshot: DocumentSnapshot,
}).annotate({ identifier: "FtcJava.DocumentEvent" })

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
  ]),
  projectID: optional(Project.ID),
  path: optional(Schema.String),
  expectedRevision: optional(NonNegativeInt),
  actualRevision: optional(NonNegativeInt),
}).annotate({ identifier: "FtcJava.DocumentError" })
