export * as NativeInspectionReader from "./index"

import { createRequire } from "node:module"
import { release } from "node:os"
import path from "node:path"

declare const resource: unique symbol
export interface Resource {
  readonly [resource]: true
}
export interface Root extends Resource {
  readonly canonicalRoot: string
  readonly identity: string
}
export interface Job<A> {
  readonly promise: Promise<A>
  readonly cancel: () => void
}
export interface Binding {
  readonly root: (path: string) => Job<Root>
  readonly open: (root: Root, relative: string, kind: "file" | "directory") => Job<Resource | undefined>
  readonly read: (file: Resource) => Job<Uint8Array>
  readonly list: (directory: Resource) => Job<readonly { readonly name: string; readonly type: "file" | "directory" }[]>
  readonly verify: (root: Root) => Job<void>
  readonly close: (resource: Resource) => Promise<void>
}
export function load(): Binding {
  if (
    process.platform !== "darwin" ||
    process.arch !== "arm64" ||
    process.versions.bun !== "1.3.14" ||
    release() !== "25.5.0"
  )
    throw Object.assign(new Error("Unverified inspection reader platform/runtime"), { code: "unsupported_reader" })
  // Compiled drivers use an adjacent sidecar; source execution uses ignored package output.
  const filename = import.meta.dir.startsWith("/$bunfs/")
    ? path.join(path.dirname(process.execPath), "inspection-reader.node")
    : path.join(import.meta.dir, "dist", "reader.node")
  try {
    const binding: unknown = createRequire(import.meta.url)(filename)
    if (!isBinding(binding)) throw new Error("Invalid native binding")
    return Object.freeze({ ...binding })
  } catch (cause) {
    if (typeof cause === "object" && cause !== null && "code" in cause && cause.code === "unsupported_reader")
      throw cause
    throw Object.assign(new Error("Inspection reader artifact unavailable", { cause }), { code: "reader_unavailable" })
  }
}

function isBinding(value: unknown): value is Binding {
  return (
    typeof value === "object" &&
    value !== null &&
    ["root", "open", "read", "list", "verify", "close"].every((name) => typeof Reflect.get(value, name) === "function")
  )
}
