export * as FtcOperation from "./ftc-operation"

import { Schema } from "effect"
import { FtcJava } from "./ftc-java"
import { FtcProject } from "./ftc-project"
import { ascending } from "./identifier"
import { Project } from "./project"
import { optional, statics } from "./schema"

const Text = Schema.String.check(
  Schema.isMinLength(1),
  Schema.makeFilter((value) => value.trim() === value),
)
const Parameter = Schema.Json.check(Schema.makeFilter((value) => value !== null))

export const RobotMode = Schema.Literals(["observation", "actions-with-approval"]).annotate({
  identifier: "FtcOperation.RobotMode",
})
export type RobotMode = typeof RobotMode.Type

export const OperationID = Schema.String.check(Schema.isStartsWith("operation_"))
  .pipe(Schema.brand("FtcOperation.OperationID"))
  .annotate({ identifier: "FtcOperation.OperationID" })
  .pipe(statics((schema) => ({ create: () => schema.make(`operation_${ascending()}`) })))
export type OperationID = typeof OperationID.Type

// M9's read-only binding projection; M5 supplies successful/current build evidence at composition.
export interface DeploymentArtifactContext extends Schema.Schema.Type<typeof DeploymentArtifactContext> {}
export const DeploymentArtifactContext = Schema.Struct({
  projectID: Project.ID.check(Schema.isMinLength(1)),
  buildID: Text,
  sourceRevision: Schema.Array(FtcJava.Revision).check(Schema.isMinLength(1)),
  configurationRevision: Text,
  digest: Text,
}).annotate({ identifier: "FtcOperation.DeploymentArtifactContext" })

export const Action = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("deploy"), artifact: DeploymentArtifactContext }),
  Schema.Struct({ kind: Schema.Literal("initialize"), opMode: Text, expectedState: Parameter }),
  Schema.Struct({ kind: Schema.Literal("start"), opMode: Text, expectedState: Parameter }),
  Schema.Struct({ kind: Schema.Literal("tune"), field: Text, value: Parameter, expectedState: Parameter }),
]).annotate({ identifier: "FtcOperation.Action" })
export type Action = typeof Action.Type

export interface OperationRequest extends Schema.Schema.Type<typeof OperationRequest> {}
export const OperationRequest = Schema.Struct({
  projectID: Project.ID.check(Schema.isMinLength(1)),
  chatID: optional(FtcProject.ChatID),
  initiator: Schema.Literals(["user", "agent"]),
  controllerID: Text,
  // Opaque change/equality token. M8 owns its producer and lifecycle semantics.
  generation: Text,
  action: Action,
}).annotate({ identifier: "FtcOperation.OperationRequest" })

export const Status = Schema.Literals([
  "requested",
  "awaiting_approval",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "unknown",
]).annotate({ identifier: "FtcOperation.Status" })
export type Status = typeof Status.Type

export interface PreparedOperation extends Schema.Schema.Type<typeof PreparedOperation> {}
export const PreparedOperation = Schema.Struct({
  ...OperationRequest.fields,
  operationID: OperationID,
  robotMode: RobotMode,
  status: Schema.Literal("awaiting_approval"),
  // Decision data only, never approval authority.
  contextFingerprint: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
}).annotate({ identifier: "FtcOperation.PreparedOperation" })

export interface OperationError extends Schema.Schema.Type<typeof OperationError> {}
export const OperationError = Schema.Struct({
  code: Schema.Literals([
    "invalid_operation_input",
    "untrusted_caller",
    "project_unauthorized",
    "chat_unauthorized",
    "initiator_mismatch",
    "robot_mode_mismatch",
    "controller_unknown",
    "context_changed",
    "unsupported_operation",
    "invalid_parameters",
    "artifact_invalid",
    "observation_only",
    "owner_closed",
  ]),
  projectID: optional(Project.ID),
  chatID: optional(FtcProject.ChatID),
  controllerID: optional(Schema.String),
}).annotate({ identifier: "FtcOperation.OperationError" })
