import { expect, test } from "bun:test"
import { Schema } from "effect"
import { FtcKnowledge } from "../src/ftc-knowledge"

const lesson: FtcKnowledge.Lesson = {
  id: "synthetic-lesson",
  version: "1.0.0",
  topic: "synthetic",
  title: "Synthetic",
  body: "Explain",
  exercises: [
    {
      id: "synthetic-exercise",
      prompt: "Apply",
      requiresExplanation: true,
      requiresProjectApplication: true,
      explanationCriteria: "Explain",
      projectApplicationCriteria: "Apply",
    },
  ],
}
const document: FtcKnowledge.ContentDocument = {
  id: "synthetic",
  version: "1.0.0",
  language: "en",
  body: "Synthetic",
  lessons: [lesson],
}

test("optional course policy preserves true, false and unknown without defaults", () => {
  const decode = Schema.decodeUnknownSync(FtcKnowledge.ContentDocument, { onExcessProperty: "error" })
  expect(decode(document)).toEqual(document)
  const withPolicy = {
    ...document,
    entryPoints: { "java-beginner": lesson.id, "ftc-beginner": lesson.id, experienced: lesson.id },
    lessons: [
      { ...lesson, skippable: false, exercises: [{ ...lesson.exercises[0], requiresPhysicalValidation: true }] },
    ],
  }
  expect(decode(withPolicy)).toEqual(withPolicy)
  expect(Schema.encodeSync(FtcKnowledge.ContentDocument)({ ...decode(document), entryPoints: undefined })).toEqual(
    document,
  )
  expect(() => decode({ ...withPolicy, entryPoints: { experienced: lesson.id } })).toThrow()
  expect(() => decode({ ...document, lessons: [{ ...lesson, skippable: "yes" }] })).toThrow()
  expect(() =>
    decode({
      ...document,
      lessons: [{ ...lesson, exercises: [{ ...lesson.exercises[0], requiresExplanation: false }] }],
    }),
  ).toThrow()
})
