import { expect, test } from "bun:test"
import { FtcController } from "@opencode-ai/schema"
import { Deferred, Effect, Exit, Fiber, Schema } from "effect"
import { Controllers } from "../../../src/ftc/controllers"
import { Adb } from "../../../src/ftc/controllers/adb"

// Synthetic adb devices -l transcripts; no ADB process or physical device is used.
const transcript = (stdout: string): Adb.Response => ({ stdout, stderr: "", exitCode: 0 })
const discover = (response: Adb.Response) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const controllers = yield* Controllers.Service
      return yield* controllers.discoverControllers()
    }).pipe(Effect.provide(Controllers.layer({ readDevices: () => Effect.succeed(response) }))),
  )

test("unauthorized device is visible without deployment side effects", async () => {
  const mutationCalls: string[][] = []
  const readCalls: string[][] = []
  const candidates = await Effect.runPromise(
    Effect.gen(function* () {
      const controllers = yield* Controllers.Service
      return yield* controllers.discoverControllers()
    }).pipe(
      Effect.provide(
        Controllers.layer({
          readDevices: (args) => {
            if (args[0] !== "devices" || args[1] !== "-l" || args.length !== 2) mutationCalls.push([...args])
            readCalls.push([...args])
            return Effect.succeed(transcript("List of devices attached\nSERIAL_A\tunauthorized\n"))
          },
        }),
      ),
    ),
  )
  expect(candidates).toHaveLength(1)
  const candidate = candidates[0]
  expect(candidate.authorization).toBe("unauthorized")
  expect(candidate.state).toBe("unauthorized")
  expect(candidate.errorCodes).toEqual(["adb_unauthorized"])
  expect(candidate.transportAddress).toBe("SERIAL_A")
  expect(mutationCalls).toEqual([])
  expect(readCalls).toEqual([["devices", "-l"]])
})

test("multiple targets retain authorization and reported model facts without identity guesses", async () => {
  const candidates = await discover(
    transcript(
      "List of devices attached\r\nUSB_A device usb:1-2 product:ControlHub model:REV_Control_Hub device:ControlHub transport_id:1\r\n192.0.2.3:5555 offline transport_id:2\r\nPHONE_A device product:fixture model:Pixel_7 device:fixture transport_id:3\r\n",
    ),
  )
  expect(candidates.map((candidate) => [candidate.transportAddress, candidate.authorization, candidate.state])).toEqual(
    [
      ["USB_A", "authorized", "available"],
      ["192.0.2.3:5555", "unknown", "offline"],
      ["PHONE_A", "authorized", "available"],
    ],
  )
  expect(candidates[0]?.kind).toBe("control-hub")
  expect(candidates[0]?.model).toBe("REV_Control_Hub")
  expect(candidates[1]?.errorCodes).toEqual(["adb_offline"])
  expect(candidates[2]?.model).toBe("Pixel_7")
  expect(candidates[2]?.kind).toBeUndefined()
  expect(candidates.every((candidate) => !("controllerID" in candidate) && !("aliases" in candidate))).toBe(true)
  expect(candidates[0]?.guidanceCodes).toContain("control_hub_connection")
  expect(candidates[2]?.guidanceCodes).toContain("identify_control_hub_or_phone")
  expect(candidates[2]?.guidanceCodes).toContain("phone_compatibility_unverified")
  expect(
    candidates.every((candidate) => candidate.guidanceCodes.includes("expansion_hub_configuration_unobserved")),
  ).toBe(true)
  expect(candidates.every((candidate) => !("attachedExpansionHubs" in candidate) && !("wiring" in candidate))).toBe(
    true,
  )
})

test.each(["recovery", "bootloader", "sideload", "future-state", "no permissions (user in plugdev group)"])(
  "keeps %s visible but unavailable",
  async (state) => {
    const candidates = await discover(transcript(`List of devices attached\nSERIAL_A ${state}\n`))
    expect(candidates[0]?.state).toBe("unavailable")
    expect(candidates[0]?.adbState).toBe(state.startsWith("no permissions") ? "no permissions" : state)
    expect(candidates[0]?.authorization).toBe("unknown")
    expect(candidates[0]?.errorCodes).toEqual(["adb_unsupported_state"])
  },
)

test("successful empty discovery differs from missing output", async () => {
  expect(await discover(transcript("List of devices attached\n\n"))).toEqual([])
  expect(await discoverFailure(transcript(""))).toMatchObject({ code: "adb_invalid_response" })
})

test.each([
  "garbage\nSERIAL_A device\n",
  "List of devices attached\nSERIAL_A\n",
  "List of devices attached\nSERIAL_A device not-metadata\n",
  "List of devices attached\nSERIAL_A device model:one model:two\n",
  "List of devices attached\nSERIAL_A device\nSERIAL_A offline\n",
])("malformed transcript fails rather than reporting usable or empty targets: %s", async (stdout) => {
  expect(await discoverFailure(transcript(stdout))).toMatchObject({ code: "adb_invalid_response" })
})

test("ADB command failure differs from successful empty discovery", async () => {
  expect(
    await discoverFailure({ stdout: "List of devices attached\n", stderr: "cannot connect", exitCode: 1 }),
  ).toEqual({
    code: "adb_command_failed",
    detail: "cannot connect",
    exitCode: 1,
  })
})

test.each(["adb_missing_tool", "adb_transport_error"] as const)(
  "preserves %s from the read transport",
  async (code) => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const controllers = yield* Controllers.Service
        return yield* controllers.discoverControllers().pipe(Effect.flip)
      }).pipe(
        Effect.provide(Controllers.layer({ readDevices: () => Effect.fail({ code, detail: "fixture failure" }) })),
      ),
    )
    expect(result).toEqual({ code, detail: "fixture failure" })
  },
)

test.each(["success", "malformed", "command", "transport"] as const)(
  "releases the read resource after %s",
  async (outcome) => {
    const active = new Set<object>()
    const calls: object[] = []
    const layer = Controllers.layer({
      readDevices: () =>
        Effect.acquireRelease(
          Effect.sync(() => {
            const token = {}
            active.add(token)
            calls.push(token)
            return token
          }),
          (token) => Effect.sync(() => active.delete(token)),
        ).pipe(
          Effect.andThen(() =>
            outcome === "transport"
              ? Effect.fail({ code: "adb_transport_error" as const })
              : Effect.succeed(
                  outcome === "command"
                    ? { stdout: "", stderr: "fixture failure", exitCode: 1 }
                    : transcript(outcome === "malformed" ? "invalid" : "List of devices attached\nSERIAL_A device\n"),
                ),
          ),
        ),
    })
    await Effect.runPromise(Effect.void.pipe(Effect.provide(layer)))
    expect(calls).toEqual([])
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const controllers = yield* Controllers.Service
        return yield* controllers.discoverControllers()
      }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isSuccess(exit)).toBe(outcome === "success")
    expect(active.size).toBe(0)
    expect(calls).toHaveLength(1)
  },
)

test("cancellation releases the active read and fresh scopes do not retain discovery state", async () => {
  const active = new Set<object>()
  const acquired: object[] = []
  const started = Deferred.makeUnsafe<void>()
  const transport: Adb.DiscoveryTransport = {
    readDevices: () =>
      Effect.acquireRelease(
        Effect.sync(() => {
          const token = {}
          active.add(token)
          acquired.push(token)
          return token
        }),
        (token) => Effect.sync(() => active.delete(token)),
      ).pipe(Effect.andThen(Deferred.succeed(started, undefined)), Effect.andThen(Effect.never)),
  }
  const layer = Controllers.layer(transport)
  expect(active.size).toBe(0)
  await Effect.runPromise(
    Effect.gen(function* () {
      const controllers = yield* Controllers.Service
      const fiber = yield* controllers.discoverControllers().pipe(Effect.forkChild)
      yield* Deferred.await(started)
      expect(active.size).toBe(1)
      yield* Fiber.interrupt(fiber)
      const exit = yield* Fiber.await(fiber)
      expect(Exit.isFailure(exit)).toBe(true)
      expect(active.size).toBe(0)
    }).pipe(Effect.provide(layer)),
  )
  const fresh = Controllers.layer({
    readDevices: () =>
      Effect.acquireRelease(
        Effect.sync(() => {
          const token = {}
          active.add(token)
          acquired.push(token)
          return token
        }),
        (token) => Effect.sync(() => active.delete(token)),
      ).pipe(Effect.as(transcript("List of devices attached\nFRESH device\n"))),
  })
  const run = () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const controllers = yield* Controllers.Service
        return yield* controllers.discoverControllers()
      }).pipe(Effect.provide(fresh)),
    )
  expect((await run())[0]?.transportAddress).toBe("FRESH")
  expect(active.size).toBe(0)
  expect((await run())[0]?.transportAddress).toBe("FRESH")
  expect(active.size).toBe(0)
  expect(new Set(acquired).size).toBe(3)
})

test("canonical candidate contract omits optional values and is the exact facade contract", async () => {
  const candidate = (await discover(transcript("List of devices attached\nSERIAL_A unauthorized\n")))[0]
  expect(Controllers.ControllerCandidate).toBe(FtcController.ControllerCandidate)
  expect(Controllers.DiscoveryError).toBe(FtcController.DiscoveryError)
  expect(Schema.decodeUnknownSync(FtcController.ControllerCandidate)(candidate)).toEqual(candidate)
  expect(
    Schema.encodeSync(FtcController.ControllerCandidate)({ ...candidate, kind: undefined, model: undefined }),
  ).toEqual(candidate)
  expect(() =>
    Schema.decodeUnknownSync(FtcController.ControllerCandidate)({ ...candidate, authorization: "guessed" }),
  ).toThrow()
  expect(() =>
    Schema.decodeUnknownSync(FtcController.ControllerCandidate)({ ...candidate, transportAddress: "" }),
  ).toThrow()
  expect(JSON.parse(JSON.stringify(candidate))).toEqual(candidate)
})

const discoverFailure = (response: Adb.Response) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const controllers = yield* Controllers.Service
      return yield* controllers.discoverControllers().pipe(Effect.flip)
    }).pipe(Effect.provide(Controllers.layer({ readDevices: () => Effect.succeed(response) }))),
  )
