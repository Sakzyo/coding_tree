import { expect, test } from "bun:test"
import { FtcJava } from "@opencode-ai/schema/ftc-java"
import { FtcOperation } from "@opencode-ai/schema/ftc-operation"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { Session } from "@opencode-ai/schema/session"
import { Location } from "@opencode-ai/schema/location"
import { Project } from "@opencode-ai/schema/project"
import { AbsolutePath } from "@opencode-ai/schema/schema"
import { Cause, Deferred, Effect, Exit, Fiber, Schema, Scope } from "effect"
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
const artifact = {
  projectID,
  buildID: "displayed-build",
  sourceRevision: [{ documentID: FtcJava.DocumentID.make("doc_main"), bufferRevision: 0, diskRevision: 0 }],
  configurationRevision: "displayed-configuration",
  digest: "displayed-digest",
}
const request = {
  projectID,
  initiator: "user" as const,
  controllerID: "displayed-controller",
  generation: "displayed-generation",
  action: { kind: "deploy" as const, artifact },
}
const caller = Object.freeze({})
type Decision = {
  operationID: FtcOperation.OperationID
  contextFingerprint: string
  decision: "deploy" | "approve" | "reject"
}
type Revocation = Omit<Decision, "decision"> & { reason: "context_changed" | "approval_rejected" }
type Approval = {
  claim: (event: object) => Decision | FtcOperation.OperationError
  observe: (revoke: (input: Revocation) => void) => Effect.Effect<void, FtcOperation.OperationError, Scope.Scope>
  now: Effect.Effect<number, FtcOperation.OperationError, Scope.Scope>
  deadline: (input: {
    prepared: FtcOperation.PreparedOperation
    claimedAt: number
  }) => Effect.Effect<number, FtcOperation.OperationError, Scope.Scope>
}
// Test-only missing-behavior guard: the real owner is always exercised; no approval is simulated.
const approve = (
  operations: Operations.Interface,
  prepared: FtcOperation.PreparedOperation,
  userEvent: object,
): Effect.Effect<FtcOperation.PreparedOperation, FtcOperation.OperationError> => {
  const owner = operations as Operations.Interface & {
    approveOperation?: (input: {
      operationID: FtcOperation.OperationID
      contextFingerprint: string
      userEvent: object
    }) => Effect.Effect<FtcOperation.PreparedOperation, FtcOperation.OperationError>
  }
  return owner.approveOperation
    ? owner.approveOperation({
        operationID: prepared.operationID,
        contextFingerprint: prepared.contextFingerprint,
        userEvent,
      })
    : Effect.fail({ code: "approval_unavailable" } as const)
}
const run = <A, E>(effect: Effect.Effect<A, E, Scope.Scope>) => Effect.runPromise(Effect.scoped(effect))
const fixture = (
  change: Partial<Approval> | null = {},
  mode: FtcOperation.RobotMode = "actions-with-approval",
  context: FtcOperation.OperationRequest = request,
) =>
  Effect.gen(function* () {
    const events = new Map<object, Decision>()
    const state = {
      context,
      time: 10,
      expires: 20,
      claims: 0,
      registered: false,
      released: 0,
      revoke: (_input: Revocation) => {},
      onClaim: () => {},
    }
    const approval: Approval = {
      claim: (event) => {
        state.claims++
        const decision = events.get(event)
        if (!decision) return { code: "untrusted_approval" }
        events.delete(event)
        state.onClaim()
        return decision
      },
      observe: (revoke) =>
        Effect.gen(function* () {
          state.revoke = revoke
          state.registered = true
          yield* Effect.addFinalizer(() =>
            Effect.sync(() => {
              state.registered = false
              state.released++
            }),
          )
        }),
      now: Effect.sync(() => state.time),
      deadline: () => Effect.sync(() => state.expires),
      ...change,
    }
    const ports = {
      policy: {
        check: () =>
          Effect.succeed({
            project: { ...project, projectID: state.context.projectID },
            ...(state.context.chatID === undefined
              ? {}
              : {
                  chat: {
                    projectID: state.context.projectID,
                    chatID: state.context.chatID,
                    sessionID: Session.ID.make("ses_robot"),
                  },
                }),
            initiator: state.context.initiator,
            robotMode: mode,
            controllerID: state.context.controllerID,
            generation: state.context.generation,
            verified: true,
            capabilities: ["deploy", "initialize", "start", "tune"] as const,
          }),
      },
      parameters: { check: () => Effect.void },
      ...(change === null ? {} : { approval }),
    }
    const operations = yield* Operations.make(ports)
    yield* Effect.yieldNow
    expect("approveOperation" in operations).toBe(true)
    const prepare = (action: FtcOperation.Action = state.context.action) =>
      operations.prepareOperation({ request: { ...state.context, action }, robotMode: mode, caller })
    const event = (prepared: FtcOperation.PreparedOperation, decision: Decision["decision"] = "deploy") => {
      const token = Object.freeze({})
      events.set(
        token,
        Object.freeze({ operationID: prepared.operationID, contextFingerprint: prepared.contextFingerprint, decision }),
      )
      return token
    }
    return { operations, state, prepare, event, events, approval }
  })

// Catches accepting a substituted artifact/target, reusing consent or admitting caller-created events.
test("Deploy click authorizes only the displayed build and target", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const prepared = yield* f.prepare()
      const token = f.event(prepared)
      const accepted = yield* approve(f.operations, prepared, token).pipe(Effect.exit)
      expect(Exit.isSuccess(accepted)).toBe(true)
      if (Exit.isFailure(accepted)) return
      const approved = accepted.value
      const displayedDigest = "displayed-digest"
      expect(approved.action.kind).toBe("deploy")
      if (approved.action.kind !== "deploy") return
      expect(approved.action.artifact.digest).toBe(displayedDigest)
      expect(approved.controllerID).toBe("displayed-controller")
      expect(approved).toBe(prepared)
      const reused = yield* approve(f.operations, prepared, token).pipe(Effect.flip)
      expect(reused.code).toBe("approval_consumed")
      const fresh = yield* f.prepare()
      const forged = yield* approve(f.operations, fresh, {}).pipe(Effect.flip)
      expect(forged.code).toBe("untrusted_approval")
    }),
  ))

// Removing exact pair checks, tombstones, readiness, finite guards or owned cleanup breaks the respective cases below.
test.each(["observation", "actions-with-approval"] as const)("Deploy requires one deliberate event in %s", (mode) =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture({}, mode)
      const p = yield* f.prepare()
      const accepted = yield* approve(f.operations, p, f.event(p))
      expect(accepted.action).toEqual({ kind: "deploy", artifact })
      expect(accepted.robotMode).toBe(mode)
      expect(accepted.status).toBe("awaiting_approval")
      expect(f.state.claims).toBe(1)
      expect(Object.keys(f.operations)).toEqual(["prepareOperation", "approveOperation"])
      expect(Object.isFrozen(accepted.action)).toBe(true)
    }),
  ),
)

test.each([
  { kind: "initialize", opMode: "DisplayOpMode", expectedState: { ready: true } },
  { kind: "start", opMode: "DisplayOpMode", expectedState: { ready: true } },
  { kind: "tune", field: "gain", value: false, expectedState: { ready: true } },
] as const)("specific approval retains exact $kind action", (action) =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const p = yield* f.prepare(action)
      expect((yield* approve(f.operations, p, f.event(p, "approve"))).action).toEqual(action)
      const other = yield* f.prepare(action)
      expect((yield* approve(f.operations, other, f.event(other, "deploy")).pipe(Effect.flip)).code).toBe(
        "untrusted_approval",
      )
      expect((yield* approve(f.operations, other, f.event(other, "approve")).pipe(Effect.flip)).code).toBe(
        "approval_cancelled",
      )
    }),
  ),
)

test.each(["plain", "copied", "serialized", "code", "wrong-owner"])("%s events grant no consent", (kind) =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const p = yield* f.prepare()
      const token = f.event(p)
      const other = yield* fixture()
      const alien = yield* other.prepare()
      const forged =
        kind === "wrong-owner"
          ? other.event(alien)
          : kind === "code"
            ? { approved: true, purpose: "code" }
            : kind === "copied"
              ? { ...token }
              : kind === "serialized"
                ? JSON.parse(JSON.stringify(token))
                : {}
      expect((yield* approve(f.operations, p, forged).pipe(Effect.flip)).code).toBe("untrusted_approval")
      expect((yield* approve(f.operations, p, token)).operationID).toBe(p.operationID)
    }),
  ),
)

test("unknown and caller-mismatched contexts do not claim an event", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const p = yield* f.prepare()
      const token = f.event(p)
      expect(
        (yield* approve(
          f.operations,
          { ...p, operationID: FtcOperation.OperationID.make("operation_unknown") },
          token,
        ).pipe(Effect.flip)).code,
      ).toBe("operation_unknown")
      expect(
        (yield* approve(f.operations, { ...p, contextFingerprint: "a".repeat(64) }, token).pipe(Effect.flip)).code,
      ).toBe("context_changed")
      expect(f.state.claims).toBe(0)
      expect((yield* approve(f.operations, p, token)).operationID).toBe(p.operationID)
    }),
  ))

test("same hash never transfers events between different operation IDs", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const first = yield* f.prepare()
      const second = yield* f.prepare()
      expect(first.contextFingerprint).toBe(second.contextFingerprint)
      expect(first.operationID).not.toBe(second.operationID)
      expect((yield* approve(f.operations, second, f.event(first)).pipe(Effect.flip)).code).toBe("context_changed")
      expect((yield* approve(f.operations, first, f.event(first)).pipe(Effect.flip)).code).toBe("context_changed")
      expect((yield* approve(f.operations, second, f.event(second))).operationID).toBe(second.operationID)
    }),
  ))

const contexts: { category: string; context: FtcOperation.OperationRequest; mode?: FtcOperation.RobotMode }[] = [
  {
    category: "project",
    context: {
      ...request,
      projectID: Project.ID.make("other"),
      action: { kind: "deploy", artifact: { ...artifact, projectID: Project.ID.make("other") } },
    },
  },
  { category: "chat", context: { ...request, chatID: FtcProject.ChatID.make("chat_other") } },
  { category: "initiator", context: { ...request, initiator: "agent", chatID: FtcProject.ChatID.make("chat_robot") } },
  { category: "mode", context: request, mode: "observation" },
  { category: "target", context: { ...request, controllerID: "other-controller" } },
  { category: "generation", context: { ...request, generation: "other-generation" } },
  {
    category: "build",
    context: { ...request, action: { kind: "deploy", artifact: { ...artifact, buildID: "other-build" } } },
  },
  {
    category: "digest",
    context: { ...request, action: { kind: "deploy", artifact: { ...artifact, digest: "other-digest" } } },
  },
  {
    category: "source",
    context: {
      ...request,
      action: {
        kind: "deploy",
        artifact: { ...artifact, sourceRevision: [{ ...artifact.sourceRevision[0], bufferRevision: 1 }] },
      },
    },
  },
  {
    category: "configuration",
    context: {
      ...request,
      action: { kind: "deploy", artifact: { ...artifact, configurationRevision: "other-config" } },
    },
  },
  {
    category: "kind",
    context: { ...request, action: { kind: "initialize", opMode: "DisplayOpMode", expectedState: { ready: true } } },
  },
  {
    category: "opMode",
    context: { ...request, action: { kind: "start", opMode: "OtherOpMode", expectedState: { ready: true } } },
  },
  {
    category: "field",
    context: { ...request, action: { kind: "tune", field: "other-gain", value: 0, expectedState: { ready: true } } },
  },
  {
    category: "value",
    context: { ...request, action: { kind: "tune", field: "gain", value: false, expectedState: { ready: true } } },
  },
  {
    category: "state",
    context: { ...request, action: { kind: "start", opMode: "DisplayOpMode", expectedState: { ready: false } } },
  },
]
test.each(contexts)("exact $category context revocation is irreversible before during and after acceptance", (input) =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture({}, input.mode, input.context)
      for (const phase of ["before", "during", "after"]) {
        const p = yield* f.prepare()
        const token = f.event(p, p.action.kind === "deploy" ? "deploy" : "approve")
        const revoke = () =>
          f.state.revoke({
            operationID: p.operationID,
            contextFingerprint: p.contextFingerprint,
            reason: "context_changed",
          })
        const entered = yield* Deferred.make<void>()
        const release = yield* Deferred.make<void>()
        if (phase === "during")
          f.approval.deadline = () =>
            Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(release)), Effect.as(20))
        if (phase === "before") revoke()
        if (phase === "after") yield* approve(f.operations, p, token)
        const waiting = phase === "during" ? yield* approve(f.operations, p, token).pipe(Effect.forkChild) : undefined
        if (waiting) yield* Deferred.await(entered)
        revoke()
        // A notification for a changed-away/back binding cannot resurrect this original pair.
        f.state.revoke({ operationID: p.operationID, contextFingerprint: "b".repeat(64), reason: "approval_rejected" })
        if (waiting) {
          yield* Deferred.succeed(release, undefined)
          expect((yield* Fiber.join(waiting).pipe(Effect.flip)).code).toBe("context_changed")
          f.approval.deadline = () => Effect.succeed(20)
        }
        expect((yield* approve(f.operations, p, f.event(p)).pipe(Effect.flip)).code).toBe("context_changed")
        expect(p.controllerID).toBe(input.context.controllerID)
        expect(p.action).toEqual(input.context.action)
      }
    }),
  ),
)

test("unknown exact notifications cannot revoke a different binding", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const p = yield* f.prepare()
      f.state.revoke({
        operationID: FtcOperation.OperationID.make("operation_other"),
        contextFingerprint: p.contextFingerprint,
        reason: "context_changed",
      })
      f.state.revoke({ operationID: p.operationID, contextFingerprint: "a".repeat(64), reason: "approval_rejected" })
      expect((yield* approve(f.operations, p, f.event(p))).operationID).toBe(p.operationID)
    }),
  ))

test.each(["decision", "callback", "accepted"])("trusted rejection via %s retires the exact binding", (via) =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const p = yield* f.prepare()
      if (via === "accepted") yield* approve(f.operations, p, f.event(p))
      if (via !== "decision")
        f.state.revoke({
          operationID: p.operationID,
          contextFingerprint: p.contextFingerprint,
          reason: "approval_rejected",
        })
      expect((yield* approve(f.operations, p, f.event(p, "reject")).pipe(Effect.flip)).code).toBe("approval_rejected")
      f.state.revoke({
        operationID: p.operationID,
        contextFingerprint: p.contextFingerprint,
        reason: "context_changed",
      })
      expect((yield* approve(f.operations, p, f.event(p)).pipe(Effect.flip)).code).toBe("approval_rejected")
    }),
  ),
)

test.each([
  { now: 19, deadline: 20, want: "accepted" },
  { now: 20, deadline: 20, want: "approval_expired" },
  { now: 21, deadline: 20, want: "approval_expired" },
  { now: 10, deadline: 10, want: "approval_expired" },
  { now: 10, deadline: 9, want: "approval_expired" },
  { now: NaN, deadline: 20, want: "approval_unavailable" },
  { now: Infinity, deadline: 20, want: "approval_unavailable" },
  { now: 10, deadline: NaN, want: "approval_unavailable" },
  { now: 10, deadline: Infinity, want: "approval_unavailable" },
])("injected time $now and deadline $deadline yield $want", (input) =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      f.state.time = input.now
      f.state.expires = input.deadline
      const p = yield* f.prepare()
      const result = yield* approve(f.operations, p, f.event(p)).pipe(Effect.exit)
      expect(Exit.isSuccess(result)).toBe(input.want === "accepted")
      if (Exit.isFailure(result))
        expect(Cause.findErrorOption(result.cause).pipe((x) => (x._tag === "Some" ? x.value.code : "defect"))).toBe(
          input.want,
        )
    }),
  ),
)

test("clock advance during policy and lazy accepted expiry retire consent", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const p = yield* f.prepare()
      f.approval.deadline = () =>
        Effect.sync(() => {
          f.state.time = 20
          return 20
        })
      expect((yield* approve(f.operations, p, f.event(p)).pipe(Effect.flip)).code).toBe("approval_expired")
      f.state.time = 10
      f.approval.deadline = () => Effect.succeed(20)
      const accepted = yield* f.prepare()
      yield* approve(f.operations, accepted, f.event(accepted))
      f.state.time = 20
      expect((yield* approve(f.operations, accepted, {}).pipe(Effect.flip)).code).toBe("approval_expired")
      f.state.time = 10
      expect((yield* approve(f.operations, accepted, f.event(accepted)).pipe(Effect.flip)).code).toBe(
        "approval_expired",
      )
    }),
  ))

test("synchronous claim reentrancy cannot overwrite revocation", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const p = yield* f.prepare()
      f.state.onClaim = () =>
        f.state.revoke({
          operationID: p.operationID,
          contextFingerprint: p.contextFingerprint,
          reason: "context_changed",
        })
      expect((yield* approve(f.operations, p, f.event(p)).pipe(Effect.flip)).code).toBe("context_changed")
    }),
  ))

test("at most one acceptance wins and unrelated operations progress", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const p = yield* f.prepare()
      const entered = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      f.approval.deadline = ({ prepared }) =>
        prepared.operationID === p.operationID
          ? Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(release)), Effect.as(20))
          : Effect.succeed(20)
      const first = yield* approve(f.operations, p, f.event(p)).pipe(Effect.forkChild)
      yield* Deferred.await(entered)
      const unused = f.event(p)
      expect((yield* approve(f.operations, p, unused).pipe(Effect.flip)).code).toBe("approval_consumed")
      expect(f.events.has(unused)).toBe(true)
      const other = yield* f.prepare()
      expect((yield* approve(f.operations, other, f.event(other))).operationID).toBe(other.operationID)
      yield* Deferred.succeed(release, undefined)
      expect((yield* Fiber.join(first)).operationID).toBe(p.operationID)
      expect((yield* approve(f.operations, p, unused).pipe(Effect.flip)).code).toBe("approval_consumed")
    }),
  ))

test("approval envelope and captured decision survive mutation during waits", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const p = yield* f.prepare()
      const entered = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      f.approval.deadline = ({ prepared, claimedAt }) => {
        expect(prepared).toBe(p)
        expect(claimedAt).toBe(10)
        return Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(release)), Effect.as(20))
      }
      const token = {}
      const captured = {
        operationID: p.operationID,
        contextFingerprint: p.contextFingerprint,
        decision: "deploy" as Decision["decision"],
      }
      f.events.set(token, captured)
      const input = { ...p }
      const accepting = yield* approve(f.operations, input, token).pipe(Effect.forkChild)
      yield* Deferred.await(entered)
      input.operationID = FtcOperation.OperationID.make("operation_attacker")
      input.contextFingerprint = "a".repeat(64)
      captured.operationID = input.operationID
      captured.contextFingerprint = input.contextFingerprint
      captured.decision = "reject"
      yield* Deferred.succeed(release, undefined)
      expect(yield* Fiber.join(accepting)).toBe(p)
    }),
  ))

test.each(["now", "deadline"] as const)("canonical %s failure and defect remain distinguishable", (boundary) =>
  run(
    Effect.gen(function* () {
      for (const defect of [false, true]) {
        const f = yield* fixture()
        const failing = defect ? Effect.die("producer-defect") : Effect.fail({ code: "invalid_parameters" } as const)
        if (boundary === "now") f.approval.now = failing
        if (boundary === "deadline") f.approval.deadline = () => failing
        const p = yield* f.prepare()
        const token = f.event(p)
        const failed = yield* approve(f.operations, p, token).pipe(Effect.exit)
        expect(Exit.isFailure(failed)).toBe(true)
        if (Exit.isFailure(failed)) {
          expect(Cause.hasDies(failed.cause)).toBe(defect)
          if (!defect)
            expect(
              Cause.findErrorOption(failed.cause).pipe((x) => (x._tag === "Some" ? x.value.code : "missing")),
            ).toBe("invalid_parameters")
        }
        f.approval.now = Effect.succeed(10)
        f.approval.deadline = () => Effect.succeed(20)
        if (boundary === "deadline")
          expect((yield* approve(f.operations, p, f.event(p)).pipe(Effect.flip)).code).toBe("approval_cancelled")
        if (boundary === "now") expect((yield* approve(f.operations, p, token)).operationID).toBe(p.operationID)
      }
    }),
  ),
)

test.each(["absent", "pending", "failed", "malformed", "malformed-result"])(
  "%s observer cannot make approval ready",
  (kind) =>
    run(
      Effect.gen(function* () {
        // Preserve intentionally malformed adapter values at this runtime boundary.
        const invalidObserver: Partial<Approval> = {}
        Object.assign(invalidObserver, { observe: () => (kind === "malformed" ? undefined : Effect.succeed(true)) })
        const change =
          kind === "absent"
            ? null
            : kind === "pending"
              ? { observe: () => Effect.never }
              : kind === "failed"
                ? { observe: () => Effect.fail({ code: "invalid_parameters" } as const) }
                : kind === "malformed"
                  ? invalidObserver
                  : invalidObserver
        const f = yield* fixture(change)
        const p = yield* f.prepare()
        expect((yield* approve(f.operations, p, f.event(p)).pipe(Effect.flip)).code).toBe("approval_unavailable")
        expect(f.state.claims).toBe(0)
      }),
    ),
)

// Actual Scope finalizers (not just acquireUseRelease) catch provision into the wrong lifetime.
test.each(["caller", "owner"] as const)(
  "%s interruption joins owned scoped deadline cleanup and retires admission",
  (who) =>
    run(
      Effect.gen(function* () {
        const owner = yield* Scope.make()
        const entered = yield* Deferred.make<void>()
        const cleaning = yield* Deferred.make<void>()
        const release = yield* Deferred.make<void>()
        const state = { completed: false, released: false }
        const f = yield* fixture({
          deadline: () =>
            Effect.gen(function* () {
              yield* Effect.addFinalizer(() =>
                Deferred.succeed(cleaning, undefined).pipe(
                  Effect.andThen(Deferred.await(release)),
                  Effect.andThen(
                    Effect.sync(() => {
                      state.released = true
                    }),
                  ),
                ),
              )
              yield* Deferred.succeed(entered, undefined)
              return yield* Effect.never
            }),
        }).pipe(Scope.provide(owner))
        const p = yield* f.prepare()
        const accepting = yield* approve(f.operations, p, f.event(p)).pipe(Effect.forkChild)
        yield* Deferred.await(entered)
        const stopping = yield* (who === "caller" ? Fiber.interrupt(accepting) : Scope.close(owner, Exit.void)).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              state.completed = true
            }),
          ),
          Effect.forkChild,
        )
        yield* Deferred.await(cleaning)
        expect(state.completed).toBe(false)
        expect(state.released).toBe(false)
        expect((yield* approve(f.operations, p, f.event(p)).pipe(Effect.flip)).code).toBe(
          who === "owner" ? "owner_closed" : "approval_cancelled",
        )
        const other = yield* fixture()
        const independent = yield* other.prepare()
        expect((yield* approve(other.operations, independent, other.event(independent))).operationID).toBe(
          independent.operationID,
        )
        yield* Deferred.succeed(release, undefined)
        yield* Fiber.join(stopping)
        expect(state.released).toBe(true)
        const exit = yield* Fiber.await(accepting)
        expect(Exit.isFailure(exit)).toBe(true)
        if (Exit.isFailure(exit)) expect(Cause.hasInterrupts(exit.cause)).toBe(true)
        yield* Scope.close(owner, Exit.void)
      }),
    ),
)

test.each(["preclaim", "postclaim"] as const)("scoped %s clock cleanup belongs to the attempt", (phase) =>
  run(
    Effect.gen(function* () {
      const cleaning = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const state = { reads: 0, completed: false }
      const f = yield* fixture({
        now: Effect.gen(function* () {
          state.reads++
          if (state.reads !== (phase === "preclaim" ? 1 : 2)) return 10
          yield* Effect.addFinalizer(() =>
            Deferred.succeed(cleaning, undefined).pipe(Effect.andThen(Deferred.await(release))),
          )
          return 10
        }),
      })
      const p = yield* f.prepare()
      const accepting = yield* approve(f.operations, p, f.event(p)).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            state.completed = true
          }),
        ),
        Effect.forkChild,
      )
      yield* Deferred.await(cleaning)
      expect(state.completed).toBe(false)
      expect((yield* approve(f.operations, p, {}).pipe(Effect.flip)).code).toBe("approval_consumed")
      yield* Deferred.succeed(release, undefined)
      expect(yield* Fiber.join(accepting)).toBe(p)
    }),
  ),
)

test.each(["revocation", "owner"] as const)("late domain failure after held cleanup preserves %s precedence", (kind) =>
  run(
    Effect.gen(function* () {
      const owner = yield* Scope.make()
      const cleaning = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const f = yield* fixture({
        deadline: () =>
          Effect.gen(function* () {
            yield* Effect.addFinalizer(() =>
              Deferred.succeed(cleaning, undefined).pipe(Effect.andThen(Deferred.await(release))),
            )
            return yield* Effect.fail({ code: "invalid_parameters" } as const)
          }),
      }).pipe(Scope.provide(owner))
      const p = yield* f.prepare()
      const accepting = yield* approve(f.operations, p, f.event(p)).pipe(Effect.forkChild)
      yield* Deferred.await(cleaning)
      if (kind === "revocation")
        f.state.revoke({
          operationID: p.operationID,
          contextFingerprint: p.contextFingerprint,
          reason: "context_changed",
        })
      const closing = kind === "owner" ? yield* Scope.close(owner, Exit.void).pipe(Effect.forkChild) : undefined
      yield* Effect.yieldNow
      yield* Deferred.succeed(release, undefined)
      const failed = yield* Fiber.await(accepting)
      expect(Exit.isFailure(failed)).toBe(true)
      if (Exit.isFailure(failed) && !Cause.hasInterrupts(failed.cause)) {
        const code = Cause.findErrorOption(failed.cause).pipe((x) => (x._tag === "Some" ? x.value.code : "missing"))
        // Matching failure retired first, so revocation during cleanup cannot replace cancellation.
        expect(code).toBe(kind === "owner" ? "owner_closed" : "invalid_parameters")
      }
      if (closing) yield* Fiber.join(closing)
      expect((yield* approve(f.operations, p, {}).pipe(Effect.flip)).code).toBe(
        kind === "owner" ? "owner_closed" : "approval_cancelled",
      )
      yield* Scope.close(owner, Exit.void)
    }),
  ),
)

test.each(["successful", "failed", "pending"])(
  "owner closes before joined %s observer cleanup and old events never transfer",
  (registration) =>
    run(
      Effect.gen(function* () {
        const owner = yield* Scope.make()
        const entered = yield* Deferred.make<void>()
        const cleaning = yield* Deferred.make<void>()
        const release = yield* Deferred.make<void>()
        const state = { unregistered: false, closed: false, listener: (_input: Revocation) => {} }
        const f = yield* fixture({
          observe: (revoke) =>
            Effect.gen(function* () {
              state.listener = revoke
              yield* Effect.addFinalizer(() =>
                Deferred.succeed(cleaning, undefined).pipe(
                  Effect.andThen(Deferred.await(release)),
                  Effect.andThen(
                    Effect.sync(() => {
                      state.unregistered = true
                    }),
                  ),
                ),
              )
              yield* Deferred.succeed(entered, undefined)
              if (registration === "failed") return yield* Effect.fail({ code: "invalid_parameters" } as const)
              if (registration === "pending") return yield* Effect.never
              return undefined
            }),
        }).pipe(Scope.provide(owner))
        yield* Deferred.await(entered)
        const p = yield* f.prepare()
        const old = f.event(p)
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
        expect(state.unregistered).toBe(false)
        state.listener({
          operationID: p.operationID,
          contextFingerprint: p.contextFingerprint,
          reason: "context_changed",
        })
        expect((yield* approve(f.operations, p, old).pipe(Effect.flip)).code).toBe("owner_closed")
        expect((yield* f.prepare().pipe(Effect.flip)).code).toBe("owner_closed")
        const fresh = yield* fixture()
        const next = yield* fresh.prepare()
        expect((yield* approve(fresh.operations, next, old).pipe(Effect.flip)).code).toBe("untrusted_approval")
        yield* Deferred.succeed(release, undefined)
        yield* Fiber.join(closing)
        expect(state.unregistered).toBe(true)
        expect((yield* approve(fresh.operations, next, fresh.event(next))).operationID).toBe(next.operationID)
      }),
    ),
)

test("canonical request is data only and Schema/Core identities remain exact", () => {
  expect(Operations.ApprovalRequest).toBe(FtcOperation.ApprovalRequest)
  expect(FtcOperation.ApprovalRequest.fields.operationID).toBe(FtcOperation.PreparedOperation.fields.operationID)
  expect(FtcOperation.ApprovalRequest.fields.contextFingerprint).toBe(
    FtcOperation.PreparedOperation.fields.contextFingerprint,
  )
  expect(Object.keys(FtcOperation.ApprovalRequest.fields)).toEqual(["operationID", "contextFingerprint"])
  expect(
    Schema.encodeSync(FtcOperation.ApprovalRequest)({
      operationID: FtcOperation.OperationID.make("operation_fixture"),
      contextFingerprint: "a".repeat(64),
    }),
  ).toEqual({ operationID: "operation_fixture", contextFingerprint: "a".repeat(64) })
  for (const code of [
    "approval_consumed",
    "untrusted_approval",
    "approval_unavailable",
    "operation_unknown",
    "approval_rejected",
    "approval_expired",
    "approval_cancelled",
  ] as const) {
    expect(Schema.encodeSync(FtcOperation.OperationError)({ code, chatID: undefined })).toEqual({ code })
  }
})

test("held live observer registration admits preparation and enables approval only after installation", () =>
  run(
    Effect.gen(function* () {
      const entered = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const state = { listener: (_input: Revocation) => {}, installed: false }
      const f = yield* fixture({
        observe: (listener) =>
          Effect.gen(function* () {
            yield* Effect.addFinalizer(() =>
              Effect.sync(() => {
                state.installed = false
              }),
            )
            yield* Deferred.succeed(entered, undefined)
            yield* Deferred.await(release)
            state.listener = listener
            state.installed = true
          }),
      })
      yield* Deferred.await(entered)
      const p = yield* f.prepare()
      const token = f.event(p)
      expect((yield* approve(f.operations, p, token).pipe(Effect.flip)).code).toBe("approval_unavailable")
      expect(f.events.has(token)).toBe(true)
      yield* Deferred.succeed(release, undefined)
      yield* Effect.yieldNow
      expect(state.installed).toBe(true)
      expect((yield* approve(f.operations, p, token)).operationID).toBe(p.operationID)
      state.listener({
        operationID: p.operationID,
        contextFingerprint: p.contextFingerprint,
        reason: "context_changed",
      })
      expect((yield* approve(f.operations, p, {}).pipe(Effect.flip)).code).toBe("context_changed")
    }),
  ))

test.each(["revoke", "mutate", "compete"])(
  "%s during the preclaim clock cannot consume or retarget a stale attempt",
  (change) =>
    run(
      Effect.gen(function* () {
        const entered = yield* Deferred.make<void>()
        const release = yield* Deferred.make<void>()
        const f = yield* fixture({
          now: Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(release)), Effect.as(10)),
        })
        const p = yield* f.prepare()
        const token = f.event(p)
        const input = { operationID: p.operationID, contextFingerprint: p.contextFingerprint, userEvent: token }
        const accepting = yield* f.operations.approveOperation(input).pipe(Effect.forkChild)
        yield* Deferred.await(entered)
        f.approval.now = Effect.succeed(10)
        if (change === "revoke") f.state.revoke({ ...input, reason: "context_changed" })
        if (change === "mutate") {
          input.operationID = FtcOperation.OperationID.make("operation_attacker")
          input.contextFingerprint = "a".repeat(64)
          input.userEvent = {}
          // The original handles must have been captured before the clock wait.
          f.approval.claim = () => ({ code: "untrusted_approval" })
          f.approval.deadline = () => Effect.succeed(0)
        }
        if (change === "compete") yield* approve(f.operations, p, f.event(p))
        yield* Deferred.succeed(release, undefined)
        const exit = yield* Fiber.await(accepting)
        if (change === "mutate") {
          expect(Exit.isSuccess(exit)).toBe(true)
          if (Exit.isSuccess(exit)) expect(exit.value).toBe(p)
        }
        if (change !== "mutate") {
          expect(Exit.isFailure(exit)).toBe(true)
          if (Exit.isFailure(exit))
            expect(Cause.findErrorOption(exit.cause).pipe((x) => (x._tag === "Some" ? x.value.code : "missing"))).toBe(
              change === "revoke" ? "context_changed" : "approval_consumed",
            )
          expect(f.events.has(token)).toBe(true)
        }
      }),
    ),
)

test.each([
  { phase: "preclaim", who: "caller" },
  { phase: "postclaim", who: "caller" },
  { phase: "preclaim", who: "owner" },
  { phase: "postclaim", who: "owner" },
])("$who cancellation joins held $phase scoped clock cleanup", (input) =>
  run(
    Effect.gen(function* () {
      const owner = yield* Scope.make()
      const entered = yield* Deferred.make<void>()
      const cleaning = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const state = { reads: 0, stopped: false }
      const f = yield* fixture({
        now: Effect.gen(function* () {
          state.reads++
          if (state.reads !== (input.phase === "preclaim" ? 1 : 2)) return 10
          yield* Effect.addFinalizer(() =>
            Deferred.succeed(cleaning, undefined).pipe(Effect.andThen(Deferred.await(release))),
          )
          yield* Deferred.succeed(entered, undefined)
          return yield* Effect.never
        }),
      }).pipe(Scope.provide(owner))
      const p = yield* f.prepare()
      const token = f.event(p)
      const accepting = yield* approve(f.operations, p, token).pipe(Effect.forkChild)
      yield* Deferred.await(entered)
      const stopping = yield* (
        input.who === "caller" ? Fiber.interrupt(accepting) : Scope.close(owner, Exit.void)
      ).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            state.stopped = true
          }),
        ),
        Effect.forkChild,
      )
      yield* Deferred.await(cleaning)
      expect(state.stopped).toBe(false)
      f.approval.now = Effect.succeed(10)
      if (input.who === "owner")
        expect((yield* approve(f.operations, p, {}).pipe(Effect.flip)).code).toBe("owner_closed")
      if (input.who === "caller" && input.phase === "preclaim")
        expect((yield* approve(f.operations, p, token)).operationID).toBe(p.operationID)
      if (input.who === "caller" && input.phase === "postclaim")
        expect((yield* approve(f.operations, p, f.event(p)).pipe(Effect.flip)).code).toBe("approval_cancelled")
      yield* Deferred.succeed(release, undefined)
      yield* Fiber.join(stopping)
      const exit = yield* Fiber.await(accepting)
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) expect(Cause.hasInterrupts(exit.cause)).toBe(true)
      yield* Scope.close(owner, Exit.void)
    }),
  ),
)

test.each(["now", "deadline"] as const)("rejection before failed %s cleanup wins the first retirement", (boundary) =>
  run(
    Effect.gen(function* () {
      const entered = yield* Deferred.make<void>()
      const fail = yield* Deferred.make<void>()
      const cleaning = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const state = { reads: 0 }
      const failing = Effect.gen(function* () {
        yield* Effect.addFinalizer(() =>
          Deferred.succeed(cleaning, undefined).pipe(Effect.andThen(Deferred.await(release))),
        )
        yield* Deferred.succeed(entered, undefined)
        yield* Deferred.await(fail)
        return yield* Effect.fail({ code: "invalid_parameters" } as const)
      })
      const f = yield* fixture(
        boundary === "deadline"
          ? { deadline: () => failing }
          : {
              now: Effect.suspend(() => {
                state.reads++
                return state.reads === 1 ? Effect.succeed(10) : failing
              }),
            },
      )
      const p = yield* f.prepare()
      const accepting = yield* approve(f.operations, p, f.event(p)).pipe(Effect.forkChild)
      yield* Deferred.await(entered)
      f.state.revoke({
        operationID: p.operationID,
        contextFingerprint: p.contextFingerprint,
        reason: "approval_rejected",
      })
      yield* Deferred.succeed(fail, undefined)
      yield* Deferred.await(cleaning)
      expect((yield* approve(f.operations, p, {}).pipe(Effect.flip)).code).toBe("approval_rejected")
      yield* Deferred.succeed(release, undefined)
      expect((yield* Fiber.join(accepting).pipe(Effect.flip)).code).toBe("approval_rejected")
    }),
  ),
)

test("deadline already expired at claim retires before a later clock failure", () =>
  run(
    Effect.gen(function* () {
      const state = { reads: 0 }
      const f = yield* fixture({
        now: Effect.suspend(() => {
          state.reads++
          return state.reads === 1 ? Effect.succeed(10) : Effect.fail({ code: "invalid_parameters" } as const)
        }),
        deadline: () => Effect.succeed(10),
      })
      const p = yield* f.prepare()
      expect((yield* approve(f.operations, p, f.event(p)).pipe(Effect.flip)).code).toBe("approval_expired")
      expect((yield* approve(f.operations, p, {}).pipe(Effect.flip)).code).toBe("approval_expired")
      expect(state.reads).toBe(1)
    }),
  ))

test("postcommit cleanup cannot promise ongoing consent or block exact revocation", () =>
  run(
    Effect.gen(function* () {
      const cleaning = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const f = yield* fixture({
        deadline: () =>
          Effect.gen(function* () {
            yield* Effect.addFinalizer(() =>
              Deferred.succeed(cleaning, undefined).pipe(Effect.andThen(Deferred.await(release))),
            )
            return 20
          }),
      })
      const p = yield* f.prepare()
      const accepting = yield* approve(f.operations, p, f.event(p)).pipe(Effect.forkChild)
      yield* Deferred.await(cleaning)
      expect((yield* approve(f.operations, p, {}).pipe(Effect.flip)).code).toBe("approval_consumed")
      f.state.revoke({
        operationID: p.operationID,
        contextFingerprint: p.contextFingerprint,
        reason: "approval_rejected",
      })
      expect((yield* approve(f.operations, p, {}).pipe(Effect.flip)).code).toBe("approval_rejected")
      yield* Deferred.succeed(release, undefined)
      expect(yield* Fiber.join(accepting)).toBe(p)
      expect(p.status).toBe("awaiting_approval")
    }),
  ))

test.each([
  { label: "ID", operationID: "other", contextFingerprint: "a".repeat(64) },
  { label: "fingerprint", operationID: "operation_other", contextFingerprint: "not-a-hash" },
  { label: "event", operationID: "operation_other", contextFingerprint: "a".repeat(64), userEvent: undefined },
])("malformed approval $label fails before claim", (change) =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const p = yield* f.prepare()
      const invalid = {
        operationID: p.operationID,
        contextFingerprint: p.contextFingerprint,
        userEvent: f.event(p),
      }
      Object.assign(invalid, change)
      expect((yield* f.operations.approveOperation(invalid).pipe(Effect.flip)).code).toBe("invalid_operation_input")
      expect(f.state.claims).toBe(0)
    }),
  ),
)

test.each(["clock", "deadline"])("malformed %s effect fails closed without replaying a matching claim", (boundary) =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      if (boundary === "clock") Object.assign(f.approval, { now: undefined })
      if (boundary === "deadline") Object.assign(f.approval, { deadline: () => undefined })
      const p = yield* f.prepare()
      const token = f.event(p)
      expect((yield* approve(f.operations, p, token).pipe(Effect.flip)).code).toBe("approval_unavailable")
      f.approval.now = Effect.succeed(10)
      f.approval.deadline = () => Effect.succeed(20)
      if (boundary === "clock") expect((yield* approve(f.operations, p, token)).operationID).toBe(p.operationID)
      if (boundary === "deadline")
        expect((yield* approve(f.operations, p, f.event(p)).pipe(Effect.flip)).code).toBe("approval_cancelled")
    }),
  ),
)
