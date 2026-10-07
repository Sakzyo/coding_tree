export * as ManifestSnapshot from "./manifest-snapshot"

import { FtcConfiguration } from "@opencode-ai/schema/ftc-configuration"
import { createHash } from "node:crypto"
import { Option, Result, Schema } from "effect"

export interface Producer {
  readonly decodeRead: (
    bytes: Uint8Array | undefined,
  ) => Result.Result<FtcConfiguration.ReadResult, FtcConfiguration.ManifestError>
}

export function decodeRead(
  input: Uint8Array | undefined,
): Result.Result<FtcConfiguration.ReadResult, FtcConfiguration.ManifestError> {
  if (input === undefined) return Result.succeed(proposal())
  const bytes = new Uint8Array(input)
  return Result.map(decodeBytes(bytes), (manifest) => ({
    revision: createHash("sha256").update(bytes).digest("hex"),
    manifest,
  }))
}

function proposal(): FtcConfiguration.InitializationProposal {
  return {
    kind: "initialization_proposal",
    filename: "ftc-project.json",
    expectedRevision: null,
    manifest: { schemaVersion: 1, hardware: [], managedPathing: "neither" },
  }
}

export function decodeManifest(
  value: unknown,
): Result.Result<FtcConfiguration.Manifest, FtcConfiguration.ManifestError> {
  if (
    typeof value === "object" &&
    value !== null &&
    "schemaVersion" in value &&
    typeof value.schemaVersion === "number" &&
    value.schemaVersion > 1
  )
    return Result.fail({ code: "unsupported_schema_version" } satisfies FtcConfiguration.ManifestError)
  const decoded = Schema.decodeUnknownOption(FtcConfiguration.Manifest, { onExcessProperty: "error" })(value)
  return Option.isSome(decoded)
    ? Result.succeed(decoded.value)
    : Result.fail({ code: "invalid_manifest" } satisfies FtcConfiguration.ManifestError)
}

export function decodeBytes(
  bytes: Uint8Array,
): Result.Result<FtcConfiguration.Manifest, FtcConfiguration.ManifestError> {
  const json = Schema.decodeUnknownOption(Schema.UnknownFromJsonString)(
    new TextDecoder("utf-8", { fatal: false }).decode(bytes),
  )
  return Option.isSome(json)
    ? decodeManifest(json.value)
    : Result.fail({ code: "invalid_manifest" } satisfies FtcConfiguration.ManifestError)
}
