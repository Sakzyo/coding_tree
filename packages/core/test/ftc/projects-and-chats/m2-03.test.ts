import { expect, test } from "bun:test"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { Location } from "@opencode-ai/schema/location"
import { Project } from "@opencode-ai/schema/project"
import { Session } from "@opencode-ai/schema/session"
import { AbsolutePath } from "@opencode-ai/schema/schema"
import { Workspace } from "@opencode-ai/schema/workspace"
import { Deferred, Effect, Exit, Fiber, Result, Schema, SchemaAST, Scope } from "effect"
import { FtcProjects } from "../../../src/ftc/projects"
import { ProjectGate } from "../../../src/ftc/projects/gate"

function fixture() {
  const projects = ["a", "b"].map((name) => ({
    projectID: Project.ID.make(`prj_${name}`),
    canonicalRoot: AbsolutePath.make(`/prepared/${name}`),
    location: new Location.Info({
      directory: AbsolutePath.make(`/prepared/${name}`),
      project: { id: Project.ID.global, directory: AbsolutePath.make("/prepared") },
    }),
  }))
  const chats = [0, 0, 1].map((index, number) => ({
    projectID: projects[index].projectID,
    chatID: FtcProject.ChatID.make(`chat_${number}`),
    sessionID: Session.ID.make(`ses_${number}`),
  }))
  const port: ProjectGate.Projects = {
    getProject: (input) => Effect.succeed(projects.find((project) => project.projectID === input.projectID)!),
    listChats: (input) => Effect.succeed(chats.filter((chat) => chat.projectID === input.projectID)),
  }
  return { projects, chats, port }
}

// An always-acquired gate or a gate keyed by the shared host ID fails this contract.
test("same project contends while another runs", async () => {
  const data = fixture()
  await Effect.runPromise(
    Effect.gen(function* () {
      const gate = yield* ProjectGate.Service
      const first = data.chats[0]
      const initial = yield* gate.acquire(first)
      expect(initial.kind).toBe("acquired")
      const same = yield* gate.acquire(data.chats[1])
      const other = yield* gate.acquire(data.chats[2])
      const active = yield* gate.activeChat(data.projects[0])
      expect(same.kind).toBe("busy")
      expect(other.kind).toBe("acquired")
      expect(active!.chatID).toBe(first.chatID)
    }).pipe(Effect.provide(ProjectGate.layer(data.port)), Effect.scoped),
  )
})

// Removing the atomic check/set lets these simultaneous validations split ownership.
test("concurrent different chats and duplicate project views have one canonical owner", async () => {
  const data = fixture()
  const duplicate = {
    ...data.projects[0],
    projectID: Project.ID.make("prj_duplicate"),
    location: new Location.Info({
      directory: data.projects[0].canonicalRoot,
      project: { id: Project.ID.make("prj_other_host"), directory: AbsolutePath.make("/prepared") },
    }),
  }
  const alias = { ...data.chats[1], projectID: duplicate.projectID }
  const port: ProjectGate.Projects = {
    getProject: (input) =>
      Effect.yieldNow.pipe(Effect.as(input.projectID === duplicate.projectID ? duplicate : data.projects[0])),
    listChats: () => Effect.yieldNow.pipe(Effect.as([...data.chats, alias])),
  }
  await run(
    port,
    Effect.gen(function* () {
      const gate = yield* ProjectGate.Service
      const results = yield* Effect.all(
        [data.chats[0], alias].map((chat) => gate.acquire(chat)),
        { concurrency: "unbounded" },
      )
      expect(results.map((result) => result.kind).sort()).toEqual(["acquired", "busy"])
      const owner = yield* gate.activeChat(data.projects[0])
      expect(owner).toBeDefined()
      if (!owner) throw new Error("expected active chat")
      expect(yield* gate.activeChat(duplicate)).toEqual(owner)
      expect(results.find((result) => result.kind === "busy")!.active).toEqual(owner)
    }),
  )
})

// A reused same-chat token lets one failing reservation release the other's owner.
test("concurrent same-chat claims survive one release and stale or mismatched releases", async () => {
  const data = fixture()
  const port: ProjectGate.Projects = {
    getProject: (input) => Effect.yieldNow.pipe(Effect.andThen(data.port.getProject(input))),
    listChats: (input) => Effect.yieldNow.pipe(Effect.andThen(data.port.listChats(input))),
  }
  await run(
    port,
    Effect.gen(function* () {
      const gate = yield* ProjectGate.Service
      const results = yield* Effect.all(
        Array.from({ length: 8 }, () => gate.acquire(data.chats[0])),
        { concurrency: "unbounded" },
      )
      const leases = results.map((result) => {
        expect(result.kind).toBe("acquired")
        if (result.kind !== "acquired") throw new Error("expected lease")
        return result.lease
      })
      expect(new Set(leases.map((lease) => lease.token)).size).toBe(8)
      yield* gate.release(leases[0])
      yield* gate.release(leases[0])
      yield* gate.release({ ...leases[1], chatID: data.chats[1].chatID })
      yield* gate.release({ ...leases[1], sessionID: data.chats[1].sessionID })
      yield* gate.release({ ...leases[1], projectKey: data.projects[1].canonicalRoot })
      yield* gate.release({ ...leases[1], token: FtcProject.GateToken.make("gate_unowned") })
      expect((yield* gate.acquire(data.chats[1])).kind).toBe("busy")
      yield* Effect.forEach(leases.slice(1), (lease) => gate.release(lease))
      const next = yield* gate.acquire(data.chats[1])
      expect(next.kind).toBe("acquired")
      yield* gate.release(leases[1])
      expect(yield* gate.activeChat(data.projects[0])).toEqual(data.chats[1])
      if (next.kind === "acquired") yield* gate.release(next.lease)
      expect(yield* gate.activeChat(data.projects[0])).toBeUndefined()
    }),
  )
})

test.each(["chat", "session", "project", "invalid"] as const)(
  "rejects %s membership without acquiring",
  async (change) => {
    const data = fixture()
    const chat = {
      ...data.chats[0],
      ...(change === "chat" ? { chatID: FtcProject.ChatID.make("chat_absent") } : {}),
      ...(change === "session" ? { sessionID: data.chats[1].sessionID } : {}),
      ...(change === "project" ? { projectID: data.projects[1].projectID } : {}),
    }
    if (change === "invalid") Reflect.set(chat, "chatID", "invalid")
    await run(
      data.port,
      Effect.gen(function* () {
        const gate = yield* ProjectGate.Service
        const result = yield* gate.acquire(chat).pipe(Effect.result)
        expect(Result.isFailure(result) && result.failure.code).toBe(
          change === "invalid" ? "invalid_chat" : "chat_not_found",
        )
        expect(yield* gate.activeChat(data.projects[0])).toBeUndefined()
      }),
    )
  },
)

test.each(["identity", "directory", "workspace"] as const)("rejects %s ProjectContext mapping", async (change) => {
  const data = fixture()
  const port = {
    ...data.port,
    getProject: () =>
      Effect.succeed({
        ...data.projects[0],
        projectID: change === "identity" ? data.projects[1].projectID : data.projects[0].projectID,
        location: {
          project: data.projects[0].location.project,
          directory: change === "directory" ? data.projects[1].canonicalRoot : data.projects[0].canonicalRoot,
          ...(change === "workspace" ? { workspaceID: Workspace.ID.make("wrk_explicit") } : {}),
        },
      }),
  }
  await run(
    port,
    Effect.gen(function* () {
      const gate = yield* ProjectGate.Service
      const result = yield* gate.acquire(data.chats[0]).pipe(Effect.result)
      expect(Result.isFailure(result) && result.failure.code).toBe("invalid_project")
    }),
  )
})

test("interrupted membership lookup allocates no ownership", async () => {
  const data = fixture()
  await run(
    data.port,
    Effect.gen(function* () {
      const ready = yield* Deferred.make<void>()
      const scope = yield* Scope.make()
      const gate = yield* ProjectGate.make({
        ...data.port,
        listChats: () => Deferred.succeed(ready, undefined).pipe(Effect.andThen(Effect.never)),
      }).pipe(Scope.provide(scope))
      const pending = yield* gate.acquire(data.chats[0]).pipe(Effect.forkChild)
      yield* Deferred.await(ready)
      yield* Fiber.interrupt(pending)
      expect(yield* gate.activeChat(data.projects[0])).toBeUndefined()
      yield* Scope.close(scope, Exit.void)
    }),
  )
})

test.each(["failure", "cancel"] as const)("%s releases only bracketed caller's claim", async (outcome) => {
  const data = fixture()
  await run(
    data.port,
    Effect.gen(function* () {
      const gate = yield* ProjectGate.Service
      const keeper = yield* gate.acquire(data.chats[0])
      const ready = yield* Deferred.make<void>()
      const holder = Effect.acquireUseRelease(
        gate.acquire(data.chats[0]),
        () =>
          Deferred.succeed(ready, undefined).pipe(
            Effect.andThen(outcome === "failure" ? Effect.fail("admission failed") : Effect.never),
          ),
        (result) => (result.kind === "acquired" ? gate.release(result.lease) : Effect.void),
      )
      const fiber = yield* holder.pipe(Effect.forkChild)
      yield* Deferred.await(ready)
      if (outcome === "cancel") yield* Fiber.interrupt(fiber)
      if (outcome === "failure") yield* Fiber.await(fiber)
      expect((yield* gate.acquire(data.chats[1])).kind).toBe("busy")
      if (keeper.kind === "acquired") yield* gate.release(keeper.lease)
      expect((yield* gate.acquire(data.chats[1])).kind).toBe("acquired")
    }),
  )
})

test("independent scopes cannot release each other's claims and disposed gate rejects reuse", async () => {
  const data = fixture()
  await run(
    data.port,
    Effect.gen(function* () {
      const firstScope = yield* Scope.make()
      const secondScope = yield* Scope.make()
      const first = yield* ProjectGate.make(data.port).pipe(Scope.provide(firstScope))
      const second = yield* ProjectGate.make(data.port).pipe(Scope.provide(secondScope))
      const a = yield* first.acquire(data.chats[0])
      const b = yield* second.acquire(data.chats[1])
      expect([a.kind, b.kind]).toEqual(["acquired", "acquired"])
      if (a.kind === "acquired") yield* second.release(a.lease)
      expect(yield* second.activeChat(data.projects[0])).toEqual(data.chats[1])
      yield* Scope.close(firstScope, Exit.void)
      const result = yield* first.acquire(data.chats[0]).pipe(Effect.result)
      expect(Result.isFailure(result) && result.failure.code).toBe("gate_closed")
      const active = yield* first.activeChat(data.projects[0]).pipe(Effect.result)
      expect(Result.isFailure(active) && active.failure.code).toBe("gate_closed")
      expect(yield* second.activeChat(data.projects[0])).toEqual(data.chats[1])
      yield* Scope.close(secondScope, Exit.void)
    }),
  )
})

function run<A, E>(port: ProjectGate.Projects, effect: Effect.Effect<A, E, ProjectGate.Service>) {
  return Effect.runPromise(effect.pipe(Effect.provide(ProjectGate.layer(port)), Effect.scoped))
}

test("public project lookup validates association identity and preserves host identity", async () => {
  const data = fixture()
  const repository: FtcProjects.Repository = {
    associate: () => Effect.die("unused"),
    getProject: data.port.getProject,
    addChat: () => Effect.die("unused"),
    listChats: data.port.listChats,
  }
  const layer = FtcProjects.layer({ resolve: () => Effect.die("unused") }, repository, {
    createSession: () => Effect.die("lookup must not create a Session"),
    getSession: () => Effect.die("project lookup must not inspect Session history"),
  })
  await Effect.runPromise(
    Effect.gen(function* () {
      const projects = yield* FtcProjects.Service
      expect((yield* projects.getProject(data.projects[0])).location.project.id).toBe(Project.ID.global)
      const unknown = yield* projects.getProject({ projectID: Project.ID.make("prj_unknown") }).pipe(Effect.result)
      expect(Result.isFailure(unknown) && unknown.failure.code).toBe("project_not_found")
    }).pipe(Effect.provide(layer)),
  )
  const invalid = FtcProjects.layer(
    { resolve: () => Effect.die("unused") },
    {
      ...repository,
      getProject: () => Effect.succeed(data.projects[1]),
    },
    { createSession: () => Effect.die("unused"), getSession: () => Effect.die("unused") },
  )
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const projects = yield* FtcProjects.Service
      return yield* projects.getProject(data.projects[0]).pipe(Effect.result)
    }).pipe(Effect.provide(invalid)),
  )
  expect(Result.isFailure(result) && result.failure.code).toBe("project_changed")
})

test("gate records validate serializable contracts and exact facade identities", () => {
  const data = fixture()
  const lease = {
    projectKey: data.projects[0].canonicalRoot,
    chatID: data.chats[0].chatID,
    sessionID: data.chats[0].sessionID,
    token: FtcProject.GateToken.make("gate_example"),
  }
  expect(
    Schema.decodeUnknownSync(FtcProject.GateResult)(JSON.parse(JSON.stringify({ kind: "acquired", lease }))),
  ).toEqual({ kind: "acquired", lease })
  expect(Schema.decodeUnknownSync(FtcProject.GateResult)({ kind: "busy", active: data.chats[0] })).toEqual({
    kind: "busy",
    active: data.chats[0],
  })
  expect(() => Schema.decodeUnknownSync(FtcProject.GateLease)({ ...lease, token: "invalid" })).toThrow()
  expect(() => Schema.decodeUnknownSync(FtcProject.GateLease)({ ...lease, projectKey: "relative" })).toThrow()
  expect(
    Schema.encodeSync(FtcProject.GateError)({ code: "gate_closed", projectID: undefined, recovery: "retry" }),
  ).toEqual({ code: "gate_closed", recovery: "retry" })
  expect([ProjectGate.GateToken, ProjectGate.GateLease, ProjectGate.GateResult, ProjectGate.GateError]).toEqual([
    FtcProject.GateToken,
    FtcProject.GateLease,
    FtcProject.GateResult,
    FtcProject.GateError,
  ])
  const identifiers = [FtcProject.GateToken, FtcProject.GateLease, FtcProject.GateResult, FtcProject.GateError].map(
    (value) => SchemaAST.resolveIdentifier(value.ast),
  )
  expect(identifiers).toEqual([
    "FtcProject.GateToken",
    "FtcProject.GateLease",
    "FtcProject.GateResult",
    "FtcProject.GateError",
  ])
  expect(new Set(identifiers).size).toBe(4)
})

// Disposal racing pending lookup cannot resurrect a closed owner's map.
test("scope disposal during validation rejects later acquisition", async () => {
  const data = fixture()
  await Effect.runPromise(
    Effect.gen(function* () {
      const ready = yield* Deferred.make<void>()
      const continueLookup = yield* Deferred.make<void>()
      const scope = yield* Scope.make()
      const gate = yield* ProjectGate.make({
        ...data.port,
        listChats: (input) =>
          Deferred.succeed(ready, undefined).pipe(
            Effect.andThen(Deferred.await(continueLookup)),
            Effect.andThen(data.port.listChats(input)),
          ),
      }).pipe(Scope.provide(scope))
      const fiber = yield* gate.acquire(data.chats[0]).pipe(Effect.result, Effect.forkChild)
      yield* Deferred.await(ready)
      yield* Scope.close(scope, Exit.void)
      yield* Deferred.succeed(continueLookup, undefined)
      const result = yield* Fiber.join(fiber)
      expect(Result.isFailure(result) && result.failure.code).toBe("gate_closed")
    }).pipe(Effect.scoped),
  )
})

test("Session placement failure from validated membership port acquires nothing", async () => {
  const data = fixture()
  await run(
    {
      ...data.port,
      listChats: (input) =>
        Effect.fail({ code: "session_mismatch", projectID: input.projectID, recovery: "reopen_project" } as const),
    },
    Effect.gen(function* () {
      const gate = yield* ProjectGate.Service
      const result = yield* gate.acquire(data.chats[0]).pipe(Effect.result)
      expect(Result.isFailure(result) && result.failure.code).toBe("session_mismatch")
      expect(yield* gate.activeChat(data.projects[0])).toBeUndefined()
    }),
  )
})
