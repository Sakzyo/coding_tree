import { expect, test } from "bun:test"
import { FtcKnowledge } from "@opencode-ai/schema/ftc-knowledge"
import { validatePack } from "../../../src/ftc/knowledge"
import { Hash } from "../../../src/util/hash"

function pack(change: (doc: FtcKnowledge.ContentDocument) => unknown = (doc) => doc) {
  const documents = (["en", "zh"] as const).map((language) => ({
    id: "synthetic",
    version: "1.0.0",
    language,
    body: "Synthetic",
    entryPoints: { "java-beginner": "lesson", "ftc-beginner": "lesson", experienced: "lesson" },
    lessons: [
      {
        id: "lesson",
        version: "1.0.0",
        topic: "synthetic",
        title: "Synthetic",
        body: "Synthetic",
        skippable: true,
        exercises: [
          {
            id: "exercise",
            prompt: "Synthetic",
            requiresExplanation: true as const,
            requiresProjectApplication: true as const,
            explanationCriteria: "Explain",
            projectApplicationCriteria: "Apply",
            requiresPhysicalValidation: true,
          },
        ],
      },
    ],
  }))
  const files = documents.map((doc) => ({
    localPath: `${doc.language}/synthetic.json`,
    bytes: Array.from(Buffer.from(JSON.stringify(doc.language === "zh" ? change(doc) : doc))),
  }))
  return {
    manifest: {
      kind: "synthetic" as const,
      records: documents.map((doc, index) => ({
        id: doc.id,
        version: doc.version,
        language: doc.language,
        topic: "synthetic",
        sdkRange: "11.1.0",
        source: "https://example.com/synthetic",
        license: "fixture",
        localPath: files[index].localPath,
        digest: Hash.sha256(Buffer.from(files[index].bytes)),
        provenance: "synthetic" as const,
        codeTokens: [],
      })),
    },
    files,
  }
}

test("paired synthetic course metadata validates and translation structure includes all policy", () => {
  expect(validatePack(pack()).kind).toBe("valid")
  const changes: ((doc: FtcKnowledge.ContentDocument) => unknown)[] = [
    (doc) => ({ ...doc, entryPoints: undefined }),
    (doc) => ({ ...doc, entryPoints: { ...doc.entryPoints, experienced: "absent" } }),
    ...[false, undefined].map((skippable) => (doc: FtcKnowledge.ContentDocument) => ({
      ...doc,
      lessons: doc.lessons!.map((lesson) => ({ ...lesson, skippable })),
    })),
    ...[false, undefined].map((requiresPhysicalValidation) => (doc: FtcKnowledge.ContentDocument) => ({
      ...doc,
      lessons: doc.lessons!.map((lesson) => ({
        ...lesson,
        exercises: lesson.exercises.map((exercise) => ({ ...exercise, requiresPhysicalValidation })),
      })),
    })),
  ]
  for (const change of changes) {
    const result = validatePack(pack(change))
    expect(result.kind).toBe("invalid")
    if (result.kind === "invalid") expect(result.errors.map((error) => error.reason)).toContain("translation_mismatch")
  }
})

test("entry references must exist even when both languages share the same invalid policy", () => {
  const snapshot = pack()
  const files = snapshot.files.map((file) => ({
    ...file,
    bytes: Array.from(
      Buffer.from(Buffer.from(file.bytes).toString().replaceAll('"experienced":"lesson"', '"experienced":"absent"')),
    ),
  }))
  const result = validatePack({
    ...snapshot,
    files,
    manifest: {
      ...snapshot.manifest,
      records: snapshot.manifest.records.map((record, index) => ({
        ...record,
        digest: Hash.sha256(Buffer.from(files[index].bytes)),
      })),
    },
  })
  expect(result.kind).toBe("invalid")
  if (result.kind === "invalid") expect(result.errors.map((error) => error.reason)).toContain("invalid_record")
})

test("equivalent entry maps do not depend on JSON key order", () => {
  expect(
    validatePack(
      pack((doc) => ({
        ...doc,
        entryPoints: { experienced: "lesson", "ftc-beginner": "lesson", "java-beginner": "lesson" },
      })),
    ).kind,
  ).toBe("valid")
})
