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

export interface ForwardTransport {
  // Host implementation must atomically allocate without rebinding, compensate failed
  // acquisitions, and close only this lease. Raw forwarding is bidirectional.
  readonly open: (request: {
    readonly serial: string
    readonly localPort: 0
    readonly remotePort: number
    readonly noRebind: true
  }) => Effect.Effect<
    {
      readonly localPort: number
      readonly close: Effect.Effect<void, FtcController.EndpointError>
    },
    FtcController.EndpointError
  >
}

export function forwardPanels(
  candidate: FtcController.ControllerCandidate,
  revision: string,
  transport: ForwardTransport,
): Effect.Effect<
  { readonly httpOrigin: string; readonly dataOrigin: string },
  FtcController.EndpointError,
  Scope.Scope
> {
  return Effect.gen(function* () {
    if (candidate.state !== "available" || candidate.authorization !== "authorized")
      return yield* Effect.fail({ code: "candidate_unavailable" as const })
    if (revision !== "11d69a98e39c43a7d9edc5932275897c034f7a30")
      return yield* Effect.fail({ code: "protocol_unknown" as const })
    const ports = yield* Effect.forEach([8001, 8002], (remotePort) =>
      Effect.acquireRelease(
        transport.open({ serial: candidate.transportAddress, localPort: 0, remotePort, noRebind: true }),
        // Cleanup failure must remain visible in the scope exit, never a false success.
        (lease) => lease.close.pipe(Effect.orDie),
      ).pipe(
        Effect.flatMap((lease) =>
          Number.isInteger(lease.localPort) && lease.localPort > 0 && lease.localPort <= 65535
            ? Effect.succeed(lease.localPort)
            : Effect.fail({ code: "forward_invalid" as const }),
        ),
      ),
    )
    if (ports[0] === ports[1]) return yield* Effect.fail({ code: "forward_invalid" as const })
    return { httpOrigin: `http://127.0.0.1:${ports[0]}`, dataOrigin: `ws://127.0.0.1:${ports[1]}` }
  })
}
