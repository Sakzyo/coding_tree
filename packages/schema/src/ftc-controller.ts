export * as FtcController from "./ftc-controller"

import { Schema } from "effect"
import { optional } from "./schema"

const Text = Schema.String.check(Schema.isMinLength(1), Schema.isTrimmed())

export interface ControllerCandidate extends Schema.Schema.Type<typeof ControllerCandidate> {}
export const ControllerCandidate = Schema.Struct({
  // A transport address and reported model do not establish physical controller identity.
  transportAddress: Text,
  adbState: Text,
  model: optional(Text),
  kind: optional(Schema.Literals(["control-hub", "phone"])),
  authorization: Schema.Literals(["authorized", "unauthorized", "unknown"]),
  state: Schema.Literals(["available", "unauthorized", "offline", "unavailable"]),
  errorCodes: Schema.Array(Schema.Literals(["adb_unauthorized", "adb_offline", "adb_unsupported_state"])),
  guidanceCodes: Schema.Array(
    Schema.Literals([
      "control_hub_connection",
      "identify_control_hub_or_phone",
      "phone_compatibility_unverified",
      "usb_authorization_required",
      "connection_recovery",
      "expansion_hub_configuration_unobserved",
    ]),
  ),
}).annotate({ identifier: "FtcController.ControllerCandidate" })

export interface DiscoveryError extends Schema.Schema.Type<typeof DiscoveryError> {}
export const DiscoveryError = Schema.Struct({
  code: Schema.Literals(["adb_missing_tool", "adb_transport_error", "adb_command_failed", "adb_invalid_response"]),
  detail: optional(Schema.String),
  exitCode: optional(Schema.Int),
}).annotate({ identifier: "FtcController.DiscoveryError" })
