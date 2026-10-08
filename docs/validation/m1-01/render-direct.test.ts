import { expect, test } from "bun:test"
import { render, createComponent } from "solid-js/web"
const { RenderProbe } = await import("./render-probe.tsx")

test("plain TSX renders under the existing preload", () => {
  const host = document.createElement("div")
  const dispose = render(() => createComponent(RenderProbe, { cleanup: () => {} }), host)
  expect(host.querySelector("textarea")?.value).toBe("draft")
  dispose()
})
