export * as FtcKnowledge from "./knowledge"

import { FtcKnowledge } from "@opencode-ai/schema/ftc-knowledge"
import { Option, Schema } from "effect"
import semver from "semver"
import { Hash } from "../util/hash"

export const ContentRecord = FtcKnowledge.ContentRecord
export type ContentRecord = FtcKnowledge.ContentRecord
export const PackResult = FtcKnowledge.PackResult
export type PackResult = FtcKnowledge.PackResult

const Input = Schema.Struct({
  manifest: Schema.Struct({
    kind: Schema.Literals(["production", "synthetic"]),
    records: Schema.Array(Schema.Unknown),
  }),
  files: Schema.Array(FtcKnowledge.ContentFile),
})
const Metadata = Schema.Record(Schema.String, Schema.Unknown)

export function validatePack(input: unknown): FtcKnowledge.PackResult {
  const request = Schema.decodeUnknownOption(Input, { onExcessProperty: "error" })(input)
  if (Option.isNone(request)) return { kind: "invalid", errors: [{ code: "invalid_content", reason: "invalid_input" }] }

  const decoded = request.value.manifest.records.map((value) => ({
    value,
    record: Schema.decodeUnknownOption(FtcKnowledge.ContentRecord, { onExcessProperty: "error" })(value),
  }))
  const metadataErrors = decoded.flatMap((entry): FtcKnowledge.PackError[] => {
    if (Option.isSome(entry.record)) return []
    const metadata = Schema.decodeUnknownOption(Metadata)(entry.value)
    if (Option.isNone(metadata)) return [{ code: "invalid_content", reason: "invalid_record" }]
    if (typeof metadata.value.source !== "string" || !metadata.value.source.trim())
      return [{ code: "invalid_content", reason: "missing_source" }]
    if (typeof metadata.value.license !== "string" || !metadata.value.license.trim())
      return [{ code: "invalid_content", reason: "missing_license" }]
    if (typeof metadata.value.sdkRange !== "string" || !validRange(metadata.value.sdkRange))
      return [{ code: "invalid_content", reason: "invalid_range" }]
    if (
      (metadata.value.library === undefined) !== (metadata.value.libraryRange === undefined) ||
      (metadata.value.libraryRange !== undefined &&
        (typeof metadata.value.libraryRange !== "string" || !validRange(metadata.value.libraryRange)))
    )
      return [{ code: "invalid_content", reason: "invalid_range" }]
    return [{ code: "invalid_content", reason: "invalid_record" }]
  })
  if (metadataErrors.length) return { kind: "invalid", errors: metadataErrors }

  const records = decoded.flatMap((entry) => (Option.isSome(entry.record) ? [entry.record.value] : []))
  const errors = [
    ...request.value.files.flatMap((file, index): FtcKnowledge.PackError[] =>
      request.value.files.slice(0, index).some((other) => other.localPath === file.localPath)
        ? [{ code: "invalid_content", reason: "duplicate_file", localPath: file.localPath }]
        : [],
    ),
    ...records.flatMap((record, index): FtcKnowledge.PackError[] => {
      const reasons: FtcKnowledge.PackError["reason"][] = []
      if (
        records
          .slice(0, index)
          .some(
            (other) => other.id === record.id && other.version === record.version && other.language === record.language,
          )
      )
        reasons.push("duplicate_id")
      if (!semver.valid(record.version)) reasons.push("invalid_record")
      if (
        !validRange(record.sdkRange) ||
        (record.library === undefined) !== (record.libraryRange === undefined) ||
        (record.libraryRange !== undefined && !validRange(record.libraryRange))
      )
        reasons.push("invalid_range")
      if (request.value.manifest.kind === "production" && record.provenance === "synthetic")
        reasons.push("synthetic_content")

      const pair = records.find(
        (other) => other.id === record.id && other.version === record.version && other.language !== record.language,
      )
      if (!pair) reasons.push("missing_translation")
      if (
        pair &&
        (pair.topic !== record.topic ||
          pair.sdkRange !== record.sdkRange ||
          pair.library !== record.library ||
          pair.libraryRange !== record.libraryRange ||
          pair.provenance !== record.provenance ||
          JSON.stringify(pair.codeTokens) !== JSON.stringify(record.codeTokens))
      )
        reasons.push("translation_mismatch")

      const file = request.value.files.find((file) => file.localPath === record.localPath)
      if (!file) reasons.push("missing_file")
      if (file) reasons.push(...validateContent(record, file))
      return reasons.map((reason) => ({
        code: "invalid_content",
        reason,
        id: record.id,
        language: record.language,
        localPath: record.localPath,
      }))
    }),
  ]
  if (errors.length) return { kind: "invalid", errors }
  return { kind: "valid", records }
}

function validRange(value: string) {
  if (!value.trim() || !semver.validRange(value)) return false
  const minimum = semver.minVersion(value)
  return minimum !== null && semver.satisfies(minimum, value, { includePrerelease: true })
}

function validateContent(
  record: FtcKnowledge.ContentRecord,
  file: FtcKnowledge.ContentFile,
): FtcKnowledge.PackError["reason"][] {
  const bytes = Buffer.from(file.bytes)
  if (Hash.sha256(bytes) !== record.digest.toLowerCase()) return ["digest_mismatch"]
  const text = bytes.toString("utf8")
  if (!Buffer.from(text, "utf8").equals(bytes)) return ["malformed_content"]
  const json = Schema.decodeUnknownOption(Schema.UnknownFromJsonString)(text)
  if (Option.isNone(json)) return ["malformed_content"]
  const document = Schema.decodeUnknownOption(FtcKnowledge.ContentDocument, { onExcessProperty: "error" })(json.value)
  if (Option.isNone(document)) return ["malformed_content"]
  if (
    document.value.id !== record.id ||
    document.value.version !== record.version ||
    document.value.language !== record.language
  )
    return ["identity_mismatch"]
  // These exact literals are the package's protected API/device/domain-code surface.
  const tokens = protectedLiterals(document.value.body)
  if (tokens === null) return ["malformed_content"]
  if (JSON.stringify(tokens) !== JSON.stringify(record.codeTokens)) return ["identifier_mismatch"]
  return []
}

function protectedLiterals(body: string) {
  const tokens: string[] = []
  const pattern = /^[ \t]*(`{3,}|~{3,})([^\r\n]*)(?:\r?\n|$)|(`+)([\s\S]*?)\3/gm
  for (let match = pattern.exec(body); match; match = pattern.exec(body)) {
    if (match[1] === undefined) {
      tokens.push(match[4])
      continue
    }
    if (match[1][0] === "`" && match[2].includes("`")) return null
    const closer = new RegExp(`^[ \\t]*${match[1][0]}{${match[1].length},}[ \\t]*(?:\\r?\\n|$)`, "gm")
    closer.lastIndex = match.index + match[0].length
    const closing = closer.exec(body)
    if (!closing) return null
    tokens.push(body.slice(match.index + match[0].length, closing.index).replace(/\r?\n$/, ""))
    // Consume the whole fence so code inside it is protected once, not reparsed as Markdown.
    pattern.lastIndex = closer.lastIndex
  }
  return tokens
}
