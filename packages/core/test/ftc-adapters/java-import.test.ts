import { expect, test } from "bun:test"
import { JavaLanguageEvaluation } from "../../src/ftc/java/language-service"

const artifact = {
  version: "21.0.10",
  source: "https://example.test/jdk",
  license: "GPL-2.0-with-classpath-exception",
  sha256: "a".repeat(64),
}
const input = {
  pins: {
    editorJdk: artifact,
    buildJdk: { ...artifact, version: "17.0.15" },
    jdtLs: { ...artifact, version: "1.46.1" },
  },
  os: "macos" as const,
  editorHome: "/owned/editor",
  buildHome: "/owned/build",
  server: "/owned/server",
  launcher: "/owned/server/plugins/launcher.jar",
  configuration: "/owned/config",
  workspace: "/owned/workspace",
  gradleHome: "/owned/gradle",
}

test("candidate launch separates editor Java from Gradle Java and uses only explicit paths", () => {
  const result = JavaLanguageEvaluation.launch(input)
  expect(result.command[0]).toBe("/owned/editor/bin/java")
  expect(result.command).toContain("/owned/config")
  expect(result.command).toContain("/owned/workspace")
  expect(result.settings.java.import.gradle.java.home).toBe("/owned/build")
  expect(result.settings.java.import.gradle.user.home).toBe("/owned/gradle")
})

test("candidate rejects implicit runtimes, bad pins and unsupported hosts before launch", () => {
  expect(() => JavaLanguageEvaluation.launch({ ...input, editorHome: "java" })).toThrow()
  expect(() =>
    JavaLanguageEvaluation.launch({ ...input, pins: { ...input.pins, jdtLs: { ...artifact, sha256: "missing" } } }),
  ).toThrow()
  expect(() =>
    JavaLanguageEvaluation.launch({
      ...input,
      pins: { ...input.pins, editorJdk: { ...artifact, version: "17.0.15" } },
    }),
  ).toThrow()
})

import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { run } from "./fixtures/java-import/owned"

test.skipIf(process.platform === "win32").each(["exit", "abort", "timeout"])(
  "evaluation process tree cleanup after %s",
  async (mode) => {
    const directory = await mkdtemp(path.join(tmpdir(), "m503-cleanup-"))
    const file = path.join(directory, "pids")
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 200)
    const running = run(["/bin/sh", path.join(import.meta.dir, "fixtures/action-boundary/tree.sh"), file, mode], {
      timeout: mode === "timeout" ? 200 : 2000,
      signal: mode === "abort" ? controller.signal : undefined,
    })
    try {
      const result = await Promise.race([
        running.then(
          () => "finished",
          () => "finished",
        ),
        Bun.sleep(1000).then(() => "stalled"),
      ])
      expect(result).toBe("finished")
      const pids = (await Bun.file(file).text()).trim().split(" ").map(Number)
      expect(pids).toHaveLength(2)
      for (const pid of pids) expect(() => process.kill(pid, 0)).toThrow()
    } finally {
      clearTimeout(timer)
      if (await Bun.file(file).exists())
        for (const pid of (await Bun.file(file).text()).trim().split(" ").map(Number)) {
          try {
            process.kill(pid, "SIGKILL")
          } catch (error) {
            expect(error).toMatchObject({ code: "ESRCH" })
          }
        }
      await running.catch(() => undefined)
      await rm(directory, { recursive: true, force: true })
    }
  },
  5000,
)

test("candidate rejects a nonnumeric editor version", () => {
  expect(() =>
    JavaLanguageEvaluation.launch({
      ...input,
      pins: { ...input.pins, editorJdk: { ...artifact, version: "unknown" } },
    }),
  ).toThrow("editor_requires_java_21")
})

test("candidate preserves the configured build JDK level", () => {
  const result = JavaLanguageEvaluation.launch({
    ...input,
    pins: { ...input.pins, buildJdk: { ...artifact, version: "21.0.10" } },
  })
  expect(result.settings.java.configuration.runtimes[0].name).toBe("JavaSE-21")
})

test("candidate cannot manufacture a runtime name from a nonnumeric build JDK pin", () => {
  expect(() =>
    JavaLanguageEvaluation.launch({ ...input, pins: { ...input.pins, buildJdk: { ...artifact, version: "unknown" } } }),
  ).toThrow()
})
