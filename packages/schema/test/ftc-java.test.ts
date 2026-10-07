import { expect, test } from "bun:test"
import { Schema } from "effect"
import { AbsolutePath } from "../src/schema"
import { FtcJava } from "../src/index"
import { DocumentSnapshot, DocumentEvent } from "../src/ftc-java"

const snapshot = {
  documentID: "doc_fixture",
  projectID: "fixture-project",
  path: "/team/Main.java",
  bufferRevision: 1,
  diskRevision: 0,
  text: "unsaved",
  dirty: true,
}

test("document snapshots and revisioned events survive JSON without losing buffer or disk identity", () => {
  const document = Schema.decodeUnknownSync(FtcJava.DocumentSnapshot)(snapshot)
  expect(Schema.encodeSync(FtcJava.DocumentSnapshot)(document)).toEqual(snapshot)
  const event = { type: "changed" as const, snapshot: document }
  expect(Schema.decodeUnknownSync(FtcJava.DocumentEvent)(JSON.parse(JSON.stringify(event)))).toEqual(event)
  expect(FtcJava.DocumentSnapshot).toBe(DocumentSnapshot)
  expect(FtcJava.DocumentEvent).toBe(DocumentEvent)
  expect(
    [FtcJava.DocumentID, FtcJava.DocumentSnapshot, FtcJava.DocumentEvent, FtcJava.DocumentError].map((contract) =>
      "identifier" in contract ? contract.identifier : contract.ast.annotations?.identifier,
    ),
  ).toEqual(["FtcJava.DocumentID", "FtcJava.DocumentSnapshot", "FtcJava.DocumentEvent", "FtcJava.DocumentError"])
})

test.each(["document", "doc", "docs_fixture", "document_fixture"])("document IDs reject foreign prefix %s", (id) => {
  expect(() => Schema.decodeUnknownSync(FtcJava.DocumentID)(id)).toThrow()
})

test("generated document IDs validate their emitted prefix and distinguish identities", () => {
  const first = FtcJava.DocumentID.create()
  const second = FtcJava.DocumentID.create()
  expect(first).toStartWith("doc_")
  expect(Schema.decodeUnknownSync(FtcJava.DocumentID)(first)).toBe(first)
  expect(first).not.toBe(second)
})

test.each([-1, 0.5])("buffer and saved revisions reject invalid sequence value %s", (revision) => {
  expect(() => Schema.decodeUnknownSync(FtcJava.DocumentSnapshot)({ ...snapshot, bufferRevision: revision })).toThrow()
  expect(() => Schema.decodeUnknownSync(FtcJava.DocumentSnapshot)({ ...snapshot, diskRevision: revision })).toThrow()
})

test("document errors omit undefined optional properties and reject invented success states", () => {
  expect(
    Schema.encodeSync(FtcJava.DocumentError)({
      code: "owner_closed",
      projectID: undefined,
      path: undefined,
      expectedRevision: undefined,
      actualRevision: undefined,
    }),
  ).toEqual({ code: "owner_closed" })
  expect(() => Schema.decodeUnknownSync(FtcJava.DocumentError)({ code: "success" })).toThrow()
  expect(() => Schema.decodeUnknownSync(FtcJava.DocumentEvent)({ type: "saved", snapshot })).toThrow()
})

test.each(["Main.java", "../Main.java", ""])("snapshot paths reject relative identity %s", (value) => {
  expect(() => Schema.decodeUnknownSync(FtcJava.DocumentSnapshot)({ ...snapshot, path: value })).toThrow()
})

test.each(["/team/Main.java", "C:\\team\\Main.java", "C:/team/Main.java", "\\\\host\\team\\Main.java"])(
  "snapshot paths preserve platform absolute identity %s",
  (value) => {
    expect(Schema.decodeUnknownSync(FtcJava.DocumentSnapshot)({ ...snapshot, path: value }).path).toBe(
      AbsolutePath.make(value),
    )
  },
)
