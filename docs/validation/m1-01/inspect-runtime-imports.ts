import { createRequire } from "node:module"

const require = createRequire(`${process.cwd()}/package.json`)
const compiler = createRequire(require.resolve("vite-plugin-solid"))
const babel = compiler("@babel/core")
const files = ["src/ftc/facades.ts", "src/ftc/workspace.tsx"]
const allowed = new Set(["solid-js", "solid-js/store", "solid-js/web"])
const scanner = new Bun.Transpiler({ loader: "js" })
for (const file of files) {
  const result = babel.transformSync(await Bun.file(file).text(), {
    filename: file,
    babelrc: false,
    configFile: false,
    presets: [
      [compiler.resolve("babel-preset-solid"), { generate: "dom", hydratable: false }],
      compiler.resolve("@babel/preset-typescript"),
    ],
  })
  if (!result?.code) throw new Error(`Missing compiled source: ${file}`)
  const imports = scanner.scan(result.code).imports
  if (imports.some((entry) => !allowed.has(entry.path))) throw new Error(`Forbidden runtime import: ${file}`)
  console.log(file, JSON.stringify(imports))
  if (file.endsWith("facades.ts") && result.code.trim() !== "export {};")
    throw new Error("Facade has executable initialization")
}
