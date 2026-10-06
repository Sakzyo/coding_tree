import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { SqliteClient } from "@effect/sql-sqlite-bun"
import { EffectDrizzleSqlite } from "@opencode-ai/effect-drizzle-sqlite"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { Location } from "@opencode-ai/schema/location"
import { Project } from "@opencode-ai/schema/project"
import { Session } from "@opencode-ai/schema/session"
import { Workspace } from "@opencode-ai/schema/workspace"
import { AbsolutePath } from "@opencode-ai/schema/schema"
import { DateTime, Deferred, Effect, Fiber, Result, Schema } from "effect"
import { sql } from "drizzle-orm"
import { DatabaseMigration } from "../../../src/database/migration"
import { migrations } from "../../../src/database/migration.gen"
import { FtcProjects } from "../../../src/ftc/projects"
import { ProjectAssociations } from "../../../src/ftc/projects/sql"
import { tmpdir } from "../../fixture/tmpdir"

const folders: FtcProjects.FolderIdentity = {
  resolve: ({ root }) =>
    Effect.promise(async () => {
      const directory = AbsolutePath.make(await fs.realpath(root))
      return {
        canonicalRoot: directory,
        location: new Location.Info({
          directory,
          project: { id: Project.ID.global, directory: AbsolutePath.make(path.parse(directory).root) },
        }),
      }
    }),
}

// Session owns these records. Only its narrow create/get ports are supplied to M2.
function sessions() {
  const records = new Map<Session.ID, Session.Info>()
  const port: FtcProjects.SessionAccess = {
    createSession: ({ location }) =>
      Effect.sync(() => {
        const session: Session.Info = {
          id: Session.ID.create(),
          projectID: Project.ID.global,
          location,
          title: "New session",
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          time: { created: DateTime.makeUnsafe(1), updated: DateTime.makeUnsafe(1) },
        }
        records.set(session.id, session)
        return session
      }),
    getSession: (id) => Effect.sync(() => records.get(id)),
  }
  return { records, port }
}

function run<A, E>(
  filename: string,
  port: FtcProjects.SessionAccess,
  effect: Effect.Effect<A, E, FtcProjects.Service>,
) {
  return database(filename, (db) =>
    effect.pipe(Effect.provide(FtcProjects.layer(folders, ProjectAssociations.make(db), port))),
  )
}

function database<A, E>(
  filename: string,
  effect: (db: EffectDrizzleSqlite.EffectSQLiteDatabase) => Effect.Effect<A, E>,
) {
  return Effect.runPromise(
    Effect.gen(function* () {
      const db = yield* EffectDrizzleSqlite.makeWithDefaults()
      yield* DatabaseMigration.apply(db)
      return yield* effect(db)
    }).pipe(Effect.provide(SqliteClient.layer({ filename })), Effect.scoped),
  )
}

const open = (root: string) =>
  Effect.gen(function* () {
    const projects = yield* FtcProjects.Service
    return yield* projects.openProject({ root: AbsolutePath.make(root) })
  })

// Removing membership persistence or reusing a Session makes these expectations fail.
test("reopen retains distinct chat Sessions", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "local.sqlite")
  const fixture = sessions()
  const project = await run(filename, fixture.port, open(tmp.path))
  const [a, b] = await run(
    filename,
    fixture.port,
    Effect.gen(function* () {
      const projects = yield* FtcProjects.Service
      return [yield* projects.createChat(project), yield* projects.createChat(project)]
    }),
  )
  expect(a.sessionID).not.toBe(b.sessionID)
  expect(a.chatID).not.toBe(b.chatID)
  expect(a.projectID).toBe(project.projectID)
  const reopened = await run(
    filename,
    {
      ...fixture.port,
      createSession: () => Effect.die("Reopen must not create or execute a Session"),
    },
    Effect.gen(function* () {
      const projects = yield* FtcProjects.Service
      return yield* projects.listChats(project)
    }),
  )
  expect(reopened).toEqual([a, b])
  expect(await database(filename, (db) => db.all(sql`SELECT id FROM session`))).toEqual([])
})

test("two roots with the same host ID keep separate chats and aliases restore membership", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "local.sqlite")
  const fixture = sessions()
  const roots = [AbsolutePath.make(path.join(tmp.path, "a")), AbsolutePath.make(path.join(tmp.path, "b"))]
  await Promise.all(roots.map((root) => fs.mkdir(root)))
  await fs.symlink(roots[0], path.join(tmp.path, "alias"))
  const projects = await Promise.all(roots.map((root) => run(filename, fixture.port, open(root))))
  const chats = await run(
    filename,
    fixture.port,
    Effect.gen(function* () {
      const service = yield* FtcProjects.Service
      return yield* Effect.forEach(projects, (project) => service.createChat(project))
    }),
  )
  expect(chats[0].projectID).not.toBe(chats[1].projectID)
  expect(chats[0].sessionID).not.toBe(chats[1].sessionID)
  expect(projects.map((project) => project.location.project.id)).toEqual([Project.ID.global, Project.ID.global])
  expect([...fixture.records.values()].map((session) => session.location.directory)).toEqual(roots)
  const alias = await run(filename, fixture.port, open(path.join(tmp.path, "alias")))
  expect(alias.projectID).toBe(projects[0].projectID)
  const listed = await run(
    filename,
    fixture.port,
    Effect.gen(function* () {
      const service = yield* FtcProjects.Service
      return yield* Effect.forEach([alias, projects[1]], (project) => service.listChats(project))
    }),
  )
  expect(listed).toEqual([[chats[0]], [chats[1]]])
})

test("unknown association fails before Session creation and is not inherited by another database", async () => {
  await using tmp = await tmpdir()
  const fixture = sessions()
  const project = await run(path.join(tmp.path, "first.sqlite"), fixture.port, open(tmp.path))
  const result = await run(
    path.join(tmp.path, "second.sqlite"),
    {
      ...fixture.port,
      createSession: () => Effect.die("Unknown projects must not create Sessions"),
    },
    Effect.gen(function* () {
      const service = yield* FtcProjects.Service
      return [
        yield* service.createChat(project).pipe(Effect.result),
        yield* service.listChats(project).pipe(Effect.result),
      ]
    }),
  )
  expect(result.map((item) => item._tag === "Failure" && item.failure.code)).toEqual([
    "project_not_found",
    "project_not_found",
  ])
  expect(fixture.records.size).toBe(0)
})

test.each(["directory", "host", "workspace", "lookup-id", "missing"] as const)(
  "create rejects %s Session mismatch without membership",
  async (mismatch) => {
    await using tmp = await tmpdir()
    const filename = path.join(tmp.path, "local.sqlite")
    const fixture = sessions()
    const project = await run(filename, fixture.port, open(tmp.path))
    const port: FtcProjects.SessionAccess = {
      ...fixture.port,
      createSession: (input) =>
        fixture.port.createSession(input).pipe(
          Effect.map((session) => {
            const changed = {
              ...session,
              projectID: mismatch === "host" ? project.projectID : session.projectID,
              location: {
                directory:
                  mismatch === "directory"
                    ? AbsolutePath.make(path.join(tmp.path, "other"))
                    : session.location.directory,
                ...(mismatch === "workspace" ? { workspaceID: Workspace.ID.make("wrk_explicit") } : {}),
              },
            }
            fixture.records.set(session.id, changed)
            return changed
          }),
        ),
      getSession: (id) =>
        fixture.port.getSession(id).pipe(
          Effect.map((session) => {
            if (mismatch === "missing") return undefined
            if (mismatch === "lookup-id" && session) return { ...session, id: Session.ID.create() }
            return session
          }),
        ),
    }
    const result = await run(
      filename,
      port,
      Effect.gen(function* () {
        const service = yield* FtcProjects.Service
        return yield* service.createChat(project).pipe(Effect.result)
      }),
    )
    expect(Result.isFailure(result) && result.failure.code).toBe(
      mismatch === "missing" ? "session_not_found" : "session_mismatch",
    )
    expect(
      await run(
        filename,
        fixture.port,
        Effect.gen(function* () {
          const service = yield* FtcProjects.Service
          return yield* service.listChats(project)
        }),
      ),
    ).toEqual([])
  },
)

test.each(["missing", "placement", "identity"] as const)(
  "reopen rejects %s Session instead of returning a false association",
  async (change) => {
    await using tmp = await tmpdir()
    const filename = path.join(tmp.path, "local.sqlite")
    const fixture = sessions()
    const project = await run(filename, fixture.port, open(tmp.path))
    const chat = await run(
      filename,
      fixture.port,
      Effect.gen(function* () {
        const service = yield* FtcProjects.Service
        return yield* service.createChat(project)
      }),
    )
    const original = fixture.records.get(chat.sessionID)!
    const port: FtcProjects.SessionAccess = {
      ...fixture.port,
      getSession: () =>
        Effect.succeed(
          change === "missing"
            ? undefined
            : {
                ...original,
                id: change === "identity" ? Session.ID.create() : original.id,
                location:
                  change === "placement"
                    ? { directory: AbsolutePath.make(path.join(tmp.path, "other")) }
                    : original.location,
              },
        ),
    }
    const result = await run(
      filename,
      port,
      Effect.gen(function* () {
        const service = yield* FtcProjects.Service
        return yield* service.listChats(project).pipe(Effect.result)
      }),
    )
    expect(Result.isFailure(result) && result.failure.code).toBe(
      change === "missing" ? "session_not_found" : "session_mismatch",
    )
    expect(
      await run(
        filename,
        fixture.port,
        Effect.gen(function* () {
          const service = yield* FtcProjects.Service
          return yield* service.listChats(project)
        }),
      ),
    ).toEqual([chat])
  },
)

test("concurrent separate connections cannot assign a Session to two chats", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "local.sqlite")
  const fixture = sessions()
  const project = await run(filename, fixture.port, open(tmp.path))
  const session = await Effect.runPromise(fixture.port.createSession({ location: project.location }))
  const port = { ...fixture.port, createSession: () => Effect.succeed(session) }
  const results = await Promise.all(
    Array.from({ length: 6 }, () =>
      run(
        filename,
        port,
        Effect.gen(function* () {
          const service = yield* FtcProjects.Service
          return yield* service.createChat(project).pipe(Effect.result)
        }),
      ),
    ),
  )
  expect(results.filter(Result.isSuccess)).toHaveLength(1)
  expect(results.filter(Result.isFailure).map((item) => item.failure.code)).toEqual(
    Array(5).fill("chat_session_conflict"),
  )
  expect(await database(filename, (db) => db.all(sql`SELECT session_id FROM ftc_chat`))).toEqual([
    { session_id: session.id },
  ])
})

test("SQLite failure after Session creation retains the unassociated Session and retry creates a fresh chat", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "local.sqlite")
  const fixture = sessions()
  const project = await run(filename, fixture.port, open(tmp.path))
  const result = await database(filename, (db) =>
    Effect.gen(function* () {
      yield* db.run(sql`PRAGMA query_only = ON`)
      return yield* Effect.gen(function* () {
        const service = yield* FtcProjects.Service
        return yield* service.createChat(project).pipe(Effect.result)
      }).pipe(Effect.provide(FtcProjects.layer(folders, ProjectAssociations.make(db), fixture.port)))
    }),
  )
  expect(Result.isFailure(result) && result.failure.code).toBe("chat_store_failed")
  expect(fixture.records.size).toBe(1)
  expect(await database(filename, (db) => db.all(sql`SELECT * FROM ftc_chat`))).toEqual([])
  const orphan = [...fixture.records.keys()][0]
  const retry = await run(
    filename,
    fixture.port,
    Effect.gen(function* () {
      const service = yield* FtcProjects.Service
      return yield* service.createChat(project)
    }),
  )
  expect(retry.sessionID).not.toBe(orphan)
  expect(fixture.records.has(orphan)).toBe(true)
})

test("interruption during lookup releases the port and creates no membership", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "local.sqlite")
  const fixture = sessions()
  const project = await run(filename, fixture.port, open(tmp.path))
  const started = Deferred.makeUnsafe<void>()
  const released = Deferred.makeUnsafe<void>()
  await run(
    filename,
    {
      ...fixture.port,
      getSession: () =>
        Effect.scoped(
          Effect.gen(function* () {
            yield* Effect.addFinalizer(() => Deferred.succeed(released, undefined))
            yield* Deferred.succeed(started, undefined)
            return yield* Effect.never
          }),
        ),
    },
    Effect.gen(function* () {
      const service = yield* FtcProjects.Service
      const fiber = yield* service.createChat(project).pipe(Effect.forkChild)
      yield* Deferred.await(started)
      yield* Fiber.interrupt(fiber)
      expect(yield* Deferred.isDone(released)).toBe(true)
    }),
  )
  expect(fixture.records.size).toBe(1)
  expect(await database(filename, (db) => db.all(sql`SELECT * FROM ftc_chat`))).toEqual([])
})

test.each(["create", "lookup"] as const)(
  "Session %s failure does not become successful membership",
  async (operation) => {
    await using tmp = await tmpdir()
    const filename = path.join(tmp.path, "local.sqlite")
    const fixture = sessions()
    const project = await run(filename, fixture.port, open(tmp.path))
    const failure: FtcProject.ChatError = {
      code: "session_access_failed",
      projectID: project.projectID,
      recovery: "retry",
    }
    const result = await run(
      filename,
      {
        ...fixture.port,
        ...(operation === "create"
          ? { createSession: () => Effect.fail(failure) }
          : { getSession: () => Effect.fail(failure) }),
      },
      Effect.gen(function* () {
        const service = yield* FtcProjects.Service
        return yield* service.createChat(project).pipe(Effect.result)
      }),
    )
    expect(Result.isFailure(result) && result.failure).toEqual(failure)
    expect(await database(filename, (db) => db.all(sql`SELECT * FROM ftc_chat`))).toEqual([])
  },
)

test("host mapping refresh during Session creation rejects stale membership", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "local.sqlite")
  const fixture = sessions()
  const project = await run(filename, fixture.port, open(tmp.path))
  const result = await database(filename, (db) => {
    const repository = ProjectAssociations.make(db)
    return Effect.gen(function* () {
      const service = yield* FtcProjects.Service
      return yield* service.createChat(project).pipe(Effect.result)
    }).pipe(
      Effect.provide(
        FtcProjects.layer(folders, repository, {
          ...fixture.port,
          createSession: (input) =>
            fixture.port.createSession(input).pipe(
              Effect.tap(() =>
                repository
                  .associate({
                    canonicalRoot: project.canonicalRoot,
                    location: new Location.Info({
                      directory: project.canonicalRoot,
                      project: { id: Project.ID.make("new-host"), directory: project.canonicalRoot },
                    }),
                  })
                  .pipe(Effect.orDie),
              ),
            ),
        }),
      ),
    )
  })
  expect(Result.isFailure(result) && result.failure.code).toBe("project_changed")
  expect(await database(filename, (db) => db.all(sql`SELECT * FROM ftc_chat`))).toEqual([])
  expect(fixture.records.size).toBe(1)
})

test("tracked chat migration preserves prior project association data and reopens membership", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "local.sqlite")
  const fixture = sessions()
  const project = await Effect.runPromise(
    Effect.gen(function* () {
      const db = yield* EffectDrizzleSqlite.makeWithDefaults()
      const index = migrations.findIndex((migration) => migration.id.endsWith("_ftc-chat-membership"))
      expect(index).toBeGreaterThan(0)
      yield* DatabaseMigration.applyOnly(db, migrations.slice(0, index))
      const project = yield* open(tmp.path).pipe(
        Effect.provide(FtcProjects.layer(folders, ProjectAssociations.make(db), fixture.port)),
      )
      const before = yield* db.all(sql`SELECT * FROM ftc_project_association`)
      yield* DatabaseMigration.apply(db)
      yield* DatabaseMigration.apply(db)
      expect(yield* db.all(sql`SELECT * FROM ftc_project_association`)).toEqual(before)
      expect(yield* db.all(sql`SELECT * FROM ftc_chat`)).toEqual([])
      return project
    }).pipe(Effect.provide(SqliteClient.layer({ filename })), Effect.scoped),
  )
  const chat = await run(
    filename,
    fixture.port,
    Effect.gen(function* () {
      const service = yield* FtcProjects.Service
      return yield* service.createChat(project)
    }),
  )
  expect(
    await run(
      filename,
      fixture.port,
      Effect.gen(function* () {
        const service = yield* FtcProjects.Service
        return yield* service.listChats(project)
      }),
    ),
  ).toEqual([chat])
})

test("chat contracts keep canonical identities, strict ID prefix and optional omission", () => {
  expect(FtcProjects.ChatRef).toBe(FtcProject.ChatRef)
  expect(FtcProjects.ChatID).toBe(FtcProject.ChatID)
  expect(FtcProjects.ProjectRequest).toBe(FtcProject.ProjectRequest)
  expect(FtcProjects.ChatError).toBe(FtcProject.ChatError)
  expect(FtcProject.ChatRef.fields.projectID).toBe(Project.ID)
  expect(FtcProject.ChatRef.fields.sessionID).toBe(Session.ID)
  expect(FtcProject.ChatRef.fields.chatID).toBe(FtcProject.ChatID)
  expect(Schema.is(FtcProject.ChatID)(FtcProject.ChatID.create())).toBe(true)
  expect(Schema.is(FtcProject.ChatID)("chat-invalid")).toBe(false)
  expect(Schema.is(FtcProject.ChatID)("chat")).toBe(false)
  expect(
    Schema.encodeSync(FtcProject.ChatError)({
      code: "chat_store_failed",
      projectID: Project.ID.global,
      sessionID: undefined,
      detail: undefined,
      recovery: "retry",
    }),
  ).toEqual({ code: "chat_store_failed", projectID: Project.ID.global, recovery: "retry" })
  const identifiers = [FtcProject.ChatID, FtcProject.ChatRef, FtcProject.ProjectRequest, FtcProject.ChatError].map(
    (schema) => Schema.toJsonSchemaDocument(schema).schema,
  )
  expect(identifiers).toEqual([
    { $ref: "#/$defs/FtcProject.ChatID" },
    { $ref: "#/$defs/FtcProject.ChatRef" },
    { $ref: "#/$defs/FtcProject.ProjectRequest" },
    { $ref: "#/$defs/FtcProject.ChatError" },
  ])
})
