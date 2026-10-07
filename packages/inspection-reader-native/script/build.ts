import { createHash } from "node:crypto"
import { mkdir } from "node:fs/promises"
import path from "node:path"

const headers = process.argv[2]
if (!headers || !path.isAbsolute(headers)) throw new Error("Pass an explicit absolute Node 26.10.0 header directory")
if (process.platform !== "darwin" || process.arch !== "arm64" || process.versions.bun !== "1.3.14")
  throw new Error("Build combination is unverified")
const expected = {
  "node_api.h": "2d4560831e525b47b060ec8a0864ab73993df9e20215ce9f0fe7b24cd31af32a",
  "node_api_types.h": "a25356630d3058f0a0c8937d9f297e9471e037fda58c2696d8a505c2bd99cb00",
  "js_native_api.h": "82d3708ce120f8000ec34d72e1aa70b0d7d8a43027986293681374a71b2cb840",
  "js_native_api_types.h": "c12406a8c0036aefdb66b98065fc88e2e7a053c1f274deef33af6c26c099b933",
  "node_version.h": "44ac53187e569f412f02a889cfb067dda7fbe04d0e84f3ce604543ed437a61e9",
}
for (const [name, hash] of Object.entries(expected)) {
  if (
    createHash("sha256")
      .update(await Bun.file(path.join(headers, name)).bytes())
      .digest("hex") !== hash
  )
    throw new Error(`Unverified header: ${name}`)
}
const sdk = Bun.spawnSync(["xcrun", "--show-sdk-path"])
if (sdk.exitCode !== 0) throw new Error("Missing SDK")
const sdkVersion = Bun.spawnSync(["xcrun", "--show-sdk-version"])
const sdkBuild = Bun.spawnSync(["xcrun", "--show-sdk-build-version"])
if (
  sdkVersion.exitCode !== 0 ||
  sdkVersion.stdout.toString().trim() !== "26.5" ||
  sdkBuild.exitCode !== 0 ||
  sdkBuild.stdout.toString().trim() !== "25F70"
)
  throw new Error("Unverified SDK")
const compiler = Bun.spawnSync(["xcrun", "clang", "--version"])
if (
  compiler.exitCode !== 0 ||
  !compiler.stdout.toString().startsWith("Apple clang version 21.0.0 (clang-2100.1.1.101)")
)
  throw new Error("Unverified compiler")
const directory = path.resolve(import.meta.dir, "../dist")
await mkdir(directory, { recursive: true })
const command = [
  "xcrun",
  "clang",
  "-Wall",
  "-Wextra",
  "-Werror",
  "-std=c11",
  "-DNAPI_VERSION=8",
  "-arch",
  "arm64",
  "-mmacosx-version-min=26.5",
  "-isysroot",
  sdk.stdout.toString().trim(),
  "-bundle",
  "-undefined",
  "dynamic_lookup",
  `-I${headers}`,
  path.resolve(import.meta.dir, "../src/reader.c"),
  "-MD",
  "-MF",
  path.join(directory, "reader.d"),
  "-o",
  path.join(directory, "reader.node"),
]
const result = Bun.spawnSync(command)
if (result.exitCode !== 0) throw new Error(result.stderr.toString())
const dependencies =
  (await Bun.file(path.join(directory, "reader.d")).text())
    .replace(/\\\r?\n/g, "")
    .match(/(?:\\.|[^\s])+/g)
    ?.slice(1)
    .map((filename) => filename.replace(/\\(.)/g, "$1")) ?? []
const inputHashes = Object.fromEntries(
  await Promise.all(
    dependencies.map(async (filename) => [
      filename,
      createHash("sha256")
        .update(await Bun.file(filename).bytes())
        .digest("hex"),
    ]),
  ),
)
const record = {
  headers: { directory: headers, node: "26.10.0", sha256: expected },
  sdk: {
    path: sdk.stdout.toString().trim(),
    version: sdkVersion.stdout.toString().trim(),
    build: sdkBuild.stdout.toString().trim(),
  },
  inputHashes,
  compiler: compiler.stdout.toString().trim(),
  deploymentTarget: "26.5",
  verifiedHost: Bun.spawnSync(["sw_vers"]).stdout.toString().trim(),
  command,
  runtime: process.versions.bun,
  architecture: process.arch,
  artifactSHA256: createHash("sha256")
    .update(await Bun.file(path.join(directory, "reader.node")).bytes())
    .digest("hex"),
}
await Bun.write(path.join(directory, "build.json"), JSON.stringify(record, null, 2) + "\n")
console.log(JSON.stringify(record, null, 2))
