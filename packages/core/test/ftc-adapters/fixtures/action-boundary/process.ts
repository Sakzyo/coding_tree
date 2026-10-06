// Only owned loopback endpoints are permitted, including in unrestricted controls.
const endpoint = new URL(process.argv[3])
if (endpoint.hostname !== "127.0.0.1") throw new Error("loopback_required")
console.log("probe_ready")
if (process.argv[2] === "http") {
  const response = await fetch(endpoint, { method: "POST", body: "probe", signal: AbortSignal.timeout(2000) })
  if (response.status !== 204) throw new Error("unexpected_response")
}
if (process.argv[2] === "websocket") {
  await new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(endpoint)
    const timeout = setTimeout(() => {
      socket.close()
      reject(new Error("probe_timeout"))
    }, 2000)
    socket.onopen = () => socket.send("probe")
    socket.onmessage = (event) => {
      clearTimeout(timeout)
      socket.close()
      if (event.data === "received") resolve()
      else reject(new Error("unexpected_response"))
    }
    socket.onerror = () => {
      clearTimeout(timeout)
      reject(new Error("websocket_denied"))
    }
  })
}
