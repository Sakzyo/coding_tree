import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

test("real native held resources reject foreign leaf and ancestor authority", async () => {
  const module = await import("../index").catch(() => undefined)
  expect(module?.load).toBeFunction()
  if (!module) return
  const native = module.load()
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "m6-native-"))
  const own = path.join(base, "own")
  const foreign = path.join(base, "foreign")
  await fs.mkdir(path.join(own, "nested"), { recursive: true })
  await fs.mkdir(foreign)
  await fs.writeFile(path.join(own, "nested/secret"), "OWN")
  await fs.writeFile(path.join(foreign, "secret"), "FOREIGN")
  const root = await native.root(own).promise
  try {
    const file = await native.open(root, "nested/secret", "file").promise
    const dir = await native.open(root, "nested", "directory").promise
    if (!file || !dir) throw new Error("own resources missing")
    await fs.rename(path.join(own, "nested"), path.join(own, "saved"))
    await fs.symlink(foreign, path.join(own, "nested"))
    expect(new TextDecoder().decode(await native.read(file).promise)).toBe("OWN")
    expect(await native.list(dir).promise).toEqual([{ name: "secret", type: "file" }])
    await rejects(native.open(root, "nested/secret", "file").promise, "path_outside_project")
    await rejects(native.open(root, "nested", "directory").promise, "path_outside_project")
    await native.close(file)
    await native.close(dir)
    await rejects(native.read(file).promise, "owner_closed")
    expect(() => Reflect.apply(native.read, undefined, [{}])).toThrow()
    expect(() => Reflect.apply(native.read, undefined, [])).toThrow()
    expect(() => Reflect.apply(native.close, undefined, [])).toThrow()
  } finally {
    await native.close(root)
    await fs.rm(base, { recursive: true, force: true })
  }
})

test("root aliases and replacement never redirect held content; repeated listing has fresh offset", async () => {
  const { NativeInspectionReader } = await import("../index")
  const native = NativeInspectionReader.load()
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "m6-native-alias-"))
  await fs.mkdir(path.join(base, "own"))
  await fs.mkdir(path.join(base, "foreign"))
  await fs.writeFile(path.join(base, "own/OWN"), "own")
  await fs.writeFile(path.join(base, "foreign/FOREIGN"), "foreign")
  await fs.symlink(path.join(base, "own"), path.join(base, "alias"))
  const root = await native.root(path.join(base, "alias")).promise
  try {
    await fs.rename(path.join(base, "own"), path.join(base, "moved"))
    await fs.symlink(path.join(base, "foreign"), path.join(base, "own"))
    await rejects(native.verify(root).promise, "path_outside_project")
    const file = await native.open(root, "OWN", "file").promise
    if (!file) throw new Error("own file missing")
    expect(new TextDecoder().decode(await native.read(file).promise)).toBe("own")
    expect(await native.open(root, "FOREIGN", "file").promise).toBeUndefined()
    await native.close(file)
    await fs.mkdir(path.join(base, "moved/nested"))
    await fs.writeFile(path.join(base, "moved/nested/OWN"), "own")
    for (let i = 0; i < 30; i++) {
      const dir = await native.open(root, "nested", "directory").promise
      if (!dir) throw new Error("directory missing")
      expect(await native.list(dir).promise).toEqual([{ name: "OWN", type: "file" }])
      expect(await native.list(dir).promise).toEqual([])
      await native.close(dir)
    }
  } finally {
    await native.close(root)
    await fs.rm(base, { recursive: true, force: true })
  }
})

test("bad components, leaf links, special entries and file mutation fail visibly", async () => {
  const { NativeInspectionReader } = await import("../index")
  const native = NativeInspectionReader.load()
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "m6-native-input-"))
  await fs.mkdir(path.join(base, "own"))
  await fs.mkdir(path.join(base, "foreign"))
  await fs.writeFile(path.join(base, "foreign/secret"), "FOREIGN")
  await fs.symlink(path.join(base, "foreign/secret"), path.join(base, "own/leaf"))
  const root = await native.root(path.join(base, "own")).promise
  try {
    for (const input of ["", ".", "..", "/foreign", "a/../b", "a/./b", "a//b", "a/", "a\0b", "a\\b"]) {
      expect(() => native.open(root, input, "file")).toThrow()
    }
    await rejects(native.open(root, "leaf", "file").promise, "path_outside_project")
    await fs.mkdir(path.join(base, "own/dir"))
    await rejects(native.open(root, "dir", "file").promise, "file_unavailable")
    // Fixture creation only; reader never invokes a subprocess.
    expect(Bun.spawnSync(["mkfifo", path.join(base, "own/fifo")]).exitCode).toBe(0)
    await rejects(native.open(root, "fifo", "file").promise, "file_unavailable")
    await fs.writeFile(path.join(base, "own/dir/value"), "original")
    const file = await native.open(root, "dir/value", "file").promise
    if (!file) throw new Error("file missing")
    await fs.writeFile(path.join(base, "own/dir/value"), "changed content")
    await rejects(native.read(file).promise, "file_unavailable")
    await native.close(file)
    await fs.symlink(path.join(base, "foreign"), path.join(base, "own/dir/link"))
    const dir = await native.open(root, "dir", "directory").promise
    if (!dir) throw new Error("directory missing")
    await rejects(native.list(dir).promise, "path_outside_project")
    await native.close(dir)
  } finally {
    await native.close(root)
    await fs.rm(base, { recursive: true, force: true })
  }
})

test("concurrent cancellation joins native retirement and closed handles resist descriptor reuse", async () => {
  const { NativeInspectionReader } = await import("../index")
  const native = NativeInspectionReader.load()
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "m6-native-cancel-"))
  await fs.writeFile(path.join(base, "file"), "own")
  await native.close(await native.root(base).promise)
  const baseline = (await fs.readdir("/dev/fd")).length
  const root = await native.root(base).promise
  const jobs = Array.from({ length: 200 }, () => native.open(root, "file", "file"))
  const settled = Promise.allSettled(jobs.map((job) => job.promise))
  jobs.forEach((job) => job.cancel())
  await native.close(root)
  for (const result of await settled) {
    if (result.status === "fulfilled" && result.value) await native.close(result.value)
    if (result.status === "rejected") expect(result.reason.code).toBe("cancelled")
  }
  await native.close(root)
  const next = await native.root(base).promise
  await rejects(native.open(root, "file", "file").promise, "owner_closed")
  expect(() => native.open(Object.create(next), "file", "file")).toThrow()
  expect(() => native.open({ ...next }, "file", "file")).toThrow()
  const cancel = await (async () => {
    const job = native.verify(next)
    await job.promise
    return job.cancel
  })()
  Bun.gc(true)
  cancel()
  await native.close(next)
  Bun.gc(true)
  expect((await fs.readdir("/dev/fd")).length).toBe(baseline)
  await fs.rm(base, { recursive: true, force: true })
})

test("real files and directories cross bounded batch boundaries without truncation", async () => {
  const { NativeInspectionReader } = await import("../index")
  const native = NativeInspectionReader.load()
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "m6-native-chunks-"))
  const bytes = new Uint8Array(65536 * 2 + 37).map((_, index) => index % 251)
  await fs.writeFile(path.join(base, "value"), bytes)
  await fs.mkdir(path.join(base, "directory"))
  await Promise.all(
    Array.from({ length: 137 }, (_, index) => fs.writeFile(path.join(base, `directory/item-${index}`), "own")),
  )
  const root = await native.root(base).promise
  const file = await native.open(root, "value", "file").promise
  const directory = await native.open(root, "directory", "directory").promise
  if (!file || !directory) throw new Error("fixture resources missing")
  try {
    const chunks = [await native.read(file).promise, await native.read(file).promise, await native.read(file).promise]
    expect(chunks.map((chunk) => chunk.length)).toEqual([65536, 65536, 37])
    expect(Buffer.concat(chunks)).toEqual(Buffer.from(bytes))
    expect((await native.read(file).promise).length).toBe(0)
    const entries = [await native.list(directory).promise, await native.list(directory).promise]
    expect(entries.map((chunk) => chunk.length)).toEqual([128, 9])
    expect(new Set(entries.flat().map((entry) => entry.name)).size).toBe(137)
    expect(await native.list(directory).promise).toEqual([])
  } finally {
    await native.close(file)
    await native.close(directory)
    await native.close(root)
    await fs.rm(base, { recursive: true, force: true })
  }
})

test("backup native finalizers release abandoned opaque handles", async () => {
  const { NativeInspectionReader } = await import("../index")
  const native = NativeInspectionReader.load()
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "m6-native-finalizers-"))
  await fs.writeFile(path.join(base, "file"), "own")
  await native.close(await native.root(base).promise)
  const baseline = (await fs.readdir("/dev/fd")).length
  await (async () => {
    const root = await native.root(base).promise
    await native.open(root, "file", "file").promise
  })()
  for (let attempt = 0; attempt < 10; attempt++) {
    Bun.gc(true)
    await Bun.sleep(1)
    if ((await fs.readdir("/dev/fd")).length === baseline) break
  }
  expect((await fs.readdir("/dev/fd")).length).toBe(baseline)
  await fs.rm(base, { recursive: true, force: true })
})

async function rejects(promise: Promise<unknown>, code: string) {
  const outcome = await promise.then(
    () => undefined,
    (error: unknown) => error,
  )
  expect(outcome).toMatchObject({ code })
}
