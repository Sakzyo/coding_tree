import { createConnection, createServer, Socket } from "node:net"
import { Effect } from "effect"
import { Adb } from "../../../../src/ftc/controllers/adb"
import { Panels } from "../../../../src/ftc/controllers/panels"
import { fixture } from "./fixture"

// Owned localhost servers only. This is not an ADB daemon or Android simulation.
export function loopback(socketUnavailable = false, serial = "SYNTHETIC_USB_A") {
  const source = fixture()
  const received: string[] = []
  const sockets = new Set<WebSocket>()
  const forwards = new Set<number>()
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      const path = new URL(request.url).pathname
      if (request.headers.get("upgrade") === "websocket") {
        if (socketUnavailable) return new Response("Panels has not started yet", { status: 503 })
        if (server.upgrade(request)) return undefined
        return new Response("upgrade failed", { status: 400 })
      }
      if (request.method !== "GET") return new Response("method blocked", { status: 405 })
      const resource = source.resources[path]
      if (!resource) return new Response("missing", { status: 404 })
      return new Response(resource.contentEncoding === "gzip" ? Bun.gzipSync(resource.body) : resource.body, {
        status: resource.status,
        headers: {
          "Content-Type": resource.contentType,
          ...(resource.contentEncoding ? { "Content-Encoding": resource.contentEncoding } : {}),
        },
      })
    },
    websocket: {
      open(socket) {
        if (source.frames.value !== null) socket.send(source.frames.value)
      },
      message(_socket, message) {
        received.push(String(message))
      },
    },
  })
  const forward: Adb.ForwardTransport = {
    open: (request) =>
      Effect.tryPromise({
        try: () =>
          new Promise<{ localPort: number; close: Effect.Effect<void> }>((resolve, reject) => {
            if (
              request.serial !== serial ||
              request.localPort !== 0 ||
              !request.noRebind ||
              ![8001, 8002].includes(request.remotePort)
            ) {
              reject(new Error("unexpected forward request"))
              return
            }
            const connections = new Set<Socket>()
            const listener = createServer((client) => {
              const upstream = createConnection({ host: "127.0.0.1", port: server.port! })
              connections.add(client)
              connections.add(upstream)
              client.on("error", () => upstream.destroy())
              upstream.on("error", () => client.destroy())
              client.on("close", () => {
                connections.delete(client)
                upstream.destroy()
              })
              upstream.on("close", () => {
                connections.delete(upstream)
                client.destroy()
              })
              client.pipe(upstream).pipe(client)
            })
            listener.once("error", reject)
            listener.listen(0, "127.0.0.1", () => {
              const address = listener.address()
              if (!address || typeof address === "string") {
                listener.close()
                reject(new Error("invalid listener"))
                return
              }
              const localPort = address.port
              forwards.add(localPort)
              resolve({
                localPort,
                close: Effect.promise(
                  () =>
                    new Promise<void>((done) => {
                      connections.forEach((socket) => socket.destroy())
                      listener.close(() => {
                        forwards.delete(localPort)
                        done()
                      })
                    }),
                ),
              })
            })
          }),
        catch: () => ({ code: "forward_failed" as const }),
      }),
  }
  const reads: Panels.ReadTransport = {
    get: (url) =>
      Effect.tryPromise({
        try: async (signal) => {
          const response = await fetch(url, { method: "GET", redirect: "error", signal })
          return {
            status: response.status,
            body: await response.text(),
            contentType: response.headers.get("content-type") ?? "",
            contentEncoding: response.headers.get("content-encoding") ?? undefined,
          }
        },
        catch: () => ({ code: "resource_missing" as const }),
      }),
    receive: (url) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          const socket = new WebSocket(url)
          sockets.add(socket)
          return socket
        }),
        (socket) =>
          Effect.sync(() => {
            socket.close()
            sockets.delete(socket)
          }),
      ).pipe(
        Effect.flatMap((socket) =>
          Effect.tryPromise({
            try: (signal) =>
              new Promise<string | null>((resolve, reject) => {
                const timer = setTimeout(() => resolve(null), 250)
                const clear = () => clearTimeout(timer)
                signal.addEventListener(
                  "abort",
                  () => {
                    clear()
                    reject(new Error("cancelled"))
                  },
                  { once: true },
                )
                socket.addEventListener(
                  "message",
                  (event) => {
                    clear()
                    resolve(String(event.data))
                  },
                  { once: true },
                )
                socket.addEventListener(
                  "error",
                  () => {
                    clear()
                    reject(new Error("disconnected"))
                  },
                  { once: true },
                )
                socket.addEventListener(
                  "close",
                  () => {
                    clear()
                    reject(new Error("disconnected"))
                  },
                  { once: true },
                )
              }),
            catch: () => ({ code: "socket_disconnected" as const }),
          }),
        ),
      ),
  }
  return { source, received, sockets, forwards, forward, reads, close: () => server.stop(true) }
}
