export * as JavaDocuments from "./documents"

import { FtcJava } from "@opencode-ai/schema/ftc-java"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { Project } from "@opencode-ai/schema/project"
import { AbsolutePath } from "@opencode-ai/schema/schema"
import { Effect, Fiber, PubSub, Schema, Scope, Stream } from "effect"
import path from "node:path"
import { KeyedMutex } from "../../effect/keyed-mutex"

export interface Filesystem {
  readonly realpath: (path: string) => Effect.Effect<string, FtcJava.DocumentError>
  readonly readText: (path: string) => Effect.Effect<string, FtcJava.DocumentError, Scope.Scope>
  // Mutation-enabled owners capture original bytes on open. Read-only owners cannot save.
  readonly readBytes?: (path: string) => Effect.Effect<Uint8Array, FtcJava.DocumentError, Scope.Scope>
  // The adapter must recheck canonical root/target and compare exact bytes at its commit boundary.
  // Conflict writes nothing; a failed write can have an unknown filesystem outcome.
  readonly writeIfUnchanged?: (input: {
    readonly path: string
    readonly root: string
    readonly expected: Uint8Array
    readonly replacement: Uint8Array
  }) => Effect.Effect<"written" | "conflict", FtcJava.DocumentError, Scope.Scope>
}

export interface Projects {
  // The supplied port is authorization authority; a caller's project record is not.
  readonly resolve: (projectID: Project.ID) => Effect.Effect<FtcProject.ProjectContext, FtcJava.DocumentError>
}

export interface CodeChanges {
  // Only injected trusted code owns authorization; it binds the full immutable proposal and revisions.
  readonly check: (input: { readonly proposal: FtcJava.EditProposal; readonly authorization: object }) => Effect.Effect<
    {
      readonly projectID: Project.ID
      readonly canonicalRoot: AbsolutePath
      readonly paths: readonly AbsolutePath[]
    },
    FtcJava.DocumentError,
    Scope.Scope
  >
}

export interface Ports {
  readonly filesystem: Filesystem
  readonly projects: Projects
  readonly codeChanges?: CodeChanges
}

export interface Interface {
  readonly openDocument: (input: {
    readonly project: FtcProject.ProjectContext
    readonly path: string
  }) => Effect.Effect<FtcJava.DocumentSnapshot, FtcJava.DocumentError>
  readonly changeDocument: (input: {
    // Absolute opened-file identity avoids guessing a project from a relative path.
    readonly path: string
    readonly expectedRevision: number
    readonly text: string
  }) => Effect.Effect<FtcJava.DocumentSnapshot, FtcJava.DocumentError>
  readonly readDocument: (input: {
    readonly projectID: Project.ID
    readonly path: string
  }) => Effect.Effect<FtcJava.DocumentSnapshot, FtcJava.DocumentError>
  readonly saveDocument: (input: FtcJava.SaveRequest) => Effect.Effect<FtcJava.DocumentSnapshot, FtcJava.DocumentError>
  readonly applyEdits: (input: {
    readonly proposal: FtcJava.EditProposal
    readonly authorization: object
  }) => Effect.Effect<FtcJava.EditResult, FtcJava.DocumentError>
  readonly events: Stream.Stream<FtcJava.DocumentEvent>
}

export const make = (ports: Ports): Effect.Effect<Interface, never, Scope.Scope> =>
  Effect.gen(function* () {
    const ownerScope = yield* Effect.scope
    const documents = new Map<
      string,
      {
        readonly root: string
        readonly savedText: string
        readonly savedBytes?: Uint8Array
        readonly snapshot: FtcJava.DocumentSnapshot
      }
    >()
    const locks = KeyedMutex.makeUnsafe<string>()
    const events = yield* PubSub.unbounded<FtcJava.DocumentEvent>()
    let closed = false
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        closed = true
        documents.clear()
      }).pipe(Effect.andThen(PubSub.shutdown(events))),
    )
    const active = () =>
      Effect.suspend(() =>
        closed ? Effect.fail({ code: "owner_closed" } satisfies FtcJava.DocumentError) : Effect.void,
      )
    const authorize = Effect.fn("JavaDocuments.authorize")(function* (projectID: Project.ID) {
      yield* active()
      const project = yield* ports.projects.resolve(projectID)
      if (
        !Schema.is(FtcProject.ProjectContext)(project) ||
        project.projectID !== projectID ||
        !path.isAbsolute(project.canonicalRoot) ||
        project.location.directory !== project.canonicalRoot
      )
        return yield* Effect.fail({ code: "project_unauthorized", projectID } satisfies FtcJava.DocumentError)
      const root = project.canonicalRoot
      if ((yield* ports.filesystem.realpath(root)) !== root)
        return yield* Effect.fail({ code: "project_unauthorized", projectID } satisfies FtcJava.DocumentError)
      yield* active()
      return { project, root }
    })
    const resolve = Effect.fn("JavaDocuments.resolve")(function* (root: string, value: string) {
      if (typeof value !== "string" || !value || value.includes("\0"))
        return yield* Effect.fail({ code: "invalid_document_input", path: value } satisfies FtcJava.DocumentError)
      const filename = path.resolve(root, value)
      if (!contained(root, filename))
        return yield* Effect.fail({ code: "path_outside_project", path: value } satisfies FtcJava.DocumentError)
      const canonical = yield* ports.filesystem.realpath(filename)
      if (!contained(root, canonical))
        return yield* Effect.fail({ code: "path_outside_project", path: value } satisfies FtcJava.DocumentError)
      return AbsolutePath.make(canonical)
    })
    const owned = <A, E>(effect: Effect.Effect<A, E, Scope.Scope>) =>
      Effect.acquireUseRelease(Effect.scoped(effect).pipe(Effect.forkIn(ownerScope)), Fiber.join, Fiber.interrupt)
    const publish = (type: FtcJava.DocumentEvent["type"], snapshot: FtcJava.DocumentSnapshot) =>
      PubSub.publish(events, Object.freeze({ type, snapshot }))
    const checkScope = Effect.fn("JavaDocuments.checkScope")(function* (
      projectID: Project.ID,
      root: string,
      value: string,
      canonical: string,
    ) {
      const authorized = yield* authorize(projectID)
      if (authorized.root !== root)
        return yield* Effect.fail({ code: "project_unauthorized", projectID } satisfies FtcJava.DocumentError)
      if ((yield* resolve(root, value)) !== canonical)
        return yield* Effect.fail({ code: "file_unavailable", path: value } satisfies FtcJava.DocumentError)
      const current = documents.get(canonical)
      if (!current)
        return yield* Effect.fail({ code: "document_not_open", path: value } satisfies FtcJava.DocumentError)
      if (current.root !== root || current.snapshot.projectID !== projectID)
        return yield* Effect.fail({ code: "project_unauthorized", projectID } satisfies FtcJava.DocumentError)
      return yield* active()
    })
    const readDisk = Effect.fn("JavaDocuments.readDisk")(function* (canonical: string) {
      if (!ports.filesystem.readBytes || !ports.filesystem.writeIfUnchanged)
        return yield* Effect.fail({ code: "file_unavailable", path: canonical } satisfies FtcJava.DocumentError)
      return Uint8Array.from(yield* ports.filesystem.readBytes(canonical))
    })
    const observe = Effect.fn("JavaDocuments.observe")(function* (canonical: string) {
      yield* active()
      const current = documents.get(canonical)
      if (!current)
        return yield* Effect.fail({ code: "document_not_open", path: canonical } satisfies FtcJava.DocumentError)
      if (!current.savedBytes)
        return yield* Effect.fail({ code: "file_unavailable", path: canonical } satisfies FtcJava.DocumentError)
      const bytes = yield* readDisk(canonical)
      yield* checkScope(current.snapshot.projectID, current.root, canonical, canonical)
      const text = yield* Effect.try({
        try: () => decode(bytes),
        catch: (): FtcJava.DocumentError => ({ code: "file_unavailable", path: canonical }),
      })
      yield* active()
      if (sameBytes(bytes, current.savedBytes)) return { document: current, bytes, text, changed: false }
      const snapshot = Object.freeze(
        FtcJava.DocumentSnapshot.make({
          ...current.snapshot,
          diskRevision: current.snapshot.diskRevision + 1,
          dirty: current.snapshot.text !== text,
        }),
      )
      const document = { ...current, savedText: text, savedBytes: bytes, snapshot }
      documents.set(canonical, document)
      yield* publish("disk_changed", snapshot)
      return { document, bytes, text, changed: true }
    })
    const conflict = (
      disk: { document: { snapshot: FtcJava.DocumentSnapshot }; text: string; changed: boolean },
      expected: FtcJava.Revision,
      rejectDirty: boolean,
    ): FtcJava.EditConflict | undefined => {
      const current = disk.document.snapshot
      const reason = disk.changed
        ? "disk_changed"
        : !matches(current, expected)
          ? "revision"
          : rejectDirty && current.dirty
            ? "dirty"
            : undefined
      if (!reason) return undefined
      return Object.freeze({
        path: current.path,
        reason,
        current,
        diskText: disk.text,
        choices: ["save", "merge", "defer"] as const,
      })
    }
    const commit = Effect.fn("JavaDocuments.commit")(function* (canonical: string, text: string, expected: Uint8Array) {
      yield* active()
      const current = documents.get(canonical)!
      const replacement = current.savedText.startsWith("\ufeff") && !text.startsWith("\ufeff") ? `\ufeff${text}` : text
      const bytes = new TextEncoder().encode(replacement)
      if (decode(bytes) !== replacement)
        return yield* Effect.fail({ code: "invalid_document_input", path: canonical } satisfies FtcJava.DocumentError)
      // Compare-and-write and snapshot publication form one cancellation boundary. A confirmed disk write
      // must be reflected in owner state even if the caller cancels at the commit boundary.
      return yield* Effect.uninterruptible(
        Effect.gen(function* () {
          const outcome = yield* ports.filesystem.writeIfUnchanged!({
            path: canonical,
            root: current.root,
            expected,
            replacement: bytes,
          }).pipe(Effect.mapError((error): FtcJava.DocumentError => ({ ...error, outcome: "unknown" })))
          if (outcome === "conflict") return undefined
          const snapshot = Object.freeze(
            FtcJava.DocumentSnapshot.make({
              ...current.snapshot,
              bufferRevision: current.snapshot.bufferRevision + (current.snapshot.text === replacement ? 0 : 1),
              diskRevision: current.snapshot.diskRevision + (sameBytes(expected, bytes) ? 0 : 1),
              text: replacement,
              dirty: false,
            }),
          )
          documents.set(canonical, { ...current, savedText: replacement, savedBytes: bytes, snapshot })
          yield* publish("saved", snapshot)
          return snapshot
        }),
      )
    })
    const checkChanges = Effect.fn("JavaDocuments.checkChanges")(function* (
      proposal: FtcJava.EditProposal,
      authorization: object,
      root: string,
      paths: readonly string[],
    ) {
      yield* active()
      if (!ports.codeChanges || !authorization || typeof authorization !== "object")
        return yield* Effect.fail({ code: "edit_unauthorized" } satisfies FtcJava.DocumentError)
      const grant = yield* ports.codeChanges.check({ proposal, authorization })
      if (
        grant.projectID !== proposal.projectID ||
        grant.canonicalRoot !== root ||
        paths.some((value) => !grant.paths.includes(AbsolutePath.make(value)))
      )
        return yield* Effect.fail({ code: "edit_unauthorized" } satisfies FtcJava.DocumentError)
      return yield* active()
    })
    return {
      openDocument: Effect.fn("JavaDocuments.openDocument")(function* (input) {
        if (!Schema.is(FtcProject.ProjectContext)(input.project) || typeof input.path !== "string")
          return yield* Effect.fail({ code: "invalid_document_input" } satisfies FtcJava.DocumentError)
        // Capture the caller's identity before awaiting the authorizer.
        const requested = FtcProject.ProjectContext.make({
          ...input.project,
          location: {
            directory: input.project.location.directory,
            workspaceID: input.project.location.workspaceID,
            project: { ...input.project.location.project },
          },
        })
        const value = input.path
        const authorized = yield* authorize(requested.projectID)
        if (
          requested.canonicalRoot !== authorized.root ||
          requested.location.directory !== authorized.project.location.directory ||
          requested.location.workspaceID !== authorized.project.location.workspaceID ||
          requested.location.project.id !== authorized.project.location.project.id ||
          requested.location.project.directory !== authorized.project.location.project.directory
        )
          return yield* Effect.fail({
            code: "project_unauthorized",
            projectID: requested.projectID,
          } satisfies FtcJava.DocumentError)
        const canonical = yield* resolve(authorized.root, value)
        return yield* locks.withLock(canonical)(
          Effect.gen(function* () {
            yield* active()
            const current = documents.get(canonical)
            if (current) {
              if (current.snapshot.projectID !== requested.projectID || current.root !== authorized.root)
                return yield* Effect.fail({ code: "project_unauthorized" } satisfies FtcJava.DocumentError)
              return current.snapshot
            }
            const savedBytes = ports.filesystem.readBytes
              ? Uint8Array.from(yield* owned(ports.filesystem.readBytes(canonical)))
              : undefined
            const text = savedBytes
              ? yield* Effect.try({
                  try: () => decode(savedBytes),
                  catch: (): FtcJava.DocumentError => ({ code: "file_unavailable", path: canonical }),
                })
              : yield* owned(ports.filesystem.readText(canonical))
            // Do not admit a read if a link changed while the filesystem port was reading.
            if ((yield* resolve(authorized.root, value)) !== canonical)
              return yield* Effect.fail({ code: "file_unavailable", path: value } satisfies FtcJava.DocumentError)
            yield* active()
            const snapshot = Object.freeze(
              FtcJava.DocumentSnapshot.make({
                documentID: FtcJava.DocumentID.create(),
                projectID: requested.projectID,
                path: canonical,
                bufferRevision: 0,
                diskRevision: 0,
                text,
                dirty: false,
              }),
            )
            documents.set(canonical, { root: authorized.root, savedText: text, savedBytes, snapshot })
            yield* PubSub.publish(events, Object.freeze({ type: "opened", snapshot }))
            return snapshot
          }),
        )
      }),
      readDocument: Effect.fn("JavaDocuments.readDocument")(function* (input) {
        const projectID = input.projectID
        const value = input.path
        const authorized = yield* authorize(projectID)
        const canonical = yield* resolve(authorized.root, value)
        yield* active()
        const document = documents.get(canonical)
        if (!document)
          return yield* Effect.fail({ code: "document_not_open", path: value } satisfies FtcJava.DocumentError)
        if (document.snapshot.projectID !== projectID || document.root !== authorized.root)
          return yield* Effect.fail({ code: "project_unauthorized", projectID } satisfies FtcJava.DocumentError)
        return document.snapshot
      }),
      changeDocument: Effect.fn("JavaDocuments.changeDocument")(function* (input) {
        yield* active()
        const value = input.path
        const expectedRevision = input.expectedRevision
        const text = input.text
        if (
          typeof value !== "string" ||
          !path.isAbsolute(value) ||
          !Number.isSafeInteger(expectedRevision) ||
          expectedRevision < 0 ||
          typeof text !== "string"
        )
          return yield* Effect.fail({ code: "invalid_document_input" } satisfies FtcJava.DocumentError)
        const current = documents.get(path.normalize(value))
        if (!current)
          return yield* Effect.fail({ code: "document_not_open", path: value } satisfies FtcJava.DocumentError)
        const authorized = yield* authorize(current.snapshot.projectID)
        if (authorized.root !== current.root)
          return yield* Effect.fail({ code: "project_unauthorized" } satisfies FtcJava.DocumentError)
        const canonical = yield* resolve(authorized.root, value)
        if (canonical !== current.snapshot.path)
          return yield* Effect.fail({ code: "document_not_open", path: value } satisfies FtcJava.DocumentError)
        return yield* locks.withLock(canonical)(
          Effect.gen(function* () {
            yield* active()
            const document = documents.get(canonical)!
            if (document.snapshot.bufferRevision !== expectedRevision)
              return yield* Effect.fail({
                code: "revision_conflict",
                path: canonical,
                expectedRevision,
                actualRevision: document.snapshot.bufferRevision,
              } satisfies FtcJava.DocumentError)
            if (document.snapshot.text === text) return document.snapshot
            const snapshot = Object.freeze(
              FtcJava.DocumentSnapshot.make({
                ...document.snapshot,
                bufferRevision: document.snapshot.bufferRevision + 1,
                text,
                dirty: text !== document.savedText,
              }),
            )
            documents.set(canonical, { ...document, snapshot })
            yield* PubSub.publish(events, Object.freeze({ type: "changed", snapshot }))
            return snapshot
          }),
        )
      }),
      saveDocument: Effect.fn("JavaDocuments.saveDocument")(function* (input) {
        yield* active()
        return yield* owned(
          Effect.gen(function* () {
            yield* active()
            if (!Schema.is(FtcJava.SaveRequest)(input))
              return yield* Effect.fail({ code: "invalid_document_input" } satisfies FtcJava.DocumentError)
            const requested = FtcJava.SaveRequest.make({ ...input, expectedRevision: { ...input.expectedRevision } })
            const authorized = yield* authorize(requested.projectID)
            const canonical = yield* resolve(authorized.root, requested.path)
            return yield* locks.withLock(canonical)(
              Effect.gen(function* () {
                yield* checkScope(requested.projectID, authorized.root, requested.path, canonical)
                const disk = yield* observe(canonical)
                const detail = conflict(disk, requested.expectedRevision, false)
                if (detail)
                  return yield* Effect.fail({
                    code: "revision_conflict",
                    path: canonical,
                    conflict: detail,
                  } satisfies FtcJava.DocumentError)
                if (!disk.document.snapshot.dirty) return disk.document.snapshot
                yield* checkScope(requested.projectID, authorized.root, requested.path, canonical)
                const saved = yield* commit(canonical, disk.document.snapshot.text, disk.bytes)
                if (saved) return saved
                const latest = yield* observe(canonical)
                return yield* Effect.fail({
                  code: "revision_conflict",
                  path: canonical,
                  conflict:
                    conflict(latest, requested.expectedRevision, false) ??
                    Object.freeze({
                      path: canonical,
                      reason: "disk_changed",
                      current: latest.document.snapshot,
                      diskText: latest.text,
                      choices: ["save", "merge", "defer"] as const,
                    }),
                } satisfies FtcJava.DocumentError)
              }),
            )
          }),
        )
      }),
      applyEdits: Effect.fn("JavaDocuments.applyEdits")(function* (input) {
        yield* active()
        return yield* owned(
          Effect.gen(function* () {
            yield* active()
            if (!Schema.is(FtcJava.EditProposal)(input.proposal))
              return yield* Effect.fail({ code: "invalid_document_input" } satisfies FtcJava.DocumentError)
            const proposal = Object.freeze(
              FtcJava.EditProposal.make({
                ...input.proposal,
                edits: Object.freeze(
                  input.proposal.edits.map((edit) =>
                    Object.freeze({ ...edit, expectedRevision: Object.freeze({ ...edit.expectedRevision }) }),
                  ),
                ),
              }),
            )
            if (proposal.edits.some((edit) => decode(new TextEncoder().encode(edit.replacement)) !== edit.replacement))
              return yield* Effect.fail({ code: "invalid_document_input" } satisfies FtcJava.DocumentError)
            const authorization = input.authorization
            const authorized = yield* authorize(proposal.projectID)
            const paths = yield* Effect.forEach(proposal.edits, (edit) => resolve(authorized.root, edit.path))
            if (new Set(paths).size !== paths.length)
              return yield* Effect.fail({ code: "invalid_document_input" } satisfies FtcJava.DocumentError)
            yield* checkChanges(proposal, authorization, authorized.root, paths)
            const execute = Effect.gen(function* () {
              const preflight = yield* Effect.forEach(proposal.edits, (edit, index) =>
                Effect.gen(function* () {
                  yield* checkScope(proposal.projectID, authorized.root, edit.path, paths[index])
                  const disk = yield* observe(paths[index])
                  return conflict(disk, edit.expectedRevision, true)
                }),
              )
              const conflicts = preflight.filter((value): value is FtcJava.EditConflict => value !== undefined)
              if (conflicts.length) return { kind: "conflict" as const, proposal, applied: [], conflicts }
              const applied: FtcJava.DocumentSnapshot[] = []
              for (const [index, edit] of proposal.edits.entries()) {
                const result = yield* Effect.gen(function* () {
                  yield* checkChanges(proposal, authorization, authorized.root, paths)
                  yield* checkScope(proposal.projectID, authorized.root, edit.path, paths[index])
                  const disk = yield* observe(paths[index])
                  const detail = conflict(disk, edit.expectedRevision, true)
                  if (detail) return { conflict: detail }
                  yield* checkChanges(proposal, authorization, authorized.root, paths)
                  yield* checkScope(proposal.projectID, authorized.root, edit.path, paths[index])
                  const saved = yield* commit(paths[index], edit.replacement, disk.bytes)
                  if (saved) return { saved }
                  const latest = yield* observe(paths[index])
                  return {
                    conflict:
                      conflict(latest, edit.expectedRevision, true) ??
                      Object.freeze({
                        path: paths[index],
                        reason: "disk_changed" as const,
                        current: latest.document.snapshot,
                        diskText: latest.text,
                        choices: ["save", "merge", "defer"] as const,
                      }),
                  }
                }).pipe(Effect.result)
                if (result._tag === "Failure") {
                  if (!applied.length && result.failure.code === "edit_unauthorized")
                    return yield* Effect.fail(result.failure)
                  return {
                    kind: "failed" as const,
                    proposal,
                    applied,
                    error: result.failure,
                    uncertainPaths:
                      "outcome" in result.failure && result.failure.outcome === "unknown" ? [paths[index]] : [],
                  }
                }
                if (result.success.conflict)
                  return { kind: "conflict" as const, proposal, applied, conflicts: [result.success.conflict] }
                applied.push(result.success.saved)
              }
              return { kind: "applied" as const, proposal, applied }
            })
            return yield* [...paths]
              .sort()
              .reduceRight((effect, canonical) => locks.withLock(canonical)(effect), execute)
          }),
        )
      }),
      events: Stream.fromPubSub(events),
    }
  })

function contained(root: string, filename: string) {
  const relative = path.relative(root, filename)
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

function decode(bytes: Uint8Array) {
  // Keep the BOM in the editable string; TextDecoder's default would silently remove it.
  return new TextDecoder("utf-8", { ignoreBOM: true, fatal: true }).decode(bytes)
}

function sameBytes(left: Uint8Array, right: Uint8Array) {
  return left.length === right.length && left.every((byte, index) => byte === right[index])
}

function matches(snapshot: FtcJava.DocumentSnapshot, expected: FtcJava.Revision) {
  return (
    snapshot.documentID === expected.documentID &&
    snapshot.bufferRevision === expected.bufferRevision &&
    snapshot.diskRevision === expected.diskRevision
  )
}
