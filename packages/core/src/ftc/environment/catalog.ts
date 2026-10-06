export * as FtcEnvironmentCatalog from "./catalog"

import { FtcEnvironment } from "@opencode-ai/schema/ftc-environment"
import { Option, Schema } from "effect"

export function resolveProfile(input: unknown): FtcEnvironment.ResolveResult {
  const request = Schema.decodeUnknownOption(FtcEnvironment.ResolveRequest, { onExcessProperty: "error" })(input)
  if (Option.isNone(request)) return { kind: "unsupported", reasons: [{ code: "invalid_input" }] }
  if (request.value.catalog.profiles.length === 0) return { kind: "unsupported", reasons: [{ code: "no_profiles" }] }

  const candidates = request.value.catalog.profiles.map((profile) => ({
    profile,
    reasons: incompatibilities(request.value, profile),
  }))
  const matches = candidates.filter((candidate) => candidate.reasons.length === 0)
  if (matches.length === 1) return { kind: "matched", profile: matches[0].profile }
  if (matches.length > 1) return { kind: "unsupported", reasons: [{ code: "ambiguous_profiles" }] }
  return { kind: "unsupported", reasons: candidates.flatMap((candidate) => candidate.reasons) }
}

function incompatibilities(
  request: FtcEnvironment.ResolveRequest,
  profile: FtcEnvironment.Profile,
): FtcEnvironment.Reason[] {
  if (profile.evaluation.status !== "evaluated") return [{ code: "unevaluated_profile", profileID: profile.id }]
  // Fixture provenance is selectable only through an explicitly synthetic catalog.
  if (profile.evaluation.kind !== (request.catalog.kind === "synthetic" ? "synthetic" : "platform"))
    return [{ code: "evaluation_kind", profileID: profile.id }]

  return [
    ...(profile.os !== request.host.os ? [{ code: "host_os" as const, profileID: profile.id }] : []),
    ...(!profile.osVersions.includes(request.host.osVersion)
      ? [{ code: "host_version" as const, profileID: profile.id }]
      : []),
    ...(profile.architecture !== request.host.architecture
      ? [{ code: "host_architecture" as const, profileID: profile.id }]
      : []),
    ...(request.host.resources.memoryBytes < profile.resources.memoryBytes ||
    request.host.resources.diskBytes < profile.resources.diskBytes
      ? [{ code: "host_resources" as const, profileID: profile.id }]
      : []),
    ...(["ftcSdk", "androidGradlePlugin", "androidSdk", "gradleWrapper"] as const).flatMap((component) =>
      request.projectVersions[component] !== undefined &&
      request.projectVersions[component] !== profile[component].version
        ? [{ code: "project_version" as const, profileID: profile.id, component }]
        : [],
    ),
  ]
}
