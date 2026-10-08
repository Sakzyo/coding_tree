# M9-01 preparation implementation brief — 2026-10-08

Dispatched on explicit continuation, 2026-10-08. Source base `5fdd801e1`; sole product writer `/root/m9_01`. Root owns shared exports, Git and authoritative progress accounting.
Read AGENTS.md, docs/prompt.md, M9 module, proposal ROB-03/04/07, high-level M9 ownership and docs/validation/M9-01-preflight.md. Exact original task follows below. Prerequisites: fixture-ready with no implementation prerequisite; action isolation M9-07/08 stays blocked and is not promoted by preparation.

Allowed product paths: packages/schema/src/ftc-operation.ts, packages/core/src/ftc/operations.ts, packages/core/test/ftc/robot-approvals-and-operations/m9-01.test.ts. Evidence docs/validation/M9-01-implementation.md and docs/validation/m9-01/*. Root owns shared Schema export/Git/ledger; no manifest/migration/generated/host/transport/approval/UI edits, no subagents or worker commits.

## Coordinator contract decisions

1. Core-only opaque caller object validated by mandatory injected trusted policy.check. Caller identity never comes from serializable input; asserted initiator/mode/project/chat/target/generation must match the captured authoritative grant. Agent requests require matching canonical ChatRef/Session; direct-user chat omission is explicitly permitted by the source. No code/layout/inference approval grants robot action.
2. Use an explicitly M9-owned DeploymentArtifactContext binding projection, reusing canonical Project.ID and FtcJava.Revision where applicable, with exact build/source/configuration/digest references. It is not the future M5 ArtifactRef and carries no path or build capability. Mandatory trusted parameter/artifact validator checks it for fixture preparation; actual producer binding/current successful builds remain M5/M9-04 production gates.
3. Use a nonempty opaque string generation token; this requires equality/change identity only, not guessed numeric increment semantics. Future M8 composition supplies conversion/provenance.
4. Preserve required JSON expectedState and tune value, exact nonempty opMode/field, and valid zero/false. Mandatory narrow trusted version-specific semantic-validation port must reject missing/null/malformed/unsupported state/field/value; no guessed Panel lifecycle enum, physical measurements, tuning range or protocol support. Canonical decode/copy and deeply freeze all ingress before async port waits; no late caller-envelope retargeting.
5. Consumed capabilities are exact action kinds deploy/initialize/start/tune in the trusted grant, plus explicit verified-target status. This is a narrow preparation projection, not canonical M8 capabilities; current ControllerCandidate/ProtocolEvidence cannot establish verified identity. Preserve unknown/rejection paths. Fixtures never authorize production dispatch.

Observation mode rejects agent initialize/start/tune. Deployment remains eligible for separate explicit approval in either mode. Direct-user controls may prepare awaiting approval; declared user initiator never self-authorizes. Every eligible result remains awaiting_approval; M9-02 owns actual user-action/single-use approval. This service must have no mutation/transport/execute method or port.

Store only accepted immutable pending contexts with owner-local operationID and deterministic canonical-JSON context fingerprint covering project/chat/initiator/controller/generation/mode/full action. Fingerprint is decision data, never bearer authority. No SQL/timers/approval expiry/subscriptions/future lifecycle implementation. Owner cleanup interrupts owned policy/validation waits and prevents late retention; caller cancellation isolates other preparations. Import/construction starts no external I/O.

Read Superpowers TDD; meaningful behavior RED then minimal GREEN with real service plus supplied narrow ports. Required test cases are in the preflight, including exact source assertions, forged caller/mode/initiator/target/generation, capability mismatch, malformed params/invalid artifact, caller mutation during waits, zero/false, canonical equal/context-change fingerprints, independent maps, cancellation/disposal and canonical facade/schema identity. No sibling startup, network/provider/robot/toolchain/models/OS credential work.

Run focused test and affected Agent trust/lifecycle regressions from packages/core, bun typecheck in Core/Schema, scoped lint/format/diff. Pinned Bun directory /private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64; isolate OPENCODE_TEST_HOME/XDG under /private/tmp/m9-01-home. Freeze source SHA256/report commands/cwd/counts/RED-GREEN/results, fixture classification and unrun M5/M8/M9 host/platform/physical/action-isolation gates. Report completion candidate, never checkbox completion.

## Exact task excerpt

### M9-01 — Prepare typed operations under independent action policy

**Prerequisites:** None; implement using supplied port fixtures.

**Files:** `packages/schema/src/ftc-operation.ts`, `packages/core/src/ftc/operations.ts`, `packages/core/test/ftc/robot-approvals-and-operations/m9-01.test.ts`.

**Interfaces:** Produces `prepareOperation({ request, robotMode }): PreparedOperation`; robotMode is observation/actions-with-approval and cannot be changed by code/layout/inference settings.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/robot-approvals-and-operations/m9-01.test.ts`, add `observation blocks agent control but not separately approved deployment`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(start.code).toBe('observation_only'); expect(deploy.status).toBe('awaiting_approval'); expect(dispatchCount).toBe(0)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/robot-approvals-and-operations/m9-01.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Validate action-specific parameters and trusted project/chat identity; reject missing identity or unsupported capabilities. Store requested context without dispatching. Direct user commands and agent requests remain distinguishable at the trusted boundary.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/robot-approvals-and-operations/m9-01.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): prepare typed operations under independent action policy`.
