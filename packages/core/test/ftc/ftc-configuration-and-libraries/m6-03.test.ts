import { expect, test } from "bun:test"
import { Cause, Deferred, Effect, Exit, Fiber, Result, Scope } from "effect"
import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { ManifestSnapshot } from "../../../src/ftc/configuration/manifest-snapshot"
import { Inspection } from "../../../src/ftc/configuration/inspection"
import type { InspectionFilesystem } from "../../../src/ftc/configuration/inspection-filesystem"
import { tmpdir } from "../../fixture/tmpdir"

const root = "/controlled/project"
const initial = { schemaVersion: 1, hardware: [], managedPathing: "neither" } as const
const gradle = "dependencies {\n implementation 'org.firstinspires.ftc:RobotCore:11.1.0'\n}\n"
const java = "TeamCode/src/main/java/org/firstinspires/ftc/teamcode/Paths.java"

// Controlled public capability fixture; this is not a native protected filesystem adapter.
function reader(values: Record<string, string>, override: Partial<InspectionFilesystem.Project> = {}) {
  return {
    openProject: (input: { root: string }) =>
      Effect.gen(function* () {
        expect(input.root).toBe(root)
        return {
          canonicalRoot: root,
          identity: "controlled-project-1",
          verify: () => Effect.void,
          readFile: (relative: string) =>
            Effect.sync(() =>
              values[relative] === undefined ? undefined : new TextEncoder().encode(values[relative]),
            ),
          readDirectory: (relative: string) =>
            Effect.sync(() => {
              const children = Object.keys(values).filter((name) => name.startsWith(`${relative}/`))
              if (!children.length) return undefined
              return Array.from(new Set(children.map((name) => name.slice(relative.length + 1).split("/")[0]))).map(
                (name) => ({
                  name,
                  type: children.some((file) => file.startsWith(`${relative}/${name}/`))
                    ? ("directory" as const)
                    : ("file" as const),
                }),
              )
            }),
          ...override,
        }
      }),
  }
}

function manifest() {
  return { decodeRead: ManifestSnapshot.decodeRead }
}

function run<A, E>(body: Effect.Effect<A, E, Scope.Scope>) {
  return Effect.runPromise(Effect.scoped(body))
}

// Removing conflict production or guessing a variable version breaks these assertions.
test("ambiguous imports stay untouched", async () => {
  const beforeFiles = {
    "build.dependencies.gradle": gradle,
    "TeamCode/build.gradle":
      'dependencies {\n implementation "com.pedropathing:core:$pedroVersion"\n implementation "com.acmerobotics.roadrunner:core:1.0.1"\n}\n',
    [java]: "import com.pedropathing.geometry.Pose;\nimport com.acmerobotics.roadrunner.Action;\n",
    "ftc-project.json": JSON.stringify(initial),
  }
  const values = { ...beforeFiles }
  await run(
    Effect.gen(function* () {
      const owner = yield* Inspection.make({ reader: reader(values), manifest: manifest() })
      const result = yield* owner.inspectProject({ root })
      expect(result.conflicts.length).toBeGreaterThan(0)
      expect(result.detectedPathing).toBe("both")
      expect(result.sdkVersion).toBe("11.1.0")
      const dynamic = result.dependencies.find((item) => item.group === "com.pedropathing")
      expect(dynamic).toBeDefined()
      expect(dynamic?.version).toBeUndefined()
      expect(dynamic?.reason).toBe("dynamic_version")
      expect(result.conflicts.map((item) => item.code)).toContain("manifest_mismatch")
      expect(values).toEqual(beforeFiles)
      expect(result.sourceRevisions.find((item) => item.path === "ftc-project.json")?.revision).toBe(
        createHash("sha256").update(beforeFiles["ftc-project.json"]).digest("hex"),
      )
    }),
  )
})

test("static Kotlin coordinates and Java imports ignore comments and preserve evidence", async () => {
  const text =
    'dependencies {\n implementation("com.pedropathing:ftc:2.1.2") // comment\n /* implementation("com.acmerobotics.roadrunner:core:1.0.1") */\n}\n'
  await run(
    Effect.gen(function* () {
      const owner = yield* Inspection.make({
        reader: reader({
          "build.dependencies.gradle": gradle,
          "TeamCode/build.gradle.kts": text,
          [java]: "// import com.acmerobotics.roadrunner.Action;\nimport com.pedropathing.geometry.Pose;\n",
        }),
        manifest: manifest(),
      })
      const result = yield* owner.inspectProject({ root })
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

test.each([
  "dependencies {\n implementation(libs.pathing)\n if (enabled) {\n implementation 'com.pedropathing:core:2.1.2'\n }\n}\n",
  "customDependencyLoader()\n",
  "if (enabled) {\n dependencies {\n implementation 'com.pedropathing:core:2.1.2'\n }\n}\n",
  'val sample = """\ndependencies {\n implementation "com.pedropathing:core:2.1.2"\n}\n"""\n',
  "dependencies {\n}\nloadTeamDependencies()\n",
])("unsupported source cannot establish absence or parse embedded code %s", async (text) => {
  await run(
    Effect.gen(function* () {
      const owner = yield* Inspection.make({
        reader: reader({
          "TeamCode/build.gradle.kts": text,
          [java]: 'class Paths { String example = """\nimport com.acmerobotics.roadrunner.Action;\n"""; }\n',
        }),
        manifest: manifest(),
      })
      const result = yield* owner.inspectProject({ root })
      expect(result.detectedPathing).toBe("unknown")
      expect(result.sdkVersion).toBeUndefined()
      expect(result.dependencies).toEqual([])
      expect(result.unknowns.map((item) => item.reason)).toContain("unsupported_gradle")
      expect(result.unknowns.map((item) => item.reason)).toContain("missing_input")
    }),
  )
})

test("complete supported layout can observe neither independently of managed selection", async () => {
  await run(
    Effect.gen(function* () {
      const owner = yield* Inspection.make({
        reader: reader({
          "build.dependencies.gradle": gradle,
          "TeamCode/build.gradle": "dependencies {\n}\n",
          [java]: "import com.qualcomm.robotcore.hardware.DcMotor;\n",
        }),
        manifest: manifest(),
      })
      const result = yield* owner.inspectProject({ root })
      expect(result.detectedPathing).toBe("neither")
      expect(result.conflicts).toEqual([])
    }),
  )
})

test("changed observed bytes cannot supply a version", async () => {
  let reads = 0
  await run(
    Effect.gen(function* () {
      const owner = yield* Inspection.make({
        reader: reader(
          {},
          {
            readFile: (name) =>
              Effect.sync(() =>
                name === "build.dependencies.gradle"
                  ? new TextEncoder().encode(++reads === 1 ? gradle : gradle.replace("11.1.0", "11.2.0"))
                  : undefined,
              ),
          },
        ),
        manifest: manifest(),
      })
      const result = yield* owner.inspectProject({ root })
      expect(result.sdkVersion).toBeUndefined()
      expect(result.sourceRevisions.find((item) => item.path === "build.dependencies.gradle")?.state).toBe("changed")
      expect(result.unknowns.map((item) => item.reason)).toContain("changed_input")
    }),
  )
})

test("reader scope closes on success and input is captured before asynchronous admission", async () => {
  const input = { root }
  let released = false
  await run(
    Effect.gen(function* () {
      const supplied = reader({ "build.dependencies.gradle": gradle })
      const owner = yield* Inspection.make({
        reader: {
          openProject: (requested) =>
            supplied.openProject(requested).pipe(
              Effect.tap(() =>
                Effect.sync(() => {
                  input.root = "/unrelated"
                }),
              ),
              Effect.tap(() =>
                Effect.addFinalizer(() =>
                  Effect.sync(() => {
                    released = true
                  }),
                ),
              ),
            ),
        },
        manifest: manifest(),
      })
      expect((yield* owner.inspectProject(input)).sdkVersion).toBe("11.1.0")
      expect(released).toBe(true)
    }),
  )
})

test("scope disposal interrupts reads, releases project reader and rejects escaped API", async () => {
  await run(
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const started = yield* Deferred.make<void>()
      const interrupted = yield* Deferred.make<void>()
      let released = false
      const supplied = reader(
        {},
        {
          readFile: () =>
            Deferred.succeed(started, undefined).pipe(
              Effect.andThen(Effect.never),
              Effect.onInterrupt(() => Deferred.succeed(interrupted, undefined)),
            ),
        },
      )
      const owner = yield* Inspection.make({
        reader: {
          openProject: (input) =>
            supplied.openProject(input).pipe(
              Effect.tap(() =>
                Effect.addFinalizer(() =>
                  Effect.sync(() => {
                    released = true
                  }),
                ),
              ),
            ),
        },
        manifest: manifest(),
      }).pipe(Scope.provide(scope))
      const reading = yield* Effect.forkChild(owner.inspectProject({ root }))
      yield* Deferred.await(started)
      yield* Scope.close(scope, Exit.void)
      yield* Deferred.await(interrupted)
      const result = yield* Fiber.await(reading)
      expect(Exit.isFailure(result) && Cause.hasInterrupts(result.cause)).toBe(true)
      expect(released).toBe(true)
      expect((yield* owner.inspectProject({ root }).pipe(Effect.flip)).code).toBe("owner_closed")
    }),
  )
})

test("reader verification failure is surfaced before any relative read", async () => {
  let consumed = false
  await run(
    Effect.gen(function* () {
      const owner = yield* Inspection.make({
        reader: reader(
          {},
          {
            verify: () => Effect.fail({ code: "path_outside_project" }),
            readFile: () =>
              Effect.sync(() => {
                consumed = true
                return undefined
              }),
          },
        ),
        manifest: manifest(),
      })
      expect((yield* owner.inspectProject({ root }).pipe(Effect.flip)).code).toBe("path_outside_project")
      expect(consumed).toBe(false)
    }),
  )
})

test("SDK disagreement is unknown and matching managed selection is consistent", async () => {
  await run(
    Effect.gen(function* () {
      const owner = yield* Inspection.make({
        reader: reader({
          "build.dependencies.gradle": gradle,
          "TeamCode/build.gradle":
            "dependencies {\n implementation 'org.firstinspires.ftc:Hardware:11.2.0'\n implementation 'com.pedropathing:core:2.1.2'\n}\n",
          [java]: "import com.pedropathing.geometry.Pose;\n",
          "ftc-project.json": JSON.stringify({ ...initial, managedPathing: "pedro" }),
        }),
        manifest: manifest(),
      })
      const result = yield* owner.inspectProject({ root })
      expect(result.sdkVersion).toBeUndefined()
      expect(result.conflicts.map((item) => item.code)).toEqual(["sdk_version_conflict"])
      expect(result.managedPathing).toBe("pedro")
    }),
  )
})

test.each(["/", "$/"])("unsupported Groovy %s literal content is never dependency evidence", async (delimiter) => {
  const end = delimiter === "/" ? "/" : "/$"
  await run(
    Effect.gen(function* () {
      const owner = yield* Inspection.make({
        reader: reader({
          "TeamCode/build.gradle": `def example = ${delimiter}\ndependencies {\n implementation 'com.pedropathing:core:2.1.2'\n implementation 'org.firstinspires.ftc:RobotCore:11.1.0'\n}\n${end}\n`,
        }),
        manifest: manifest(),
      })
      const result = yield* owner.inspectProject({ root })
      expect(result.dependencies).toEqual([])
      expect(result.sdkVersion).toBeUndefined()
      expect(result.detectedPathing).toBe("unknown")
      expect(result.conflicts).toEqual([])
      expect(result.unknowns.map((item) => item.reason)).toContain("unsupported_gradle")
    }),
  )
})

// Missing protected binding must never fall back to the historical generic pathname API.
test.each(["file", "ancestor"])(
  "generic pathname %s retarget fallback is rejected before consuming foreign data",
  async (mode) => {
    await using directory = await tmpdir()
    await using foreign = await tmpdir()
    const sentinel = "foreign-read-sentinel-6-03"
    const source = path.join(directory.path, mode === "file" ? "build.gradle" : "TeamCode")
    const outside = path.join(foreign.path, mode === "file" ? "build.gradle" : "TeamCode")
    if (mode === "file") await fs.writeFile(outside, sentinel)
    if (mode === "ancestor") {
      await fs.mkdir(outside)
      await fs.writeFile(path.join(outside, `${sentinel}.java`), sentinel)
    }
    await fs.symlink(outside, source)
    let consumed = false
    const generic = {
      readFile: async () => {
        consumed = true
        return fs.readFile(source)
      },
      readDirectory: async () => {
        consumed = true
        return fs.readdir(source)
      },
    }
    await run(
      Effect.gen(function* () {
        const legacy = { filesystem: generic, manifest: manifest() }
        // @ts-expect-error Runtime probe deliberately omits the mandatory protected reader.
        const owner = yield* Inspection.make(legacy)
        expect((yield* owner.inspectProject({ root: directory.path }).pipe(Effect.flip)).code).toBe(
          "reader_unavailable",
        )
        expect(consumed).toBe(false)
      }),
    )
  },
)

test("unsupported protected binding fails visibly without manifest or source reads", async () => {
  let manifestRead = false
  await run(
    Effect.gen(function* () {
      const owner = yield* Inspection.make({
        reader: { openProject: () => Effect.fail({ code: "unsupported_reader" }) },
        manifest: {
          decodeRead: (bytes) => {
            manifestRead = true
            return ManifestSnapshot.decodeRead(bytes)
          },
        },
      })
      expect((yield* owner.inspectProject({ root }).pipe(Effect.flip)).code).toBe("unsupported_reader")
      expect(manifestRead).toBe(false)
    }),
  )
})

test("managed snapshot selection is captured before later reader verification", async () => {
  const shared = { ...initial, managedPathing: "pedro" as "pedro" | "road-runner" }
  const text = JSON.stringify(shared)
  let delivered = false
  await run(
    Effect.gen(function* () {
      const owner = yield* Inspection.make({
        reader: reader(
          { "ftc-project.json": text },
          {
            verify: () =>
              Effect.sync(() => {
                if (delivered) shared.managedPathing = "road-runner"
              }),
          },
        ),
        manifest: {
          decodeRead: () => {
            delivered = true
            return Result.succeed({ revision: createHash("sha256").update(text).digest("hex"), manifest: shared })
          },
        },
      })
      expect((yield* owner.inspectProject({ root })).managedPathing).toBe("pedro")
    }),
  )
})

test("reader listing cannot make the module request a parent path", async () => {
  let sourceRead = false
  await run(
    Effect.gen(function* () {
      const owner = yield* Inspection.make({
        reader: reader(
          {},
          {
            readDirectory: () => Effect.succeed([{ name: "..", type: "directory" }]),
            readFile: (relative) =>
              Effect.sync(() => {
                if (relative.includes("..")) sourceRead = true
                return undefined
              }),
          },
        ),
        manifest: manifest(),
      })
      expect((yield* owner.inspectProject({ root }).pipe(Effect.flip)).code).toBe("path_outside_project")
      expect(sourceRead).toBe(false)
    }),
  )
})
