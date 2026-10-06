import { expect, test } from "bun:test"
import { JavaLanguageEvaluation } from "../../src/ftc/java/language-service"
import { mkdtemp, cp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { run } from "../ftc-adapters/fixtures/java-import/owned"

import "../ftc-adapters/java-import.test"

// Explicit opt-in: absent real assets are NOT RUN. Config paths are evaluation inputs, not an M4 descriptor.
const configuration = process.env.M503_CONFIG

test.skipIf(!configuration || process.platform === "win32")(
  "real pinned JDT LS: FTC Android generated and pathing symbols resolve",
  async () => {
    const config = await Bun.file(configuration!).json()
    for (const [file, digest] of [
      [path.join(config.editorHome, "bin/java"), config.pins.editorJdk.sha256],
      [path.join(config.buildHome, "bin/java"), config.pins.buildJdk.sha256],
      [config.serverArchive, config.pins.jdtLs.sha256],
    ])
      expect(new Bun.CryptoHasher("sha256").update(await Bun.file(file).arrayBuffer()).digest("hex")).toBe(digest)
    const owned = await mkdtemp(path.join(tmpdir(), "m503-lsp-"))
    const env = {
      PATH: "/usr/bin:/bin",
      HOME: owned,
      JAVA_HOME: config.buildHome,
      GRADLE_USER_HOME: config.gradleHome,
      ANDROID_HOME: config.sdk,
    }
    try {
      await cp(path.join(config.server, "config_mac"), path.join(owned, "config"), { recursive: true })
      const launch = JavaLanguageEvaluation.launch({
        ...config,
        os: "macos",
        configuration: path.join(owned, "config"),
        workspace: path.join(owned, "workspace"),
      })
      const input = {
        ...config,
        ...launch,
        settings: {
          java: {
            ...launch.settings.java,
            import: {
              ...launch.settings.java.import,
              gradle: {
                ...launch.settings.java.import.gradle,
                enabled: config.mode !== "classpath",
                home: config.gradleInstall,
                arguments: ["-Pandroid.builder.sdkDownload=false"],
              },
            },
          },
        },
      }
      await Bun.write(path.join(owned, "input.json"), JSON.stringify(input))
      const execution = await run(
        [
          config.python,
          path.join(import.meta.dir, "../ftc-adapters/fixtures/java-import/probe.py"),
          path.join(owned, "input.json"),
        ],
        { env, timeout: 240000, cwd: config.root },
      )
      console.log(JSON.stringify(execution))
      expect(execution.exit).toBe(0)
      const result = await Bun.file(config.output).json()
      const observations = result.cases.map(
        (item: {
          name: string
          valid: { state?: string; diagnostics?: { severity: number; message: string }[] }
          invalid: { state?: string; diagnostics?: { severity: number; message: string }[] }
          definition: { uri: string }[]
          completion: { items: { label: string }[] } | { label: string }[] | null
        }) => {
          const candidates = Array.isArray(item.completion) ? item.completion : (item.completion?.items ?? [])
          const expected = config.cases.find((entry: { name: string }) => entry.name === item.name)
          return {
            name: item.name,
            valid:
              item.valid.state !== "unavailable" &&
              item.valid.diagnostics?.every(
                (diagnostic) => diagnostic.severity !== 1 && !diagnostic.message.includes("only syntax errors"),
              ),
            definition: item.definition.some((location) =>
              location.uri.includes(
                (
                  {
                    FTC: "RobotCore-11.1.0",
                    Android: "android.jar/android.os/Build.class",
                    generated: "/generated/com/qualcomm/ftcrobotcontroller/BuildConfig.java",
                    pedro: "core-2.1.2",
                    roadrunner: "core-1.0.1",
                  } as Record<string, string>
                )[item.name],
              ),
            ),
            completion: candidates.some((candidate) => candidate.label.startsWith(expected.member)),
            invalid:
              item.invalid.state !== "unavailable" &&
              item.invalid.diagnostics?.some(
                (diagnostic) => diagnostic.severity === 1 && diagnostic.message.includes("missingM503Symbol"),
              ),
          }
        },
      )
      console.log(JSON.stringify({ mode: config.mode ?? "native", observations }))
      expect(observations).toEqual(
        config.cases.map((item: { name: string }) => ({
          name: item.name,
          valid: true,
          definition: true,
          completion: true,
          invalid: true,
        })),
      )
    } finally {
      // Gradle detaches daemon sessions from JDT's process group; stop only this evaluation's user home.
      const stopped = await run([path.join(config.gradleInstall, "bin/gradle"), "--stop", "-g", config.gradleHome], {
        env,
        timeout: 15000,
      })
      console.log(JSON.stringify({ daemonCleanup: stopped }))
      expect(stopped.exit, "gradle_cleanup_unconfirmed").toBe(0)
      await rm(owned, { recursive: true, force: true })
    }
  },
  270000,
)

test.skip("NOT RUN: Windows JDT LS FTC Android generated PedroPathing Road Runner import and process-tree disposal", () => {})
