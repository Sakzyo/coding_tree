import { expect, test } from "bun:test"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { Location } from "@opencode-ai/schema/location"
import { Project } from "@opencode-ai/schema/project"
import { Session } from "@opencode-ai/schema/session"
import { SessionInput } from "@opencode-ai/schema/session-input"
import { SessionMessage } from "@opencode-ai/schema/session-message"
import { AbsolutePath } from "@opencode-ai/schema/schema"
import { DateTime, Deferred, Effect, Exit, Fiber, Layer, Scope } from "effect"
import { SessionV2 } from "../../../src/session"
import { Database } from "../../../src/database/database"
import { AppNodeBuilder } from "../../../src/effect/app-node-builder"
import { LayerNode } from "../../../src/effect/layer-node"
import { ProjectV2 } from "../../../src/project"
import { SessionExecution } from "../../../src/session/execution"
import { SessionInputTable } from "../../../src/session/sql"
import { tmpdir } from "../../fixture/tmpdir"
import { FtcProjects } from "../../../src/ftc/projects"
import { ProjectGate } from "../../../src/ftc/projects/gate"

const fixture = () =>
  Effect.gen(function* () {
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
    const gate = yield* ProjectGate.make({
      getProject: (input) => Effect.succeed(projects.find((project) => project.projectID === input.projectID)!),
      listChats: (input) => Effect.succeed(chats.filter((chat) => chat.projectID === input.projectID)),
    })
    const admittedChatIDs: FtcProject.ChatID[] = []
    const receipts: SessionInput.Admitted[] = []
    const accepted: FtcProject.GateLease[] = []
    const admission: FtcProjects.Submission["admission"] = {
      prompt: (input) =>
        Effect.sync(() => {
          const chat = chats.find((chat) => chat.sessionID === input.sessionID)!
          admittedChatIDs.push(chat.chatID)
          const receipt: SessionInput.Admitted = {
            id: input.id ?? SessionMessage.ID.create(),
            admittedSeq: receipts.length,
            sessionID: input.sessionID,
            prompt: { text: input.prompt.text, agents: input.prompt.agents },
            delivery: input.delivery ?? "steer",
            timeCreated: DateTime.makeUnsafe(0),
          }
          receipts.push(receipt)
          return receipt
        }),
    }
    const handoff: FtcProjects.Submission["handoff"] = ({ lease }) =>
      Effect.sync(() => {
        accepted.push(lease)
      })
    return { projects, chats, gate, admission, handoff, admittedChatIDs, receipts, accepted }
  })

const run = <A, E>(effect: Effect.Effect<A, E, Scope.Scope>) => Effect.runPromise(effect.pipe(Effect.scoped))

// Removing pre-admission reservation/refusal admits the other chat's rejected draft.
test("busy submission does not call admission", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      expect(FtcProjects.SubmitPrompt).toBe(FtcProject.SubmitPrompt)
      expect(FtcProjects.SubmitResult).toBe(FtcProject.SubmitResult)
      const submitter = FtcProjects.submitter(f)
      const first = f.chats[0]
      const initial = yield* f.gate.acquire(first)
      if (initial.kind !== "acquired") throw new Error("expected initial execution claim")
      const admitted = yield* submitter.submitPrompt({ chat: first, prompt: { text: "first" } })
      expect(admitted).toEqual({ kind: "admitted", receipt: f.receipts[0] })
      if (admitted.kind !== "admitted") throw new Error("expected admission")
      expect(admitted.receipt).toBe(f.receipts[0])
      const rejected = yield* submitter.submitPrompt({ chat: f.chats[1], prompt: { text: "draft" } })
      expect(rejected).toEqual({ kind: "busy", active: first })
      expect(f.admittedChatIDs).toEqual([first.chatID])
      yield* f.gate.release(initial.lease)
      yield* Effect.forEach(f.accepted, f.gate.release)
      yield* Effect.yieldNow
      const afterIdleAdmissionCount = f.receipts.length
      expect(afterIdleAdmissionCount).toBe(1)
      expect(yield* f.gate.activeChat(f.projects[0])).toBeUndefined()
      expect((yield* submitter.submitPrompt({ chat: f.chats[1], prompt: { text: "draft" } })).kind).toBe("admitted")
      expect(f.admittedChatIDs).toEqual([first.chatID, f.chats[1].chatID])
    }),
  ))

// Releasing on successful handoff or advisory return unlocks another chat prematurely.
test("successful submission retains ownership until explicit adapter settlement", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const submitter = FtcProjects.submitter(f)
      yield* submitter.submitPrompt({ chat: f.chats[0], prompt: { text: "first" } })
      expect(yield* f.gate.activeChat(f.projects[0])).toEqual(f.chats[0])
      expect((yield* submitter.submitPrompt({ chat: f.chats[1], prompt: { text: "blocked" } })).kind).toBe("busy")
      expect((yield* submitter.submitPrompt({ chat: f.chats[2], prompt: { text: "parallel" } })).kind).toBe("admitted")
      expect(f.accepted).toHaveLength(2)
      yield* f.gate.release(f.accepted[0])
      expect(yield* f.gate.activeChat(f.projects[0])).toBeUndefined()
      expect(yield* f.gate.activeChat(f.projects[1])).toEqual(f.chats[2])
    }),
  ))

test("admit-only releases its unused claim without handing off or admitting a busy draft", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const submitter = FtcProjects.submitter(f)
      yield* submitter.submitPrompt({ chat: f.chats[0], prompt: { text: "stored" }, resume: false })
      expect(f.accepted).toHaveLength(0)
      expect(yield* f.gate.activeChat(f.projects[0])).toBeUndefined()
      yield* submitter.submitPrompt({ chat: f.chats[1], prompt: { text: "run" } })
      expect((yield* submitter.submitPrompt({ chat: f.chats[0], prompt: { text: "draft" }, resume: false })).kind).toBe(
        "busy",
      )
      expect(f.admittedChatIDs).toEqual([f.chats[0].chatID, f.chats[1].chatID])
      yield* submitter.submitPrompt({ chat: f.chats[1], prompt: { text: "stored steer" }, resume: false })
      expect(f.accepted).toHaveLength(1)
      expect(yield* f.gate.activeChat(f.projects[0])).toEqual(f.chats[1])
    }),
  ))

test("failed same-chat admission releases only its own claim", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      yield* FtcProjects.submitter(f).submitPrompt({ chat: f.chats[0], prompt: { text: "active" } })
      const failure = new SessionV2.NotFoundError({ sessionID: f.chats[0].sessionID })
      const failing = FtcProjects.submitter({ ...f, admission: { prompt: () => Effect.fail(failure) } })
      expect(yield* failing.submitPrompt({ chat: f.chats[0], prompt: { text: "fail" } }).pipe(Effect.flip)).toBe(
        failure,
      )
      expect(yield* f.gate.activeChat(f.projects[0])).toEqual(f.chats[0])
      yield* f.gate.release(f.accepted[0])
      expect(yield* f.gate.activeChat(f.projects[0])).toBeUndefined()
    }),
  ))

test("handoff failure releases reservation but retains the already admitted receipt", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const failure: FtcProject.GateError = { code: "gate_closed", recovery: "retry" }
      const failing = FtcProjects.submitter({ ...f, handoff: () => Effect.fail(failure) })
      expect(yield* failing.submitPrompt({ chat: f.chats[0], prompt: { text: "durable" } }).pipe(Effect.flip)).toBe(
        failure,
      )
      expect(f.receipts).toHaveLength(1)
      expect(f.accepted).toHaveLength(0)
      expect(yield* f.gate.activeChat(f.projects[0])).toBeUndefined()
    }),
  ))

test("cancellation during admission releases its own claim while preserving concurrent same-chat ownership", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const entered = yield* Deferred.make<void>()
      const pending = FtcProjects.submitter({
        ...f,
        admission: { prompt: () => Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never)) },
      })
      const interrupted = yield* pending
        .submitPrompt({ chat: f.chats[0], prompt: { text: "cancel" } })
        .pipe(Effect.forkChild)
      yield* Deferred.await(entered)
      yield* FtcProjects.submitter(f).submitPrompt({ chat: f.chats[0], prompt: { text: "accepted" } })
      yield* Fiber.interrupt(interrupted)
      expect(Exit.isFailure(yield* Fiber.await(interrupted))).toBe(true)
      expect(yield* f.gate.activeChat(f.projects[0])).toEqual(f.chats[0])
      expect(f.accepted).toHaveLength(1)
      yield* f.gate.release(f.accepted[0])
      expect(yield* f.gate.activeChat(f.projects[0])).toBeUndefined()
    }),
  ))

test("same-chat steer and queue retain distinct tokens and canonical admission options", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const calls: Parameters<FtcProjects.Submission["admission"]["prompt"]>[0][] = []
      const submitter = FtcProjects.submitter({
        ...f,
        admission: {
          prompt: (input) => {
            calls.push(input)
            return f.admission.prompt(input)
          },
        },
      })
      const id = SessionMessage.ID.create()
      const prompt = { text: "queue", agents: [{ name: "build", source: { start: 0, end: 5, text: "build" } }] }
      yield* submitter.submitPrompt({ chat: f.chats[0], prompt: { text: "steer" } })
      yield* submitter.submitPrompt({ chat: f.chats[0], prompt, id, delivery: "queue", resume: true })
      expect(calls).toEqual([
        {
          sessionID: f.chats[0].sessionID,
          prompt: { text: "steer" },
          id: undefined,
          delivery: undefined,
          resume: false,
        },
        { sessionID: f.chats[0].sessionID, prompt, id, delivery: "queue", resume: false },
      ])
      expect(f.receipts.map((receipt) => receipt.delivery)).toEqual(["steer", "queue"])
      expect(new Set(f.accepted.map((lease) => lease.token)).size).toBe(2)
      yield* f.gate.release(f.accepted[0])
      expect((yield* f.gate.acquire(f.chats[1])).kind).toBe("busy")
      yield* f.gate.release(f.accepted[1])
      expect(yield* f.gate.activeChat(f.projects[0])).toBeUndefined()
    }),
  ))

test("cancellation during masked handoff retains the accepted token for adapter settlement", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const entered = yield* Deferred.make<void>()
      const finish = yield* Deferred.make<void>()
      const submitter = FtcProjects.submitter({
        ...f,
        handoff: (input) =>
          Deferred.succeed(entered, undefined).pipe(
            Effect.andThen(Deferred.await(finish)),
            Effect.andThen(f.handoff(input)),
          ),
      })
      const pending = yield* submitter
        .submitPrompt({ chat: f.chats[0], prompt: { text: "handoff" } })
        .pipe(Effect.forkChild)
      yield* Deferred.await(entered)
      const interrupting = yield* Fiber.interrupt(pending).pipe(Effect.forkChild)
      yield* Effect.yieldNow
      expect(f.receipts).toHaveLength(1)
      expect(f.accepted).toHaveLength(0)
      expect((yield* f.gate.acquire(f.chats[1])).kind).toBe("busy")
      yield* Deferred.succeed(finish, undefined)
      yield* Fiber.join(interrupting)
      expect(f.accepted).toHaveLength(1)
      expect(yield* f.gate.activeChat(f.projects[0])).toEqual(f.chats[0])
      yield* f.gate.release(f.accepted[0])
      expect(yield* f.gate.activeChat(f.projects[0])).toBeUndefined()
    }),
  ))

test.each(["admission", "handoff"] as const)("%s defect releases only the unused reservation", (boundary) =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const broken = FtcProjects.submitter({
        ...f,
        ...(boundary === "admission" ? { admission: { prompt: () => Effect.die("fixture defect") } } : {}),
        ...(boundary === "handoff" ? { handoff: () => Effect.die("fixture defect") } : {}),
      })
      expect(
        Exit.isFailure(yield* broken.submitPrompt({ chat: f.chats[0], prompt: { text: "fail" } }).pipe(Effect.exit)),
      ).toBe(true)
      expect(yield* f.gate.activeChat(f.projects[0])).toBeUndefined()
      expect(f.receipts).toHaveLength(boundary === "admission" ? 0 : 1)
    }),
  ),
)

test("concurrent different-chat submissions durably admit exactly one owner", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const submitter = FtcProjects.submitter(f)
      const results = yield* Effect.all(
        f.chats.slice(0, 2).map((chat) => submitter.submitPrompt({ chat, prompt: { text: "race" } })),
        { concurrency: "unbounded" },
      )
      expect(results.map((result) => result.kind).sort()).toEqual(["admitted", "busy"])
      expect(f.receipts).toHaveLength(1)
      expect(f.accepted).toHaveLength(1)
      expect(f.receipts[0].sessionID).toBe(f.accepted[0].sessionID)
    }),
  ))

test("rejected membership and cancelled acquisition never call admission", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const invalid = { ...f.chats[0], sessionID: f.chats[1].sessionID }
      expect(
        yield* FtcProjects.submitter(f)
          .submitPrompt({ chat: invalid, prompt: { text: "invalid" } })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "chat_not_found" })
      expect(f.receipts).toHaveLength(0)
      const entered = yield* Deferred.make<void>()
      const submitter = FtcProjects.submitter({
        ...f,
        gate: {
          ...f.gate,
          acquire: (chat) =>
            Deferred.succeed(entered, undefined).pipe(
              Effect.andThen(Effect.never),
              Effect.andThen(f.gate.acquire(chat)),
            ),
        },
      })
      const pending = yield* submitter
        .submitPrompt({ chat: f.chats[0], prompt: { text: "cancel" } })
        .pipe(Effect.forkChild)
      yield* Deferred.await(entered)
      yield* Fiber.interrupt(pending)
      expect(f.receipts).toHaveLength(0)
      expect(f.accepted).toHaveLength(0)
      expect(yield* f.gate.activeChat(f.projects[0])).toBeUndefined()
    }),
  ))

test("real Session admission preserves retry and conflict identity while busy drafts create no inbox row", async () => {
  await using tmp = await tmpdir()
  const replacements = [
    [Database.node, Database.layerFromPath(`${tmp.path}/session.sqlite`)],
    [
      ProjectV2.node,
      Layer.succeed(ProjectV2.Service, {
        resolve: (directory) => Effect.succeed({ id: Project.ID.global, directory }),
        directories: () => Effect.die("unused"),
        commit: () => Effect.die("unused"),
      }),
    ],
    [
      SessionExecution.node,
      Layer.succeed(SessionExecution.Service, {
        active: Effect.succeed(new Set<Session.ID>()),
        wake: () => Effect.die("Submission admission must be admit-only; handoff owns wake"),
        resume: () => Effect.die("unused"),
        interrupt: () => Effect.void,
      }),
    ],
  ] satisfies LayerNode.Replacements
  await run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const session = yield* SessionV2.Service
      const database = yield* Database.Service
      yield* Effect.forEach(f.chats, (chat) =>
        session.create({
          id: chat.sessionID,
          location: f.projects.find((project) => project.projectID === chat.projectID)!.location,
        }),
      )
      const submitter = FtcProjects.submitter({ ...f, admission: session })
      const request = {
        chat: f.chats[0],
        prompt: { text: "durable" },
        id: SessionMessage.ID.create(),
        delivery: "queue" as const,
        resume: false,
      }
      const original = yield* submitter.submitPrompt(request)
      const retried = yield* submitter.submitPrompt({ ...request, resume: true })
      expect(retried).toEqual(original)
      expect((yield* database.db.select().from(SessionInputTable).all()).length).toBe(1)
      expect((yield* submitter.submitPrompt({ chat: f.chats[1], prompt: { text: "draft" }, resume: false })).kind).toBe(
        "busy",
      )
      expect((yield* database.db.select().from(SessionInputTable).all()).length).toBe(1)
      const conflict = yield* submitter.submitPrompt({ ...request, prompt: { text: "changed" } }).pipe(Effect.flip)
      expect(conflict).toBeInstanceOf(SessionV2.PromptConflictError)
      expect(conflict).toMatchObject({ sessionID: request.chat.sessionID, messageID: request.id })
      const delivery = yield* submitter.submitPrompt({ ...request, delivery: "steer" }).pipe(Effect.flip)
      expect(delivery).toBeInstanceOf(SessionV2.PromptConflictError)
      expect((yield* database.db.select().from(SessionInputTable).all()).length).toBe(1)
      yield* f.gate.release(f.accepted[0])
      expect(yield* f.gate.activeChat(f.projects[0])).toBeUndefined()
      const mismatched = yield* submitter.submitPrompt({ ...request, chat: f.chats[1] }).pipe(Effect.flip)
      expect(mismatched).toBeInstanceOf(SessionV2.PromptConflictError)
      expect(yield* f.gate.activeChat(f.projects[0])).toBeUndefined()
      const committed = yield* Deferred.make<void>()
      const cancelled = FtcProjects.submitter({
        ...f,
        admission: {
          prompt: (input) =>
            session.prompt(input).pipe(
              Effect.tap(() => Deferred.succeed(committed, undefined)),
              Effect.andThen(Effect.never),
            ),
        },
      })
      const pending = yield* cancelled
        .submitPrompt({ chat: f.chats[1], prompt: { text: "commit then cancel" } })
        .pipe(Effect.forkChild)
      yield* Deferred.await(committed)
      yield* Fiber.interrupt(pending)
      expect((yield* database.db.select().from(SessionInputTable).all()).length).toBe(2)
      expect(yield* f.gate.activeChat(f.projects[0])).toBeUndefined()
    }).pipe(Effect.provide(AppNodeBuilder.build(LayerNode.group([Database.node, SessionV2.node]), replacements))),
  )
})

test("reservation bridges old execution settlement until new admission handoff", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const old = yield* f.gate.acquire(f.chats[0])
      if (old.kind !== "acquired") throw new Error("expected old execution claim")
      const entered = yield* Deferred.make<void>()
      const finish = yield* Deferred.make<void>()
      const pending = FtcProjects.submitter({
        ...f,
        admission: {
          prompt: (input) =>
            Deferred.succeed(entered, undefined).pipe(
              Effect.andThen(Deferred.await(finish)),
              Effect.andThen(f.admission.prompt(input)),
            ),
        },
      })
      const running = yield* pending
        .submitPrompt({ chat: f.chats[0], prompt: { text: "steer" } })
        .pipe(Effect.forkChild)
      yield* Deferred.await(entered)
      yield* f.gate.release(old.lease)
      expect((yield* FtcProjects.submitter(f).submitPrompt({ chat: f.chats[1], prompt: { text: "draft" } })).kind).toBe(
        "busy",
      )
      yield* Deferred.succeed(finish, undefined)
      yield* Fiber.join(running)
      expect(f.admittedChatIDs).toEqual([f.chats[0].chatID])
      expect(f.accepted).toHaveLength(1)
      expect(f.accepted[0].token).not.toBe(old.lease.token)
      yield* f.gate.release(old.lease)
      expect(yield* f.gate.activeChat(f.projects[0])).toEqual(f.chats[0])
    }),
  ))
