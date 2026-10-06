export * as FtcProject from "./ftc-project"

import { Schema } from "effect"
import { Location } from "./location"
import { Project } from "./project"
import { AbsolutePath, optional } from "./schema"

export interface ProjectContext extends Schema.Schema.Type<typeof ProjectContext> {}
export const ProjectContext = Schema.Struct({
  // Local association ID. Never pass this to legacy Project APIs; use location.project.id.
  projectID: Project.ID,
  // Execution ownership is keyed by this canonical root, independent of the host project ID.
  canonicalRoot: AbsolutePath,
  location: Location.Info,
}).annotate({ identifier: "FtcProject.ProjectContext" })

export interface FolderRequest extends Schema.Schema.Type<typeof FolderRequest> {}
export const FolderRequest = Schema.Struct({ root: AbsolutePath }).annotate({ identifier: "FtcProject.FolderRequest" })

export interface AssociationError extends Schema.Schema.Type<typeof AssociationError> {}
export const AssociationError = Schema.Struct({
  code: Schema.Literals(["folder_unavailable", "invalid_folder_identity", "association_store_failed"]),
  root: optional(AbsolutePath),
  detail: optional(Schema.String),
  recovery: Schema.Literals(["select_accessible_folder", "retry"]),
}).annotate({ identifier: "FtcProject.AssociationError" })
