export * as Agent from "./agent"

import { FtcAgent } from "@opencode-ai/schema/ftc-agent"
import { FtcJava } from "@opencode-ai/schema/ftc-java"
import { Project } from "@opencode-ai/schema/project"
import { AbsolutePath } from "@opencode-ai/schema/schema"
import { SessionID } from "@opencode-ai/schema/session-id"
import { Context, Effect, Exit, Fiber, Layer, Schema, Scope } from "effect"

export { CodeMode, PlanID, CodePlan } from "@opencode-ai/schema/ftc-agent"

export interface Grant {
  readonly projectID: Project.ID
  readonly canonicalRoot: AbsolutePath
  readonly paths: readonly AbsolutePath[]
}

export interface Ports {
  // Trusted application policy resolves Session/project membership, mode and allowed source paths.
  readonly policy: {
    readonly check: (input: {
      readonly sessionID: SessionID
      readonly proposal: FtcJava.EditProposal
    }) => Effect.Effect<Grant & { readonly mode: FtcAgent.CodeMode }, FtcJava.DocumentError>
  }
  readonly approvals: {
    // The host validates an actual user event against every value in this immutable plan.
    readonly check: (input: {
      readonly trustedUserEvent: object
      readonly plan: FtcAgent.CodePlan
    }) => Effect.Effect<boolean, FtcJava.DocumentError>
  }
  readonly edits: {
    readonly applyEdits: (input: {
      readonly proposal: FtcJava.EditProposal
      readonly authorization: object
    }) => Effect.Effect<FtcJava.EditResult, FtcJava.DocumentError>
  }
}

export interface Interface {
  readonly proposeCodeChange: (input: {
    readonly sessionID: SessionID
    readonly mode: FtcAgent.CodeMode
    readonly proposal: FtcJava.EditProposal
  }) => Effect.Effect<FtcAgent.CodePlan | FtcJava.EditResult, FtcJava.DocumentError>
  readonly approveCodePlan: (input: {
    readonly trustedUserEvent: object
    readonly planID: FtcAgent.PlanID
    readonly expectedRevisions: readonly FtcJava.Revision[]
  }) => Effect.Effect<FtcJava.EditResult, FtcJava.DocumentError>
  // Structurally matches the Java producer's CodeChanges port; no serializable bearer grant.
  readonly codeChanges: {
    readonly check: (input: {
      readonly proposal: FtcJava.EditProposal
      readonly authorization: object
    }) => Effect.Effect<Grant, FtcJava.DocumentError>
  }
}

export class Service extends Context.Service<Service, Interface>()("@opencode/FtcAgent") {}
export const layer = (ports: Ports) => Layer.effect(Service, make(ports))

export const make = (ports: Ports): Effect.Effect<Interface, never, Scope.Scope> =>
  Effect.gen(function* () {
    const applications = yield* Scope.make()
    const plans = new Map<FtcAgent.PlanID, { readonly plan: FtcAgent.CodePlan; readonly grant: Grant }>()
    const authorizations = new WeakMap<
      object,
      {
        readonly sessionID: SessionID
        readonly proposal: FtcJava.EditProposal
        readonly mode: FtcAgent.CodeMode
        readonly grant: Grant
      }
    >()
    let closed = false
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        closed = true
        plans.clear()
      }).pipe(Effect.andThen(Scope.close(applications, Exit.void))),
    )
    const active = () =>
      Effect.suspend(() =>
        closed ? Effect.fail({ code: "owner_closed" } satisfies FtcJava.DocumentError) : Effect.void,
      )
    const policy = Effect.fn("FtcAgent.policy")(function* (sessionID: SessionID, proposal: FtcJava.EditProposal) {
      yield* active()
      const value = yield* ports.policy.check({ sessionID, proposal })
      yield* active()
      if (value.projectID !== proposal.projectID || !Schema.is(FtcAgent.CodeMode)(value.mode))
        return yield* Effect.fail({ code: "edit_unauthorized" } satisfies FtcJava.DocumentError)
      return Object.freeze({ ...value, paths: Object.freeze([...value.paths]) })
    })
    const apply = Effect.fn("FtcAgent.apply")(function* (
      sessionID: SessionID,
      proposal: FtcJava.EditProposal,
      mode: FtcAgent.CodeMode,
      grant: Grant,
    ) {
      yield* active()
      const authorization = Object.freeze({})
      authorizations.set(authorization, { sessionID, proposal, mode, grant })
      // Caller cancellation and owner disposal both interrupt the port and revoke this application.
      return yield* Effect.acquireUseRelease(
        Effect.forkIn(ports.edits.applyEdits({ proposal, authorization }), applications),
        Fiber.join,
        (fiber) => Effect.sync(() => authorizations.delete(authorization)).pipe(Effect.andThen(Fiber.interrupt(fiber))),
      ).pipe(Effect.ensuring(Effect.sync(() => authorizations.delete(authorization))))
    })
    return {
      proposeCodeChange: Effect.fn("FtcAgent.proposeCodeChange")(function* (input) {
        if (
          !Schema.is(SessionID)(input.sessionID) ||
          !Schema.is(FtcAgent.CodeMode)(input.mode) ||
          !Schema.is(FtcJava.EditProposal)(input.proposal)
        )
          return yield* Effect.fail({ code: "invalid_document_input" } satisfies FtcJava.DocumentError)
        const sessionID = input.sessionID
        const mode = input.mode
        const proposal = immutableProposal(input.proposal)
        yield* active()
        const grant = yield* policy(sessionID, proposal)
        if (grant.mode !== mode)
          return yield* Effect.fail({ code: "edit_unauthorized" } satisfies FtcJava.DocumentError)
        if (mode === "direct") return yield* apply(sessionID, proposal, mode, grant)
        const plan = Object.freeze({
          planID: FtcAgent.PlanID.create(),
          projectID: proposal.projectID,
          sessionID,
          proposal,
          explanation: proposal.explanation,
          expectedRevisions: Object.freeze(proposal.edits.map((edit) => edit.expectedRevision)),
        } satisfies FtcAgent.CodePlan)
        plans.set(plan.planID, { plan, grant })
        return plan
      }),
      approveCodePlan: Effect.fn("FtcAgent.approveCodePlan")(function* (input) {
        const planID = input.planID
        const trustedUserEvent = input.trustedUserEvent
        if (!trustedUserEvent || typeof trustedUserEvent !== "object")
          return yield* Effect.fail({ code: "edit_unauthorized" } satisfies FtcJava.DocumentError)
        if (!Schema.is(Schema.Array(FtcJava.Revision))(input.expectedRevisions))
          return yield* Effect.fail({ code: "invalid_document_input" } satisfies FtcJava.DocumentError)
        const expected = input.expectedRevisions.map((revision) => ({ ...revision }))
        yield* active()
        const pending = plans.get(planID)
        if (!pending) return yield* Effect.fail({ code: "edit_unauthorized" } satisfies FtcJava.DocumentError)
        if (!(yield* ports.approvals.check({ trustedUserEvent, plan: pending.plan })))
          return yield* Effect.fail({ code: "edit_unauthorized" } satisfies FtcJava.DocumentError)
        yield* active()
        if (plans.get(pending.plan.planID) !== pending)
          return yield* Effect.fail({ code: "edit_unauthorized" } satisfies FtcJava.DocumentError)
        // A trusted attempt consumes the plan before any asynchronous application. No replay on failure.
        plans.delete(pending.plan.planID)
        if (
          expected.length !== pending.plan.expectedRevisions.length ||
          expected.some((revision, index) => !sameRevision(revision, pending.plan.expectedRevisions[index]))
        )
          return yield* Effect.fail({ code: "revision_conflict" } satisfies FtcJava.DocumentError)
        const grant = yield* policy(pending.plan.sessionID, pending.plan.proposal)
        if (grant.mode !== "plan-first" || !sameGrant(grant, pending.grant))
          return yield* Effect.fail({ code: "edit_unauthorized" } satisfies FtcJava.DocumentError)
        return yield* apply(pending.plan.sessionID, pending.plan.proposal, "plan-first", grant)
      }),
      codeChanges: {
        check: Effect.fn("FtcAgent.checkChanges")(function* (input) {
          const token = input.authorization
          if (!Schema.is(FtcJava.EditProposal)(input.proposal))
            return yield* Effect.fail({ code: "edit_unauthorized" } satisfies FtcJava.DocumentError)
          const proposal = immutableProposal(input.proposal)
          yield* active()
          const authorization = authorizations.get(token)
          if (!authorization || !sameProposal(proposal, authorization.proposal))
            return yield* Effect.fail({ code: "edit_unauthorized" } satisfies FtcJava.DocumentError)
          const grant = yield* policy(authorization.sessionID, authorization.proposal)
          if (
            authorizations.get(token) !== authorization ||
            grant.mode !== authorization.mode ||
            !sameGrant(grant, authorization.grant)
          )
            return yield* Effect.fail({ code: "edit_unauthorized" } satisfies FtcJava.DocumentError)
          return authorization.grant
        }),
      },
    }
  })

function immutableProposal(proposal: FtcJava.EditProposal): FtcJava.EditProposal {
  return Object.freeze({
    projectID: proposal.projectID,
    explanation: proposal.explanation,
    edits: Object.freeze(
      proposal.edits.map((edit) =>
        Object.freeze({
          path: edit.path,
          replacement: edit.replacement,
          expectedRevision: Object.freeze({ ...edit.expectedRevision }),
        }),
      ),
    ),
  })
}
function sameRevision(left: FtcJava.Revision, right: FtcJava.Revision) {
  return (
    left.documentID === right.documentID &&
    left.bufferRevision === right.bufferRevision &&
    left.diskRevision === right.diskRevision
  )
}
function sameProposal(left: FtcJava.EditProposal, right: FtcJava.EditProposal) {
  return (
    left.projectID === right.projectID &&
    left.explanation === right.explanation &&
    left.edits.length === right.edits.length &&
    left.edits.every(
      (edit, index) =>
        edit.path === right.edits[index].path &&
        edit.replacement === right.edits[index].replacement &&
        sameRevision(edit.expectedRevision, right.edits[index].expectedRevision),
    )
  )
}
function sameGrant(left: Grant, right: Grant) {
  return (
    left.projectID === right.projectID &&
    left.canonicalRoot === right.canonicalRoot &&
    left.paths.length === right.paths.length &&
    left.paths.every((value, index) => value === right.paths[index])
  )
}
