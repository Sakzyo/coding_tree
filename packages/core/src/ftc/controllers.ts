export * as Controllers from "./controllers"

import { Context, Effect, Layer } from "effect"
import { FtcController } from "@opencode-ai/schema/ftc-controller"
import { Adb } from "./controllers/adb"

export { ControllerCandidate, DiscoveryError } from "@opencode-ai/schema/ftc-controller"

export interface Interface {
  readonly discoverControllers: () => Effect.Effect<
    readonly FtcController.ControllerCandidate[],
    FtcController.DiscoveryError
  >
}

export class Service extends Context.Service<Service, Interface>()("@opencode/FtcControllers") {}

export const layer = (transport: Adb.DiscoveryTransport) =>
  Layer.succeed(Service, {
    discoverControllers: () =>
      Effect.scoped(
        Effect.gen(function* () {
          const response = yield* transport.readDevices(["devices", "-l"])
          const result = Adb.parseDevices(response)
          if ("error" in result) return yield* Effect.fail(result.error)
          return result.candidates
        }),
      ),
  })
