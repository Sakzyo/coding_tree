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
}

export interface Projects {
  // The supplied port is authorization authority; a caller's project record is not.
  readonly resolve: (projectID: Project.ID) => Effect.Effect<FtcProject.ProjectContext, FtcJava.DocumentError>
}

export interface Ports {
  readonly filesystem: Filesystem
  readonly projects: Projects
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
  readonly events: Stream.Stream<FtcJava.DocumentEvent>
}

export const make = (ports: Ports): Effect.Effect<Interface, never, Scope.Scope> =>
  Effect.gen(function* () {
    const ownerScope = yield* Effect.scope
    const documents = new Map<
      string,
      { readonly root: string; readonly savedText: string; readonly snapshot: FtcJava.DocumentSnapshot }
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
            const text = yield* Effect.acquireUseRelease(
              Effect.scoped(ports.filesystem.readText(canonical)).pipe(Effect.forkIn(ownerScope)),
              Fiber.join,
              Fiber.interrupt,
            )
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
            documents.set(canonical, { root: authorized.root, savedText: text, snapshot })
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
      events: Stream.fromPubSub(events),
    }
  })

function contained(root: string, filename: string) {
  const relative = path.relative(root, filename)
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}
