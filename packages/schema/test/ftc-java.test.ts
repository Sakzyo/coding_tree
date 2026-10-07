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
  expect(() => Schema.decodeUnknownSync(FtcJava.DocumentEvent)({ type: "invented", snapshot })).toThrow()
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

test("edit/save contracts share complete document revisions and preserve proposal/result JSON", () => {
  const revision = { documentID: snapshot.documentID, bufferRevision: 1, diskRevision: 0 }
  const proposal = Schema.decodeUnknownSync(FtcJava.EditProposal)({
    projectID: snapshot.projectID,
    edits: [{ path: snapshot.path, expectedRevision: revision, replacement: "agent" }],
    explanation: "update",
  })
  const save = { projectID: snapshot.projectID, path: snapshot.path, expectedRevision: revision }
  expect(Schema.encodeSync(FtcJava.SaveRequest)(Schema.decodeUnknownSync(FtcJava.SaveRequest)(save))).toEqual(save)
  const conflict = {
    path: snapshot.path,
    reason: "dirty" as const,
    current: Schema.decodeUnknownSync(FtcJava.DocumentSnapshot)(snapshot),
    diskText: "saved",
    choices: ["save", "merge", "defer"] as const,
  }
  const results = [
    { kind: "applied", proposal, applied: [] },
    { kind: "conflict", proposal, applied: [], conflicts: [conflict] },
    {
      kind: "failed",
      proposal,
      applied: [],
      error: { code: "file_unavailable", outcome: "unknown" },
      uncertainPaths: [snapshot.path],
    },
  ] as const
  for (const result of results)
    expect(
      Schema.encodeSync(FtcJava.EditResult)(
        Schema.decodeUnknownSync(FtcJava.EditResult)(JSON.parse(JSON.stringify(result))),
      ),
    ).toEqual(result)
  expect(Schema.encodeSync(FtcJava.DocumentError)({ code: "revision_conflict", conflict, outcome: undefined })).toEqual(
    { code: "revision_conflict", conflict },
  )
  for (const type of ["saved", "disk_changed"] as const)
    expect(Schema.decodeUnknownSync(FtcJava.DocumentEvent)({ type, snapshot }).type).toBe(type)
  expect(
    [FtcJava.Revision, FtcJava.SaveRequest, FtcJava.EditProposal, FtcJava.EditConflict, FtcJava.EditResult].map(
      (contract) => ("identifier" in contract ? contract.identifier : contract.ast.annotations?.identifier),
    ),
  ).toEqual([
    "FtcJava.Revision",
    "FtcJava.SaveRequest",
    "FtcJava.EditProposal",
    "FtcJava.EditConflict",
    "FtcJava.EditResult",
  ])
})

test("proposal and save validation reject empty edits and incomplete or negative revision pairs", () => {
  const revision = { documentID: snapshot.documentID, bufferRevision: 1, diskRevision: 0 }
  const proposal = {
    projectID: snapshot.projectID,
    edits: [{ path: snapshot.path, expectedRevision: revision, replacement: "agent" }],
    explanation: "update",
  }
  expect(() => Schema.decodeUnknownSync(FtcJava.EditProposal)({ ...proposal, edits: [] })).toThrow()
  for (const expectedRevision of [
    { bufferRevision: 1, diskRevision: 0 },
    { ...revision, diskRevision: -1 },
    { ...revision, bufferRevision: 0.5 },
  ]) {
    expect(() =>
      Schema.decodeUnknownSync(FtcJava.EditProposal)({
        ...proposal,
        edits: [{ ...proposal.edits[0], expectedRevision }],
      }),
    ).toThrow()
    expect(() =>
      Schema.decodeUnknownSync(FtcJava.SaveRequest)({
        projectID: snapshot.projectID,
        path: snapshot.path,
        expectedRevision,
      }),
    ).toThrow()
  }
  expect(() =>
    Schema.decodeUnknownSync(FtcJava.EditResult)({ kind: "conflict", proposal, applied: [], conflicts: [] }),
  ).toThrow()
})
