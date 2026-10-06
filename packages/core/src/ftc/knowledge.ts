export * as FtcKnowledge from "./knowledge"

import { FtcKnowledge } from "@opencode-ai/schema/ftc-knowledge"
import { Context, Effect, Layer, Option, Schema, Scope } from "effect"
import semver from "semver"
import { Hash } from "../util/hash"

export const ContentRecord = FtcKnowledge.ContentRecord
export type ContentRecord = FtcKnowledge.ContentRecord
export const PackResult = FtcKnowledge.PackResult
export type PackResult = FtcKnowledge.PackResult

export const ContentQuery = FtcKnowledge.ContentQuery
export type ContentQuery = FtcKnowledge.ContentQuery
export const ContentResult = FtcKnowledge.ContentResult
export type ContentResult = FtcKnowledge.ContentResult

export interface Ports {
  readonly repository: {
    // Snapshot bytes are validated independently of current local-use availability.
    readonly read: () => Effect.Effect<unknown, FtcKnowledge.QueryError, Scope.Scope>
    readonly available: (record: ContentRecord) => Effect.Effect<boolean, FtcKnowledge.QueryError, Scope.Scope>
  }
  readonly search: {
    readonly matches: (input: {
      readonly record: ContentRecord
      readonly document: FtcKnowledge.ContentDocument
      readonly text: string
    }) => Effect.Effect<boolean, FtcKnowledge.QueryError, Scope.Scope>
  }
}

export interface Interface {
  readonly lookup: (query: ContentQuery) => Effect.Effect<ContentResult, FtcKnowledge.QueryError>
  readonly search: (input: FtcKnowledge.SearchRequest) => Effect.Effect<ContentResult, FtcKnowledge.QueryError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/FtcKnowledge") {}

export const layer = (ports: Ports) => {
  const query = (input: unknown, text?: string): Effect.Effect<ContentResult, FtcKnowledge.QueryError> =>
    Effect.scoped(
      Effect.gen(function* () {
        const decoded = Schema.decodeUnknownOption(ContentQuery, { onExcessProperty: "error" })(input)
        if (
          Option.isNone(decoded) ||
          !concreteVersion(decoded.value.sdkVersion) ||
          (decoded.value.library === undefined) !== (decoded.value.libraryVersion === undefined) ||
          (decoded.value.libraryVersion !== undefined && !concreteVersion(decoded.value.libraryVersion))
        )
          return yield* Effect.fail({ code: "invalid_input" as const })
        const requested = decoded.value
        const inputPack = yield* ports.repository.read()
        const pack = validatePack(inputPack)
        if (pack.kind === "invalid")
          return yield* Effect.fail({ code: "invalid_content" as const, errors: pack.errors })
        const selected = pack.records.filter(
          (record) =>
            (requested.id === undefined || record.id === requested.id) &&
            (requested.topic === undefined || record.topic === requested.topic),
        )
        const applicable = selected.filter(
          (record) =>
            semver.satisfies(requested.sdkVersion, record.sdkRange) &&
            (record.library === undefined ||
              (record.library === requested.library &&
                requested.libraryVersion !== undefined &&
                record.libraryRange !== undefined &&
                semver.satisfies(requested.libraryVersion, record.libraryRange))),
        )
        const localized = applicable.filter((record) => record.language === requested.language)
        const missing = (reason: Extract<ContentResult, { kind: "missing" }>["reason"]): ContentResult => ({
          kind: "missing",
          reason,
          requested,
        })
        if (!selected.length) return missing("not_found")
        if (!applicable.length) return missing("incompatible")
        if (!localized.length) return missing("missing_translation")

        // Only validated snapshot bytes can supply the document; availability never fetches content.
        const snapshot = Schema.decodeUnknownSync(FtcKnowledge.PackInput)(inputPack)
        const observed = yield* Effect.forEach(localized, (record) =>
          Effect.gen(function* () {
            const available = yield* ports.repository.available(record)
            if (typeof available !== "boolean") return yield* Effect.fail({ code: "invalid_response" as const })
            if (!available) return { ...record, locallyAvailable: false }
            const file = snapshot.files.find((file) => file.localPath === record.localPath)!
            const document = Schema.decodeUnknownSync(Schema.UnknownFromJsonString)(
              Buffer.from(file.bytes).toString("utf8"),
            )
            return {
              ...record,
              locallyAvailable: true,
              document: Schema.decodeUnknownSync(FtcKnowledge.ContentDocument)(document),
            }
          }),
        )
        const local = observed.filter(
          (record): record is Extract<typeof record, { document: FtcKnowledge.ContentDocument }> =>
            "document" in record && record.locallyAvailable,
        )
        if (text !== undefined) {
          if (!local.length) return missing("not_local")
          const matches = yield* Effect.forEach(local, (record) =>
            Effect.gen(function* () {
              const matches = yield* ports.search.matches({ record, document: record.document, text })
              if (typeof matches !== "boolean") return yield* Effect.fail({ code: "invalid_response" as const })
              return matches ? [record] : []
            }),
          )
          const records = matches.flat()
          return records.length ? { kind: "found", records } : missing("no_match")
        }
        const records = requested.localOnly ? local : observed
        return records.length ? { kind: "found", records } : missing("not_local")
      }),
    )

  return Layer.succeed(Service, {
    lookup: (input) => query(input),
    search: (input) =>
      Effect.suspend((): Effect.Effect<ContentResult, FtcKnowledge.QueryError> => {
        const decoded = Schema.decodeUnknownOption(FtcKnowledge.SearchRequest, { onExcessProperty: "error" })(input)
        if (Option.isNone(decoded)) return Effect.fail({ code: "invalid_input" as const })
        return query(decoded.value.query, decoded.value.text)
      }),
  })
}

function concreteVersion(value: string) {
  return semver.valid(value) !== null && !value.startsWith("v") && value === value.trim()
}

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
      if (file) {
        reasons.push(...validateContent(record, file))
        const pairedFile = pair && request.value.files.find((file) => file.localPath === pair.localPath)
        if (pairedFile) {
          const document = decodeDocument(file)
          const pairedDocument = decodeDocument(pairedFile)
          if (
            Option.isSome(document) &&
            Option.isSome(pairedDocument) &&
            JSON.stringify(lessonIdentifiers(document.value)) !==
              JSON.stringify(lessonIdentifiers(pairedDocument.value))
          )
            reasons.push("translation_mismatch")
        }
      }
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
  const lessons = document.value.lessons ?? []
  if (lessons.some((lesson) => !concreteVersion(lesson.version))) return ["invalid_record"]
  const ids = [
    ...lessons.map((lesson) => lesson.id),
    ...lessons.flatMap((lesson) => lesson.exercises.map((exercise) => exercise.id)),
  ]
  if (new Set(ids).size !== ids.length) return ["duplicate_id"]
  const tokens = [
    document.value.body,
    ...lessons.flatMap((lesson) => [
      lesson.title,
      lesson.body,
      ...lesson.exercises.flatMap((exercise) => [
        exercise.prompt,
        exercise.explanationCriteria,
        exercise.projectApplicationCriteria,
      ]),
    ]),
  ].map(protectedLiterals)
  if (tokens.some((tokens) => tokens === null)) return ["malformed_content"]
  if (JSON.stringify(tokens.flat()) !== JSON.stringify(record.codeTokens)) return ["identifier_mismatch"]
  return []
}

function decodeDocument(file: FtcKnowledge.ContentFile) {
  return Option.flatMap(
    Schema.decodeUnknownOption(Schema.UnknownFromJsonString)(Buffer.from(file.bytes).toString("utf8")),
    Schema.decodeUnknownOption(FtcKnowledge.ContentDocument, { onExcessProperty: "error" }),
  )
}

function lessonIdentifiers(document: FtcKnowledge.ContentDocument) {
  return document.lessons?.map((lesson) => ({
    id: lesson.id,
    version: lesson.version,
    topic: lesson.topic,
    exercises: lesson.exercises.map((exercise) => exercise.id),
  }))
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
