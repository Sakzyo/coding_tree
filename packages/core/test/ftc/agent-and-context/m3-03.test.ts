import { expect, test } from "bun:test"
import { FtcAgent } from "@opencode-ai/schema/ftc-agent"
import { FtcJava } from "@opencode-ai/schema/ftc-java"
import { Project } from "@opencode-ai/schema/project"
import { AbsolutePath } from "@opencode-ai/schema/schema"
import { SessionID } from "@opencode-ai/schema/session-id"
import { Deferred, Effect, Exit, Fiber, Scope } from "effect"
import { Agent } from "../../../src/ftc/agent"

const sessionID = SessionID.make("ses_code")
const projectID = Project.ID.make("team")
const proposal: FtcJava.EditProposal = {
  projectID,
  explanation: "Replace the existing Java source",
  edits: [
    {
      path: "/team/Main.java",
      expectedRevision: { documentID: FtcJava.DocumentID.make("doc_main"), bufferRevision: 0, diskRevision: 0 },
      replacement: "class Main {}",
    },
  ],
}
const grant = { projectID, canonicalRoot: AbsolutePath.make("/team"), paths: [AbsolutePath.make("/team/Main.java")] }

// Catches early application in plan-first and trusting request mode instead of user policy.
test("plan-first waits and stale approval cannot edit", async () => {
  expect(Agent.CodeMode).toBe(FtcAgent.CodeMode)
  expect(Agent.CodePlan).toBe(FtcAgent.CodePlan)
  expect(Agent.PlanID).toBe(FtcAgent.PlanID)
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const state = { mode: "plan-first" as "plan-first" | "direct", writes: 0 }
        const event = Object.freeze({})
        const agent = yield* Agent.make({
          policy: { check: () => Effect.succeed({ ...grant, mode: state.mode }) },
          approvals: { check: (input) => Effect.succeed(input.trustedUserEvent === event) },
          edits: {
            applyEdits: (input) =>
              Effect.sync(() => {
                state.writes++
                return { kind: "applied" as const, proposal: input.proposal, applied: [] }
              }),
          },
        })
        const plan = yield* agent.proposeCodeChange({ sessionID, mode: "plan-first", proposal })
        expect(state.writes).toBe(0)
        if (!("planID" in plan)) throw new Error("Expected a pending code plan")
        expect(plan.proposal).toEqual(proposal)
        expect(plan.expectedRevisions.map((value) => ({ ...value, documentID: String(value.documentID) }))).toEqual([
          { documentID: "doc_main", bufferRevision: 0, diskRevision: 0 },
        ])
        const stale = yield* agent
          .approveCodePlan({
            trustedUserEvent: event,
            planID: plan.planID,
            expectedRevisions: [{ ...plan.expectedRevisions[0], diskRevision: 1 }],
          })
          .pipe(Effect.flip)
        expect(stale.code).toBe("revision_conflict")
        expect(state.writes).toBe(0)
        state.mode = "direct"
        const direct = yield* agent.proposeCodeChange({ sessionID, mode: "direct", proposal })
        expect("kind" in direct && direct.kind).toBe("applied")
        expect(state.writes).toBe(1)
      }),
    ),
  )
})

const fixture = (mode: FtcAgent.CodeMode = "plan-first") =>
  Effect.gen(function* () {
    const state = {
      mode,
      allowed: true,
      grants: grant,
      applications: [] as { proposal: FtcJava.EditProposal; authorization: object }[],
      approvals: new Map<object, FtcAgent.CodePlan>(),
      policyInput: undefined as { sessionID: SessionID; proposal: FtcJava.EditProposal } | undefined,
      agent: undefined as Agent.Interface | undefined,
      beforePolicy: Effect.void,
      beforeApproval: Effect.void,
      beforeApply: Effect.void,
      outcome: undefined as FtcJava.EditResult | undefined,
      error: undefined as FtcJava.DocumentError | undefined,
    }
    const agent = yield* Agent.make({
      policy: {
        check: (input) =>
          Effect.gen(function* () {
            state.policyInput = input
            yield* state.beforePolicy
            if (!state.allowed) return yield* Effect.fail({ code: "edit_unauthorized" } satisfies FtcJava.DocumentError)
            return { ...state.grants, mode: state.mode }
          }),
      },
      approvals: {
        check: (input) =>
          state.beforeApproval.pipe(Effect.as(state.approvals.get(input.trustedUserEvent) === input.plan)),
      },
      edits: {
        applyEdits: (input) =>
          Effect.gen(function* () {
            state.applications.push(input)
            yield* state.beforeApply
            yield* state.agent!.codeChanges.check(input)
            if (state.error) return yield* Effect.fail(state.error)
            return state.outcome ?? { kind: "applied" as const, proposal: input.proposal, applied: [] }
          }),
      },
    })
    state.agent = agent
    return {
      agent,
      state,
      event: (plan: FtcAgent.CodePlan) => {
        const event = Object.freeze({})
        state.approvals.set(event, plan)
        return event
      },
    }
  })
const pendingPlan = (agent: Agent.Interface, value = proposal) =>
  agent
    .proposeCodeChange({
      sessionID,
      mode: "plan-first",
      proposal: value,
    })
    .pipe(
      Effect.map((plan) => {
        if (!("planID" in plan)) throw new Error("Expected code plan")
        return plan
      }),
    )
const approve = (agent: Agent.Interface, plan: FtcAgent.CodePlan, event: object) =>
  agent.approveCodePlan({
    planID: plan.planID,
    expectedRevisions: plan.expectedRevisions,
    trustedUserEvent: event,
  })
const run = <A, E>(program: Effect.Effect<A, E, Scope.Scope>) => Effect.runPromise(Effect.scoped(program))

test("model-selected direct mode and forged or wrong-plan events cannot apply", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      expect((yield* f.agent.proposeCodeChange({ sessionID, mode: "direct", proposal }).pipe(Effect.flip)).code).toBe(
        "edit_unauthorized",
      )
      const one = yield* pendingPlan(f.agent)
      const two = yield* pendingPlan(f.agent)
      expect((yield* approve(f.agent, one, { planID: one.planID, approved: true }).pipe(Effect.flip)).code).toBe(
        "edit_unauthorized",
      )
      expect((yield* approve(f.agent, two, f.event(one)).pipe(Effect.flip)).code).toBe("edit_unauthorized")
      expect(f.state.applications).toHaveLength(0)
      expect((yield* approve(f.agent, one, f.event(one))).kind).toBe("applied")
      expect((yield* approve(f.agent, one, f.event(one)).pipe(Effect.flip)).code).toBe("edit_unauthorized")
      expect(f.state.applications).toHaveLength(1)
    }),
  ))

test("proposal and scalar envelope are copied before asynchronous policy resolution", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const entered = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      f.state.beforePolicy = Deferred.succeed(entered, undefined).pipe(
        Effect.andThen(Deferred.await(release)),
        Effect.asVoid,
      )
      const input = {
        sessionID,
        mode: "plan-first" as FtcAgent.CodeMode,
        proposal: {
          ...proposal,
          edits: proposal.edits.map((edit) => ({ ...edit, expectedRevision: { ...edit.expectedRevision } })),
        },
      }
      const fiber = yield* f.agent.proposeCodeChange(input).pipe(Effect.forkChild)
      yield* Deferred.await(entered)
      input.sessionID = SessionID.make("ses_attacker")
      input.mode = "direct"
      input.proposal.projectID = Project.ID.make("other")
      input.proposal.explanation = "Deploy and start"
      input.proposal.edits[0].replacement = "malicious"
      input.proposal.edits[0].path = "/other/Main.java"
      input.proposal.edits[0].expectedRevision.documentID = FtcJava.DocumentID.make("doc_other")
      yield* Deferred.succeed(release, undefined)
      const plan = yield* Fiber.join(fiber)
      expect(plan).toMatchObject({
        sessionID: "ses_code",
        projectID: "team",
        explanation: "Replace the existing Java source",
        proposal,
      })
      expect(String(f.state.policyInput?.sessionID)).toBe("ses_code")
      expect(f.state.applications).toHaveLength(0)
      if (!("planID" in plan)) throw new Error("Expected plan")
      expect(Object.isFrozen(plan)).toBe(true)
      expect(Object.isFrozen(plan.proposal.edits[0].expectedRevision)).toBe(true)
      const outcome = yield* approve(f.agent, plan, f.event(plan))
      expect(outcome.proposal).toEqual(proposal)
    }),
  ))

test("approval envelope mutation and concurrent claims cannot redirect or repeat application", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const one = yield* pendingPlan(f.agent)
      const two = yield* pendingPlan(f.agent)
      const entered = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      f.state.beforeApproval = Deferred.succeed(entered, undefined).pipe(
        Effect.andThen(Deferred.await(release)),
        Effect.asVoid,
      )
      const input = {
        planID: one.planID,
        trustedUserEvent: f.event(one),
        expectedRevisions: one.expectedRevisions.map((value) => ({ ...value })),
      }
      const first = yield* f.agent.approveCodePlan(input).pipe(Effect.forkChild)
      yield* Deferred.await(entered)
      const duplicate = yield* approve(f.agent, one, input.trustedUserEvent).pipe(Effect.result, Effect.forkChild)
      input.planID = two.planID
      input.trustedUserEvent = { approved: true }
      input.expectedRevisions[0].diskRevision = 99
      yield* Deferred.succeed(release, undefined)
      expect((yield* Fiber.join(first)).kind).toBe("applied")
      const second = yield* Fiber.join(duplicate)
      expect(second._tag).toBe("Failure")
      if (second._tag === "Failure") expect(second.failure.code).toBe("edit_unauthorized")
      expect(f.state.applications).toHaveLength(1)
      expect((yield* approve(f.agent, two, f.event(two))).kind).toBe("applied")
    }),
  ))

test.each(["mode", "root", "paths", "revoked"])(
  "fresh trusted policy rejects changed %s and consumes approval",
  (change) =>
    run(
      Effect.gen(function* () {
        const f = yield* fixture()
        const plan = yield* pendingPlan(f.agent)
        if (change === "mode") f.state.mode = "direct"
        if (change === "root") f.state.grants = { ...grant, canonicalRoot: AbsolutePath.make("/other") }
        if (change === "paths") f.state.grants = { ...grant, paths: [AbsolutePath.make("/team/Other.java")] }
        if (change === "revoked") f.state.allowed = false
        expect((yield* approve(f.agent, plan, f.event(plan)).pipe(Effect.flip)).code).toBe("edit_unauthorized")
        expect(f.state.applications).toHaveLength(0)
        f.state.mode = "plan-first"
        f.state.grants = grant
        f.state.allowed = true
        expect((yield* approve(f.agent, plan, f.event(plan)).pipe(Effect.flip)).code).toBe("edit_unauthorized")
      }),
    ),
)

test("opaque authorization binds every proposal field and expires after apply", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture("direct")
      const entered = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      f.state.beforeApply = Deferred.succeed(entered, undefined).pipe(
        Effect.andThen(Deferred.await(release)),
        Effect.asVoid,
      )
      const fiber = yield* f.agent.proposeCodeChange({ sessionID, mode: "direct", proposal }).pipe(Effect.forkChild)
      yield* Deferred.await(entered)
      const application = f.state.applications[0]
      expect(yield* f.agent.codeChanges.check(application)).toMatchObject(grant)
      const changes = [
        { ...proposal, projectID: Project.ID.make("other") },
        { ...proposal, explanation: "different" },
        { ...proposal, edits: [{ ...proposal.edits[0], path: "/team/Other.java" }] },
        { ...proposal, edits: [{ ...proposal.edits[0], replacement: "other" }] },
        {
          ...proposal,
          edits: [
            { ...proposal.edits[0], expectedRevision: { ...proposal.edits[0].expectedRevision, bufferRevision: 1 } },
          ],
        },
        {
          ...proposal,
          edits: [
            { ...proposal.edits[0], expectedRevision: { ...proposal.edits[0].expectedRevision, diskRevision: 1 } },
          ],
        },
        {
          ...proposal,
          edits: [
            {
              ...proposal.edits[0],
              expectedRevision: {
                ...proposal.edits[0].expectedRevision,
                documentID: FtcJava.DocumentID.make("doc_other"),
              },
            },
          ],
        },
        { ...proposal, edits: [...proposal.edits, proposal.edits[0]] },
      ]
      for (const changed of changes)
        expect((yield* f.agent.codeChanges.check({ ...application, proposal: changed }).pipe(Effect.flip)).code).toBe(
          "edit_unauthorized",
        )
      expect(
        (yield* f.agent.codeChanges
          .check({ ...application, authorization: JSON.parse(JSON.stringify(application.authorization)) })
          .pipe(Effect.flip)).code,
      ).toBe("edit_unauthorized")
      yield* Deferred.succeed(release, undefined)
      yield* Fiber.join(fiber)
      expect((yield* f.agent.codeChanges.check(application).pipe(Effect.flip)).code).toBe("edit_unauthorized")
    }),
  ))

test.each(["mode", "root", "paths", "revoked"])(
  "active application rechecks changed %s policy before edits",
  (change) =>
    run(
      Effect.gen(function* () {
        const f = yield* fixture("direct")
        const entered = yield* Deferred.make<void>()
        const release = yield* Deferred.make<void>()
        f.state.beforeApply = Deferred.succeed(entered, undefined).pipe(
          Effect.andThen(Deferred.await(release)),
          Effect.asVoid,
        )
        const fiber = yield* f.agent
          .proposeCodeChange({ sessionID, mode: "direct", proposal })
          .pipe(Effect.result, Effect.forkChild)
        yield* Deferred.await(entered)
        if (change === "mode") f.state.mode = "plan-first"
        if (change === "root") f.state.grants = { ...grant, canonicalRoot: AbsolutePath.make("/other") }
        if (change === "paths") f.state.grants = { ...grant, paths: [AbsolutePath.make("/team/Other.java")] }
        if (change === "revoked") f.state.allowed = false
        yield* Deferred.succeed(release, undefined)
        const result = yield* Fiber.join(fiber)
        expect(result._tag).toBe("Failure")
        if (result._tag === "Failure") expect(result.failure.code).toBe("edit_unauthorized")
        f.state.allowed = true
        f.state.mode = "direct"
        f.state.grants = grant
        expect((yield* f.agent.codeChanges.check(f.state.applications[0]).pipe(Effect.flip)).code).toBe(
          "edit_unauthorized",
        )
      }),
    ),
)

test("independent owners cannot exchange plans or active edit capabilities", () =>
  run(
    Effect.gen(function* () {
      const first = yield* fixture()
      const second = yield* fixture()
      const plan = yield* pendingPlan(first.agent)
      expect((yield* approve(second.agent, plan, first.event(plan)).pipe(Effect.flip)).code).toBe("edit_unauthorized")
      const entered = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      first.state.beforeApply = Deferred.succeed(entered, undefined).pipe(
        Effect.andThen(Deferred.await(release)),
        Effect.asVoid,
      )
      const fiber = yield* approve(first.agent, plan, first.event(plan)).pipe(Effect.forkChild)
      yield* Deferred.await(entered)
      expect((yield* second.agent.codeChanges.check(first.state.applications[0]).pipe(Effect.flip)).code).toBe(
        "edit_unauthorized",
      )
      yield* Deferred.succeed(release, undefined)
      expect((yield* Fiber.join(fiber)).kind).toBe("applied")
      expect(second.state.applications).toHaveLength(0)
    }),
  ))

test.each(["conflict", "failed", "error"])("canonical %s result is preserved and its plan never replays", (kind) =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const plan = yield* pendingPlan(f.agent)
      const snapshot: FtcJava.DocumentSnapshot = {
        ...plan.expectedRevisions[0],
        projectID,
        path: grant.paths[0],
        text: "unsaved",
        dirty: true,
      }
      const result: FtcJava.EditResult =
        kind === "conflict"
          ? {
              kind: "conflict",
              proposal: plan.proposal,
              applied: [],
              conflicts: [
                {
                  path: snapshot.path,
                  reason: "revision",
                  current: snapshot,
                  diskText: "external",
                  choices: ["save", "merge", "defer"],
                },
              ],
            }
          : {
              kind: "failed",
              proposal: plan.proposal,
              applied: [snapshot],
              error: { code: "file_unavailable", outcome: "unknown" },
              uncertainPaths: [snapshot.path],
            }
      f.state.outcome = result
      if (kind === "error") f.state.error = { code: "file_unavailable" }
      const applied = yield* approve(f.agent, plan, f.event(plan)).pipe(Effect.result)
      if (kind === "error") {
        expect(applied._tag).toBe("Failure")
        if (applied._tag === "Failure") expect(applied.failure.code).toBe("file_unavailable")
      }
      if (kind !== "error") {
        expect(applied._tag).toBe("Success")
        if (applied._tag === "Success") expect(applied.success).toBe(result)
      }
      expect((yield* approve(f.agent, plan, f.event(plan)).pipe(Effect.flip)).code).toBe("edit_unauthorized")
      expect(f.state.applications).toHaveLength(1)
    }),
  ),
)

test("caller cancellation revokes capability and consumes its claimed plan", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const plan = yield* pendingPlan(f.agent)
      const entered = yield* Deferred.make<void>()
      const observed = { error: undefined as FtcJava.DocumentError | undefined }
      f.state.beforeApply = Deferred.succeed(entered, undefined).pipe(
        Effect.andThen(Effect.never),
        Effect.onInterrupt(() =>
          f.agent.codeChanges.check(f.state.applications[0]).pipe(
            Effect.result,
            Effect.tap((result) =>
              Effect.sync(() => {
                if (result._tag === "Failure") observed.error = result.failure
              }),
            ),
          ),
        ),
      )
      const fiber = yield* approve(f.agent, plan, f.event(plan)).pipe(Effect.forkChild)
      yield* Deferred.await(entered)
      const application = f.state.applications[0]
      yield* Fiber.interrupt(fiber)
      expect(observed.error?.code).toBe("edit_unauthorized")
      expect((yield* f.agent.codeChanges.check(application).pipe(Effect.flip)).code).toBe("edit_unauthorized")
      expect((yield* approve(f.agent, plan, f.event(plan)).pipe(Effect.flip)).code).toBe("edit_unauthorized")
      expect(f.state.applications).toHaveLength(1)
    }),
  ))

test("owner disposal revokes pending plans and active capabilities", () =>
  run(
    Effect.gen(function* () {
      const owner = yield* Scope.make()
      const f = yield* fixture().pipe(Scope.provide(owner))
      const plan = yield* pendingPlan(f.agent)
      const entered = yield* Deferred.make<void>()
      f.state.beforeApply = Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never))
      const fiber = yield* f.agent.proposeCodeChange({ sessionID, mode: "direct", proposal }).pipe(Effect.forkChild)
      // Trusted policy still plan-first; the direct request must reject before opening an application.
      expect((yield* Fiber.join(fiber).pipe(Effect.flip)).code).toBe("edit_unauthorized")
      f.state.mode = "direct"
      const active = yield* f.agent.proposeCodeChange({ sessionID, mode: "direct", proposal }).pipe(Effect.forkChild)
      yield* Deferred.await(entered)
      yield* Scope.close(owner, Exit.void)
      expect(Exit.isFailure(yield* Fiber.await(active))).toBe(true)
      expect((yield* f.agent.codeChanges.check(f.state.applications[0]).pipe(Effect.flip)).code).toBe("owner_closed")
      expect((yield* approve(f.agent, plan, f.event(plan)).pipe(Effect.flip)).code).toBe("owner_closed")
    }),
  ))
