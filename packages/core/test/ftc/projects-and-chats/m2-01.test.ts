import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { SqliteClient } from "@effect/sql-sqlite-bun"
import { EffectDrizzleSqlite } from "@opencode-ai/effect-drizzle-sqlite"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { Location } from "@opencode-ai/schema/location"
import { Project } from "@opencode-ai/schema/project"
import { Workspace } from "@opencode-ai/schema/workspace"
import { AbsolutePath } from "@opencode-ai/schema/schema"
import { Deferred, Effect, Fiber, Result, Schema } from "effect"
import { sql } from "drizzle-orm"
import { DatabaseMigration } from "../../../src/database/migration"
import { migrations } from "../../../src/database/migration.gen"
import { FtcProjects } from "../../../src/ftc/projects"
import { ProjectAssociations } from "../../../src/ftc/projects/sql"
import { tmpdir } from "../../fixture/tmpdir"

const folders: FtcProjects.FolderIdentity = {
  resolve: ({ root }) =>
    Effect.tryPromise({
      try: async () => {
        const directory = AbsolutePath.make(await fs.realpath(root))
        if (!(await fs.stat(directory)).isDirectory()) throw new Error("not_a_directory")
        await fs.access(directory, fs.constants.R_OK)
        return {
          canonicalRoot: directory,
          location: new Location.Info({
            directory,
            project: { id: Project.ID.global, directory: AbsolutePath.make(path.parse(directory).root) },
          }),
        }
      },
      catch: (cause): FtcProject.AssociationError => ({
        code: "folder_unavailable",
        root,
        detail: String(cause),
        recovery: "select_accessible_folder",
      }),
    }),
}

function run<A, E>(filename: string, effect: Effect.Effect<A, E, FtcProjects.Service>, identity = folders) {
  return Effect.runPromise(
    Effect.gen(function* () {
      const db = yield* EffectDrizzleSqlite.makeWithDefaults()
      yield* DatabaseMigration.apply(db)
      return yield* effect.pipe(Effect.provide(FtcProjects.layer(identity, ProjectAssociations.make(db))))
    }).pipe(Effect.provide(SqliteClient.layer({ filename })), Effect.scoped),
  )
}

test("folder aliases reopen one project", async () => {
  await using tmp = await tmpdir()
  const root = AbsolutePath.make(path.join(tmp.path, "team"))
  const aliasRoot = AbsolutePath.make(path.join(tmp.path, "alias"))
  await fs.mkdir(root)
  await fs.mkdir(path.join(root, "TeamCode"))
  await Bun.write(path.join(root, "TeamCode/Main.java"), "// student code\n")
  await Bun.write(path.join(root, "ftc-project.json"), '{"name":"team"}\n')
  await fs.symlink(root, aliasRoot)
  const beforeFiles = await files(root)
  const filename = path.join(tmp.path, "local.sqlite")
  const opened = await run(
    filename,
    Effect.gen(function* () {
      const projects = yield* FtcProjects.Service
      return yield* projects.createProject({ root })
    }),
  )
  const alias = await run(
    filename,
    Effect.gen(function* () {
      const projects = yield* FtcProjects.Service
      return yield* projects.openProject({ root: aliasRoot })
    }),
  )
  expect(alias.projectID).toBe(opened.projectID)
  expect(alias).toEqual(opened)
  expect(alias.canonicalRoot).toBe(root)
  expect(alias.location.directory).toBe(root)
  expect(alias.location.project.id).toBe(Project.ID.global)
  expect(alias.projectID).not.toBe(Project.ID.global)
  const afterFiles = await files(root)
  expect(afterFiles).toEqual(beforeFiles)
})

async function files(root: string) {
  return Promise.all(
    (await fs.readdir(root, { recursive: true })).sort().map(async (name) => {
      const file = path.join(root, name)
      const stat = await fs.lstat(file)
      return { name, mode: stat.mode, content: stat.isFile() ? await Bun.file(file).text() : null }
    }),
  )
}

test.each([Project.ID.global, Project.ID.make("shared-remote")])(
  "distinct local roots retain distinct association IDs with host ID %s",
  async (hostID) => {
    await using tmp = await tmpdir()
    const filename = path.join(tmp.path, "local.sqlite")
    const identity: FtcProjects.FolderIdentity = {
      resolve: (input) =>
        folders.resolve(input).pipe(
          Effect.map((folder) => ({
            ...folder,
            location: new Location.Info({
              directory: folder.location.directory,
              project: { ...folder.location.project, id: hostID },
            }),
          })),
        ),
    }
    const roots = await Promise.all(
      ["first", "second"].map(async (name) => {
        const root = AbsolutePath.make(path.join(tmp.path, name))
        await fs.mkdir(root)
        await Bun.write(path.join(root, "ftc-project.json"), '{"id":"copied"}')
        return root
      }),
    )
    const contexts = await run(
      filename,
      Effect.gen(function* () {
        const projects = yield* FtcProjects.Service
        return yield* Effect.forEach(roots, (root) => projects.openProject({ root }))
      }),
      identity,
    )
    expect(contexts[0].projectID).not.toBe(contexts[1].projectID)
    expect(contexts.map((context) => context.canonicalRoot)).toEqual(roots)
    expect(contexts.map((context) => context.location.project.id)).toEqual([hostID, hostID])
    const reopened = await run(
      filename,
      Effect.gen(function* () {
        const projects = yield* FtcProjects.Service
        return yield* Effect.forEach(roots, (root) => projects.createProject({ root }))
      }),
      identity,
    )
    expect(reopened).toEqual(contexts)
  },
)

test("concurrent independent connections associate one canonical root exactly once", async () => {
  await using tmp = await tmpdir()
  const root = AbsolutePath.make(path.join(tmp.path, "team"))
  await fs.mkdir(root)
  const filename = path.join(tmp.path, "local.sqlite")
  const results = await Promise.all(
    Array.from({ length: 8 }, () =>
      run(
        filename,
        Effect.gen(function* () {
          const projects = yield* FtcProjects.Service
          return yield* projects.openProject({ root })
        }),
      ),
    ),
  )
  expect(new Set(results.map((context) => context.projectID)).size).toBe(1)
  expect(await rows(filename)).toHaveLength(1)
})

test("unavailable folder and regular file fail without associations or project-file edits", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "local.sqlite")
  const file = AbsolutePath.make(path.join(tmp.path, "student.java"))
  await Bun.write(file, "// preserve me")
  const results = await run(
    filename,
    Effect.gen(function* () {
      const projects = yield* FtcProjects.Service
      return yield* Effect.forEach([AbsolutePath.make(path.join(tmp.path, "missing")), file], (root) =>
        projects.createProject({ root }).pipe(Effect.result),
      )
    }),
  )
  expect(results.every(Result.isFailure)).toBe(true)
  expect(results.filter(Result.isFailure).map((result) => result.failure.code)).toEqual([
    "folder_unavailable",
    "folder_unavailable",
  ])
  expect(await rows(filename)).toEqual([])
  expect(await Bun.file(file).text()).toBe("// preserve me")
})

test("denied access is propagated before persistence", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "local.sqlite")
  const root = AbsolutePath.make(tmp.path)
  const denied: FtcProject.AssociationError = {
    code: "folder_unavailable",
    root,
    detail: "EACCES",
    recovery: "select_accessible_folder",
  }
  const result = await run(
    filename,
    Effect.gen(function* () {
      const projects = yield* FtcProjects.Service
      return yield* projects.openProject({ root }).pipe(Effect.result)
    }),
    { resolve: () => Effect.fail(denied) },
  )
  expect(Result.isFailure(result) && result.failure).toEqual(denied)
  expect(await rows(filename)).toEqual([])
})

test("interrupting folder resolution leaves no association and releases its scope", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "local.sqlite")
  const started = Deferred.makeUnsafe<void>()
  const released = Deferred.makeUnsafe<void>()
  await run(
    filename,
    Effect.gen(function* () {
      const projects = yield* FtcProjects.Service
      const fiber = yield* projects.createProject({ root: AbsolutePath.make(tmp.path) }).pipe(Effect.forkChild)
      yield* Deferred.await(started)
      yield* Fiber.interrupt(fiber)
      expect(yield* Deferred.isDone(released)).toBe(true)
    }),
    {
      resolve: () =>
        Effect.scoped(
          Effect.gen(function* () {
            yield* Effect.addFinalizer(() => Deferred.succeed(released, undefined))
            yield* Deferred.succeed(started, undefined)
            return yield* Effect.never
          }),
        ),
    },
  )
  expect(await rows(filename)).toEqual([])
})

async function rows(filename: string) {
  return Effect.runPromise(
    Effect.gen(function* () {
      const db = yield* EffectDrizzleSqlite.makeWithDefaults()
      return yield* db.all(sql`SELECT * FROM ftc_project_association`)
    }).pipe(Effect.provide(SqliteClient.layer({ filename })), Effect.scoped),
  )
}

test("inconsistent or nonlocal folder identities fail before persistence", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "local.sqlite")
  const root = AbsolutePath.make(tmp.path)
  const locations = [
    {
      canonicalRoot: root,
      location: new Location.Info({
        directory: AbsolutePath.make(path.join(root, "other")),
        project: { id: Project.ID.global, directory: root },
      }),
    },
    {
      canonicalRoot: root,
      location: new Location.Info({
        directory: root,
        workspaceID: Workspace.ID.make("wrk_future"),
        project: { id: Project.ID.global, directory: root },
      }),
    },
    {
      canonicalRoot: root,
      location: new Location.Info({
        directory: root,
        project: { id: Project.ID.global, directory: AbsolutePath.make("relative") },
      }),
    },
    {
      canonicalRoot: AbsolutePath.make("relative"),
      location: new Location.Info({
        directory: AbsolutePath.make("relative"),
        project: { id: Project.ID.global, directory: root },
      }),
    },
  ]
  for (const identity of locations) {
    const result = await run(
      filename,
      Effect.gen(function* () {
        const projects = yield* FtcProjects.Service
        return yield* projects.openProject({ root }).pipe(Effect.result)
      }),
      { resolve: () => Effect.succeed(identity) },
    )
    expect(Result.isFailure(result) && result.failure.code).toBe("invalid_folder_identity")
  }
  expect(await rows(filename)).toEqual([])
})

test("association contract reuses canonical schemas and encodes optional fields without undefined", () => {
  expect(FtcProjects.ProjectContext).toBe(FtcProject.ProjectContext)
  expect(FtcProject.ProjectContext.fields.projectID).toBe(Project.ID)
  expect(FtcProject.ProjectContext.fields.location).toBe(Location.Info)
  expect(
    Schema.encodeSync(FtcProject.AssociationError)({
      code: "association_store_failed",
      root: undefined,
      detail: undefined,
      recovery: "retry",
    }),
  ).toEqual({ code: "association_store_failed", recovery: "retry" })
  const identifiers = [FtcProject.ProjectContext, FtcProject.FolderRequest, FtcProject.AssociationError].map(
    (schema) => schema.ast.annotations?.identifier,
  )
  expect(identifiers.every((identifier) => typeof identifier === "string")).toBe(true)
  expect(new Set(identifiers).size).toBe(3)
})

test("SQLite write failure is recoverable and does not create a partial association", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "local.sqlite")
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const db = yield* EffectDrizzleSqlite.makeWithDefaults()
      yield* DatabaseMigration.apply(db)
      yield* db.run(sql`PRAGMA query_only = ON`)
      return yield* Effect.gen(function* () {
        const projects = yield* FtcProjects.Service
        return yield* projects.openProject({ root: AbsolutePath.make(tmp.path) }).pipe(Effect.result)
      }).pipe(Effect.provide(FtcProjects.layer(folders, ProjectAssociations.make(db))))
    }).pipe(Effect.provide(SqliteClient.layer({ filename })), Effect.scoped),
  )
  expect(Result.isFailure(result) && result.failure.code).toBe("association_store_failed")
  expect(Result.isFailure(result) && result.failure.recovery).toBe("retry")
  expect(await rows(filename)).toEqual([])
  const opened = await run(
    filename,
    Effect.gen(function* () {
      const projects = yield* FtcProjects.Service
      return yield* projects.openProject({ root: AbsolutePath.make(tmp.path) })
    }),
  )
  expect(opened.canonicalRoot).toBe(AbsolutePath.make(tmp.path))
})

test("fresh independent database scopes do not inherit another repository's associations", async () => {
  await using tmp = await tmpdir()
  const open = Effect.gen(function* () {
    const projects = yield* FtcProjects.Service
    return yield* projects.openProject({ root: AbsolutePath.make(tmp.path) })
  })
  const first = await run(path.join(tmp.path, "first.sqlite"), open)
  const second = await run(path.join(tmp.path, "second.sqlite"), open)
  expect(first.projectID).not.toBe(second.projectID)
  expect((await run(path.join(tmp.path, "first.sqlite"), open)).projectID).toBe(first.projectID)
})

test("reopen refreshes the explicit host mapping without changing canonical ownership", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "local.sqlite")
  const root = AbsolutePath.make(tmp.path)
  const open = Effect.gen(function* () {
    const projects = yield* FtcProjects.Service
    return yield* projects.openProject({ root })
  })
  const before = await run(filename, open)
  const after = await run(filename, open, {
    resolve: () =>
      Effect.succeed({
        canonicalRoot: root,
        location: new Location.Info({
          directory: root,
          project: { id: Project.ID.make("shared-remote"), directory: root },
        }),
      }),
  })
  expect(after.projectID).toBe(before.projectID)
  expect(after.canonicalRoot).toBe(before.canonicalRoot)
  expect(after.location.project.id).toBe(Project.ID.make("shared-remote"))
  expect(await rows(filename)).toEqual([
    {
      canonical_root: root,
      project_id: before.projectID,
      host_project_id: "shared-remote",
      host_project_directory: root,
    },
  ])
})

test("tracked upgrade preserves existing project data and supports a new association", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "local.sqlite")
  await Effect.runPromise(
    Effect.gen(function* () {
      const db = yield* EffectDrizzleSqlite.makeWithDefaults()
      const index = migrations.findIndex((migration) => migration.id.endsWith("_ftc-project-association"))
      expect(index).toBeGreaterThan(0)
      yield* DatabaseMigration.applyOnly(db, migrations.slice(0, index))
      yield* db.run(
        sql`INSERT INTO project (id, worktree, name, time_created, time_updated, sandboxes) VALUES ('existing', '/team', 'Student project', 1, 2, '[]')`,
      )
      yield* DatabaseMigration.apply(db)
      const opened = yield* Effect.gen(function* () {
        const projects = yield* FtcProjects.Service
        return yield* projects.openProject({ root: AbsolutePath.make(tmp.path) })
      }).pipe(Effect.provide(FtcProjects.layer(folders, ProjectAssociations.make(db))))
      expect(opened.canonicalRoot).toBe(AbsolutePath.make(tmp.path))
      expect(yield* db.all(sql`SELECT id, worktree, name, time_created, time_updated, sandboxes FROM project`)).toEqual(
        [
          {
            id: "existing",
            worktree: "/team",
            name: "Student project",
            time_created: 1,
            time_updated: 2,
            sandboxes: "[]",
          },
        ],
      )
      yield* DatabaseMigration.apply(db)
      expect(yield* db.all(sql`SELECT project_id FROM ftc_project_association`)).toEqual([
        { project_id: opened.projectID },
      ])
    }).pipe(Effect.provide(SqliteClient.layer({ filename })), Effect.scoped),
  )
})
