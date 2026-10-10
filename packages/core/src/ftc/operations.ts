export * as Operations from "./operations"

import { createHash } from "node:crypto"
import { FtcOperation } from "@opencode-ai/schema/ftc-operation"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { Cause, Context, Effect, Exit, Fiber, Layer, Option, Schema, Scope } from "effect"

export {
  RobotMode,
  OperationID,
  DeploymentArtifactContext,
  Action,
  OperationRequest,
  Status,
  PreparedOperation,
  ApprovalRequest,
  OperationError,
} from "@opencode-ai/schema/ftc-operation"

// Consumed preparation projection; M8 supplies verified identity/capability provenance in the host.
export interface Grant {
  readonly project: FtcProject.ProjectContext
  readonly chat?: FtcProject.ChatRef
  readonly initiator: "user" | "agent"
  readonly robotMode: FtcOperation.RobotMode
  readonly controllerID: string
  readonly generation: string
  readonly verified: boolean
  readonly capabilities: readonly FtcOperation.Action["kind"][]
}

// Trusted local adapter records, never wire authority or model-created JSON.
export interface ApprovalDecision extends FtcOperation.ApprovalRequest {
  readonly decision: "deploy" | "approve" | "reject"
}
export interface ApprovalRevocation extends FtcOperation.ApprovalRequest {
  readonly reason: "context_changed" | "approval_rejected"
}

export interface Ports {
  readonly policy: {
    readonly check: (input: {
      readonly caller: object
      readonly request: FtcOperation.OperationRequest
    }) => Effect.Effect<Grant, FtcOperation.OperationError>
  }
  // Mandatory version-specific semantic/artifact validation, with no transport or execution capability.
  readonly parameters: {
    readonly check: (input: {
      readonly action: FtcOperation.Action
      readonly projectID: FtcOperation.OperationRequest["projectID"]
      readonly controllerID: string
      readonly generation: string
    }) => Effect.Effect<void, FtcOperation.OperationError>
  }
  readonly approval?: {
    // Atomically consumes an owner-bound opaque event; returns immutable captured facts.
    readonly claim: (userEvent: object) => ApprovalDecision | FtcOperation.OperationError
    // Success means this exact synchronous listener remains installed until its supplied Scope closes.
    readonly observe: (
      revoke: (input: ApprovalRevocation) => void,
    ) => Effect.Effect<void, FtcOperation.OperationError, Scope.Scope>
    // Both numbers use the adapter's same comparison domain/unit; no default clock or TTL.
    readonly now: Effect.Effect<number, FtcOperation.OperationError, Scope.Scope>
    readonly deadline: (input: {
      readonly prepared: FtcOperation.PreparedOperation
      readonly claimedAt: number
    }) => Effect.Effect<number, FtcOperation.OperationError, Scope.Scope>
  }
}

export interface Interface {
  readonly prepareOperation: (input: {
    readonly request: FtcOperation.OperationRequest
    readonly robotMode: FtcOperation.RobotMode
    readonly caller: object
  }) => Effect.Effect<FtcOperation.PreparedOperation, FtcOperation.OperationError>
  readonly approveOperation: (
    input: FtcOperation.ApprovalRequest & { readonly userEvent: object },
  ) => Effect.Effect<FtcOperation.PreparedOperation, FtcOperation.OperationError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/FtcOperations") {}
export const layer = (ports: Ports) => Layer.effect(Service, make(ports))

export const make = (ports: Ports): Effect.Effect<Interface, never, Scope.Scope> =>
  Effect.gen(function* () {
    const operations = yield* Scope.make()
    const pending = new Map<FtcOperation.OperationID, FtcOperation.PreparedOperation>()
    const claimed = new Set<FtcOperation.OperationID>()
    const consent = new Map<FtcOperation.OperationID, number>()
    const retired = new Map<FtcOperation.OperationID, FtcOperation.OperationError["code"]>()
    let ready = false
    let closed = false
    const retire = (prepared: FtcOperation.PreparedOperation, code: FtcOperation.OperationError["code"]) => {
      if (closed || retired.has(prepared.operationID)) return false
      retired.set(prepared.operationID, code)
      claimed.delete(prepared.operationID)
      consent.delete(prepared.operationID)
      return true
    }
    const retirement = (prepared: FtcOperation.PreparedOperation) =>
      closed ? "owner_closed" : retired.get(prepared.operationID)

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        closed = true
        ready = false
        pending.clear()
        claimed.clear()
        consent.clear()
        retired.clear()
      }).pipe(Effect.andThen(Scope.close(operations, Exit.void))),
    )
    const active = () => Effect.suspend(() => (closed ? Effect.fail({ code: "owner_closed" } as const) : Effect.void))
    // Caller cancellation owns one wait; owner disposal joins all waits through asynchronous port cleanup.
    const owned = <A, E>(effect: Effect.Effect<A, E>) =>
      active().pipe(
        Effect.andThen(Effect.acquireUseRelease(Effect.forkIn(effect, operations), joinPreparation, Fiber.interrupt)),
      )
    const observer = ports.approval?.observe
    if (typeof observer === "function")
      yield* Effect.forkIn(
        Effect.suspend(() => {
          const registration = observer((input) => {
            if (closed || !input || !Schema.is(FtcOperation.ApprovalRequest)(input)) return
            if (input.reason !== "context_changed" && input.reason !== "approval_rejected") return
            const prepared = pending.get(input.operationID)
            if (prepared?.contextFingerprint === input.contextFingerprint) retire(prepared, input.reason)
          })
          if (!Effect.isEffect(registration)) return Effect.void
          return registration.pipe(
            Effect.exit,
            Effect.flatMap((exit) =>
              Effect.sync(() => {
                if (!closed && Exit.isSuccess(exit) && exit.value === undefined) ready = true
              }),
            ),
          )
        }).pipe(
          Scope.provide(operations),
          Effect.catchCause(() => Effect.void),
        ),
        operations,
      )
    return {
      prepareOperation: Effect.fn("FtcOperations.prepareOperation")(function* (input) {
        yield* active()
        const decoded = Schema.decodeUnknownOption(Schema.toType(FtcOperation.OperationRequest), {
          onExcessProperty: "error",
        })(input.request)
        if (Option.isNone(decoded) || !Schema.is(FtcOperation.RobotMode)(input.robotMode))
          return yield* Effect.fail({ code: "invalid_operation_input" } as const)
        const request = immutable(
          structuredClone(
            Schema.decodeUnknownSync(FtcOperation.OperationRequest)(
              Schema.encodeSync(FtcOperation.OperationRequest)(decoded.value),
            ),
          ),
        )
        const robotMode = input.robotMode
        const caller = input.caller
        if (!caller || typeof caller !== "object") return yield* Effect.fail({ code: "untrusted_caller" } as const)
        return yield* owned(
          Effect.gen(function* () {
            yield* active()
            const grant = yield* ports.policy.check({ caller, request })
            yield* active()
            const rejection = validateGrant(grant, request, robotMode)
            if (rejection) return yield* Effect.fail({ code: rejection })
            if (request.action.kind === "deploy" && request.action.artifact.projectID !== request.projectID)
              return yield* Effect.fail({ code: "artifact_invalid" } as const)
            yield* ports.parameters.check({
              action: request.action,
              projectID: request.projectID,
              controllerID: request.controllerID,
              generation: request.generation,
            })
            yield* active()
            const prepared = immutable({
              ...request,
              operationID: FtcOperation.OperationID.create(),
              robotMode,
              status: "awaiting_approval" as const,
              contextFingerprint: createHash("sha256")
                .update(canonical({ ...request, robotMode }))
                .digest("hex"),
            })
            pending.set(prepared.operationID, prepared)
            return prepared
          }),
        )
      }),
      approveOperation: Effect.fn("FtcOperations.approveOperation")(function* (input) {
        yield* active()
        const decoded = Schema.decodeUnknownOption(Schema.toType(FtcOperation.ApprovalRequest), {
          onExcessProperty: "error",
        })({ operationID: input.operationID, contextFingerprint: input.contextFingerprint })
        const userEvent = input.userEvent
        if (Option.isNone(decoded) || !userEvent || typeof userEvent !== "object")
          return yield* Effect.fail({ code: "invalid_operation_input" } as const)
        const prepared = pending.get(decoded.value.operationID)
        if (!prepared) return yield* Effect.fail({ code: "operation_unknown" } as const)
        if (prepared.contextFingerprint !== decoded.value.contextFingerprint)
          return yield* Effect.fail({ code: "context_changed" } as const)
        const previous = retirement(prepared)
        if (previous) return yield* Effect.fail({ code: previous })
        if (claimed.has(prepared.operationID)) return yield* Effect.fail({ code: "approval_consumed" } as const)
        const approval = ports.approval
        const claim = approval?.claim
        const now = approval?.now
        const deadline = approval?.deadline
        if (!ready || typeof claim !== "function" || !Effect.isEffect(now) || typeof deadline !== "function")
          return yield* Effect.fail({ code: "approval_unavailable" } as const)
        let reserved = false
        let cancelledHere = false
        const failure = (cause: Cause.Cause<FtcOperation.OperationError>) => {
          if (Cause.hasInterrupts(cause) || Cause.hasDies(cause)) return Effect.failCause(cause)
          const reason = retirement(prepared)
          // Preserve a first producer failure; earlier retirement and close still take precedence.
          if (reason && !(cancelledHere && reason === "approval_cancelled")) return Effect.fail({ code: reason })
          return Effect.failCause(cause)
        }
        const attempt = Effect.gen(function* () {
          const claimedAt = yield* now
          const beforeClaim = retirement(prepared)
          if (beforeClaim) return yield* Effect.fail({ code: beforeClaim })
          if (!Number.isFinite(claimedAt)) return yield* Effect.fail({ code: "approval_unavailable" } as const)
          const acceptedDeadline = consent.get(prepared.operationID)
          if (acceptedDeadline !== undefined && claimedAt >= acceptedDeadline) {
            retire(prepared, "approval_expired")
            return yield* Effect.fail({ code: "approval_expired" } as const)
          }
          if (claimed.has(prepared.operationID) || acceptedDeadline !== undefined)
            return yield* Effect.fail({ code: "approval_consumed" } as const)
          const decision = yield* Effect.sync(() => {
            // The event claim, captured decision and reservation share one synchronous boundary.
            const result = claim(userEvent)
            if (Schema.is(FtcOperation.OperationError)(result)) return immutable({ ...result })
            if (
              !result ||
              !Schema.is(FtcOperation.ApprovalRequest)(result) ||
              (result.decision !== "deploy" && result.decision !== "approve" && result.decision !== "reject")
            )
              return { code: "approval_unavailable" } as const
            const captured = immutable({
              operationID: result.operationID,
              contextFingerprint: result.contextFingerprint,
              decision: result.decision,
            })
            const afterClaim = retirement(prepared)
            if (afterClaim) return { code: afterClaim }
            if (
              captured.operationID !== prepared.operationID ||
              captured.contextFingerprint !== prepared.contextFingerprint
            ) {
              const actual = pending.get(captured.operationID)
              if (actual?.contextFingerprint === captured.contextFingerprint) retire(actual, "context_changed")
              return { code: "context_changed" } as const
            }
            if (claimed.has(prepared.operationID) || consent.has(prepared.operationID))
              return { code: "approval_consumed" } as const
            claimed.add(prepared.operationID)
            reserved = true
            if (captured.decision === "reject") {
              retire(prepared, "approval_rejected")
              return { code: "approval_rejected" } as const
            }
            if (captured.decision === "deploy" && prepared.action.kind !== "deploy")
              return { code: "untrusted_approval" } as const
            return captured
          })
          if ("code" in decision) return yield* Effect.fail(decision)
          const policy = deadline({ prepared, claimedAt })
          if (!Effect.isEffect(policy)) return yield* Effect.fail({ code: "approval_unavailable" } as const)
          const expires = yield* policy
          const afterPolicy = retirement(prepared)
          if (afterPolicy) return yield* Effect.fail({ code: afterPolicy })
          if (!Number.isFinite(expires)) return yield* Effect.fail({ code: "approval_unavailable" } as const)
          if (expires <= claimedAt) {
            retire(prepared, "approval_expired")
            return yield* Effect.fail({ code: "approval_expired" } as const)
          }
          const current = yield* now
          // No yield separates the final finite/state checks from private consent commit.
          const beforeCommit = retirement(prepared)
          if (beforeCommit) return yield* Effect.fail({ code: beforeCommit })
          if (!Number.isFinite(current)) return yield* Effect.fail({ code: "approval_unavailable" } as const)
          if (current >= expires) {
            retire(prepared, "approval_expired")
            return yield* Effect.fail({ code: "approval_expired" } as const)
          }
          consent.set(prepared.operationID, expires)
          claimed.delete(prepared.operationID)
          reserved = false
          // Snapshot only: future execution must revalidate and consume private consent.
          return prepared
        }).pipe(
          Effect.onExit((exit) =>
            Effect.sync(() => {
              if (Exit.isFailure(exit) && reserved) cancelledHere = retire(prepared, "approval_cancelled")
            }),
          ),
        )
        return yield* owned(
          Effect.acquireUseRelease(
            Scope.make(),
            (scope) => attempt.pipe(Scope.provide(scope)),
            (scope, exit) => Scope.close(scope, exit),
          ).pipe(Effect.catchCause(failure)),
        ).pipe(Effect.catchCause(failure))
      }),
    }
  })

function validateGrant(
  grant: Grant,
  request: FtcOperation.OperationRequest,
  robotMode: FtcOperation.RobotMode,
): FtcOperation.OperationError["code"] | undefined {
  if (!grant || !Schema.is(FtcProject.ProjectContext)(grant.project) || grant.project.projectID !== request.projectID)
    return "project_unauthorized"
  if (grant.initiator !== request.initiator) return "initiator_mismatch"
  if (grant.robotMode !== robotMode) return "robot_mode_mismatch"
  if (
    (grant.initiator === "agent" || request.chatID !== undefined) &&
    (!Schema.is(FtcProject.ChatRef)(grant.chat) ||
      grant.chat.projectID !== request.projectID ||
      grant.chat.chatID !== request.chatID)
  )
    return "chat_unauthorized"
  if (
    !Schema.is(Schema.Literal(true))(grant.verified) ||
    typeof grant.controllerID !== "string" ||
    !grant.controllerID.trim()
  )
    return "controller_unknown"
  if (grant.controllerID !== request.controllerID || grant.generation !== request.generation) return "context_changed"
  if (!Array.isArray(grant.capabilities) || !grant.capabilities.includes(request.action.kind))
    return "unsupported_operation"
  if (grant.initiator === "agent" && robotMode === "observation" && request.action.kind !== "deploy")
    return "observation_only"
  return undefined
}

function immutable<A>(value: A): A {
  if (value && typeof value === "object") {
    Object.values(value).forEach(immutable)
    Object.freeze(value)
  }
  return value
}

function joinPreparation<A, E>(fiber: Fiber.Fiber<A, E>) {
  return Effect.callback<A, E>((resume) => {
    // Effect beta.83 notifies a mutable observer list. Defer removal so an owner
    // Scope closer keeps its retirement notification while the caller resumes.
    const remove = fiber.addObserver((exit) => queueMicrotask(() => resume(exit)))
    return Effect.sync(remove)
  })
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort((left, right) => (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0))
      .map((entry) => `${JSON.stringify(entry[0])}:${canonical(entry[1])}`)
      .join(",")}}`
  return JSON.stringify(value)
}
