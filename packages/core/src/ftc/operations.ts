export * as Operations from "./operations"

import { createHash } from "node:crypto"
import { FtcOperation } from "@opencode-ai/schema/ftc-operation"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { Context, Effect, Exit, Fiber, Layer, Option, Schema, Scope } from "effect"

export {
  RobotMode,
  OperationID,
  DeploymentArtifactContext,
  Action,
  OperationRequest,
  Status,
  PreparedOperation,
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
}

export interface Interface {
  readonly prepareOperation: (input: {
    readonly request: FtcOperation.OperationRequest
    readonly robotMode: FtcOperation.RobotMode
    readonly caller: object
  }) => Effect.Effect<FtcOperation.PreparedOperation, FtcOperation.OperationError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/FtcOperations") {}
export const layer = (ports: Ports) => Layer.effect(Service, make(ports))

export const make = (ports: Ports): Effect.Effect<Interface, never, Scope.Scope> =>
  Effect.gen(function* () {
    const operations = yield* Scope.make()
    const pending = new Map<FtcOperation.OperationID, FtcOperation.PreparedOperation>()
    let closed = false
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        closed = true
        pending.clear()
      }).pipe(Effect.andThen(Scope.close(operations, Exit.void))),
    )
    const active = () => Effect.suspend(() => (closed ? Effect.fail({ code: "owner_closed" } as const) : Effect.void))
    // Caller cancellation owns one wait; owner disposal joins all waits through asynchronous port cleanup.
    const owned = <A, E>(effect: Effect.Effect<A, E>) =>
      active().pipe(
        Effect.andThen(Effect.acquireUseRelease(Effect.forkIn(effect, operations), joinPreparation, Fiber.interrupt)),
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
