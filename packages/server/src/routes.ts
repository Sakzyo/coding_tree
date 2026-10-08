import type { Scope } from "effect"
import { Database } from "@opencode-ai/core/database/database"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { httpClient } from "@opencode-ai/core/effect/app-node-platform"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { EventV2 } from "@opencode-ai/core/event"
import { Credential } from "@opencode-ai/core/credential"
import { PermissionSaved } from "@opencode-ai/core/permission/saved"
import { PtyTicket } from "@opencode-ai/core/pty/ticket"
import { SessionV2 } from "@opencode-ai/core/session"
import { SessionExecution } from "@opencode-ai/core/session/execution"
import { LocationServiceMap } from "@opencode-ai/core/location-service-map"
import { makeGlobalNode } from "@opencode-ai/core/effect/app-node"
import { FtcProjects } from "@opencode-ai/core/ftc/projects"
import { FtcComposition } from "@opencode-ai/core/ftc/composition"
import { FtcProjectAdapters } from "@opencode-ai/core/ftc/projects/adapters"
import { ProjectAssociations } from "@opencode-ai/core/ftc/projects/sql"
import { SessionStore } from "@opencode-ai/core/session/store"
import { SessionProjector } from "@opencode-ai/core/session/projector"
import { ProjectV2 } from "@opencode-ai/core/project"
import { ToolOutputStore } from "@opencode-ai/core/tool-output-store"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Effect, Layer, Option } from "effect"
import { Api } from "./api"
import { ServerAuth } from "./auth"
import { handlers } from "./handlers"
import { authorizationLayer } from "./middleware/authorization"
import { schemaErrorLayer } from "./middleware/schema-error"
import { PtyEnvironment } from "./pty-environment"
import { layer as locationLayer } from "./location"
import { sessionLocationLayer } from "./middleware/session-location"

const applicationServices = (ftc: ReturnType<typeof ftcHost>) =>
  LayerNode.group([
    ftc.runtime,
    ftc.tracked,
    Database.node,
    EventV2.node,
    httpClient,
    ToolOutputStore.cleanupNode,
    SessionV2.node,
    PermissionSaved.node,
    PtyTicket.node,
    Credential.node,
    PtyEnvironment.node,
    LocationServiceMap.node,
  ])

export function createRoutes(password?: string) {
  return makeRoutes(
    password
      ? ServerAuth.Config.configLayer({ username: "opencode", password: Option.some(password) })
      : ServerAuth.Config.layer,
  )
}

export function createEmbeddedRoutes() {
  return makeRoutes(ServerAuth.Config.configLayer({ username: "opencode", password: Option.none() }))
}

function makeRoutes<AuthError, AuthServices>(auth: Layer.Layer<ServerAuth.Config, AuthError, AuthServices>) {
  const ftc = ftcHost(Effect.succeed((_, commit) => commit))
  const serviceLayer = AppNodeBuilder.build(applicationServices(ftc), ftc.replacements)

  return HttpApiBuilder.layer(Api, { openapiPath: "/openapi.json" }).pipe(
    Layer.provide(handlers),
    Layer.provide(sessionLocationLayer),
    Layer.provide(locationLayer),
    Layer.provide(authorizationLayer),
    Layer.provide(schemaErrorLayer),
    Layer.provide(auth),
    Layer.provide(serviceLayer),
  )
}

export const routes = createRoutes()

export const webHandler = () =>
  HttpRouter.toWebHandler(routes.pipe(Layer.provide(HttpServer.layerServices)), { disableLogger: true })

/** Shared graph constructor for standalone/SDK and OpenCode's independent V2 host. */
export function ftcHost(activation: Effect.Effect<FtcComposition.Ports["activate"], never, Scope.Scope>) {
  const runtime = makeGlobalNode({
    service: FtcComposition.Service,
    layer: Layer.effect(
      FtcComposition.Service,
      Effect.gen(function* () {
        const activate = yield* activation
        const database = yield* Database.Service
        const project = yield* ProjectV2.Service
        const store = yield* SessionStore.Service
        const locations = yield* LocationServiceMap.Service
        const events = yield* EventV2.Service
        return yield* FtcComposition.disabled({
          repository: ProjectAssociations.make(database.db),
          folders: FtcProjectAdapters.folders(project),
          store,
          locations,
          activate,
          changed: (status) => events.publish(FtcProjects.OwnerChanged, status).pipe(Effect.asVoid),
        })
      }),
    ),
    deps: [Database.node, ProjectV2.node, SessionStore.node, LocationServiceMap.node, EventV2.node],
  })
  const execution = makeGlobalNode({
    service: SessionExecution.Service,
    layer: Layer.effect(
      SessionExecution.Service,
      Effect.map(FtcComposition.Service, (ftc) => ftc.execution),
    ),
    deps: [runtime],
  })
  const session = makeGlobalNode({
    service: SessionV2.Service,
    layer: Layer.unwrap(Effect.map(FtcComposition.Service, (ftc) => SessionV2.layerWithAdmission(ftc.guard))).pipe(
      Layer.orDie,
    ),
    deps: [
      Database.node,
      EventV2.node,
      ProjectV2.node,
      SessionExecution.node,
      SessionStore.node,
      LocationServiceMap.node,
      SessionProjector.node,
      runtime,
    ],
  })
  const tracked = makeGlobalNode({
    service: SessionExecution.Tracked,
    layer: Layer.effect(
      SessionExecution.Tracked,
      Effect.map(FtcComposition.Service, (ftc) => ftc.execution),
    ),
    deps: [runtime],
  })
  return {
    runtime,
    tracked,
    replacements: [
      [SessionExecution.node, execution],
      [SessionV2.node, session],
    ] satisfies LayerNode.Replacements,
  }
}
