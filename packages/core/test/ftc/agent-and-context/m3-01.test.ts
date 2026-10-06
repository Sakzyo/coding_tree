import { expect, test } from "bun:test"
import { LLMClient, LLMEvent, Model, type LLMClientShape, type LLMRequest } from "@opencode-ai/llm"
import { route } from "@opencode-ai/llm/protocols/openai-chat"
import { Config } from "@opencode-ai/core/config"
import { Database } from "@opencode-ai/core/database/database"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNodePlatform } from "@opencode-ai/core/effect/app-node-platform"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { EventV2 } from "@opencode-ai/core/event"
import { Location } from "@opencode-ai/core/location"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { SessionV2 } from "@opencode-ai/core/session"
import { SessionEvent } from "@opencode-ai/core/session/event"
import { SessionExecution } from "@opencode-ai/core/session/execution"
import { SessionInput } from "@opencode-ai/core/session/input"
import { SessionMessage } from "@opencode-ai/core/session/message"
import { Prompt } from "@opencode-ai/core/session/prompt"
import { SessionRunCoordinator } from "@opencode-ai/core/session/run-coordinator"
import { SessionRunner } from "@opencode-ai/core/session/runner"
import { node } from "@opencode-ai/core/session/runner/llm"
import { SessionRunnerModel } from "@opencode-ai/core/session/runner/model"
import { SessionInputTable } from "@opencode-ai/core/session/sql"
import { Snapshot } from "@opencode-ai/core/snapshot"
import { SkillGuidance } from "@opencode-ai/core/skill/guidance"
import { ReferenceGuidance } from "@opencode-ai/core/reference/guidance"
import { SystemContext } from "@opencode-ai/core/system-context"
import { Deferred, Effect, Fiber, Layer, Stream } from "effect"
import { eq } from "drizzle-orm"
import { tmpdir } from "../../fixture/tmpdir"

test("admission precedes wake and exact retry reconciles", async () => {
  const tmp = await tmpdir()
  const databasePath = `${tmp.path}/session.sqlite`
  {
    await using repository = tmp
    expect(await Bun.spawn(["git", "init", "--quiet"], { cwd: repository.path }).exited).toBe(0)
    await Bun.write(`${repository.path}/README.md`, "Session boundary fixture\n")
    const order: string[] = []
    const requests: LLMRequest[] = []
    const messageID = SessionMessage.ID.create()
    await Effect.gen(function* () {
      const started = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const client = Layer.succeed(
        LLMClient.Service,
        LLMClient.Service.of({
          prepare: () => Effect.die("unused"),
          generate: () => Effect.die("unused"),
          stream: ((request: LLMRequest) => {
            requests.push(request)
            return Stream.unwrap(
              Deferred.succeed(started, undefined).pipe(
                Effect.andThen(Deferred.await(release)),
                Effect.as(
                  Stream.fromIterable([
                    LLMEvent.stepStart({ index: 0 }),
                    LLMEvent.stepFinish({ index: 0, reason: "stop" }),
                    LLMEvent.finish({ reason: "stop" }),
                  ]),
                ),
              ),
            )
          }) as LLMClientShape["stream"],
        }),
      )
      const replacements = [
        [Database.node, Database.layerFromPath(databasePath)],
        [LayerNodePlatform.llmClient, client],
        [
          SessionRunnerModel.node,
          SessionRunnerModel.layerWith(() => Effect.succeed(Model.make({ id: "fixture", provider: "fixture", route }))),
        ],
        [Location.node, Location.boundNode({ directory: AbsolutePath.make(repository.path) })],
        [Snapshot.node, Snapshot.noopLayer],
        [Config.node, Layer.succeed(Config.Service, Config.Service.of({ entries: () => Effect.succeed([]) }))],
        [SkillGuidance.node, Layer.succeed(SkillGuidance.Service, { load: () => Effect.succeed(SystemContext.empty) })],
        [
          ReferenceGuidance.node,
          Layer.succeed(ReferenceGuidance.Service, { load: () => Effect.succeed(SystemContext.empty) }),
        ],
      ] satisfies LayerNode.Replacements
      const execution = Layer.effect(
        SessionExecution.Service,
        Effect.gen(function* () {
          const runner = yield* SessionRunner.Service
          const database = yield* Database.Service
          const coordinator = yield* SessionRunCoordinator.make<SessionV2.ID, SessionRunner.RunError>({
            drain: (sessionID, force) => runner.run({ sessionID, force }),
          })
          return SessionExecution.Service.of({
            active: coordinator.active,
            resume: coordinator.run,
            interrupt: coordinator.interrupt,
            wake: (sessionID) =>
              Effect.gen(function* () {
                // Observe the committed row at the execution boundary, before scheduling any drain.
                expect(yield* SessionInput.find(database.db, messageID)).toMatchObject({ id: messageID, sessionID })
                order.push("wake")
                yield* coordinator.wake(sessionID)
              }),
          })
        }),
      ).pipe(Layer.provide(AppNodeBuilder.build(LayerNode.group([Database.node, node]), replacements)))
      const layer = AppNodeBuilder.build(LayerNode.group([Database.node, EventV2.node, SessionV2.node]), [
        ...replacements,
        [SessionExecution.node, execution],
      ])
      yield* Effect.gen(function* () {
        const session = yield* SessionV2.Service
        const events = yield* EventV2.Service
        const database = yield* Database.Service
        yield* Effect.acquireRelease(
          events.listen((event) =>
            Effect.sync(() => {
              if (event.type === SessionEvent.PromptAdmitted.type) order.push("admit")
            }),
          ),
          (unsubscribe) => unsubscribe,
        )
        const created = yield* session.create({
          location: Location.Ref.make({ directory: AbsolutePath.make(repository.path) }),
        })
        const input = { sessionID: created.id, id: messageID, prompt: Prompt.make({ text: "Pin Session admission" }) }
        expect(yield* SessionInput.find(database.db, messageID)).toBeUndefined()
        const admitted = yield* session.prompt(input)
        expect(order).toEqual(["admit", "wake"])
        yield* Deferred.await(started)
        expect(yield* session.prompt(input)).toMatchObject({
          id: admitted.id,
          sessionID: admitted.sessionID,
          admittedSeq: admitted.admittedSeq,
          timeCreated: admitted.timeCreated,
          prompt: { text: input.prompt.text },
          delivery: "steer",
        })
        expect(order).toEqual(["admit", "wake", "wake"])
        expect(requests).toHaveLength(1)
        const joined = yield* session.resume(created.id).pipe(Effect.forkChild)
        yield* Effect.yieldNow
        yield* Deferred.succeed(release, undefined)
        yield* Fiber.join(joined)
        const inputRowsForMessage = yield* database.db
          .select()
          .from(SessionInputTable)
          .where(eq(SessionInputTable.id, messageID))
          .all()
          .pipe(Effect.orDie)
        const messages = yield* session.messages({ sessionID: created.id })
        const providerTurns = messages.filter((message) => message.type === "assistant").length
        expect(inputRowsForMessage).toHaveLength(1)
        expect(inputRowsForMessage[0]?.promoted_seq).not.toBeNull()
        expect(messages.filter((message) => message.type === "user")).toHaveLength(1)
        expect(providerTurns).toBe(1)
        expect(requests.length).toBe(providerTurns)
        expect(requests[0]?.messages).toMatchObject([
          { role: "user", content: [{ type: "text", text: input.prompt.text }] },
        ])
        expect(Array.from(yield* session.active)).toEqual([])
      }).pipe(Effect.provide(layer), Effect.scoped)
    }).pipe(Effect.scoped, Effect.runPromise)
  }
  expect(await Bun.file(databasePath).exists()).toBe(false)
})
