import { expect, test } from "bun:test"
import { panelsPolicy } from "../../../desktop/src/main/panels-policy"

// A disabled policy is an evaluation decision, not evidence of Electron enforcement.
test("M9-07 keeps unverified embedded dashboard and controls disabled", () => {
  expect(panelsPolicy.embedded).toBe(false)
  expect(panelsPolicy.controls).toBe(false)
  expect(panelsPolicy.reason).toBe("isolation_unverified")
  expect(Object.isFrozen(panelsPolicy)).toBe(true)
})

// Include the real local process probes in the required evaluation entry point.
import "../ftc-adapters/action-boundary-probe.test"
