export * as FtcInferenceCatalog from "./catalog"

import { FtcInference } from "@opencode-ai/schema/ftc-inference"
import { Option, Schema } from "effect"

// Validate the resource envelope independently so catalog failures retain their own reason.
const Request = Schema.Struct({
  hostResources: FtcInference.HostResources,
  concurrentWork: FtcInference.ConcurrentWork,
  catalog: Schema.Unknown,
})

export function recommendModels(input: unknown): FtcInference.Recommendation {
  const request = Schema.decodeUnknownOption(Request, { onExcessProperty: "error" })(input)
  if (Option.isNone(request)) return failure("invalid_input")
  const catalog = Schema.decodeUnknownOption(FtcInference.Catalog, { onExcessProperty: "error" })(request.value.catalog)
  if (Option.isNone(catalog)) return failure("invalid_catalog")

  const host = request.value.hostResources
  const work = request.value.concurrentWork
  const reserved = [work.desktop, work.jdt, work.gradle, ...work.projects.map((project) => project.resources)].reduce(
    (total, resources) => ({
      memoryBytes: total.memoryBytes + resources.memoryBytes,
      gpuMemoryBytes: total.gpuMemoryBytes + resources.gpuMemoryBytes,
      diskBytes: total.diskBytes + resources.diskBytes,
    }),
    { memoryBytes: 0, gpuMemoryBytes: 0, diskBytes: 0 },
  )
  const shared = host.gpu?.memory === "shared"
  const reservedMemory = reserved.memoryBytes + (shared ? reserved.gpuMemoryBytes : 0)
  if (
    !Object.values(reserved).every(Number.isSafeInteger) ||
    !Number.isSafeInteger(reservedMemory) ||
    (reserved.gpuMemoryBytes > 0 && host.gpu === undefined)
  )
    return failure("invalid_input")

  const available = {
    memoryBytes: host.availableMemoryBytes - reservedMemory,
    gpuMemoryBytes: (host.gpu?.availableMemoryBytes ?? 0) - reserved.gpuMemoryBytes,
    diskBytes: host.availableDiskBytes - reserved.diskBytes,
  }
  const candidates = catalog.value.profiles.map((profile) => {
    const memory = profile.resources.memoryBytes + (shared ? profile.resources.gpuMemoryBytes : 0)
    if (!Number.isSafeInteger(memory))
      return { profile, reasons: [{ code: "invalid_catalog" as const }], remainingResources: available }
    const reasons: FtcInference.ExclusionReason[] = [
      ...(profile.evaluation.status === "unevaluated" ? [{ code: "unevaluated_profile" as const }] : []),
      ...(profile.evaluation.status === "evaluated" &&
      profile.evaluation.kind !== (catalog.value.kind === "synthetic" ? "synthetic" : "platform")
        ? [{ code: "evaluation_kind" as const }]
        : []),
      ...(profile.os !== host.os || profile.architecture !== host.architecture
        ? [{ code: "unsupported_platform" as const }]
        : []),
      ...(!host.backends.includes(profile.backend) ? [{ code: "unsupported_backend" as const }] : []),
      ...(profile.backend !== "cpu" && host.gpu === undefined ? [{ code: "gpu_unavailable" as const }] : []),
      ...(memory > available.memoryBytes
        ? [{ code: "insufficient_memory" as const, required: memory, available: available.memoryBytes }]
        : []),
      ...(profile.resources.gpuMemoryBytes > available.gpuMemoryBytes
        ? [
            {
              code: "insufficient_gpu_memory" as const,
              required: profile.resources.gpuMemoryBytes,
              available: available.gpuMemoryBytes,
            },
          ]
        : []),
      ...(profile.resources.diskBytes > available.diskBytes
        ? [
            {
              code: "insufficient_disk" as const,
              required: profile.resources.diskBytes,
              available: available.diskBytes,
            },
          ]
        : []),
      ...(work.requiredContextTokens > profile.contextTokens
        ? [
            {
              code: "insufficient_context" as const,
              required: work.requiredContextTokens,
              available: profile.contextTokens,
            },
          ]
        : []),
      ...work.requiredCapabilities
        .filter((capability) => !profile.testedCapabilities.includes(capability))
        .map((capability) => ({ code: "untested_capability" as const, capability })),
    ]
    return {
      profile,
      reasons,
      remainingResources: {
        memoryBytes: available.memoryBytes - memory,
        gpuMemoryBytes: available.gpuMemoryBytes - profile.resources.gpuMemoryBytes,
        diskBytes: available.diskBytes - profile.resources.diskBytes,
      },
    }
  })
  return {
    eligible: candidates
      .filter((candidate) => candidate.reasons.length === 0)
      .map((candidate) => ({ profile: candidate.profile, remainingResources: candidate.remainingResources })),
    excluded: candidates
      .filter((candidate) => candidate.reasons.length > 0)
      .map((candidate) => ({
        profileID: candidate.profile.id,
        reason: candidate.reasons[0].code,
        reasons: candidate.reasons,
      })),
  }
}

function failure(code: "invalid_input" | "invalid_catalog"): FtcInference.Recommendation {
  return { eligible: [], excluded: [{ reason: code, reasons: [{ code }] }] }
}
