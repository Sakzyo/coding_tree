import { expect, test } from "bun:test"
import { createRequire } from "node:module"
import { render, createComponent } from "solid-js/web"
const require = createRequire("/Users/dylanxu/coding_tree/packages/app/package.json")
const compiler = createRequire(require.resolve("vite-plugin-solid"))
const { transformSync } = compiler("@babel/core")

Bun.plugin({
  name: "m1-01-preparation-solid",
  setup(build) {
    build.onLoad({ filter: /\/m1-01-preparation\/render-probe\.tsx$/ }, async (args) => {
      const result = transformSync(await Bun.file(args.path).text(), {
        filename: args.path,
        babelrc: false,
        configFile: false,
        presets: [
          [compiler.resolve("babel-preset-solid"), { generate: "dom", hydratable: false }],
          compiler.resolve("@babel/preset-typescript"),
        ],
      })
      if (!result?.code) throw new Error("No transformed probe")
      return { contents: result.code, loader: "js", resolveDir: "/Users/dylanxu/coding_tree/packages/app" }
    })
  },
})

const { RenderProbe } = await import("./render-probe.tsx")

test("compiled TSX renders reactive DOM and disposes under the existing preload", async () => {
  const host = document.createElement("div")
  document.body.append(host)
  const cleanup: string[] = []
  const dispose = render(() => createComponent(RenderProbe, { cleanup: () => cleanup.push("disposed") }), host)
  expect(host.querySelector("textarea")?.value).toBe("draft")
  expect(host.querySelector("output")?.textContent).toBe("draft")
  host.querySelector("button")?.click()
  expect(host.querySelector("button")?.textContent).toBe("1")
  const textarea = host.querySelector("textarea")!
  textarea.value = "edited"
  textarea.dispatchEvent(new Event("input", { bubbles: true }))
  expect(host.querySelector("output")?.textContent).toBe("edited")
  dispose()
  expect(cleanup).toEqual(["disposed"])
  expect(host.textContent).toBe("")
  host.remove()
})
