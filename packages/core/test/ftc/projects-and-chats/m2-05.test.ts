import { expect, test } from "bun:test"
import { FtcProject } from "@opencode-ai/schema/ftc-project"
import { Location } from "@opencode-ai/schema/location"
import { Project } from "@opencode-ai/schema/project"
import { Session } from "@opencode-ai/schema/session"
import { SessionInput } from "@opencode-ai/schema/session-input"
import { SessionMessage } from "@opencode-ai/schema/session-message"
import { AbsolutePath } from "@opencode-ai/schema/schema"
import { DateTime, Deferred, Effect, Exit, Fiber, Scope } from "effect"
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
    const admission: FtcProjects.Submission["admission"] = {
      prompt: (input) =>
        Effect.succeed({
          id: input.id ?? SessionMessage.ID.create(),
          admittedSeq: 1,
          sessionID: input.sessionID,
          prompt: { text: input.prompt.text },
          delivery: input.delivery ?? "steer",
          timeCreated: DateTime.makeUnsafe(0),
        } satisfies SessionInput.Admitted),
    }
    return { projects, chats, gate, admission }
  })

const run = <A, E>(effect: Effect.Effect<A, E, Scope.Scope>) => Effect.runPromise(effect.pipe(Effect.scoped))

// Releasing in stopRun before interruption cleanup allows another chat to enter.
test("stop retains ownership until cleanup settles", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const cleaning = yield* Deferred.make<void>()
      const clean = yield* Deferred.make<void>()
      const lifecycle = yield* FtcProjects.lifecycle({
        gate: f.gate,
        execution: {
          wake: () => Effect.void,
          interrupt: () => Deferred.succeed(cleaning, undefined).pipe(Effect.andThen(Deferred.await(clean))),
        },
      })
      const initial = yield* lifecycle.acquire(f.chats[0])
      if (initial.kind !== "acquired") throw new Error("expected initial claim")
      const stop = yield* lifecycle.stopRun({ chat: f.chats[0] }).pipe(Effect.forkChild)
      yield* Deferred.await(cleaning)
      const duringCleanup = yield* f.gate.acquire(f.chats[1])
      yield* Deferred.succeed(clean, undefined)
      yield* Fiber.join(stop)
      yield* lifecycle.settled(initial.lease)
      expect(duringCleanup.kind).toBe("busy")
      const afterCleanup = yield* lifecycle.acquire(f.chats[1])
      expect(afterCleanup.kind).toBe("acquired")
      if (afterCleanup.kind !== "acquired") throw new Error("expected successor claim")
      const newLease = afterCleanup.lease
      yield* lifecycle.settled(initial.lease)
      const afterOldCallback = yield* f.gate.activeChat(f.projects[0])
      expect(afterOldCallback).toEqual(f.chats[1])
      expect(yield* f.gate.held(newLease)).toBe(true)
      yield* lifecycle.settled(newLease)
    }),
  ))

// A terminal callback during bounded registration cannot unlock its pending wake.
test("terminal notification waits for pending handoff acceptance", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const registering = yield* Deferred.make<void>()
      const registered = yield* Deferred.make<void>()
      const lifecycle = yield* FtcProjects.lifecycle({
        gate: f.gate,
        execution: {
          wake: () => Deferred.succeed(registering, undefined).pipe(Effect.andThen(Deferred.await(registered))),
          interrupt: () => Effect.void,
        },
      })
      const reserved = yield* f.gate.acquire(f.chats[0])
      if (reserved.kind !== "acquired") throw new Error("expected reservation")
      const receipt = yield* f.admission.prompt({ sessionID: f.chats[0].sessionID, prompt: { text: "admitted" } })
      const handoff = yield* lifecycle
        .handoff({ chat: f.chats[0], receipt, lease: reserved.lease })
        .pipe(Effect.forkChild)
      yield* Deferred.await(registering)
      yield* lifecycle.settled(reserved.lease)
      const duringRegistration = yield* f.gate.acquire(f.chats[1])
      yield* Deferred.succeed(registered, undefined)
      yield* Fiber.join(handoff)
      expect(duringRegistration.kind).toBe("busy")
      expect((yield* f.gate.acquire(f.chats[1])).kind).toBe("acquired")
    }),
  ))

// An old execution's terminal notification must not consume a later admission token.
test("admission bridges old execution completion and retains its own terminal identity", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const admitting = yield* Deferred.make<void>()
      const admitted = yield* Deferred.make<void>()
      const accepted: FtcProject.GateLease[] = []
      const lifecycle = yield* FtcProjects.lifecycle({
        gate: f.gate,
        execution: {
          wake: (input) => Effect.sync(() => accepted.push(input.lease)).pipe(Effect.asVoid),
          interrupt: () => Effect.void,
        },
      })
      const initial = yield* lifecycle.acquire(f.chats[0])
      if (initial.kind !== "acquired") throw new Error("expected execution")
      const submitter = FtcProjects.submitter({
        gate: f.gate,
        handoff: lifecycle.handoff,
        admission: {
          prompt: (input) =>
            Deferred.succeed(admitting, undefined).pipe(
              Effect.andThen(Deferred.await(admitted)),
              Effect.andThen(f.admission.prompt(input)),
            ),
        },
      })
      const submission = yield* submitter
        .submitPrompt({ chat: f.chats[0], prompt: { text: "later" } })
        .pipe(Effect.forkChild)
      yield* Deferred.await(admitting)
      yield* lifecycle.settled(initial.lease)
      expect((yield* f.gate.acquire(f.chats[1])).kind).toBe("busy")
      yield* Deferred.succeed(admitted, undefined)
      expect((yield* Fiber.join(submission)).kind).toBe("admitted")
      expect(accepted).toHaveLength(1)
      expect(accepted[0].token).not.toBe(initial.lease.token)
      yield* lifecycle.settled(initial.lease)
      expect((yield* f.gate.acquire(f.chats[1])).kind).toBe("busy")
      // A terminal no-work/rejection notification uses the admission lease even with no execution acquisition.
      yield* lifecycle.settled(accepted[0])
      expect((yield* f.gate.acquire(f.chats[1])).kind).toBe("acquired")
    }),
  ))

test("idle and different-chat stops do not interrupt the current owner", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const interrupted: Session.ID[] = []
      const lifecycle = yield* FtcProjects.lifecycle({
        gate: f.gate,
        execution: {
          wake: () => Effect.void,
          interrupt: (sessionID) => Effect.sync(() => interrupted.push(sessionID)).pipe(Effect.asVoid),
        },
      })
      yield* lifecycle.stopRun({ chat: f.chats[0] })
      expect(interrupted).toEqual([])
      const execution = yield* lifecycle.acquire(f.chats[0])
      if (execution.kind !== "acquired") throw new Error("expected owner")
      yield* lifecycle.stopRun({ chat: f.chats[1] })
      expect(interrupted).toEqual([])
      expect((yield* lifecycle.acquire(f.chats[2])).kind).toBe("acquired")
      yield* lifecycle.settled(execution.lease)
    }),
  ))

test("stop waits for registration before interruption and retains accepted reservations", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const registering = yield* Deferred.make<void>()
      const registered = yield* Deferred.make<void>()
      const cleaning = yield* Deferred.make<void>()
      const clean = yield* Deferred.make<void>()
      const interrupted: Session.ID[] = []
      const leases: FtcProject.GateLease[] = []
      const lifecycle = yield* FtcProjects.lifecycle({
        gate: f.gate,
        execution: {
          wake: (input) =>
            Effect.sync(() => leases.push(input.lease)).pipe(
              Effect.andThen(Deferred.succeed(registering, undefined)),
              Effect.andThen(Deferred.await(registered)),
            ),
          interrupt: (sessionID) =>
            Effect.sync(() => interrupted.push(sessionID)).pipe(
              Effect.andThen(Deferred.succeed(cleaning, undefined)),
              Effect.andThen(Deferred.await(clean)),
            ),
        },
      })
      const submitter = FtcProjects.submitter({ gate: f.gate, admission: f.admission, handoff: lifecycle.handoff })
      const submission = yield* submitter
        .submitPrompt({ chat: f.chats[0], prompt: { text: "run" } })
        .pipe(Effect.forkChild)
      yield* Deferred.await(registering)
      const stop = yield* lifecycle.stopRun({ chat: f.chats[0] }).pipe(Effect.forkChild)
      yield* Effect.yieldNow
      const earlyInterrupts = [...interrupted]
      const duringRegistration = yield* f.gate.acquire(f.chats[1])
      yield* Deferred.succeed(registered, undefined)
      yield* Deferred.await(cleaning)
      const duringCleanup = yield* f.gate.acquire(f.chats[1])
      yield* Deferred.succeed(clean, undefined)
      yield* Fiber.join(stop)
      yield* Fiber.join(submission)
      expect(earlyInterrupts).toEqual([])
      expect(duringRegistration.kind).toBe("busy")
      expect(interrupted).toEqual([f.chats[0].sessionID])
      expect(duringCleanup.kind).toBe("busy")
      // Interrupt return alone does not manufacture an admission-terminal notification.
      expect((yield* f.gate.acquire(f.chats[1])).kind).toBe("busy")
      yield* lifecycle.settled(leases[0])
      expect((yield* f.gate.acquire(f.chats[1])).kind).toBe("acquired")
    }),
  ))

test("same-chat admission and execution claims settle independently", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const accepted: FtcProject.GateLease[] = []
      const lifecycle = yield* FtcProjects.lifecycle({
        gate: f.gate,
        execution: {
          wake: (input) => Effect.sync(() => accepted.push(input.lease)).pipe(Effect.asVoid),
          interrupt: () => Effect.void,
        },
      })
      const submitter = FtcProjects.submitter({ gate: f.gate, admission: f.admission, handoff: lifecycle.handoff })
      yield* submitter.submitPrompt({ chat: f.chats[0], prompt: { text: "first" } })
      yield* submitter.submitPrompt({ chat: f.chats[0], prompt: { text: "steer" } })
      const execution = yield* lifecycle.acquire(f.chats[0])
      if (execution.kind !== "acquired") throw new Error("expected execution")
      expect(new Set([...accepted.map((lease) => lease.token), execution.lease.token]).size).toBe(3)
      yield* lifecycle.settled(execution.lease)
      yield* lifecycle.settled(accepted[0])
      yield* lifecycle.settled(accepted[0])
      yield* lifecycle.settled({ ...accepted[1], sessionID: f.chats[1].sessionID })
      expect((yield* f.gate.acquire(f.chats[1])).kind).toBe("busy")
      yield* lifecycle.settled(accepted[1])
      expect((yield* f.gate.acquire(f.chats[1])).kind).toBe("acquired")
    }),
  ))

test("failed handoff releases only its reservation", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const failure: FtcProject.GateError = { code: "gate_closed", recovery: "retry" }
      const lifecycle = yield* FtcProjects.lifecycle({
        gate: f.gate,
        execution: { wake: () => Effect.fail(failure), interrupt: () => Effect.void },
      })
      const execution = yield* lifecycle.acquire(f.chats[0])
      if (execution.kind !== "acquired") throw new Error("expected execution")
      const submitter = FtcProjects.submitter({ gate: f.gate, admission: f.admission, handoff: lifecycle.handoff })
      const result = yield* submitter.submitPrompt({ chat: f.chats[0], prompt: { text: "admitted" } }).pipe(Effect.exit)
      expect(Exit.isFailure(result)).toBe(true)
      expect(yield* f.gate.held(execution.lease)).toBe(true)
      yield* lifecycle.settled(execution.lease)
      expect((yield* f.gate.acquire(f.chats[1])).kind).toBe("acquired")
    }),
  ))

test("scope closure waits for bounded handoff registration before interruption", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const scope = yield* Scope.make()
      const registering = yield* Deferred.make<void>()
      const registered = yield* Deferred.make<void>()
      const interruptions: Session.ID[] = []
      const lifecycle = yield* FtcProjects.lifecycle({
        gate: f.gate,
        execution: {
          wake: () => Deferred.succeed(registering, undefined).pipe(Effect.andThen(Deferred.await(registered))),
          interrupt: (sessionID) => Effect.sync(() => interruptions.push(sessionID)).pipe(Effect.asVoid),
        },
      }).pipe(Effect.provideService(Scope.Scope, scope))
      const submission = yield* FtcProjects.submitter({
        gate: f.gate,
        admission: f.admission,
        handoff: lifecycle.handoff,
      })
        .submitPrompt({ chat: f.chats[0], prompt: { text: "handoff" } })
        .pipe(Effect.forkChild)
      yield* Deferred.await(registering)
      const closing = yield* Scope.close(scope, Exit.void).pipe(Effect.forkChild)
      yield* Effect.yieldNow
      const earlyInterruptions = [...interruptions]
      const duringRegistration = yield* f.gate.acquire(f.chats[1])
      yield* Deferred.succeed(registered, undefined)
      yield* Fiber.join(submission)
      yield* Fiber.join(closing)
      expect(earlyInterruptions).toEqual([])
      expect(duringRegistration.kind).toBe("busy")
      expect(interruptions).toEqual([f.chats[0].sessionID])
      expect((yield* f.gate.acquire(f.chats[1])).kind).toBe("acquired")
    }),
  ))

test("cancelling the submitting fiber during masked handoff retains accepted ownership", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const registering = yield* Deferred.make<void>()
      const registered = yield* Deferred.make<void>()
      const accepted: FtcProject.GateLease[] = []
      const lifecycle = yield* FtcProjects.lifecycle({
        gate: f.gate,
        execution: {
          wake: (input) =>
            Deferred.succeed(registering, undefined).pipe(
              Effect.andThen(Deferred.await(registered)),
              Effect.andThen(Effect.sync(() => accepted.push(input.lease))),
              Effect.asVoid,
            ),
          interrupt: () => Effect.void,
        },
      })
      const submission = yield* FtcProjects.submitter({
        gate: f.gate,
        admission: f.admission,
        handoff: lifecycle.handoff,
      })
        .submitPrompt({ chat: f.chats[0], prompt: { text: "handoff" } })
        .pipe(Effect.forkChild)
      yield* Deferred.await(registering)
      const cancellation = yield* Fiber.interrupt(submission).pipe(Effect.forkChild)
      yield* Effect.yieldNow
      const duringRegistration = yield* f.gate.acquire(f.chats[1])
      yield* Deferred.succeed(registered, undefined)
      yield* Fiber.join(cancellation)
      expect(duringRegistration.kind).toBe("busy")
      expect(Exit.isFailure(yield* Fiber.await(submission))).toBe(true)
      expect(accepted).toHaveLength(1)
      expect(yield* f.gate.held(accepted[0])).toBe(true)
      yield* lifecycle.settled(accepted[0])
      expect((yield* f.gate.acquire(f.chats[1])).kind).toBe("acquired")
    }),
  ))

test("handoff rejects fabricated mismatched and released leases before scheduling", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const scheduled: FtcProject.GateLease[] = []
      const lifecycle = yield* FtcProjects.lifecycle({
        gate: f.gate,
        execution: {
          wake: (input) => Effect.sync(() => scheduled.push(input.lease)).pipe(Effect.asVoid),
          interrupt: () => Effect.void,
        },
      })
      const initial = yield* f.gate.acquire(f.chats[0])
      if (initial.kind !== "acquired") throw new Error("expected reservation")
      const receipt = yield* f.admission.prompt({ sessionID: f.chats[0].sessionID, prompt: { text: "admitted" } })
      const fabricated = { ...initial.lease, token: FtcProject.GateToken.make("gate_not-held") }
      expect(
        Exit.isFailure(yield* lifecycle.handoff({ chat: f.chats[0], receipt, lease: fabricated }).pipe(Effect.exit)),
      ).toBe(true)
      expect(
        Exit.isFailure(yield* lifecycle.handoff({ chat: f.chats[1], receipt, lease: initial.lease }).pipe(Effect.exit)),
      ).toBe(true)
      expect(yield* f.gate.held(initial.lease)).toBe(true)
      yield* f.gate.release(initial.lease)
      expect(
        Exit.isFailure(yield* lifecycle.handoff({ chat: f.chats[0], receipt, lease: initial.lease }).pipe(Effect.exit)),
      ).toBe(true)
      expect(scheduled).toEqual([])
    }),
  ))

test("scope closure rejects a delayed execution acquisition and compensates its new token", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const scope = yield* Scope.make()
      const acquiring = yield* Deferred.make<void>()
      const allowAcquire = yield* Deferred.make<void>()
      const lifecycle = yield* FtcProjects.lifecycle({
        gate: {
          ...f.gate,
          acquire: (chat) =>
            Deferred.succeed(acquiring, undefined).pipe(
              Effect.andThen(Deferred.await(allowAcquire)),
              Effect.andThen(f.gate.acquire(chat)),
            ),
        },
        execution: { wake: () => Effect.void, interrupt: () => Effect.void },
      }).pipe(Effect.provideService(Scope.Scope, scope))
      const acquisition = yield* lifecycle.acquire(f.chats[0]).pipe(Effect.exit, Effect.forkChild)
      yield* Deferred.await(acquiring)
      yield* Scope.close(scope, Exit.void)
      yield* Deferred.succeed(allowAcquire, undefined)
      expect(Exit.isFailure(yield* Fiber.join(acquisition))).toBe(true)
      expect((yield* f.gate.acquire(f.chats[1])).kind).toBe("acquired")
    }),
  ))

test("cancelling pending execution acquisition leaves no claim or terminal release", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const acquiring = yield* Deferred.make<void>()
      const releases: FtcProject.GateLease[] = []
      const lifecycle = yield* FtcProjects.lifecycle({
        gate: {
          ...f.gate,
          acquire: () => Deferred.succeed(acquiring, undefined).pipe(Effect.andThen(Effect.never)),
          release: (lease) => Effect.sync(() => releases.push(lease)).pipe(Effect.andThen(f.gate.release(lease))),
        },
        execution: { wake: () => Effect.void, interrupt: () => Effect.void },
      })
      const acquisition = yield* lifecycle.acquire(f.chats[0]).pipe(Effect.forkChild)
      yield* Deferred.await(acquiring)
      yield* Fiber.interrupt(acquisition)
      expect(Exit.isFailure(yield* Fiber.await(acquisition))).toBe(true)
      expect(releases).toEqual([])
      expect((yield* f.gate.acquire(f.chats[1])).kind).toBe("acquired")
    }),
  ))

test("held validates the complete process-local lease identity", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const initial = yield* f.gate.acquire(f.chats[0])
      if (initial.kind !== "acquired") throw new Error("expected reservation")
      expect(yield* f.gate.held(initial.lease)).toBe(true)
      expect(yield* f.gate.held({ ...initial.lease, projectKey: f.projects[1].canonicalRoot })).toBe(false)
      expect(yield* f.gate.held({ ...initial.lease, chatID: f.chats[1].chatID })).toBe(false)
      expect(yield* f.gate.held({ ...initial.lease, sessionID: f.chats[1].sessionID })).toBe(false)
      expect(yield* f.gate.held({ ...initial.lease, token: FtcProject.GateToken.make("gate_fabricated") })).toBe(false)
      yield* f.gate.release(initial.lease)
      expect(yield* f.gate.held(initial.lease)).toBe(false)
    }),
  ))

test("defective handoff cleans its reservation even after a deferred terminal callback", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const registering = yield* Deferred.make<void>()
      const fail = yield* Deferred.make<void>()
      const lifecycle = yield* FtcProjects.lifecycle({
        gate: f.gate,
        execution: {
          wake: () =>
            Deferred.succeed(registering, undefined).pipe(
              Effect.andThen(Deferred.await(fail)),
              Effect.andThen(Effect.die("registration failed")),
            ),
          interrupt: () => Effect.void,
        },
      })
      const initial = yield* f.gate.acquire(f.chats[0])
      if (initial.kind !== "acquired") throw new Error("expected reservation")
      const receipt = yield* f.admission.prompt({ sessionID: f.chats[0].sessionID, prompt: { text: "admitted" } })
      const registration = yield* lifecycle
        .handoff({ chat: f.chats[0], receipt, lease: initial.lease })
        .pipe(Effect.exit, Effect.forkChild)
      yield* Deferred.await(registering)
      yield* lifecycle.settled(initial.lease)
      const duringRegistration = yield* f.gate.acquire(f.chats[1])
      yield* Deferred.succeed(fail, undefined)
      expect(Exit.isFailure(yield* Fiber.join(registration))).toBe(true)
      expect(duringRegistration.kind).toBe("busy")
      expect((yield* f.gate.acquire(f.chats[1])).kind).toBe("acquired")
    }),
  ))

test("scope closure waits for interruption cleanup then releases remaining exact claims", () =>
  run(
    Effect.gen(function* () {
      const f = yield* fixture()
      const scope = yield* Scope.make()
      const cleaning = yield* Deferred.make<void>()
      const clean = yield* Deferred.make<void>()
      const lifecycle = yield* FtcProjects.lifecycle({
        gate: f.gate,
        execution: {
          wake: () => Effect.void,
          interrupt: () => Deferred.succeed(cleaning, undefined).pipe(Effect.andThen(Deferred.await(clean))),
        },
      }).pipe(Effect.provideService(Scope.Scope, scope))
      const execution = yield* lifecycle.acquire(f.chats[0])
      if (execution.kind !== "acquired") throw new Error("expected execution")
      const submitter = FtcProjects.submitter({ gate: f.gate, admission: f.admission, handoff: lifecycle.handoff })
      yield* submitter.submitPrompt({ chat: f.chats[0], prompt: { text: "pending" } })
      const closing = yield* Scope.close(scope, Exit.void).pipe(Effect.forkChild)
      yield* Deferred.await(cleaning)
      const duringCleanup = yield* f.gate.acquire(f.chats[1])
      const rejected = yield* lifecycle.acquire(f.chats[0]).pipe(Effect.exit)
      yield* Deferred.succeed(clean, undefined)
      yield* Fiber.join(closing)
      expect(duringCleanup.kind).toBe("busy")
      expect(Exit.isFailure(rejected)).toBe(true)
      expect(yield* f.gate.held(execution.lease)).toBe(false)
      const next = yield* f.gate.acquire(f.chats[1])
      if (next.kind !== "acquired") throw new Error("expected next owner")
      yield* lifecycle.settled(execution.lease)
      expect(yield* f.gate.held(next.lease)).toBe(true)
    }),
  ))
