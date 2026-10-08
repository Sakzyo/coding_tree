import { expect, test } from "bun:test"
import { FtcJava } from "@opencode-ai/schema/ftc-java"
import { FtcOperation } from "@opencode-ai/schema/ftc-operation"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { Location } from "@opencode-ai/schema/location"
import { Project } from "@opencode-ai/schema/project"
import { AbsolutePath } from "@opencode-ai/schema/schema"
import { Session } from "@opencode-ai/schema/session"
import { Deferred, Effect, Exit, Fiber, Schema, Scope } from "effect"
import { Operations } from "../../../src/ftc/operations"

const projectID = Project.ID.make("team")
const project = {
  projectID,
  canonicalRoot: AbsolutePath.make("/team"),
  location: new Location.Info({
    directory: AbsolutePath.make("/team"),
    project: { id: Project.ID.global, directory: AbsolutePath.make("/team") },
  }),
}
const chat = {
  projectID,
  chatID: FtcProject.ChatID.make("chat_robot"),
  sessionID: Session.ID.make("ses_robot"),
}
const artifact = {
  projectID,
  buildID: "build_fixture",
  sourceRevision: [{ documentID: FtcJava.DocumentID.make("doc_main"), bufferRevision: 0, diskRevision: 0 }],
  configurationRevision: "configuration_fixture",
  digest: "digest_fixture",
}
const caller = Object.freeze({})
const request = {
  projectID,
  chatID: chat.chatID,
  initiator: "agent" as const,
  controllerID: "controller_fixture",
  generation: "generation_fixture",
  action: { kind: "start" as const, opMode: "FixtureOpMode", expectedState: { fixture: "ready" } },
}

// Catches treating independent robot mode as code approval, or blocking deployment with agent controls.
test("observation blocks agent control but not separately approved deployment", () =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const dispatchCount = 0
        const operations = yield* Operations.make({
          policy: {
            check: (input) =>
              input.caller === caller
                ? Effect.succeed({
                    project,
                    chat,
                    initiator: "agent" as const,
                    robotMode: "observation" as const,
                    controllerID: request.controllerID,
                    generation: request.generation,
                    verified: true,
                    capabilities: ["deploy", "initialize", "start", "tune"] as const,
                  })
                : Effect.fail({ code: "untrusted_caller" as const }),
          },
          parameters: { check: () => Effect.void },
        })
        const start = yield* operations
          .prepareOperation({ request, robotMode: "observation", caller })
          .pipe(Effect.flip)
        expect(start.code).toBe("observation_only")
        const deploy = yield* operations.prepareOperation({
          request: { ...request, action: { kind: "deploy", artifact } },
          robotMode: "observation",
          caller,
        })
        expect(deploy.status).toBe("awaiting_approval")
        expect(dispatchCount).toBe(0)
        expect(Object.keys(operations)).toEqual(["prepareOperation"])
        expect("executeOperation" in operations).toBe(false)
      }),
    ),
  ))

const run = <A, E>(effect: Effect.Effect<A, E, Scope.Scope>) => Effect.runPromise(Effect.scoped(effect))
const fixture = (robotMode: FtcOperation.RobotMode = "actions-with-approval", initiator: "agent" | "user" = "agent") =>
  Effect.gen(function* () {
    const state = {
      grant: {
        project,
        chat,
        initiator,
        robotMode,
        controllerID: request.controllerID,
        generation: request.generation,
        verified: true,
        capabilities: ["deploy", "initialize", "start", "tune"],
      } as Operations.Grant,
      beforePolicy: Effect.void,
      beforeParameters: Effect.void,
      artifactValid: true,
      policyCalls: 0,
      parameterCalls: 0,
    }
    const operations = yield* Operations.make({
      policy: {
        check: (input) =>
          Effect.gen(function* () {
            state.policyCalls++
            yield* state.beforePolicy
            if (input.caller !== caller) return yield* Effect.fail({ code: "untrusted_caller" } as const)
            return state.grant
          }),
      },
      parameters: {
        check: (input) =>
          Effect.gen(function* () {
            state.parameterCalls++
            yield* state.beforeParameters
            // Fixture protocol accepts only these explicit values, not a guessed physical robot lifecycle.
            if (input.action.kind === "deploy") {
              if (!state.artifactValid) return yield* Effect.fail({ code: "artifact_invalid" } as const)
              return yield* Effect.void
            }
            if (
              JSON.stringify(input.action.expectedState) !== '{"fixture":"ready"}' &&
              JSON.stringify(input.action.expectedState) !== '{"a":1,"b":2}' &&
              JSON.stringify(input.action.expectedState) !== '{"b":2,"a":1}'
            )
              return yield* Effect.fail({ code: "invalid_parameters" } as const)
            if (input.action.kind === "tune") {
              if (input.action.field !== "fixtureField" || (input.action.value !== 0 && input.action.value !== false))
                return yield* Effect.fail({ code: "invalid_parameters" } as const)
              return yield* Effect.void
            }
            if (input.action.opMode !== "FixtureOpMode")
              return yield* Effect.fail({ code: "invalid_parameters" } as const)
            return yield* Effect.void
          }),
      },
    })
    return {
      operations,
      state,
      prepare: (action: FtcOperation.Action = request.action, value: FtcOperation.OperationRequest = request) =>
        operations.prepareOperation({ request: { ...value, action }, robotMode, caller }),
    }
  })

const controls: readonly FtcOperation.Action[] = [
  { kind: "initialize", opMode: "FixtureOpMode", expectedState: { fixture: "ready" } },
  request.action,
  { kind: "tune", field: "fixtureField", value: 0, expectedState: { fixture: "ready" } },
]

test.each([...controls])("agent observation rejects $kind and approval mode only prepares", (action) =>
  run(
    Effect.gen(function* () {
      const observed = yield* fixture("observation")
      expect((yield* observed.prepare(action).pipe(Effect.flip)).code).toBe("observation_only")
      expect(observed.state.parameterCalls).toBe(0)
      const eligible = yield* fixture()
      expect((yield* eligible.prepare(action)).status).toBe("awaiting_approval")
      expect(eligible.state.parameterCalls).toBe(1)
    }),
  ),
)

test("direct users may omit chat in observation and never self-approve", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture("observation", "user")
      f.state.grant = { ...f.state.grant, chat: undefined }
      const value = { ...request, initiator: "user" as const, chatID: undefined }
      const prepared = yield* f.prepare(request.action, value)
      expect(prepared.status).toBe("awaiting_approval")
      expect(prepared.initiator).toBe("user")
      expect("chatID" in prepared).toBe(false)
    }),
  ))

test.each([
  { change: { projectID: Project.ID.make("other") }, code: "project_unauthorized" },
  { change: { chatID: FtcProject.ChatID.make("chat_other") }, code: "chat_unauthorized" },
  { change: { chatID: undefined }, code: "chat_unauthorized" },
  { change: { initiator: "user" }, code: "initiator_mismatch" },
  { change: { controllerID: "other" }, code: "context_changed" },
  { change: { generation: "other" }, code: "context_changed" },
])("asserted context cannot override trusted $code", (input) =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      expect(
        (yield* f
          .prepare(request.action, { ...request, ...input.change } as FtcOperation.OperationRequest)
          .pipe(Effect.flip)).code,
      ).toBe(input.code)
      expect(f.state.parameterCalls).toBe(0)
    }),
  ),
)

test("forged caller and independent mode mismatch cannot prepare", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture("observation")
      expect(
        (yield* f.operations.prepareOperation({ request, robotMode: "observation", caller: {} }).pipe(Effect.flip))
          .code,
      ).toBe("untrusted_caller")
      expect(
        (yield* f.operations
          .prepareOperation({ request, robotMode: "actions-with-approval", caller })
          .pipe(Effect.flip)).code,
      ).toBe("robot_mode_mismatch")
      expect(f.state.parameterCalls).toBe(0)
    }),
  ))

test.each([
  { change: { verified: false }, code: "controller_unknown" },
  { change: { verified: "true" }, code: "controller_unknown" },
  { change: { controllerID: 1 }, code: "controller_unknown" },
  { change: { controllerID: "" }, code: "controller_unknown" },
  { change: { project: { ...project, projectID: Project.ID.make("other") } }, code: "project_unauthorized" },
  { change: { project: undefined }, code: "project_unauthorized" },
  { change: { chat: undefined }, code: "chat_unauthorized" },
  { change: { chat: { ...chat, projectID: Project.ID.make("other") } }, code: "chat_unauthorized" },
  { change: { chat: { ...chat, sessionID: "invalid" } }, code: "chat_unauthorized" },
])("invalid trusted identity fails with $code", (input) =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      // Deliberately malformed supplied grant; keep its runtime values at the tested boundary.
      Object.assign(f.state.grant, input.change)
      expect((yield* f.prepare().pipe(Effect.flip)).code).toBe(input.code)
      expect(f.state.parameterCalls).toBe(0)
    }),
  ),
)

test.each([controls[0], controls[2], { kind: "deploy", artifact } as const])(
  "start capability does not permit $kind",
  (action) =>
    run(
      Effect.gen(function* () {
        const f = yield* fixture()
        f.state.grant = { ...f.state.grant, capabilities: ["start"] }
        expect((yield* f.prepare(action).pipe(Effect.flip)).code).toBe("unsupported_operation")
        expect((yield* f.prepare()).status).toBe("awaiting_approval")
      }),
    ),
)

test.each([
  { projectID: "" },
  { projectID: undefined },
  { chatID: "invalid" },
  { generation: "" },
  { controllerID: " " },
  { action: { kind: "start", opMode: "", expectedState: {} } },
  { action: { kind: "start", opMode: "FixtureOpMode" } },
  { action: { kind: "start", opMode: "FixtureOpMode", expectedState: null } },
  { action: { kind: "start", opMode: "FixtureOpMode", expectedState: { value: Infinity } } },
  { action: { kind: "tune", field: "", value: 0, expectedState: {} } },
  { action: { kind: "tune", field: "fixtureField", expectedState: {} } },
  { action: { kind: "tune", field: "fixtureField", value: null, expectedState: {} } },
  { action: { kind: "tune", field: "fixtureField", value: NaN, expectedState: {} } },
  { action: { kind: "deploy", artifact: { ...artifact, digest: "" } } },
  { action: { kind: "deploy", artifact: { ...artifact, sourceRevision: [] } } },
  { action: { kind: "start", opMode: "FixtureOpMode", expectedState: {}, approved: true } },
  { authorization: { approved: true } },
])("malformed input is rejected before any trusted port ($#)", (change) =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      expect(
        (yield* f.operations
          .prepareOperation({
            request: Object.assign({ ...request }, change),
            robotMode: "actions-with-approval",
            caller,
          })
          .pipe(Effect.flip)).code,
      ).toBe("invalid_operation_input")
      expect(f.state.policyCalls).toBe(0)
    }),
  ),
)

const unsupportedParameters: FtcOperation.Action[] = [
  { kind: "start", opMode: "Unsupported", expectedState: { fixture: "ready" } },
  { kind: "start", opMode: "FixtureOpMode", expectedState: {} },
  { kind: "tune", field: "unsupported", value: 0, expectedState: { fixture: "ready" } },
  { kind: "tune", field: "fixtureField", value: 123, expectedState: { fixture: "ready" } },
]
test.each(unsupportedParameters)("required semantic port rejects unsupported parameters ($#)", (action) =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      expect((yield* f.prepare(action).pipe(Effect.flip)).code).toBe("invalid_parameters")
      expect(f.state.parameterCalls).toBe(1)
    }),
  ),
)

test.each([0, false])("accepted tuning preserves valid %p", (value) =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      expect(
        (yield* f.prepare({ kind: "tune", field: "fixtureField", value, expectedState: { fixture: "ready" } })).action,
      ).toEqual({ kind: "tune", field: "fixtureField", value, expectedState: { fixture: "ready" } })
    }),
  ),
)

test.each(["observation", "actions-with-approval"] as const)(
  "deployment requires matching artifact validation in %s",
  (mode) =>
    run(
      Effect.gen(function* () {
        const f = yield* fixture(mode)
        expect((yield* f.prepare({ kind: "deploy", artifact })).status).toBe("awaiting_approval")
        f.state.artifactValid = false
        expect((yield* f.prepare({ kind: "deploy", artifact }).pipe(Effect.flip)).code).toBe("artifact_invalid")
        f.state.artifactValid = true
        expect(
          (yield* f
            .prepare({ kind: "deploy", artifact: { ...artifact, projectID: Project.ID.make("other") } })
            .pipe(Effect.flip)).code,
        ).toBe("artifact_invalid")
      }),
    ),
)

test.each(["policy", "parameters"] as const)("ingress snapshot survives caller mutation during %s wait", (boundary) =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const entered = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const waiting = Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(release)), Effect.asVoid)
      if (boundary === "policy") f.state.beforePolicy = waiting
      if (boundary === "parameters") f.state.beforeParameters = waiting
      const input = {
        request: { ...request, action: { kind: "deploy" as const, artifact: structuredClone(artifact) } },
        robotMode: "actions-with-approval" as FtcOperation.RobotMode,
        caller,
      }
      const fiber = yield* f.operations.prepareOperation(input).pipe(Effect.forkChild)
      yield* Deferred.await(entered)
      input.robotMode = "observation"
      input.caller = {}
      input.request.controllerID = "attacker"
      input.request.generation = "attacker"
      input.request.projectID = Project.ID.make("attacker")
      input.request.chatID = FtcProject.ChatID.make("chat_attacker")
      input.request.action.artifact.digest = "attacker"
      input.request.action.artifact.sourceRevision[0].bufferRevision = 99
      yield* Deferred.succeed(release, undefined)
      const prepared = yield* Fiber.join(fiber)
      expect(prepared.controllerID).toBe("controller_fixture")
      expect(prepared.generation).toBe("generation_fixture")
      expect(prepared.projectID).toBe(projectID)
      expect(prepared.chatID).toBe(chat.chatID)
      expect(prepared.robotMode).toBe("actions-with-approval")
      expect(prepared.action).toEqual({ kind: "deploy", artifact })
      expect(Object.isFrozen(prepared)).toBe(true)
      if (prepared.action.kind === "deploy")
        expect(Object.isFrozen(prepared.action.artifact.sourceRevision[0])).toBe(true)
    }),
  ),
)

test("canonical fingerprints exclude operation IDs and bind every decision context", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const first = yield* f.prepare({ ...request.action, expectedState: { a: 1, b: 2 } })
      const equal = yield* f.prepare({ ...request.action, expectedState: { b: 2, a: 1 } })
      expect(first.operationID).not.toBe(equal.operationID)
      expect(first.contextFingerprint).toBe(equal.contextFingerprint)
      const changed = yield* f.prepare({ kind: "initialize", opMode: "FixtureOpMode", expectedState: { a: 1, b: 2 } })
      expect(changed.contextFingerprint).not.toBe(first.contextFingerprint)
      const zero = yield* f.prepare({
        ...controls[2],
        kind: "tune",
        field: "fixtureField",
        value: 0,
        expectedState: { fixture: "ready" },
      })
      const falseValue = yield* f.prepare({
        kind: "tune",
        field: "fixtureField",
        value: false,
        expectedState: { fixture: "ready" },
      })
      expect(zero.contextFingerprint).not.toBe(falseValue.contextFingerprint)
      const deployed = yield* f.prepare({ kind: "deploy", artifact })
      const artifactChanged = yield* f.prepare({
        kind: "deploy",
        artifact: { ...artifact, configurationRevision: "next" },
      })
      expect(deployed.contextFingerprint).not.toBe(artifactChanged.contextFingerprint)
    }),
  ))

test("control snapshot preserves field value state and exact OpMode across policy waits", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const entered = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      f.state.beforePolicy = Deferred.succeed(entered, undefined).pipe(
        Effect.andThen(Deferred.await(release)),
        Effect.asVoid,
      )
      const action = { kind: "tune" as const, field: "fixtureField", value: false, expectedState: { fixture: "ready" } }
      const preparing = yield* f.prepare(action).pipe(Effect.forkChild)
      yield* Deferred.await(entered)
      action.field = "attacker"
      action.value = true
      action.expectedState.fixture = "attacker"
      yield* Deferred.succeed(release, undefined)
      const prepared = yield* Fiber.join(preparing)
      expect(prepared.action).toEqual({
        kind: "tune",
        field: "fixtureField",
        value: false,
        expectedState: { fixture: "ready" },
      })
      expect(Object.isFrozen(prepared.action)).toBe(true)
      if (prepared.action.kind === "tune") expect(Object.isFrozen(prepared.action.expectedState)).toBe(true)
    }),
  ))

test.each(["project", "chat", "initiator", "controller", "generation", "mode"] as const)(
  "fingerprint binds matched %s context independently of approval",
  (field) =>
    run(
      Effect.gen(function* () {
        const f = yield* fixture()
        const first = yield* f.prepare()
        const changed: FtcOperation.OperationRequest = {
          ...request,
          projectID: field === "project" ? Project.ID.make("other") : projectID,
          chatID: field === "chat" ? FtcProject.ChatID.make("chat_other") : chat.chatID,
          initiator: field === "initiator" ? "user" : "agent",
          controllerID: field === "controller" ? "other" : request.controllerID,
          generation: field === "generation" ? "other" : request.generation,
        }
        f.state.grant = {
          ...f.state.grant,
          project: { ...project, projectID: changed.projectID },
          chat: { ...chat, projectID: changed.projectID, chatID: changed.chatID! },
          initiator: changed.initiator,
          controllerID: changed.controllerID,
          generation: changed.generation,
          robotMode: field === "mode" ? "observation" : "actions-with-approval",
        }
        const action: FtcOperation.Action = field === "mode" ? { kind: "deploy", artifact } : request.action
        const initial = field === "mode" ? yield* fixture() : undefined
        const comparison = initial ? yield* initial.prepare(action) : first
        const second = yield* f.operations.prepareOperation({
          request: { ...changed, action },
          robotMode: f.state.grant.robotMode,
          caller,
        })
        expect(second.contextFingerprint).not.toBe(comparison.contextFingerprint)
        expect(second.status).toBe("awaiting_approval")
      }),
    ),
)

test.each(["policy", "parameters"] as const)(
  "caller cancellation releases %s without closing other preparations",
  (boundary) =>
    run(
      Effect.gen(function* () {
        const f = yield* fixture()
        const entered = yield* Deferred.make<void>()
        const resource = { released: 0 }
        const waiting = Effect.acquireUseRelease(
          Effect.void,
          () => Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never)),
          () =>
            Effect.sync(() => {
              resource.released++
            }),
        )
        if (boundary === "policy") f.state.beforePolicy = waiting
        if (boundary === "parameters") f.state.beforeParameters = waiting
        const cancelled = yield* f.prepare().pipe(Effect.forkChild)
        yield* Deferred.await(entered)
        f.state.beforePolicy = Effect.void
        f.state.beforeParameters = Effect.void
        const other = yield* f.prepare().pipe(Effect.forkChild)
        yield* Fiber.interrupt(cancelled)
        expect(resource.released).toBe(1)
        expect(Exit.isFailure(yield* Fiber.await(cancelled))).toBe(true)
        expect((yield* Fiber.join(other)).status).toBe("awaiting_approval")
        expect((yield* f.prepare()).status).toBe("awaiting_approval")
      }),
    ),
)

test.each(["policy", "parameters"] as const)(
  "owner disposal waits through %s resource cleanup and blocks late retention",
  (boundary) =>
    run(
      Effect.gen(function* () {
        const owner = yield* Scope.make()
        const f = yield* fixture().pipe(Scope.provide(owner))
        const other = yield* fixture()
        yield* f.prepare()
        const entered = yield* Deferred.make<void>()
        const cleaning = yield* Deferred.make<void>()
        const release = yield* Deferred.make<void>()
        const state = { released: false, closed: false }
        const waiting = Effect.acquireUseRelease(
          Effect.void,
          () => Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never)),
          () =>
            Deferred.succeed(cleaning, undefined).pipe(
              Effect.andThen(Deferred.await(release)),
              Effect.andThen(
                Effect.sync(() => {
                  state.released = true
                }),
              ),
            ),
        )
        if (boundary === "policy") f.state.beforePolicy = waiting
        if (boundary === "parameters") f.state.beforeParameters = waiting
        const callerFiber = yield* f.prepare().pipe(Effect.forkChild)
        yield* Deferred.await(entered)
        const closing = yield* Scope.close(owner, Exit.void).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              state.closed = true
            }),
          ),
          Effect.forkChild,
        )
        yield* Deferred.await(cleaning)
        expect(state.closed).toBe(false)
        expect(state.released).toBe(false)
        expect((yield* f.prepare().pipe(Effect.flip)).code).toBe("owner_closed")
        expect((yield* other.prepare()).status).toBe("awaiting_approval")
        yield* Deferred.succeed(release, undefined)
        yield* Fiber.join(closing)
        expect(state.closed).toBe(true)
        expect(state.released).toBe(true)
        expect(Exit.isFailure(yield* Fiber.await(callerFiber))).toBe(true)
        expect((yield* f.prepare().pipe(Effect.flip)).code).toBe("owner_closed")
      }),
    ),
)

test.each(["policy", "parameters"] as const)("caller interruption awaits asynchronous %s cleanup", (boundary) =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const entered = yield* Deferred.make<void>()
      const cleaning = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const state = { interrupted: false, released: false }
      const waiting = Effect.acquireUseRelease(
        Effect.void,
        () => Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never)),
        () =>
          Deferred.succeed(cleaning, undefined).pipe(
            Effect.andThen(Deferred.await(release)),
            Effect.andThen(
              Effect.sync(() => {
                state.released = true
              }),
            ),
          ),
      )
      if (boundary === "policy") f.state.beforePolicy = waiting
      if (boundary === "parameters") f.state.beforeParameters = waiting
      const preparing = yield* f.prepare().pipe(Effect.forkChild)
      yield* Deferred.await(entered)
      const interrupting = yield* Fiber.interrupt(preparing).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            state.interrupted = true
          }),
        ),
        Effect.forkChild,
      )
      yield* Deferred.await(cleaning)
      expect(state.interrupted).toBe(false)
      expect(state.released).toBe(false)
      f.state.beforePolicy = Effect.void
      f.state.beforeParameters = Effect.void
      expect((yield* f.prepare()).status).toBe("awaiting_approval")
      yield* Deferred.succeed(release, undefined)
      yield* Fiber.join(interrupting)
      expect(state.interrupted).toBe(true)
      expect(state.released).toBe(true)
      expect(Exit.isFailure(yield* Fiber.await(preparing))).toBe(true)
    }),
  ),
)

test("facade reuses serializable canonical schemas and exact emitted ID prefix", async () => {
  const schema = await import("@opencode-ai/schema")
  expect(schema.FtcOperation).toBe(FtcOperation)
  expect(Operations.RobotMode).toBe(FtcOperation.RobotMode)
  expect(Operations.OperationRequest).toBe(FtcOperation.OperationRequest)
  expect(Operations.PreparedOperation).toBe(FtcOperation.PreparedOperation)
  expect(Operations.OperationError).toBe(FtcOperation.OperationError)
  expect(Operations.Action).toBe(FtcOperation.Action)
  expect(Operations.DeploymentArtifactContext).toBe(FtcOperation.DeploymentArtifactContext)
  expect(Operations.OperationID).toBe(FtcOperation.OperationID)
  expect(Operations.Status).toBe(FtcOperation.Status)
  expect(Schema.is(FtcOperation.OperationID)(FtcOperation.OperationID.create())).toBe(true)
  expect(Schema.is(FtcOperation.OperationID)("operationForged")).toBe(false)
  expect(Schema.encodeSync(FtcOperation.OperationError)({ code: "owner_closed", chatID: undefined })).toEqual({
    code: "owner_closed",
  })
  expect("caller" in FtcOperation.OperationRequest.fields).toBe(false)
})
