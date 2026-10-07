export * as FtcProjectExecution from "./execution"

import { Effect } from "effect"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import type { Session } from "@opencode-ai/schema/session"
import type { SessionV2 } from "../../session"
import type { SessionExecution } from "../../session/execution"
import type { FtcAgentGate } from "../agent/gate"
import { FtcProjects } from "../projects"
import type { ProjectGate } from "./gate"

interface Ports {
  readonly gate: ProjectGate.Interface
  readonly resolve: FtcAgentGate.Port["resolve"]
  // Construction binds this closure before exposing any public service or starting work.
  readonly execution: () => SessionExecution.Interface & SessionExecution.TrackedInterface
  readonly changed: (status: FtcProject.OwnerStatus) => Effect.Effect<void>
}

export const disabled = (input: Ports) =>
  make(input, Effect.fail(new FtcProject.ExecutionUnavailable({ code: "execution_disabled" })))

/** Requires caller-supplied controlled execution ports. Real hosts exclusively bind disabled. */
export const controlled = (input: Ports) => make(input, Effect.void)

const make = (input: Ports, available: Effect.Effect<void, FtcProject.ExecutionUnavailable>) =>
  Effect.gen(function* () {
    const proofs = new WeakMap<
      object,
      { readonly request: Parameters<SessionV2.Interface["prompt"]>[0]; readonly lease: FtcProject.GateLease }
    >()
    const changed = (chat: FtcProject.ChatRef) =>
      input.gate.activeChat(chat).pipe(
        Effect.flatMap((active) => input.changed({ projectID: chat.projectID, ...(active ? { active } : {}) })),
        Effect.exit,
        Effect.asVoid,
      )
    const owners = new Map<FtcProject.GateToken, FtcProject.ChatRef>()
    const gate: ProjectGate.Interface = {
      ...input.gate,
      acquire: (chat) =>
        Effect.scoped(
          Effect.uninterruptibleMask((restore) =>
            Effect.gen(function* () {
              const ownership = { accepted: false }
              const result = yield* Effect.acquireRelease(
                restore(input.gate.acquire(chat)),
                (result) =>
                  result.kind === "acquired" && !ownership.accepted ? input.gate.release(result.lease) : Effect.void,
                { interruptible: true },
              )
              if (result.kind === "busy") return result
              owners.set(result.lease.token, chat)
              yield* changed(chat)
              ownership.accepted = true
              return result
            }),
          ),
        ),
      release: (lease) =>
        Effect.gen(function* () {
          const chat = owners.get(lease.token)
          if (!(yield* input.gate.held(lease))) return
          yield* input.gate.release(lease)
          if (!chat || (yield* input.gate.held(lease))) return
          owners.delete(lease.token)
          yield* changed(chat)
        }),
    }
    const lifecycle: Effect.Success<ReturnType<typeof FtcProjects.lifecycle>> = yield* FtcProjects.lifecycle({
      gate,
      execution: {
        wake: ({ chat, lease }) => input.execution().wakeWithSettlement(chat.sessionID, () => lifecycle.settled(lease)),
        interrupt: (id) => input.execution().interrupt(id),
      },
    })
    const resolve = (session: Session.Info) =>
      input
        .resolve({ sessionID: session.id, location: session.location })
        .pipe(
          Effect.mapError(
            () => new FtcProject.ExecutionUnavailable({ code: "membership_unavailable", sessionID: session.id }),
          ),
        )
    const guard: SessionV2.AdmissionGuard = {
      check: (request, session, proof) =>
        Effect.gen(function* () {
          const member = yield* resolve(session)
          if (member.kind === "unmanaged") return
          yield* available
          const held = proof ? proofs.get(proof) : undefined
          if (
            !held ||
            held.request !== request ||
            request.resume !== false ||
            held.lease.sessionID !== session.id ||
            held.lease.chatID !== member.chat.chatID ||
            !(yield* gate.held(held.lease))
          )
            yield* new FtcProject.ExecutionUnavailable({
              code: "managed_submit_required",
              sessionID: session.id,
            })
        }),
    }
    const gatePort: FtcAgentGate.Port = {
      resolve: input.resolve,
      acquire: (chat) =>
        available.pipe(
          Effect.mapError((): FtcProject.GateError => ({ code: "execution_disabled", recovery: "retry" })),
          Effect.andThen(lifecycle.acquire(chat)),
          Effect.mapError(
            (error): FtcProject.GateError => ({
              code: error.code === "gate_closed" || error.code === "execution_disabled" ? error.code : "invalid_chat",
              recovery: "retry",
            }),
          ),
        ),
      release: lifecycle.settled,
    }
    const bind = (session: SessionV2.Interface) => {
      const submission = FtcProjects.submitter({
        gate,
        admission: {
          prompt: (request, lease) =>
            Effect.gen(function* () {
              if (!lease)
                return yield* new FtcProject.ExecutionUnavailable({
                  code: "managed_submit_required",
                  sessionID: request.sessionID,
                })
              const captured = freeze(structuredClone(request))
              const proof = {}
              proofs.set(proof, { request: captured, lease: Object.freeze({ ...lease }) })
              return yield* session.prompt(captured, proof).pipe(
                Effect.ensuring(
                  Effect.sync(() => {
                    proofs.delete(proof)
                  }),
                ),
              )
            }),
        },
        handoff: lifecycle.handoff,
      })
      const requireChat = (chat: FtcProject.ChatRef) =>
        Effect.gen(function* () {
          const recorded = yield* session.get(chat.sessionID)
          const member = yield* resolve(recorded)
          if (
            member.kind !== "managed" ||
            member.chat.projectID !== chat.projectID ||
            member.chat.chatID !== chat.chatID
          )
            yield* new FtcProject.ExecutionUnavailable({
              code: "membership_unavailable",
              sessionID: chat.sessionID,
            })
        })
      return {
        submitPrompt: (request: FtcProject.SubmitPrompt) =>
          Effect.gen(function* () {
            const captured = freeze(structuredClone(request))
            yield* requireChat(captured.chat)
            yield* available
            return yield* submission.submitPrompt(captured)
          }),
        resume: (chat: FtcProject.ChatRef) =>
          Effect.scoped(
            Effect.gen(function* () {
              const captured = Object.freeze({ ...chat })
              yield* requireChat(captured)
              yield* available
              const claim = yield* Effect.acquireRelease(gate.acquire(captured), (claim) =>
                claim.kind === "acquired" ? gate.release(claim.lease) : Effect.void,
              )
              if (claim.kind === "busy") return claim
              yield* session.resume(captured.sessionID)
              return { kind: "settled" } as const
            }),
          ),
        stop: (chat: FtcProject.ChatRef) => requireChat(chat).pipe(Effect.andThen(lifecycle.stopRun({ chat }))),
        stopRaw: (id: Session.ID) =>
          Effect.gen(function* () {
            const recorded = yield* session.get(id)
            const member = yield* resolve(recorded)
            if (member.kind === "unmanaged") return yield* session.interrupt(id)
            return yield* lifecycle.stopRun({ chat: member.chat })
          }),
        active: (project: FtcProject.ProjectRequest) =>
          gate
            .activeChat(project)
            .pipe(Effect.map((active) => ({ projectID: project.projectID, ...(active ? { active } : {}) }))),
      }
    }
    return { guard, gatePort, bind, lifecycle }
  })

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
