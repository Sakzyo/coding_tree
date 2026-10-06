import { expect, test } from "bun:test"
import {
  ContentQuery,
  ContentResult,
  ContentReference,
  QueryError,
  SearchRequest,
} from "@opencode-ai/schema/ftc-knowledge"
import { Effect, Fiber, Schema } from "effect"
import { FtcKnowledge } from "../../../src/ftc/knowledge"
import { FtcKnowledgeContext } from "../../../src/ftc/knowledge/context"
import { SystemContext } from "../../../src/system-context"
import { Hash } from "../../../src/util/hash"

// Synthetic packages establish filtering behavior, never supported SDK/library versions.
function pack() {
  const fixtures = [
    { id: "sdk-fixture-v1", sdkRange: ">=1.0.0 <2.0.0" },
    { id: "sdk-fixture-v2", sdkRange: ">=2.0.0 <3.0.0" },
    { id: "library-v1", sdkRange: "1.x", library: "fixture-library", libraryRange: "1.x" },
    { id: "library-v2", sdkRange: "1.x", library: "fixture-library", libraryRange: "2.x" },
  ].flatMap((metadata) =>
    (["en", "zh"] as const).map((language) => {
      const document = { id: metadata.id, version: "1.0.0", language, body: `${language}: fixture motor reference` }
      const bytes = JSON.stringify(document)
      return {
        record: {
          ...metadata,
          version: "1.0.0",
          language,
          topic: "fixture-topic",
          source: `https://fixtures.invalid/${metadata.id}`,
          license: "synthetic-fixture-license",
          localPath: `${language}/${metadata.id}.json`,
          digest: Hash.sha256(bytes),
          provenance: "synthetic" as const,
          codeTokens: [],
        },
        file: { localPath: `${language}/${metadata.id}.json`, bytes: Array.from(new TextEncoder().encode(bytes)) },
      }
    }),
  )
  return {
    manifest: { kind: "synthetic" as const, records: fixtures.map((x) => x.record) },
    files: fixtures.map((x) => x.file),
  }
}

const query = { sdkVersion: "1.2.0", language: "en" as const, localOnly: true }

const ports = (): FtcKnowledge.Ports => ({
  repository: { read: () => Effect.succeed(pack()), available: () => Effect.succeed(true) },
  search: {
    matches: (input) => Effect.succeed(input.document.body.toLowerCase().includes(input.text.toLowerCase())),
  },
})

test("incompatible or absent local reference never appears as current", async () => {
  const networkCalls = 0 // No network capability is present in either injected port.
  const supplied = ports()
  const results = await Effect.runPromise(
    Effect.gen(function* () {
      const service = yield* FtcKnowledge.Service
      return [yield* service.lookup(query), yield* service.lookup({ ...query, id: "sdk-fixture-v1", language: "zh" })]
    }).pipe(
      Effect.provide(
        FtcKnowledge.layer({
          ...supplied,
          repository: {
            ...supplied.repository,
            available: (record) => Effect.succeed(record.language === "en"),
          },
        }),
      ),
    ),
  )
  const result = results[0]
  expect(result.kind).toBe("found")
  if (result.kind !== "found") throw new Error("Expected applicable local content")
  expect(result.records.map((x) => x.id)).toEqual(["sdk-fixture-v1"])
  expect(result.records[0].source).toBe("https://fixtures.invalid/sdk-fixture-v1")
  expect(result.records[0].version).toBe("1.0.0")
  expect(result.records[0].locallyAvailable).toBe(true)
  expect(result.records[0].document?.body).toBe("en: fixture motor reference")
  expect(results[1]).toEqual({
    kind: "missing",
    reason: "not_local",
    requested: { ...query, id: "sdk-fixture-v1", language: "zh" },
  })
  expect(results[1].kind).toBe("missing")
  expect(networkCalls).toBe(0)
})

const run = <A>(work: (service: FtcKnowledge.Interface) => Effect.Effect<A, unknown>, supplied = ports()) =>
  Effect.runPromise(Effect.flatMap(FtcKnowledge.Service, work).pipe(Effect.provide(FtcKnowledge.layer(supplied))))

test("explicit library versions and back-to-back SDK queries have independent applicability", async () => {
  const results = await run((service) =>
    Effect.forEach(
      [
        { ...query, library: "fixture-library", libraryVersion: "1.4.0" },
        { ...query, library: "fixture-library", libraryVersion: "2.1.0" },
        { ...query, sdkVersion: "2.1.0", language: "zh" as const },
        { ...query, library: "other-library", libraryVersion: "1.0.0" },
      ],
      (input) => service.lookup(input),
      { concurrency: "unbounded" },
    ),
  )
  expect(results.map((result) => (result.kind === "found" ? result.records.map((x) => x.id) : result.reason))).toEqual([
    ["sdk-fixture-v1", "library-v1"],
    ["sdk-fixture-v1", "library-v2"],
    ["sdk-fixture-v2"],
    ["sdk-fixture-v1"],
  ])
  if (results[2].kind !== "found") throw new Error("Expected SDK v2 Chinese reference")
  expect(results[2].records[0].language).toBe("zh")
})

test("search sees only compatible available language candidates and retains validated content", async () => {
  const seen: string[] = []
  const supplied = ports()
  const result = await run((service) => service.search({ query, text: "MOTOR" }), {
    ...supplied,
    search: {
      matches: (input) => {
        seen.push(`${input.record.id}:${input.record.language}`)
        return supplied.search.matches(input)
      },
    },
  })
  expect(seen).toEqual(["sdk-fixture-v1:en"])
  expect(result.kind).toBe("found")
  if (result.kind !== "found") throw new Error("Expected matching content")
  expect(result.records[0].digest).toHaveLength(64)
  expect(result.records[0].document?.id).toBe("sdk-fixture-v1")
  const missing = await run((service) => service.search({ query, text: "absent" }))
  expect(missing).toEqual({ kind: "missing", reason: "no_match", requested: query })
})

test("unavailable compatible metadata is explicit and cannot satisfy a body search", async () => {
  const supplied = ports()
  const unavailable = { ...supplied, repository: { ...supplied.repository, available: () => Effect.succeed(false) } }
  const result = await run((service) => service.lookup({ ...query, localOnly: false }), unavailable)
  expect(result.kind).toBe("found")
  if (result.kind !== "found") throw new Error("Expected metadata")
  expect(result.records.map((record) => [record.id, record.locallyAvailable, record.document])).toEqual([
    ["sdk-fixture-v1", false, undefined],
  ])
  const searched = await run((service) => service.search({ query: { ...query, localOnly: false }, text: "motor" }), {
    ...unavailable,
    search: { matches: () => Effect.die("Unavailable content reached search") },
  })
  expect(searched).toEqual({ kind: "missing", reason: "not_local", requested: { ...query, localOnly: false } })
})

test.each([
  { id: "absent", want: "not_found" },
  { id: "sdk-fixture-v2", want: "incompatible" },
  { topic: "absent-topic", want: "not_found" },
])("missing references retain the exact explicit request: %j", async ({ want, ...input }) => {
  const requested = { ...query, ...input }
  expect(await run((service) => service.lookup(requested))).toEqual({ kind: "missing", reason: want, requested })
})

test.each([
  { sdkVersion: "1.x" },
  { sdkVersion: "v1.2.0" },
  { sdkVersion: "" },
  { language: "fr" },
  { library: "fixture-library" },
  { libraryVersion: "1.0.0" },
  { library: "fixture-library", libraryVersion: "^1.0.0" },
  { projectID: "implicit-selection" },
])("invalid queries fail before repository observation: %j", async (input) => {
  const supplied = ports()
  const result = await run(
    // @ts-expect-error Deliberately submit malformed caller JSON to the runtime boundary.
    (service) => service.lookup({ ...query, ...input }).pipe(Effect.result),
    { ...supplied, repository: { ...supplied.repository, read: () => Effect.die("Invalid input reached repository") } },
  )
  expect(result).toMatchObject({ failure: { code: "invalid_input" } })
})

test("invalid search text never reaches the repository", async () => {
  expect(await run((service) => service.search({ query, text: " " }).pipe(Effect.result))).toMatchObject({
    failure: { code: "invalid_input" },
  })
})

test("repository bytes are revalidated instead of trusting claimed validity", async () => {
  const input = pack()
  const supplied = ports()
  const result = await run((service) => service.lookup(query).pipe(Effect.result), {
    ...supplied,
    repository: {
      ...supplied.repository,
      read: () => Effect.succeed({ ...input, files: input.files.map((file) => ({ ...file, bytes: [0] })) }),
    },
  })
  expect(result._tag).toBe("Failure")
  if (result._tag !== "Failure") throw new Error("Expected invalid pack")
  expect(result.failure).toMatchObject({ code: "invalid_content" })
})

test("availability observation cannot mutate the already validated document snapshot", async () => {
  const input = pack()
  const supplied = ports()
  const result = await run((service) => service.lookup(query), {
    ...supplied,
    repository: {
      read: () => Effect.succeed(input),
      available: () =>
        Effect.sync(() => {
          input.files[0].bytes.splice(
            0,
            input.files[0].bytes.length,
            ...Array.from(
              new TextEncoder().encode(
                JSON.stringify({
                  id: "changed",
                  version: "9.0.0",
                  language: "en",
                  body: "unvalidated replacement",
                }),
              ),
            ),
          )
          return true
        }),
    },
  })
  expect(result.kind).toBe("found")
  if (result.kind !== "found") throw new Error("Expected immutable snapshot")
  expect(result.records[0].document).toEqual({
    id: "sdk-fixture-v1",
    version: "1.0.0",
    language: "en",
    body: "en: fixture motor reference",
  })
})

test("failures release repository resources and remain distinct from missing data", async () => {
  const activity: string[] = []
  const supplied = ports()
  const result = await run((service) => service.lookup(query).pipe(Effect.result), {
    ...supplied,
    repository: {
      ...supplied.repository,
      read: () =>
        Effect.gen(function* () {
          yield* Effect.acquireRelease(
            Effect.sync(() => activity.push("open")),
            () => Effect.sync(() => activity.push("close")),
          )
          return yield* Effect.fail({ code: "repository_failed" as const })
        }),
    },
  })
  expect(result).toMatchObject({ failure: { code: "repository_failed" } })
  expect(activity).toEqual(["open", "close"])
  expect(
    await run((service) => service.search({ query, text: "motor" }).pipe(Effect.result), {
      ...supplied,
      search: { matches: () => Effect.fail({ code: "search_failed" }) },
    }),
  ).toMatchObject({ failure: { code: "search_failed" } })
})

test("interruption releases a pending repository observation and independent instances remain usable", async () => {
  const activity: string[] = []
  const started = Promise.withResolvers<void>()
  const supplied = ports()
  const fiber = Effect.runFork(
    Effect.flatMap(FtcKnowledge.Service, (service) => service.lookup(query)).pipe(
      Effect.provide(
        FtcKnowledge.layer({
          ...supplied,
          repository: {
            ...supplied.repository,
            read: () =>
              Effect.gen(function* () {
                yield* Effect.acquireRelease(
                  Effect.sync(() => {
                    activity.push("open")
                    started.resolve()
                  }),
                  () => Effect.sync(() => activity.push("close")),
                )
                return yield* Effect.never
              }),
          },
        }),
      ),
    ),
  )
  await started.promise
  await Effect.runPromise(Fiber.interrupt(fiber))
  expect(activity).toEqual(["open", "close"])
  expect((await run((service) => service.lookup(query))).kind).toBe("found")
})

test("canonical query/result contracts preserve facade identity and omit undefined optionals", () => {
  expect(FtcKnowledge.ContentQuery).toBe(ContentQuery)
  expect(FtcKnowledge.ContentResult).toBe(ContentResult)
  expect(FtcKnowledge.ContentQuery.ast.annotations?.identifier).toBe("FtcKnowledge.ContentQuery")
  expect(FtcKnowledge.ContentResult.ast.annotations?.identifier).toBe("FtcKnowledge.ContentResult")
  expect(Schema.encodeSync(FtcKnowledge.ContentQuery)({ ...query, id: undefined, topic: undefined })).toEqual(query)
  const identifiers = [ContentQuery, ContentResult, ContentReference, QueryError, SearchRequest].map(
    (schema) => schema.ast.annotations?.identifier,
  )
  expect(new Set(identifiers).size).toBe(5)
  expect(identifiers.every((id) => typeof id === "string" && id.startsWith("FtcKnowledge."))).toBe(true)
  expect(Schema.encodeSync(QueryError)({ code: "repository_failed", errors: undefined })).toEqual({
    code: "repository_failed",
  })
})

test("construction observes nothing and successful observation releases all acquired resources", async () => {
  const activity: string[] = []
  const supplied = ports()
  const layer = FtcKnowledge.layer({
    ...supplied,
    repository: {
      ...supplied.repository,
      read: () =>
        Effect.gen(function* () {
          yield* Effect.acquireRelease(
            Effect.sync(() => activity.push("open")),
            () => Effect.sync(() => activity.push("close")),
          )
          return pack()
        }),
    },
  })
  expect(activity).toEqual([])
  const result = await Effect.runPromise(
    Effect.flatMap(FtcKnowledge.Service, (service) => service.lookup(query)).pipe(Effect.provide(layer)),
  )
  expect(result.kind).toBe("found")
  if (result.kind !== "found") throw new Error("Expected content")
  expect(Schema.decodeUnknownSync(ContentResult)(result)).toEqual(result)
  expect(activity).toEqual(["open", "close"])
})

test.each(["availability", "search"] as const)("malformed %s responses fail explicitly", async (kind) => {
  const supplied = ports()
  const result = await run((service) => service.search({ query, text: "motor" }).pipe(Effect.result), {
    ...supplied,
    repository: {
      ...supplied.repository,
      // @ts-expect-error Deliberately simulate a malformed external adapter response.
      available: kind === "availability" ? () => Effect.succeed("yes") : supplied.repository.available,
    },
    // @ts-expect-error Deliberately simulate a malformed external adapter response.
    search: kind === "search" ? { matches: () => Effect.succeed("yes") } : supplied.search,
  })
  expect(result).toMatchObject({ failure: { code: "invalid_response" } })
})

test("an incomplete translation pack is invalid and cannot silently supply another language", async () => {
  const input = pack()
  const supplied = ports()
  const result = await run((service) => service.lookup({ ...query, language: "zh" }).pipe(Effect.result), {
    ...supplied,
    repository: {
      ...supplied.repository,
      read: () =>
        Effect.succeed({
          ...input,
          manifest: {
            ...input.manifest,
            records: input.manifest.records.filter((record) => record.language === "en"),
          },
        }),
    },
  })
  expect(result).toMatchObject({
    failure: {
      code: "invalid_content",
      errors: [
        {
          code: "invalid_content",
          reason: "missing_translation",
          id: "sdk-fixture-v1",
          language: "en",
          localPath: "en/sdk-fixture-v1.json",
        },
        {
          code: "invalid_content",
          reason: "missing_translation",
          id: "sdk-fixture-v2",
          language: "en",
          localPath: "en/sdk-fixture-v2.json",
        },
        {
          code: "invalid_content",
          reason: "missing_translation",
          id: "library-v1",
          language: "en",
          localPath: "en/library-v1.json",
        },
        {
          code: "invalid_content",
          reason: "missing_translation",
          id: "library-v2",
          language: "en",
          localPath: "en/library-v2.json",
        },
      ],
    },
  })
})

test("search interruption closes scoped resources without retaining a partial result", async () => {
  const supplied = ports()
  const started = Promise.withResolvers<void>()
  const activity: string[] = []
  const fiber = Effect.runFork(
    Effect.flatMap(FtcKnowledge.Service, (service) => service.search({ query, text: "motor" })).pipe(
      Effect.provide(
        FtcKnowledge.layer({
          ...supplied,
          search: {
            matches: () =>
              Effect.gen(function* () {
                yield* Effect.acquireRelease(
                  Effect.sync(() => {
                    activity.push("open")
                    started.resolve()
                  }),
                  () => Effect.sync(() => activity.push("close")),
                )
                return yield* Effect.never
              }),
          },
        }),
      ),
    ),
  )
  await started.promise
  await Effect.runPromise(Fiber.interrupt(fiber))
  expect(activity).toEqual(["open", "close"])
})

test("knowledge Context Source preserves missing data and treats failed observation as unavailable", async () => {
  const generation = await run((service) =>
    SystemContext.initialize(
      SystemContext.make(
        FtcKnowledgeContext.source({
          key: SystemContext.Key.make("ftc/knowledge"),
          service,
          query: { ...query, id: "absent" },
        }),
      ),
    ),
  )
  expect(generation.snapshot["ftc/knowledge"].value).toEqual({
    kind: "missing",
    reason: "not_found",
    requested: { ...query, id: "absent" },
  })
  expect(generation.baseline).toContain('"reason":"not_found"')
  const supplied = ports()
  const failed = await run(
    (service) =>
      SystemContext.initialize(
        SystemContext.make(
          FtcKnowledgeContext.source({
            key: SystemContext.Key.make("ftc/knowledge"),
            service,
            query,
          }),
        ),
      ).pipe(Effect.result),
    { ...supplied, repository: { ...supplied.repository, read: () => Effect.fail({ code: "repository_failed" }) } },
  )
  expect(failed._tag).toBe("Failure")
})
