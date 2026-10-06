export * as Adb from "./adb"

import { Effect, Scope } from "effect"
import { FtcController } from "@opencode-ai/schema/ftc-controller"

export interface Response {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number
}

export interface DiscoveryTransport {
  // This port admits only discovery. The host owns its transport and scoped read cleanup.
  readonly readDevices: (
    args: readonly ["devices", "-l"],
  ) => Effect.Effect<Response, FtcController.DiscoveryError, Scope.Scope>
}

export function parseDevices(
  response: Response,
):
  | { readonly candidates: readonly FtcController.ControllerCandidate[] }
  | { readonly error: FtcController.DiscoveryError } {
  if (response.exitCode !== 0)
    return { error: { code: "adb_command_failed", detail: response.stderr.trim(), exitCode: response.exitCode } }

  const lines = response.stdout.trim().split(/\r?\n/)
  if (lines[0]?.trim() !== "List of devices attached") return { error: { code: "adb_invalid_response" } }

  const candidates = lines
    .slice(1)
    .filter((line) => line.trim() !== "")
    .map(parseCandidate)
  if (
    candidates.some((candidate) => candidate === undefined) ||
    new Set(candidates.map((candidate) => candidate?.transportAddress)).size !== candidates.length
  )
    return { error: { code: "adb_invalid_response" } }

  return { candidates: candidates.filter((candidate) => candidate !== undefined) }
}

function parseCandidate(line: string): FtcController.ControllerCandidate | undefined {
  const fields = line.trim().split(/\s+/)
  const address = fields[0]
  const state = fields[1]
  if (!address || !state) return undefined

  // ADB's Linux permission diagnostic is a multi-word state, not device metadata.
  const noPermissions = state === "no" && fields[2] === "permissions"
  const facts = noPermissions ? [] : fields.slice(2)
  if (facts.some((fact) => !/^[a-z_]+:\S+$/.test(fact))) return undefined
  if (new Set(facts.map((fact) => fact.slice(0, fact.indexOf(":")))).size !== facts.length) return undefined

  const model = facts.find((fact) => fact.startsWith("model:"))?.slice(6)
  const kind = model === "REV_Control_Hub" ? "control-hub" : undefined
  const available = state === "device"
  const unauthorized = state === "unauthorized"
  const offline = state === "offline"
  return {
    transportAddress: address,
    adbState: noPermissions ? "no permissions" : state,
    ...(model ? { model } : {}),
    ...(kind ? { kind } : {}),
    authorization: available ? "authorized" : unauthorized ? "unauthorized" : "unknown",
    state: available ? "available" : unauthorized ? "unauthorized" : offline ? "offline" : "unavailable",
    errorCodes: available
      ? []
      : unauthorized
        ? ["adb_unauthorized"]
        : offline
          ? ["adb_offline"]
          : ["adb_unsupported_state"],
    // Guidance describes setup/recovery, never observed phone compatibility or attached hardware.
    guidanceCodes: [
      ...(kind
        ? ["control_hub_connection" as const]
        : ["identify_control_hub_or_phone" as const, "phone_compatibility_unverified" as const]),
      ...(unauthorized ? ["usb_authorization_required" as const] : []),
      ...(!available && !unauthorized ? ["connection_recovery" as const] : []),
      "expansion_hub_configuration_unobserved",
    ],
  }
}
