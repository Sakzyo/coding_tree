import { expect, test } from "bun:test"
import { Cause, Deferred, Effect, Exit, Fiber, Schema, Scope } from "effect"
import { FtcConfiguration } from "@opencode-ai/schema/ftc-configuration"
import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { Inspection } from "../../../src/ftc/configuration/inspection"
import { FSUtil } from "../../../src/fs-util"
import { LayerNode } from "../../../src/effect/layer-node"
import { tmpdir } from "../../fixture/tmpdir"

const initial = { schemaVersion: 1, hardware: [], managedPathing: "neither" } as const
const gradle = "dependencies {\n implementation 'org.firstinspires.ftc:RobotCore:11.1.0'\n}\n"
const java = "TeamCode/src/main/java/org/firstinspires/ftc/teamcode/Paths.java"

function run<A, E>(body: (filesystem: FSUtil.Interface) => Effect.Effect<A, E, Scope.Scope>) {
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const filesystem = yield* FSUtil.Service
        return yield* body(filesystem)
      }),
    ).pipe(Effect.provide(LayerNode.compile(FSUtil.node))),
  )
}

async function files(root: string, entries: Record<string, string>) {
  await Promise.all(
    Object.entries(entries).map(async ([name, text]) => {
      await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true })
      await fs.writeFile(path.join(root, name), text)
    }),
  )
}

function manifest(root: string, text?: string) {
  return {
    readManifest: (input: { root: string }) =>
      Effect.sync(() => {
        expect(input.root).toBe(root)
        return text
          ? {
              revision: createHash("sha256").update(text).digest("hex"),
              manifest: Schema.decodeUnknownSync(FtcConfiguration.Manifest)(
                Schema.decodeUnknownSync(Schema.UnknownFromJsonString)(text),
              ),
            }
          : {
              kind: "initialization_proposal" as const,
              filename: "ftc-project.json" as const,
              expectedRevision: null,
              manifest: initial,
            }
      }),
  }
}

// A parser that guesses a dynamic version or migrates a conflict breaks this test.
test("ambiguous imports stay untouched", async () => {
  await using directory = await tmpdir()
  const beforeFiles = {
    "build.dependencies.gradle": gradle,
    "TeamCode/build.gradle":
      'dependencies {\n implementation "com.pedropathing:core:$pedroVersion"\n implementation "com.acmerobotics.roadrunner:core:1.0.1"\n}\n',
    [java]: "import com.pedropathing.geometry.Pose;\nimport com.acmerobotics.roadrunner.Action;\n",
    "ftc-project.json": JSON.stringify(initial),
  }
  await files(directory.path, beforeFiles)
  await run((filesystem) =>
    Effect.gen(function* () {
      const owner = yield* Inspection.make({
        filesystem,
        manifest: manifest(directory.path, beforeFiles["ftc-project.json"]),
      })
      const result = yield* owner.inspectProject({ root: directory.path })
      expect(result.conflicts.length).toBeGreaterThan(0)
      expect(result.detectedPathing).toBe("both")
      expect(result.sdkVersion).toBe("11.1.0")
      const dynamic = result.dependencies.find((item) => item.group === "com.pedropathing")
      expect(dynamic).toBeDefined()
      expect(dynamic?.version).toBeUndefined()
      expect(dynamic?.reason).toBe("dynamic_version")
      expect(result.conflicts.map((item) => item.code)).toContain("manifest_mismatch")
      const afterFiles = Object.fromEntries(
        yield* Effect.promise(() =>
          Promise.all(
            Object.keys(beforeFiles).map(async (name) => [
              name,
              await fs.readFile(path.join(directory.path, name), "utf8"),
            ]),
          ),
        ),
      )
      expect(afterFiles).toEqual(beforeFiles)
      expect(result.sourceRevisions.find((item) => item.path === "ftc-project.json")?.revision).toBe(
        createHash("sha256").update(beforeFiles["ftc-project.json"]).digest("hex"),
      )
    }),
  )
})

// Comment-only coordinates and imports must never become observations.
test("static Kotlin coordinates and Java imports ignore comments and preserve evidence", async () => {
  await using directory = await tmpdir()
  const text =
    'dependencies {\n implementation("com.pedropathing:ftc:2.1.2") // comment\n /* implementation("com.acmerobotics.roadrunner:core:1.0.1") */\n}\n'
  await files(directory.path, {
    "build.dependencies.gradle": gradle,
    "TeamCode/build.gradle.kts": text,
    [java]: "// import com.acmerobotics.roadrunner.Action;\nimport com.pedropathing.geometry.Pose;\n",
  })
  await run((filesystem) =>
    Effect.gen(function* () {
      const owner = yield* Inspection.make({ filesystem, manifest: manifest(directory.path) })
      const result = yield* owner.inspectProject({ root: directory.path })
      expect(result.detectedPathing).toBe("pedro")
      expect(result.managedPathing).toBeUndefined()
      expect(result.dependencies.filter((item) => item.group === "com.acmerobotics.roadrunner")).toEqual([])
      expect(result.dependencies.find((item) => item.artifact === "ftc")?.version).toBe("2.1.2")
      expect(result.sourceRevisions.find((item) => item.path === "TeamCode/build.gradle.kts")?.revision).toBe(
        createHash("sha256").update(text).digest("hex"),
      )
    }),
  )
})

test("missing inputs and unsupported Gradle cannot establish neither", async () => {
  await using directory = await tmpdir()
  await files(directory.path, {
    "TeamCode/build.gradle":
      "dependencies {\n implementation(libs.pathing)\n if (enabled) {\n implementation 'com.pedropathing:core:2.1.2'\n }\n}\n",
  })
  await run((filesystem) =>
    Effect.gen(function* () {
      const owner = yield* Inspection.make({ filesystem, manifest: manifest(directory.path) })
      const result = yield* owner.inspectProject({ root: directory.path })
      expect(result.detectedPathing).toBe("unknown")
      expect(result.sdkVersion).toBeUndefined()
      expect(result.unknowns.map((item) => item.reason)).toContain("unsupported_gradle")
      expect(result.unknowns.map((item) => item.reason)).toContain("missing_input")
      expect(result.dependencies).toEqual([])
    }),
  )
})

test("supported complete layout can observe neither without a managed selection", async () => {
  await using directory = await tmpdir()
  await files(directory.path, {
    "build.dependencies.gradle": gradle,
    "TeamCode/build.gradle": "dependencies {\n}\n",
    [java]: "import com.qualcomm.robotcore.hardware.DcMotor;\n",
  })
  await run((filesystem) =>
    Effect.gen(function* () {
      const owner = yield* Inspection.make({ filesystem, manifest: manifest(directory.path) })
      const result = yield* owner.inspectProject({ root: directory.path })
      expect(result.detectedPathing).toBe("neither")
      expect(result.conflicts).toEqual([])
    }),
  )
})

test("external source symlinks are rejected before reading foreign files", async () => {
  await using directory = await tmpdir()
  await using foreign = await tmpdir()
  await files(foreign.path, { "build.gradle": "secret" })
  await fs.symlink(path.join(foreign.path, "build.gradle"), path.join(directory.path, "build.gradle"))
  await run((filesystem) =>
    Effect.gen(function* () {
      const owner = yield* Inspection.make({ filesystem, manifest: manifest(directory.path) })
      expect((yield* owner.inspectProject({ root: directory.path }).pipe(Effect.flip)).code).toBe(
        "path_outside_project",
      )
    }),
  )
})

test("changed bytes remain explicit and cannot supply a version", async () => {
  await using directory = await tmpdir()
  await files(directory.path, { "build.dependencies.gradle": gradle })
  await run((filesystem) =>
    Effect.gen(function* () {
      let changed = false
      const owner = yield* Inspection.make({
        filesystem: {
          ...filesystem,
          readFile: (name) =>
            filesystem.readFile(name).pipe(
              Effect.tap(() => {
                if (!name.endsWith("build.dependencies.gradle") || changed) return Effect.void
                changed = true
                return Effect.promise(() => fs.writeFile(name, gradle.replace("11.1.0", "11.2.0")))
              }),
            ),
        },
        manifest: manifest(directory.path),
      })
      const result = yield* owner.inspectProject({ root: directory.path })
      expect(result.sdkVersion).toBeUndefined()
      expect(result.sourceRevisions.find((item) => item.path === "build.dependencies.gradle")?.state).toBe("changed")
      expect(result.unknowns.map((item) => item.reason)).toContain("changed_input")
    }),
  )
})

test("canonical root and captured input survive caller mutation", async () => {
  await using directory = await tmpdir()
  const alias = path.join(directory.path, "alias")
  const root = path.join(directory.path, "project")
  await fs.mkdir(root)
  await fs.symlink(root, alias)
  await files(root, { "build.dependencies.gradle": gradle })
  await run((filesystem) =>
    Effect.gen(function* () {
      const input = { root: alias }
      const owner = yield* Inspection.make({
        filesystem: {
          ...filesystem,
          realPath: (name) =>
            filesystem.realPath(name).pipe(
              Effect.tap(() =>
                Effect.sync(() => {
                  input.root = "/unrelated"
                }),
              ),
            ),
        },
        manifest: manifest(root),
      })
      const result = yield* owner.inspectProject(input)
      expect(result.sdkVersion).toBe("11.1.0")
    }),
  )
})

test("scope disposal interrupts blocked reads and rejects escaped APIs", async () => {
  await using directory = await tmpdir()
  await files(directory.path, { "build.gradle": gradle })
  await run((filesystem) =>
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const started = yield* Deferred.make<void>()
      const interrupted = yield* Deferred.make<void>()
      const owner = yield* Inspection.make({
        filesystem: {
          ...filesystem,
          readFile: () =>
            Deferred.succeed(started, undefined).pipe(
              Effect.andThen(Effect.never),
              Effect.onInterrupt(() => Deferred.succeed(interrupted, undefined)),
            ),
        },
        manifest: manifest(directory.path),
      }).pipe(Scope.provide(scope))
      const reading = yield* Effect.forkChild(owner.inspectProject({ root: directory.path }))
      yield* Deferred.await(started)
      yield* Scope.close(scope, Exit.void)
      yield* Deferred.await(interrupted)
      const result = yield* Fiber.await(reading)
      expect(Exit.isFailure(result) && Cause.hasInterrupts(result.cause)).toBe(true)
      expect((yield* owner.inspectProject({ root: directory.path }).pipe(Effect.flip)).code).toBe("owner_closed")
    }),
  )
})

test.each([
  "customDependencyLoader()\n",
  "if (enabled) {\n dependencies {\n implementation 'com.pedropathing:core:2.1.2'\n }\n}\n",
  'val sample = """\ndependencies {\n implementation "com.pedropathing:core:2.1.2"\n}\n"""\n',
])("unsupported dependency source cannot establish absence or parse embedded code %s", async (text) => {
  await using directory = await tmpdir()
  await files(directory.path, {
    "build.dependencies.gradle": gradle,
    "TeamCode/build.gradle.kts": text,
    [java]: 'class Paths { String example = """\nimport com.acmerobotics.roadrunner.Action;\n"""; }\n',
  })
  await run((filesystem) =>
    Effect.gen(function* () {
      const owner = yield* Inspection.make({ filesystem, manifest: manifest(directory.path) })
      const result = yield* owner.inspectProject({ root: directory.path })
      expect(result.detectedPathing).toBe("unknown")
      expect(result.dependencies.filter((item) => item.group === "com.pedropathing" || item.import)).toEqual([])
      expect(result.unknowns.map((item) => item.reason)).toContain("unsupported_gradle")
    }),
  )
})

test("manifest retargeting during the public port read rejects foreign scope", async () => {
  await using directory = await tmpdir()
  await using foreign = await tmpdir()
  const text = JSON.stringify(initial)
  await files(directory.path, { "ftc-project.json": text })
  await files(foreign.path, { "ftc-project.json": text })
  await run((filesystem) =>
    Effect.gen(function* () {
      const owner = yield* Inspection.make({
        filesystem,
        manifest: {
          readManifest: () =>
            Effect.promise(async () => {
              await fs.unlink(path.join(directory.path, "ftc-project.json"))
              await fs.symlink(
                path.join(foreign.path, "ftc-project.json"),
                path.join(directory.path, "ftc-project.json"),
              )
              return { revision: createHash("sha256").update(text).digest("hex"), manifest: initial }
            }),
        },
      })
      expect((yield* owner.inspectProject({ root: directory.path }).pipe(Effect.flip)).code).toBe(
        "path_outside_project",
      )
    }),
  )
})

test("root alias retargeting cannot cross into another project", async () => {
  await using directory = await tmpdir()
  const root = path.join(directory.path, "project")
  const foreign = path.join(directory.path, "foreign")
  const alias = path.join(directory.path, "alias")
  await files(root, { "build.gradle": gradle })
  await files(foreign, { "build.gradle": gradle })
  await fs.symlink(root, alias)
  await run((filesystem) =>
    Effect.gen(function* () {
      const owner = yield* Inspection.make({
        filesystem: {
          ...filesystem,
          readFile: (name) =>
            filesystem.readFile(name).pipe(
              Effect.tap(() =>
                Effect.promise(async () => {
                  await fs.unlink(alias)
                  await fs.symlink(foreign, alias)
                }),
              ),
            ),
        },
        manifest: manifest(root),
      })
      expect((yield* owner.inspectProject({ root: alias }).pipe(Effect.flip)).code).toBe("path_outside_project")
    }),
  )
})

test("SDK disagreement stays unknown while a matching managed selection is consistent", async () => {
  await using directory = await tmpdir()
  const text = JSON.stringify({ ...initial, managedPathing: "pedro" })
  await files(directory.path, {
    "build.dependencies.gradle": gradle,
    "TeamCode/build.gradle":
      "dependencies {\n implementation 'org.firstinspires.ftc:Hardware:11.2.0'\n implementation 'com.pedropathing:core:2.1.2'\n}\n",
    [java]: "import com.pedropathing.geometry.Pose;\n",
    "ftc-project.json": text,
  })
  await run((filesystem) =>
    Effect.gen(function* () {
      const owner = yield* Inspection.make({ filesystem, manifest: manifest(directory.path, text) })
      const result = yield* owner.inspectProject({ root: directory.path })
      expect(result.sdkVersion).toBeUndefined()
      expect(result.conflicts.map((item) => item.code)).toEqual(["sdk_version_conflict"])
      expect(result.managedPathing).toBe("pedro")
    }),
  )
})

test("managed selection is captured before a later filesystem boundary", async () => {
  await using directory = await tmpdir()
  const shared = { ...initial, managedPathing: "pedro" as "pedro" | "road-runner" }
  const text = JSON.stringify(shared)
  await files(directory.path, { "ftc-project.json": text })
  await run((filesystem) =>
    Effect.gen(function* () {
      let delivered = false
      const owner = yield* Inspection.make({
        filesystem: {
          ...filesystem,
          realPath: (name) =>
            filesystem.realPath(name).pipe(
              Effect.tap(() =>
                Effect.sync(() => {
                  if (delivered) shared.managedPathing = "road-runner"
                }),
              ),
            ),
        },
        manifest: {
          readManifest: () =>
            Effect.sync(() => {
              delivered = true
              return { revision: createHash("sha256").update(text).digest("hex"), manifest: shared }
            }),
        },
      })
      expect((yield* owner.inspectProject({ root: directory.path })).managedPathing).toBe("pedro")
    }),
  )
})

test("additional Gradle loaders prevent a conclusive absence after literal declarations", async () => {
  await using directory = await tmpdir()
  await files(directory.path, {
    "build.dependencies.gradle": gradle,
    "TeamCode/build.gradle": "dependencies {\n}\nloadTeamDependencies()\n",
    [java]: "import com.qualcomm.robotcore.hardware.DcMotor;\n",
  })
  await run((filesystem) =>
    Effect.gen(function* () {
      const owner = yield* Inspection.make({ filesystem, manifest: manifest(directory.path) })
      expect((yield* owner.inspectProject({ root: directory.path })).detectedPathing).toBe("unknown")
    }),
  )
})
