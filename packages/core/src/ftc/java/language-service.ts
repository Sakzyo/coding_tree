export * as JavaLanguageEvaluation from "./language-service"

import { FtcEnvironment } from "@opencode-ai/schema/ftc-environment"
import { Schema } from "effect"
import path from "node:path"

// Evaluation-only launch recipe. No registration, process creation or supported-profile claim.
export function launch(input: {
  pins: Pick<FtcEnvironment.Profile, "editorJdk" | "buildJdk" | "jdtLs">
  os: FtcEnvironment.Profile["os"]
  editorHome: string
  buildHome: string
  server: string
  launcher: string
  configuration: string
  workspace: string
  gradleHome: string
}) {
  const paths = input.os === "windows" ? path.win32 : path.posix
  for (const artifact of Object.values(input.pins)) Schema.decodeUnknownSync(FtcEnvironment.Artifact)(artifact)
  if (!(Number(input.pins.editorJdk.version.split(".")[0]) >= 21)) throw new Error("editor_requires_java_21")
  if (!(Number(input.pins.buildJdk.version.split(".")[0]) >= 8)) throw new Error("invalid_build_java_version")
  for (const value of [
    input.editorHome,
    input.buildHome,
    input.server,
    input.launcher,
    input.configuration,
    input.workspace,
    input.gradleHome,
  ]) {
    if (!paths.isAbsolute(value)) throw new Error("explicit_absolute_path_required")
  }
  return {
    command: [
      paths.join(input.editorHome, "bin", input.os === "windows" ? "java.exe" : "java"),
      "-Declipse.application=org.eclipse.jdt.ls.core.id1",
      "-Dosgi.bundles.defaultStartLevel=4",
      "-Declipse.product=org.eclipse.jdt.ls.core.product",
      "-Xmx1G",
      "--add-modules=ALL-SYSTEM",
      "--add-opens",
      "java.base/java.util=ALL-UNNAMED",
      "--add-opens",
      "java.base/java.lang=ALL-UNNAMED",
      "-jar",
      input.launcher,
      "-configuration",
      input.configuration,
      "-data",
      input.workspace,
    ],
    settings: {
      java: {
        home: input.editorHome,
        configuration: {
          updateBuildConfiguration: "automatic",
          runtimes: [
            {
              name: `JavaSE-${Number(input.pins.buildJdk.version.split(".")[0])}`,
              path: input.buildHome,
              default: true,
            },
          ],
        },
        import: {
          gradle: {
            enabled: true,
            java: { home: input.buildHome },
            user: { home: input.gradleHome },
            offline: { enabled: true },
            wrapper: { enabled: false },
          },
          maven: { enabled: false },
        },
        jdt: { ls: { androidSupport: { enabled: true } } },
      },
    },
  }
}
