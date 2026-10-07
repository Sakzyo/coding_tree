import { expect, test } from "bun:test"
import { Schema } from "effect"
import { FtcProject } from "../src/ftc-project"
import { SessionInput } from "../src/session-input"
import { Project } from "../src/project"
import { Session } from "../src/session"

const chat = {
  projectID: Project.ID.make("prj_a"),
  chatID: FtcProject.ChatID.make("chat_a"),
  sessionID: Session.ID.make("ses_a"),
}

test("submission omits absent options and preserves canonical delivery and prompt attachments", () => {
  const request = Schema.decodeUnknownSync(FtcProject.SubmitPrompt)({ chat, prompt: { text: "hello" } })
  expect(
    Schema.encodeSync(FtcProject.SubmitPrompt)({ ...request, id: undefined, delivery: undefined, resume: undefined }),
  ).toEqual({ chat, prompt: { text: "hello" } })
  const queue = {
    ...request,
    delivery: "queue" as const,
    resume: false,
    prompt: { text: "read", files: [{ uri: "file:///robot.java" }] },
  }
  expect(Schema.encodeSync(FtcProject.SubmitPrompt)(queue)).toEqual(queue)
  expect(Schema.is(FtcProject.SubmitPrompt)({ ...request, delivery: "enqueue" })).toBe(false)
  expect(Schema.is(FtcProject.SubmitPrompt)({ ...request, chat: { ...chat, chatID: "invalid" } })).toBe(false)
})

test("submission result encodes the existing Session admission receipt without flattening it", () => {
  const receipt = {
    admittedSeq: 1,
    id: "msg_a",
    sessionID: "ses_a",
    prompt: { text: "durable" },
    delivery: "steer" as const,
    timeCreated: 0,
  }
  const admitted = Schema.decodeUnknownSync(FtcProject.SubmitResult)({ kind: "admitted", receipt })
  expect(Schema.encodeSync(FtcProject.SubmitResult)(admitted)).toEqual({ kind: "admitted", receipt })
  if (admitted.kind !== "admitted") throw new Error("expected admission")
  expect(Schema.is(SessionInput.Admitted)(admitted.receipt)).toBe(true)
  expect(Schema.decodeUnknownSync(FtcProject.SubmitResult)({ kind: "busy", active: chat })).toEqual({
    kind: "busy",
    active: chat,
  })
  expect(Schema.is(FtcProject.SubmitResult)({ kind: "admitted", receipt: { id: "msg_a" } })).toBe(false)
  expect([
    FtcProject.SubmitPrompt.ast.annotations?.identifier,
    FtcProject.SubmitResult.ast.annotations?.identifier,
  ]).toEqual(["FtcProject.SubmitPrompt", "FtcProject.SubmitResult"])
})
