export * as FtcKnowledgeContext from "./context"

import { FtcKnowledge } from "@opencode-ai/schema/ftc-knowledge"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { Effect, Schema } from "effect"
import type { Interface } from "../knowledge"
import { FtcContextSanitizer } from "../context-sanitizer"
import { SystemContext } from "../../system-context"

export function source(input: {
  readonly key: SystemContext.Key
  readonly service: Pick<Interface, "lookup">
  readonly query: FtcKnowledge.ContentQuery
}): SystemContext.Source<FtcKnowledge.ContentResult> {
  return {
    key: input.key,
    codec: FtcKnowledge.ContentResult,
    load: Effect.suspend(() => input.service.lookup(input.query)).pipe(
      Effect.catch(() => Effect.succeed(SystemContext.unavailable)),
    ),
    baseline: (current) => JSON.stringify(current),
    update: (_previous, current) => JSON.stringify(current),
  }
}

const Snapshot = Schema.Struct({
  project: FtcProject.ProjectContext,
  query: FtcKnowledge.ContentQuery,
  projection: Schema.Literal("sanitized_context_projection"),
  result: FtcKnowledge.ContentResult,
})

/** Bound model-context path. Legacy lookup sources above retain their existing behavior. */
export function bound(input: {
  readonly project: FtcProject.ProjectContext
  readonly service: Pick<Interface, "lookup">
  readonly query: FtcKnowledge.ContentQuery
  readonly sanitize: FtcContextSanitizer.Sanitizer
}): FtcContextSanitizer.BoundContext {
  const project = FtcContextSanitizer.binding(input.project)
  const query = Object.freeze({
    ...(input.query.id === undefined ? {} : { id: input.query.id }),
    ...(input.query.topic === undefined ? {} : { topic: input.query.topic }),
    sdkVersion: input.query.sdkVersion,
    ...(input.query.library === undefined ? {} : { library: input.query.library }),
    ...(input.query.libraryVersion === undefined ? {} : { libraryVersion: input.query.libraryVersion }),
    language: input.query.language,
    localOnly: input.query.localOnly,
  })
  const id = (value: string) => FtcContextSanitizer.identifier(input.sanitize, value)
  const optional = (value: string | undefined) => FtcContextSanitizer.optionalIdentifier(input.sanitize, value)
  const text = (value: string) => FtcContextSanitizer.text(input.sanitize, value)
  return {
    project,
    key: SystemContext.Key.make("ftc/knowledge"),
    context: SystemContext.make({
      key: SystemContext.Key.make("ftc/knowledge"),
      codec: Schema.toCodecJson(Snapshot),
      load: FtcContextSanitizer.value(
        Snapshot,
        Effect.gen(function* () {
          const requested = yield* Effect.all({
            id: optional(query.id),
            topic: optional(query.topic),
            sdkVersion: id(query.sdkVersion),
            library: optional(query.library),
            libraryVersion: optional(query.libraryVersion),
            language: Effect.succeed(query.language),
            localOnly: Effect.succeed(query.localOnly),
          })
          const result = yield* source({ key: SystemContext.Key.make("ftc/knowledge"), service: input.service, query })
            .load
          if (result === SystemContext.unavailable) return yield* Effect.fail("context_observation_unavailable")
          if (result.kind === "missing" && !Schema.toEquivalence(FtcKnowledge.ContentQuery)(query, result.requested))
            return yield* Effect.die(new Error("context_query_mismatch"))
          return {
            project: yield* FtcContextSanitizer.project(input.sanitize, project),
            query: requested,
            projection: "sanitized_context_projection",
            result:
              result.kind === "missing"
                ? { kind: result.kind, reason: result.reason, requested }
                : {
                    kind: result.kind,
                    records: yield* Effect.forEach(result.records, (record) =>
                      Effect.gen(function* () {
                        return {
                          id: yield* id(record.id),
                          version: yield* id(record.version),
                          language: record.language,
                          topic: yield* id(record.topic),
                          sdkRange: yield* id(record.sdkRange),
                          library: yield* optional(record.library),
                          libraryRange: yield* optional(record.libraryRange),
                          source: yield* id(record.source),
                          license: yield* id(record.license),
                          localPath: yield* id(record.localPath),
                          digest: yield* id(record.digest),
                          provenance: record.provenance,
                          codeTokens: yield* Effect.forEach(record.codeTokens, id),
                          locallyAvailable: record.locallyAvailable,
                          document:
                            record.document === undefined
                              ? undefined
                              : {
                                  id: yield* id(record.document.id),
                                  version: yield* id(record.document.version),
                                  language: record.document.language,
                                  body: yield* text(record.document.body),
                                  entryPoints:
                                    record.document.entryPoints === undefined
                                      ? undefined
                                      : {
                                          "java-beginner": yield* id(record.document.entryPoints["java-beginner"]),
                                          "ftc-beginner": yield* id(record.document.entryPoints["ftc-beginner"]),
                                          experienced: yield* id(record.document.entryPoints.experienced),
                                        },
                                  lessons:
                                    record.document.lessons === undefined
                                      ? undefined
                                      : yield* Effect.forEach(record.document.lessons, (lesson) =>
                                          Effect.gen(function* () {
                                            return {
                                              id: yield* id(lesson.id),
                                              version: yield* id(lesson.version),
                                              topic: yield* id(lesson.topic),
                                              title: yield* text(lesson.title),
                                              body: yield* text(lesson.body),
                                              skippable: lesson.skippable,
                                              exercises: yield* Effect.forEach(lesson.exercises, (exercise) =>
                                                Effect.all({
                                                  id: id(exercise.id),
                                                  prompt: text(exercise.prompt),
                                                  requiresExplanation: Effect.succeed(exercise.requiresExplanation),
                                                  requiresProjectApplication: Effect.succeed(
                                                    exercise.requiresProjectApplication,
                                                  ),
                                                  requiresPhysicalValidation: Effect.succeed(
                                                    exercise.requiresPhysicalValidation,
                                                  ),
                                                  explanationCriteria: text(exercise.explanationCriteria),
                                                  projectApplicationCriteria: text(exercise.projectApplicationCriteria),
                                                }),
                                              ),
                                            }
                                          }),
                                        ),
                                },
                        }
                      }),
                    ),
                  },
          }
        }),
      ),
      baseline: FtcContextSanitizer.render,
      update: (_previous, current) => FtcContextSanitizer.render(current),
    }),
  }
}
