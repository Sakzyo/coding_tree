import { LLMClient, LLMEvent, Model, ToolDefinition, type LLMClientShape, type LLMRequest } from "@opencode-ai/llm"
import { route } from "@opencode-ai/llm/protocols/openai-chat"
import { node } from "@opencode-ai/core/session/runner/llm"
import { SessionRunnerModel } from "@opencode-ai/core/session/runner/model"
import { LayerNodePlatform } from "@opencode-ai/core/effect/app-node-platform"
import type { LocationServices } from "@opencode-ai/core/location-services"
import { Location } from "@opencode-ai/core/location"
import { ToolRegistry } from "@opencode-ai/core/tool/registry"
import { SkillGuidance } from "@opencode-ai/core/skill/guidance"
import { ReferenceGuidance } from "@opencode-ai/core/reference/guidance"
import { SystemContext } from "@opencode-ai/core/system-context"
import { Config } from "@opencode-ai/core/config"
import { Snapshot } from "@opencode-ai/core/snapshot"
import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Context, Deferred, Effect, Fiber, Layer, LayerMap, Scope, Stream } from "effect"
import { Database } from "@opencode-ai/core/database/database"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { makeGlobalNode } from "@opencode-ai/core/effect/app-node"
import { SessionProjector } from "@opencode-ai/core/session/projector"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { EventV2 } from "@opencode-ai/core/event"
import { FtcComposition } from "@opencode-ai/core/ftc/composition"
import { FtcProjectAdapters } from "@opencode-ai/core/ftc/projects/adapters"
import { ProjectAssociations } from "@opencode-ai/core/ftc/projects/sql"
import { ProjectV2 } from "@opencode-ai/core/project"
import { LocationServiceMap } from "@opencode-ai/core/location-service-map"
import { SessionV2 } from "@opencode-ai/core/session"
import { SessionStore } from "@opencode-ai/core/session/store"
import { SessionRunner } from "@opencode-ai/core/session/runner"
import { SessionExecution } from "@opencode-ai/core/session/execution"
import { SessionInput } from "@opencode-ai/core/session/input"
import { SessionMessage } from "@opencode-ai/core/session/message"
import { Prompt } from "@opencode-ai/core/session/prompt"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { AbsolutePath } from "@opencode-ai/schema/schema"
import { tmpdir } from "../fixture/tmpdir"

const run = <A, E>(effect: Effect.Effect<A, E, Scope.Scope>) => Effect.runPromise(Effect.scoped(effect))

const fixture = (
  root: string,
  options: {
    disabled?: boolean
    unavailable?: boolean
    filename?: string
    drain?: SessionRunner.Interface["run"]
    model?: LLMClientShape
    tools?: ToolRegistry.Interface
    changed?: (status: FtcProject.OwnerStatus) => Effect.Effect<void>
  } = {},
) =>
  Effect.gen(function* () {
    const context = yield* Layer.build(
      AppNodeBuilder.build(LayerNode.group([Database.node, SessionStore.node, EventV2.node]), [
        [Database.node, Database.layerFromPath(options.filename ?? ":memory:")],
      ]),
    )
    const database = Context.get(context, Database.Service)
    const store = Context.get(context, SessionStore.Service)
    const events = Context.get(context, EventV2.Service)
    const host: ProjectV2.Interface = {
      resolve: () => Effect.succeed({ id: ProjectV2.ID.global, directory: AbsolutePath.make(path.parse(root).root) }),
      commit: () => Effect.die("No host identity writes"),
      directories: () => Effect.die("Unused"),
    }
    const starts: string[] = []
    const started = yield* Deferred.make<void>()
    const finish = yield* Deferred.make<void>()
    const twoStarted = yield* Deferred.make<void>()
    const statuses: FtcProject.OwnerStatus[] = []
    const locations = yield* LayerMap.make((ref: Location.Ref) =>
      options.model
        ? AppNodeBuilder.build(node, [
            [Database.node, Layer.succeed(Database.Service, database)],
            [EventV2.node, Layer.succeed(EventV2.Service, events)],
            [SessionStore.node, Layer.succeed(SessionStore.Service, store)],
            [LayerNodePlatform.llmClient, Layer.succeed(LLMClient.Service, options.model)],
            [
              SessionRunnerModel.node,
              SessionRunnerModel.layerWith(() =>
                Effect.succeed(Model.make({ id: "controlled", provider: "controlled", route })),
              ),
            ],
            [
              Location.node,
              Layer.succeed(Location.Service, {
                ...ref,
                project: { id: ProjectV2.ID.global, directory: AbsolutePath.make(path.parse(root).root) },
              }),
            ],
            [
              ToolRegistry.node,
              Layer.succeed(
                ToolRegistry.Service,
                options.tools ?? {
                  materialize: () => Effect.succeed({ definitions: [], settle: () => Effect.die("No tools") }),
                  register: () => Effect.die("No registration"),
                },
              ),
            ],
            [
              SkillGuidance.node,
              Layer.succeed(SkillGuidance.Service, { load: () => Effect.succeed(SystemContext.empty) }),
            ],
            [
              ReferenceGuidance.node,
              Layer.succeed(ReferenceGuidance.Service, { load: () => Effect.succeed(SystemContext.empty) }),
            ],
            [Config.node, Layer.succeed(Config.Service, { entries: () => Effect.succeed([]) })],
            [Snapshot.node, Snapshot.noopLayer],
          ])
        : Layer.succeed(SessionRunner.Service, {
            run: (request) =>
              Effect.sync(() => {
                starts.push(request.sessionID)
              }).pipe(
                Effect.andThen(Deferred.succeed(started, undefined)),
                Effect.andThen(
                  Effect.suspend(() => (starts.length >= 2 ? Deferred.succeed(twoStarted, undefined) : Effect.void)),
                ),
                Effect.andThen(options.drain ? options.drain(request) : Deferred.await(finish)),
              ),
          }),
    )
    const runtime = yield* (options.disabled ? FtcComposition.disabled : FtcComposition.controlled)({
      repository: ProjectAssociations.make(database.db),
      folders: FtcProjectAdapters.folders(host),
      store,
      locations,
      changed: (status) =>
        Effect.sync(() => {
          statuses.push(status)
        }).pipe(Effect.andThen(options.changed ? options.changed(status) : Effect.void)),
      activate: (request) =>
        options.unavailable
          ? Effect.fail({
              code: "activation_unavailable",
              root: request.root,
              recovery: "retry",
            } satisfies FtcProject.AssociationError)
          : Effect.void,
    })
    const sessionLocations = yield* LayerMap.make((_: Location.Ref) =>
      Layer.effectContext<LocationServices, never, never>(
        Effect.die("These tests do not invoke Session Location operations"),
      ),
    )
    const session = yield* SessionV2.Service.pipe(
      Effect.provide(
        AppNodeBuilder.build(SessionV2.node, [
          [Database.node, Layer.succeed(Database.Service, database)],
          [SessionStore.node, Layer.succeed(SessionStore.Service, store)],
          [EventV2.node, Layer.succeed(EventV2.Service, events)],
          [ProjectV2.node, Layer.succeed(ProjectV2.Service, host)],
          [LocationServiceMap.node, Layer.succeed(LocationServiceMap.Service, sessionLocations)],
          [SessionExecution.node, Layer.succeed(SessionExecution.Service, runtime.execution)],
          [
            SessionV2.node,
            makeGlobalNode({
              service: SessionV2.Service,
              layer: SessionV2.layerWithAdmission(runtime.guard),
              deps: [
                Database.node,
                EventV2.node,
                ProjectV2.node,
                SessionExecution.node,
                SessionStore.node,
                LocationServiceMap.node,
                SessionProjector.node,
              ],
            }),
          ],
        ]),
      ),
    )
    return {
      runtime,
      session,
      projects: runtime.projects(session),
      commands: runtime.bind(session),
      database,
      starts,
      started,
      finish,
      twoStarted,
      statuses,
    }
  })

test("composed duplicate windows cannot bypass gate", async () => {
  await using tmp = await tmpdir()
  const otherRoot = path.join(tmp.path, "other")
  await fs.mkdir(otherRoot)
  await fs.symlink(tmp.path, path.join(otherRoot, "alias"))
  await run(
    Effect.gen(function* () {
      const f = yield* fixture(tmp.path)
      const project = yield* f.projects.openProject({ root: AbsolutePath.make(tmp.path) })
      const alias = yield* f.projects.openProject({ root: AbsolutePath.make(path.join(otherRoot, "alias")) })
      const other = yield* f.projects.openProject({ root: AbsolutePath.make(otherRoot) })
      const first = yield* f.projects.createChat(project)
      const second = yield* f.projects.createChat(alias)
      const third = yield* f.projects.createChat(other)
      const id = SessionMessage.ID.create()
      const admitted = yield* f.commands.submitPrompt({ chat: first, prompt: Prompt.make({ text: "first" }) })
      yield* Deferred.await(f.started)
      const refused = yield* f.commands.submitPrompt({ chat: second, prompt: Prompt.make({ text: "draft" }), id })
      yield* f.commands.submitPrompt({ chat: third, prompt: Prompt.make({ text: "other" }) })
      yield* Deferred.await(f.twoStarted)
      expect(project.projectID).toBe(alias.projectID)
      expect(admitted.kind).toBe("admitted")
      expect(refused).toEqual({ kind: "busy", active: first })
      expect(yield* SessionInput.find(f.database.db, id)).toBeUndefined()
      expect(f.starts.filter((id) => id === first.sessionID || id === second.sessionID)).toHaveLength(1)
      expect(f.starts).toContain(third.sessionID)
      yield* Deferred.succeed(f.finish, undefined)
      yield* f.runtime.execution.resume(first.sessionID)
      yield* f.runtime.execution.resume(third.sessionID)
      expect((yield* f.commands.active(project)).active).toBeUndefined()
      expect(f.starts).not.toContain(second.sessionID)
      expect(f.statuses.at(-1)?.active).toBeUndefined()
    }),
  )
})

test("composed Core guard refuses raw managed admission and JSON proof before writing", async () => {
  await using tmp = await tmpdir()
  await run(
    Effect.gen(function* () {
      const f = yield* fixture(tmp.path)
      const project = yield* f.projects.openProject({ root: AbsolutePath.make(tmp.path) })
      const chat = yield* f.projects.createChat(project)
      for (const proof of [undefined, {}, { ready: true, chat }]) {
        const id = SessionMessage.ID.create()
        const result = yield* f.session
          .prompt({ sessionID: chat.sessionID, id, prompt: Prompt.make({ text: "bypass" }), resume: false }, proof)
          .pipe(Effect.flip)
        expect(result).toMatchObject({ code: "managed_submit_required" })
        expect(yield* SessionInput.find(f.database.db, id)).toBeUndefined()
      }
      const orphan = yield* f.session.create({ location: { directory: AbsolutePath.make(tmp.path) } })
      expect(
        yield* f.session.prompt({ sessionID: orphan.id, prompt: Prompt.make({ text: "orphan" }) }).pipe(Effect.flip),
      ).toMatchObject({ code: "membership_unavailable" })
      expect(f.starts).toEqual([])
    }),
  )
})

test("exact retries preserve durable identity and admit-only releases its own reservation", async () => {
  await using tmp = await tmpdir()
  await run(
    Effect.gen(function* () {
      const f = yield* fixture(tmp.path)
      const project = yield* f.projects.openProject({ root: AbsolutePath.make(tmp.path) })
      const chat = yield* f.projects.createChat(project)
      const request = { chat, id: SessionMessage.ID.create(), prompt: Prompt.make({ text: "durable" }), resume: false }
      const first = yield* f.commands.submitPrompt(request)
      expect(yield* f.commands.submitPrompt(request)).toEqual(first)
      expect(f.starts).toEqual([])
      expect((yield* f.commands.active(project)).active).toBeUndefined()
      expect(
        yield* f.commands.submitPrompt({ ...request, prompt: Prompt.make({ text: "conflict" }) }).pipe(Effect.flip),
      ).toBeInstanceOf(SessionV2.PromptConflictError)
      yield* f.commands.submitPrompt({ ...request, resume: true })
      yield* Deferred.await(f.started)
      yield* f.commands.submitPrompt({ ...request, id: SessionMessage.ID.create() })
      expect((yield* f.commands.active(project)).active).toEqual(chat)
      yield* f.commands.stop(chat)
      expect((yield* f.commands.active(project)).active).toBeUndefined()
    }),
  )
})

test("disabled host preserves associations and rejects every managed execution entrance", async () => {
  await using tmp = await tmpdir()
  await run(
    Effect.gen(function* () {
      const f = yield* fixture(tmp.path, { disabled: true })
      const project = yield* f.projects.openProject({ root: AbsolutePath.make(tmp.path) })
      const chat = yield* f.projects.createChat(project)
      for (const resume of [true, false]) {
        const id = SessionMessage.ID.create()
        expect(
          yield* f.commands
            .submitPrompt({ chat, id, prompt: Prompt.make({ text: "disabled" }), resume })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "execution_disabled" })
        expect(
          yield* f.session
            .prompt({ sessionID: chat.sessionID, id, prompt: Prompt.make({ text: "disabled" }), resume })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "execution_disabled" })
        expect(yield* SessionInput.find(f.database.db, id)).toBeUndefined()
      }
      expect(yield* f.commands.resume(chat).pipe(Effect.flip)).toMatchObject({ code: "execution_disabled" })
      yield* f.runtime.execution.resume(chat.sessionID).pipe(Effect.exit)
      yield* f.runtime.execution.wake(chat.sessionID)
      yield* Effect.yieldNow
      yield* f.commands.stop(chat)
      expect(f.starts).toEqual([])
      expect(yield* f.projects.listChats(project)).toEqual([chat])
      expect(yield* f.runtime.legacy({ root: AbsolutePath.make(tmp.path) }).pipe(Effect.flip)).toMatchObject({
        code: "legacy_execution_disabled",
      })
    }),
  )
})

test("unknown legacy idle refuses new activation and never associates the root", async () => {
  await using tmp = await tmpdir()
  await run(
    Effect.gen(function* () {
      const f = yield* fixture(tmp.path, { disabled: true, unavailable: true })
      expect(yield* f.projects.openProject({ root: AbsolutePath.make(tmp.path) }).pipe(Effect.flip)).toMatchObject({
        code: "activation_unavailable",
      })
      expect(yield* ProjectAssociations.make(f.database.db).findRoot(AbsolutePath.make(tmp.path))).toBeUndefined()
      expect(f.starts).toEqual([])
    }),
  )
})

test("database reopen retains separate chats and pending inputs without automatic execution", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "session.sqlite")
  const saved = await run(
    Effect.gen(function* () {
      const f = yield* fixture(tmp.path, { filename })
      const project = yield* f.projects.openProject({ root: AbsolutePath.make(tmp.path) })
      const chats = [yield* f.projects.createChat(project), yield* f.projects.createChat(project)]
      const inputs = yield* Effect.forEach(chats, (chat, index) =>
        f.commands.submitPrompt({ chat, prompt: Prompt.make({ text: `history ${index}` }), resume: false }),
      )
      expect(f.starts).toEqual([])
      return { project, chats, inputs }
    }),
  )
  await run(
    Effect.gen(function* () {
      const f = yield* fixture(tmp.path, { filename, drain: () => Effect.void })
      expect(yield* f.projects.listChats(saved.project)).toEqual(saved.chats)
      expect((yield* f.commands.active(saved.project)).active).toBeUndefined()
      expect(f.starts).toEqual([])
      for (const result of saved.inputs) {
        if (result.kind !== "admitted") throw new Error("expected admitted input")
        expect(yield* SessionInput.find(f.database.db, result.receipt.id)).toEqual(result.receipt)
      }
      yield* f.commands.resume(saved.chats[0])
      expect(f.starts).toEqual([saved.chats[0].sessionID])
      expect((yield* f.commands.active(saved.project)).active).toBeUndefined()
    }),
  )
})

test("actual runner persists independent model histories and holds ownership through controlled tool cleanup", async () => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, "histories.sqlite")
  const saved = await run(
    Effect.gen(function* () {
      const toolStarted = yield* Deferred.make<void>()
      const toolFinish = yield* Deferred.make<void>()
      const requests: LLMRequest[] = []
      let tools = 0
      const model: LLMClientShape = {
        prepare: () => Effect.die("No transport"),
        generate: () => Effect.die("No generation shortcut"),
        stream: ((request: LLMRequest) => {
          requests.push(request)
          return Stream.fromIterable<LLMEvent>(
            requests.length === 1
              ? [
                  LLMEvent.stepStart({ index: 0 }),
                  LLMEvent.toolCall({ id: "test-tool", name: "observe", input: {} }),
                  LLMEvent.stepFinish({ index: 0, reason: "tool-calls" }),
                  LLMEvent.finish({ reason: "tool-calls" }),
                ]
              : [
                  LLMEvent.stepStart({ index: 0 }),
                  LLMEvent.textStart({ id: "text" }),
                  LLMEvent.textDelta({ id: "text", text: "controlled response" }),
                  LLMEvent.textEnd({ id: "text" }),
                  LLMEvent.stepFinish({ index: 0, reason: "stop" }),
                  LLMEvent.finish({ reason: "stop" }),
                ],
          )
        }) as LLMClientShape["stream"],
      }
      const f = yield* fixture(tmp.path, {
        filename,
        model,
        tools: {
          register: () => Effect.die("No external registration"),
          materialize: () =>
            Effect.succeed({
              definitions: [
                ToolDefinition.make({
                  name: "observe",
                  description: "Controlled no-I/O test port",
                  inputSchema: { type: "object", properties: {} },
                }),
              ],
              settle: () =>
                Effect.gen(function* () {
                  tools++
                  yield* Deferred.succeed(toolStarted, undefined)
                  yield* Deferred.await(toolFinish)
                  return { result: { type: "text", value: "observed" } as const }
                }),
            }),
        },
      })
      const project = yield* f.projects.openProject({ root: AbsolutePath.make(tmp.path) })
      const first = yield* f.projects.createChat(project)
      const second = yield* f.projects.createChat(project)
      yield* f.commands.submitPrompt({ chat: first, prompt: Prompt.make({ text: "first history" }) })
      yield* Deferred.await(toolStarted)
      expect((yield* f.commands.submitPrompt({ chat: second, prompt: Prompt.make({ text: "draft" }) })).kind).toBe(
        "busy",
      )
      expect((yield* f.commands.active(project)).active).toEqual(first)
      yield* Deferred.succeed(toolFinish, undefined)
      yield* f.runtime.execution.resume(first.sessionID)
      yield* f.commands.submitPrompt({ chat: second, prompt: Prompt.make({ text: "second history" }) })
      yield* f.runtime.execution.resume(second.sessionID)
      expect(tools).toBe(1)
      expect(requests).toHaveLength(3)
      const histories = [
        yield* f.session.messages({ sessionID: first.sessionID }),
        yield* f.session.messages({ sessionID: second.sessionID }),
      ]
      expect(JSON.stringify(histories[0])).toContain("first history")
      expect(JSON.stringify(histories[0])).not.toContain("second history")
      expect(JSON.stringify(histories[1])).toContain("second history")
      expect(JSON.stringify(histories[1])).not.toContain("first history")
      return { project, first, second, histories }
    }),
  )
  await run(
    Effect.gen(function* () {
      const f = yield* fixture(tmp.path, { filename })
      expect(yield* f.session.messages({ sessionID: saved.first.sessionID })).toEqual(saved.histories[0])
      expect(yield* f.session.messages({ sessionID: saved.second.sessionID })).toEqual(saved.histories[1])
      expect(f.starts).toEqual([])
      expect((yield* f.commands.active(saved.project)).active).toBeUndefined()
    }),
  )
})

test("owner event failure cannot leak or release a newer reservation", async () => {
  await using tmp = await tmpdir()
  await run(
    Effect.gen(function* () {
      const f = yield* fixture(tmp.path, { changed: () => Effect.die("subscriber failed") })
      const project = yield* f.projects.openProject({ root: AbsolutePath.make(tmp.path) })
      const first = yield* f.projects.createChat(project)
      const second = yield* f.projects.createChat(project)
      yield* f.commands
        .submitPrompt({ chat: first, prompt: Prompt.make({ text: "admit only" }), resume: false })
        .pipe(Effect.exit)
      expect((yield* f.commands.active(project)).active).toBeUndefined()
      expect(
        (yield* f.commands.submitPrompt({ chat: second, prompt: Prompt.make({ text: "next" }), resume: false })).kind,
      ).toBe("admitted")
    }),
  )
})

test("post-stop durable admission during cancelled callback cleanup receives its own drain", async () => {
  await using tmp = await tmpdir()
  await run(
    Effect.gen(function* () {
      const closing = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const notifying = yield* Deferred.make<void>()
      const finishNotify = yield* Deferred.make<void>()
      const settled = yield* Deferred.make<void>()
      let changes = 0
      let turns = 0
      const f = yield* fixture(tmp.path, {
        changed: () =>
          Effect.suspend(() =>
            ++changes === 3
              ? Deferred.succeed(closing, undefined).pipe(Effect.andThen(Deferred.await(release)))
              : Effect.void,
          ),
        model: {
          prepare: () => Effect.die("No transport"),
          generate: () => Effect.die("No generation shortcut"),
          stream: (() => {
            turns++
            return Stream.fromIterable<LLMEvent>([
              LLMEvent.stepStart({ index: 0 }),
              LLMEvent.textStart({ id: "text" }),
              LLMEvent.textDelta({ id: "text", text: "controlled response" }),
              LLMEvent.textEnd({ id: "text" }),
              LLMEvent.stepFinish({ index: 0, reason: "stop" }),
              LLMEvent.finish({ reason: "stop" }),
            ])
          }) as LLMClientShape["stream"],
        },
      })
      const project = yield* f.projects.openProject({ root: AbsolutePath.make(tmp.path) })
      const chat = yield* f.projects.createChat(project)
      yield* f.commands.submitPrompt({ chat, prompt: Prompt.make({ text: "before stop" }) })
      yield* Deferred.await(closing)
      yield* f.runtime.execution.wakeWithSettlement(chat.sessionID, () =>
        Deferred.succeed(notifying, undefined).pipe(Effect.andThen(Deferred.await(finishNotify))),
      )
      // Invoke the exact coordinator interruption targeted by the facade, without racing its membership lookup.
      const stopping = yield* f.runtime.execution.interrupt(chat.sessionID).pipe(Effect.forkChild)
      yield* Effect.yieldNow
      yield* Deferred.succeed(release, undefined)
      yield* Deferred.await(notifying)
      const admitted = yield* f.commands.submitPrompt({ chat, prompt: Prompt.make({ text: "after stop" }) })
      expect(admitted.kind).toBe("admitted")
      yield* f.runtime.execution.wakeWithSettlement(chat.sessionID, () =>
        Deferred.succeed(settled, undefined).pipe(Effect.asVoid),
      )
      yield* Deferred.succeed(finishNotify, undefined)
      yield* Deferred.await(settled)
      yield* Fiber.join(stopping)
      yield* f.runtime.execution.interrupt(chat.sessionID)
      expect(turns).toBe(2)
      if (admitted.kind === "admitted")
        expect((yield* SessionInput.find(f.database.db, admitted.receipt.id))?.promotedSeq).toBeDefined()
      expect(JSON.stringify(yield* f.session.messages({ sessionID: chat.sessionID }))).toContain("after stop")
      expect((yield* f.commands.active(project)).active).toBeUndefined()
    }),
  )
})

test("old completion cannot unlock a newer admission paused before durable write", async () => {
  await using tmp = await tmpdir()
  await run(
    Effect.gen(function* () {
      const f = yield* fixture(tmp.path)
      const project = yield* f.projects.openProject({ root: AbsolutePath.make(tmp.path) })
      const first = yield* f.projects.createChat(project)
      const second = yield* f.projects.createChat(project)
      yield* f.commands.submitPrompt({ chat: first, prompt: Prompt.make({ text: "first" }) })
      yield* Deferred.await(f.started)
      const entering = yield* Deferred.make<void>()
      const proceed = yield* Deferred.make<void>()
      const delayed = f.runtime.bind({
        ...f.session,
        prompt: (request, proof) =>
          Deferred.succeed(entering, undefined).pipe(
            Effect.andThen(Deferred.await(proceed)),
            Effect.andThen(f.session.prompt(request, proof)),
          ),
      })
      const next = yield* delayed
        .submitPrompt({ chat: first, prompt: Prompt.make({ text: "next" }) })
        .pipe(Effect.forkChild)
      yield* Deferred.await(entering)
      yield* Deferred.succeed(f.finish, undefined)
      yield* f.runtime.execution.resume(first.sessionID)
      const attempted = yield* f.commands.submitPrompt({ chat: second, prompt: Prompt.make({ text: "busy draft" }) })
      yield* Deferred.succeed(proceed, undefined)
      yield* Fiber.join(next)
      yield* f.runtime.execution.resume(first.sessionID)
      expect(attempted).toEqual({ kind: "busy", active: first })
      expect((yield* f.commands.active(project)).active).toBeUndefined()
    }),
  )
})

test("runtime proof is revoked after admission while the exact reservation is still held", async () => {
  await using tmp = await tmpdir()
  await run(
    Effect.gen(function* () {
      const f = yield* fixture(tmp.path)
      const project = yield* f.projects.openProject({ root: AbsolutePath.make(tmp.path) })
      const chat = yield* f.projects.createChat(project)
      const captured: Array<Parameters<SessionV2.Interface["prompt"]>> = []
      const facade = f.runtime.bind({
        ...f.session,
        prompt: (request, proof) => {
          captured.push([request, proof])
          return f.session.prompt(request, proof)
        },
      })
      yield* facade.submitPrompt({ chat, prompt: Prompt.make({ text: "captured" }) })
      yield* Deferred.await(f.started)
      expect(Object.isFrozen(captured[0][0])).toBe(true)
      expect(Object.isFrozen(captured[0][0].prompt)).toBe(true)
      expect(yield* f.session.prompt(...captured[0]).pipe(Effect.flip)).toMatchObject({
        code: "managed_submit_required",
      })
      expect((yield* f.commands.active(project)).active).toEqual(chat)
      yield* f.commands.stop(chat)
    }),
  )
})

test("tracked no-work and missing-session wakes settle without provider execution", async () => {
  await using tmp = await tmpdir()
  await run(
    Effect.gen(function* () {
      let calls = 0
      const f = yield* fixture(tmp.path, {
        model: {
          prepare: () => Effect.die("unused"),
          generate: () => Effect.die("unused"),
          stream: (() => {
            calls++
            return Stream.empty
          }) as LLMClientShape["stream"],
        },
      })
      const project = yield* f.projects.openProject({ root: AbsolutePath.make(tmp.path) })
      const chat = yield* f.projects.createChat(project)
      const done = yield* Deferred.make<void>()
      yield* f.runtime.execution.wakeWithSettlement(chat.sessionID, () =>
        Deferred.succeed(done, undefined).pipe(Effect.asVoid),
      )
      yield* Deferred.await(done)
      yield* f.runtime.execution.interrupt(chat.sessionID)
      expect(calls).toBe(0)
      expect((yield* f.commands.active(project)).active).toBeUndefined()
      const missing = yield* Deferred.make<void>()
      const missingID = SessionV2.ID.create()
      yield* f.runtime.execution.wakeWithSettlement(missingID, () =>
        Deferred.succeed(missing, undefined).pipe(Effect.asVoid),
      )
      yield* Deferred.await(missing)
      // The callback runs inside finalization; join that owner before inspecting its removal.
      yield* f.runtime.execution.interrupt(missingID)
      expect(calls).toBe(0)
      expect((yield* f.runtime.execution.active).size).toBe(0)
    }),
  )
})

test("unmanaged compatibility admits without FTC proof and uses existing execution", async () => {
  await using tmp = await tmpdir()
  await run(
    Effect.gen(function* () {
      const f = yield* fixture(tmp.path, { disabled: true, drain: () => Effect.void })
      const session = yield* f.session.create({ location: { directory: AbsolutePath.make(tmp.path) } })
      const admitted = yield* f.session.prompt({
        sessionID: session.id,
        prompt: Prompt.make({ text: "unmanaged" }),
        resume: false,
      })
      expect(yield* SessionInput.find(f.database.db, admitted.id)).toEqual(admitted)
      yield* f.session.resume(session.id)
      expect(f.starts).toEqual([session.id])
    }),
  )
})
