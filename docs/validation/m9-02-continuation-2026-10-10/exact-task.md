### M9-02 — Bind single-use approval to exact operation context

**Prerequisites:** [M9-01](robot-approvals-and-operations.md#m9-01).

**Files:** `packages/core/src/ftc/operations.ts`, `packages/core/test/ftc/robot-approvals-and-operations/m9-02.test.ts`.

**Interfaces:** Produces `approveOperation({ userEvent, operationID, contextFingerprint }): PreparedOperation`; userEvent is an injected trusted capability, not a JSON secret.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/robot-approvals-and-operations/m9-02.test.ts`, add `Deploy click authorizes only the displayed build and target`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(approved.action.artifact.digest).toBe(displayedDigest); expect(reused.code).toBe('approval_consumed'); expect(forged.code).toBe('untrusted_approval')
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/robot-approvals-and-operations/m9-02.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Treat a deliberate Deploy click as authorization without a redundant confirmation. Invalidate on changed target/generation/artifact/parameters, rejection, restart or consumption; define expiry via injected policy/clock rather than inventing a product timeout. Installation approval never includes start.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/robot-approvals-and-operations/m9-02.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): bind single-use approval to exact operation context`.
