export * as Inspection from "./inspection"

import { FtcConfiguration } from "@opencode-ai/schema/ftc-configuration"
import { createHash } from "node:crypto"
import path from "node:path"
import { Effect, Fiber, Option, Result, Schema, Scope } from "effect"
import type { InspectionFilesystem } from "./inspection-filesystem"
import { InspectionLifecycle } from "./inspection-lifecycle"
import type { ManifestSnapshot } from "./manifest-snapshot"

export interface Ports {
  readonly reader: InspectionFilesystem.Interface
  readonly manifest: ManifestSnapshot.Producer
}

export interface Interface {
  readonly inspectProject: (input: {
    readonly root: string
  }) => Effect.Effect<FtcConfiguration.InspectionResult, FtcConfiguration.InspectionError>
}

export const make = (ports: Ports): Effect.Effect<Interface, never, Scope.Scope> =>
  Effect.gen(function* () {
    const scope = yield* Effect.scope
    const openProject = ports.reader?.openProject
    const decodeRead = ports.manifest.decodeRead
    let closed = false
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        closed = true
      }),
    )
    const active = () =>
      Effect.suspend(() =>
        closed ? Effect.fail({ code: "owner_closed" } satisfies FtcConfiguration.InspectionError) : Effect.void,
      )
    return {
      inspectProject: Effect.fn("Inspection.inspectProject")(function* (input) {
        const requested = input.root
        yield* active()
        return yield* Effect.acquireUseRelease(
          Effect.gen(function* () {
            if (typeof requested !== "string" || !path.isAbsolute(requested) || requested.includes("\0"))
              return yield* Effect.fail({ code: "path_outside_project" } satisfies FtcConfiguration.InspectionError)
            if (typeof openProject !== "function")
              return yield* Effect.fail({ code: "reader_unavailable" } satisfies FtcConfiguration.InspectionError)
            const admitted = yield* openProject({ root: requested })
            const project = { ...admitted }
            const root = project.canonicalRoot
            const identity = project.identity
            if (
              typeof root !== "string" ||
              !path.isAbsolute(root) ||
              root.includes("\0") ||
              typeof identity !== "string" ||
              !identity
            )
              return yield* Effect.fail({ code: "reader_unavailable" } satisfies FtcConfiguration.InspectionError)
            const checkRoot = Effect.fn("Inspection.checkRoot")(function* () {
              yield* active()
              return yield* project.verify()
            })
            yield* checkRoot()
            const sources: FtcConfiguration.InspectionSourceRevision[] = []
            const unknowns: FtcConfiguration.InspectionUnknown[] = []
            const dependencies: FtcConfiguration.InspectionDependency[] = []
            const conflicts: FtcConfiguration.InspectionConflict[] = []
            const read = Effect.fn("Inspection.read")(function* (relative: string) {
              yield* checkRoot()
              const bytes = yield* project.readFile(relative).pipe(
                Effect.map((value) => (value === undefined ? undefined : new Uint8Array(value))),
                Effect.catchIf(
                  (error) => error.code === "file_unavailable",
                  () => {
                    unknowns.push({ path: relative, reason: "file_unavailable" })
                    return Effect.succeed(undefined)
                  },
                ),
              )
              yield* checkRoot()
              if (bytes === undefined) {
                sources.push({
                  path: relative,
                  state: unknowns.some((item) => item.path === relative && item.reason === "file_unavailable")
                    ? "unavailable"
                    : "missing",
                })
                return undefined
              }
              const revision = digest(bytes)
              const latest = yield* project.readFile(relative).pipe(
                Effect.map((value) => (value === undefined ? undefined : digest(value))),
                Effect.catchIf(
                  (error) => error.code === "file_unavailable",
                  () => Effect.succeed(undefined),
                ),
              )
              yield* checkRoot()
              if (latest !== revision) {
                sources.push({ path: relative, state: "changed", revision })
                unknowns.push({ path: relative, reason: "changed_input" })
                return undefined
              }
              sources.push({ path: relative, state: "read", revision })
              return bytes
            })
            const gradlePaths = [
              "build.gradle",
              "build.gradle.kts",
              "build.dependencies.gradle",
              "build.dependencies.gradle.kts",
              "TeamCode/build.gradle",
              "TeamCode/build.gradle.kts",
            ]
            yield* Effect.forEach(
              gradlePaths,
              (relative) =>
                read(relative).pipe(
                  Effect.map((bytes) => {
                    if (!bytes) return
                    const parsed = parseGradle(relative, new TextDecoder().decode(bytes))
                    dependencies.push(...parsed.dependencies)
                    unknowns.push(...parsed.unknowns)
                  }),
                ),
              { discard: true },
            )
            if (!sources.some((source) => source.path.startsWith("TeamCode/build.gradle") && source.state === "read"))
              unknowns.push({ path: "TeamCode", reason: "missing_input" })
            const javaRoot = "TeamCode/src/main/java"
            const visit = Effect.fn("Inspection.visit")(function* (
              relative: string,
            ): Effect.fn.Return<void, FtcConfiguration.InspectionError> {
              yield* checkRoot()
              const entries = yield* project
                .readDirectory(relative)
                .pipe(Effect.map((value) => value?.map((entry) => ({ ...entry }))))
              yield* checkRoot()
              if (entries === undefined) {
                unknowns.push({ path: relative, reason: "missing_input" })
                return yield* Effect.void
              }
              yield* Effect.forEach(
                entries,
                (entry) =>
                  Effect.gen(function* () {
                    if (
                      !entry.name ||
                      path.basename(entry.name) !== entry.name ||
                      entry.name === "." ||
                      entry.name === ".." ||
                      entry.name.includes("\0") ||
                      entry.name.includes("\\")
                    )
                      return yield* Effect.fail({
                        code: "path_outside_project",
                        path: relative,
                      } satisfies FtcConfiguration.InspectionError)
                    const child = `${relative}/${entry.name}`
                    if (entry.type === "directory") return yield* visit(child)
                    if (entry.type !== "file" || !entry.name.endsWith(".java")) return yield* Effect.void
                    const bytes = yield* read(child)
                    if (bytes === undefined) return yield* Effect.void
                    const text = maskLiterals(stripComments(new TextDecoder().decode(bytes)))
                    Array.from(text.matchAll(/^\s*import\s+(?:static\s+)?([\w.]+(?:\.\*)?)\s*;/gm)).forEach((match) => {
                      dependencies.push({ path: child, kind: "java_import", import: match[1] })
                    })
                    return yield* Effect.void
                  }),
                { discard: true },
              )
              return yield* Effect.void
            })
            yield* visit(javaRoot)
            const manifestBytes = yield* read("ftc-project.json")
            const manifestSource = sources.find((source) => source.path === "ftc-project.json")
            const manifestResult =
              manifestSource?.state === "read" || manifestSource?.state === "missing"
                ? decodeRead(manifestBytes)
                : Result.fail({ code: "file_unavailable" } satisfies FtcConfiguration.ManifestError)
            const managed =
              manifestResult._tag === "Success" && "revision" in manifestResult.success
                ? Schema.decodeUnknownOption(FtcConfiguration.ManifestSnapshot)(manifestResult.success)
                : Option.none()
            const managedPathing =
              Option.isSome(managed) && manifestBytes && managed.value.revision === digest(manifestBytes)
                ? managed.value.manifest.managedPathing
                : undefined
            if (managedPathing === undefined)
              unknowns.push({
                path: "ftc-project.json",
                reason:
                  manifestResult._tag === "Failure" && manifestResult.failure.code === "invalid_manifest"
                    ? "invalid_manifest"
                    : manifestResult._tag === "Failure" && manifestResult.failure.code === "unsupported_schema_version"
                      ? "unsupported_schema_version"
                      : manifestResult._tag === "Failure"
                        ? "file_unavailable"
                        : manifestBytes
                          ? "changed_input"
                          : "manifest_missing",
              })
            yield* checkRoot()
            if (manifestResult._tag === "Failure" && manifestResult.failure.code === "path_outside_project")
              return yield* Effect.fail({
                code: "path_outside_project",
                path: "ftc-project.json",
              } satisfies FtcConfiguration.InspectionError)
            const pedro = dependencies.filter(
              (item) => item.group === "com.pedropathing" || item.import?.startsWith("com.pedropathing."),
            )
            const runner = dependencies.filter(
              (item) =>
                item.group === "com.acmerobotics.roadrunner" || item.import?.startsWith("com.acmerobotics.roadrunner."),
            )
            const sdk = dependencies.filter(
              (item) =>
                item.group === "org.firstinspires.ftc" &&
                [
                  "RobotCore",
                  "FtcCommon",
                  "Hardware",
                  "Vision",
                  "Inspection",
                  "Blocks",
                  "RobotServer",
                  "OnBotJava",
                ].includes(item.artifact ?? ""),
            )
            const versions = Array.from(new Set(sdk.flatMap((item) => (item.version ? [item.version] : []))))
            if (versions.length > 1) {
              conflicts.push({ code: "sdk_version_conflict", paths: sdk.map((item) => item.path) })
              unknowns.push({ path: "build.dependencies.gradle", reason: "sdk_version_conflict" })
            }
            if (sdk.length === 0) unknowns.push({ path: "build.dependencies.gradle", reason: "missing_input" })
            // Absent managed selection is separate from incomplete dependency evidence.
            const incomplete = unknowns.some((item) => item.path !== "ftc-project.json")
            const detectedPathing =
              pedro.length && runner.length
                ? "both"
                : pedro.length
                  ? "pedro"
                  : runner.length
                    ? "road-runner"
                    : incomplete
                      ? "unknown"
                      : "neither"
            if (detectedPathing === "both")
              conflicts.push({
                code: "both_pathing",
                paths: Array.from(new Set([...pedro, ...runner].map((item) => item.path))),
              })
            if (
              managedPathing !== undefined &&
              ((pedro.length && managedPathing !== "pedro") ||
                (runner.length && managedPathing !== "road-runner") ||
                (detectedPathing === "neither" && managedPathing !== "neither"))
            )
              conflicts.push({
                code: "manifest_mismatch",
                paths: ["ftc-project.json", ...Array.from(new Set([...pedro, ...runner].map((item) => item.path)))],
              })
            return {
              sdkVersion:
                versions.length === 1 && sdk.every((item) => item.version !== undefined) ? versions[0] : undefined,
              managedPathing,
              dependencies,
              detectedPathing,
              conflicts,
              sourceRevisions: sources,
              unknowns,
            } satisfies FtcConfiguration.InspectionResult
          }).pipe(Effect.scoped, Effect.forkIn(scope)),
          InspectionLifecycle.join,
          Fiber.interrupt,
        )
      }),
    }
  })

function digest(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex")
}

// Preserve literals while removing comments; quoted text is never scanned as code.
function stripComments(text: string) {
  return text.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (value) =>
    value.startsWith("/") ? value.replace(/[^\n]/g, " ") : value,
  )
}

function parseGradle(filename: string, text: string) {
  const dependencies: FtcConfiguration.InspectionDependency[] = []
  const unknowns: FtcConfiguration.InspectionUnknown[] = []
  const clean = stripComments(text)
  if (
    /"""|'''/.test(clean) ||
    // Slashy/dollar-slashy literals and division are outside this declaration subset.
    maskLiterals(clean).includes("/") ||
    Array.from(clean.matchAll(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g)).some((match) => /[\r\n]/.test(match[0]))
  )
    return { dependencies, unknowns: [{ path: filename, reason: "unsupported_gradle" as const }] }
  if (!/^\s*dependencies\s*\{\s*$/m.test(clean)) unknowns.push({ path: filename, reason: "unsupported_gradle" })
  let depth = 0
  let dependencyDepth: number | undefined
  clean.split(/\r?\n/).forEach((line) => {
    const code = line.trim()
    if (/^dependencies\s*\{\s*$/.test(code) && depth === 0) dependencyDepth = 1
    if (dependencyDepth === undefined && code && code !== "}")
      unknowns.push({ path: filename, reason: "unsupported_gradle" })
    if (dependencyDepth !== undefined && depth >= dependencyDepth && code && code !== "}") {
      const declaration =
        /^(?:implementation|api|compileOnly|runtimeOnly|compile|testImplementation|androidTestImplementation)\s*(?:\(\s*(["'])(.*?)\1\s*\)|\s+(["'])(.*?)\3)\s*;?$/.exec(
          code,
        )
      if (depth === dependencyDepth && declaration) {
        const coordinate = (declaration[2] ?? declaration[4]).split(":")
        if (coordinate.length === 3 && /^[\w.-]+$/.test(coordinate[0]) && /^[\w.-]+$/.test(coordinate[1])) {
          const literal = /^\d[\w.-]*$/.test(coordinate[2])
          dependencies.push({
            path: filename,
            kind: "gradle",
            group: coordinate[0],
            artifact: coordinate[1],
            ...(literal ? { version: coordinate[2] } : { reason: "dynamic_version" as const }),
          })
          if (!literal) unknowns.push({ path: filename, reason: "dynamic_version" })
        } else unknowns.push({ path: filename, reason: "unsupported_gradle" })
      } else unknowns.push({ path: filename, reason: "unsupported_gradle" })
    }
    const structural = code.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "")
    depth += (structural.match(/\{/g)?.length ?? 0) - (structural.match(/\}/g)?.length ?? 0)
    if (dependencyDepth !== undefined && depth < dependencyDepth) dependencyDepth = undefined
    if (/\bdependencies\b/.test(structural) && (depth !== 1 || !/^dependencies\s*\{\s*$/.test(structural)))
      unknowns.push({ path: filename, reason: "unsupported_gradle" })
  })
  if (depth !== 0) unknowns.push({ path: filename, reason: "unsupported_gradle" })
  return { dependencies, unknowns }
}

function maskLiterals(text: string) {
  return text.replace(/"""[\s\S]*?"""|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, (value) => value.replace(/[^\n]/g, " "))
}
