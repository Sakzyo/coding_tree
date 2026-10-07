import { expect, test } from "bun:test"
import { Schema } from "effect"
import { FtcAgent } from "../src/index"
import { CodeMode, PlanID, CodePlan } from "../src/ftc-agent"

test("code plans preserve canonical proposal and complete revisions through JSON", () => {
  const value = {
    planID: "plan_fixture",
    projectID: "team",
    sessionID: "ses_code",
    proposal: {
      projectID: "team",
      edits: [
        {
          path: "/team/Main.java",
          replacement: "class Main {}",
          expectedRevision: { documentID: "doc_main", bufferRevision: 2, diskRevision: 1 },
        },
      ],
      explanation: "Update Java",
    },
    explanation: "Update Java",
    expectedRevisions: [{ documentID: "doc_main", bufferRevision: 2, diskRevision: 1 }],
  }
  expect(Schema.encodeSync(FtcAgent.CodePlan)(Schema.decodeUnknownSync(FtcAgent.CodePlan)(value))).toEqual(value)
  expect(FtcAgent.CodeMode).toBe(CodeMode)
  expect(FtcAgent.PlanID).toBe(PlanID)
  expect(FtcAgent.CodePlan).toBe(CodePlan)
  expect(() =>
    Schema.decodeUnknownSync(FtcAgent.CodePlan)({ ...value, expectedRevisions: [{ bufferRevision: 2 }] }),
  ).toThrow()
  for (const mode of ["plan-first", "direct"] as const)
    expect(Schema.decodeUnknownSync(FtcAgent.CodeMode)(mode)).toBe(mode)
  expect(() => Schema.decodeUnknownSync(FtcAgent.CodeMode)("deploy")).toThrow()
  for (const id of ["plan", "plans_fixture", "approval_fixture"])
    expect(() => Schema.decodeUnknownSync(FtcAgent.PlanID)(id)).toThrow()
  const first = FtcAgent.PlanID.create()
  expect(Schema.decodeUnknownSync(FtcAgent.PlanID)(first)).toBe(first)
  expect(first).not.toBe(FtcAgent.PlanID.create())
  expect(
    [FtcAgent.PlanID, FtcAgent.CodeMode, FtcAgent.CodePlan].map((value) =>
      "identifier" in value ? value.identifier : value.ast.annotations?.identifier,
    ),
  ).toEqual(["FtcAgent.PlanID", "FtcAgent.CodeMode", "FtcAgent.CodePlan"])
})
