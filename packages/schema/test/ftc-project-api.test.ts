import { expect, test } from "bun:test"
import { Schema } from "effect"
import { FtcProject } from "../src/ftc-project"
import { EventManifest } from "../src/event-manifest"
import { Durable } from "../src/durable-event-manifest"
import { Project } from "../src/project"

test("owner status is current volatile data without persisted claim identity", () => {
  expect(EventManifest.ServerDefinitions.find((item) => item.type === FtcProject.OwnerChanged.type)).toBe(
    FtcProject.OwnerChanged,
  )
  expect(FtcProject.OwnerChanged.durable).toBeUndefined()
  expect(Durable.get(FtcProject.OwnerChanged.type)).toBeUndefined()
  const status = Schema.encodeSync(FtcProject.OwnerStatus)({
    projectID: Project.ID.make("ftc_test"),
    active: undefined,
  })
  expect(status).toEqual({ projectID: "ftc_test" })
  expect(Object.keys(FtcProject.OwnerStatus.fields)).toEqual(["projectID", "active"])
})

test("execution unavailable error and activation refusal preserve stable serializable reasons", () => {
  expect(
    Schema.encodeSync(FtcProject.ExecutionUnavailable)(
      new FtcProject.ExecutionUnavailable({ code: "execution_disabled", sessionID: undefined }),
    ),
  ).toEqual({ _tag: "FtcProjectExecutionUnavailable", code: "execution_disabled" })
  expect(Schema.is(FtcProject.AssociationError)({ code: "activation_unavailable", recovery: "retry" })).toBe(true)
  expect(Schema.is(FtcProject.ExecutionUnavailable)({ _tag: "FtcProjectExecutionUnavailable", code: "ready" })).toBe(
    false,
  )
})
