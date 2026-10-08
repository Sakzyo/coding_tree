# M9-02 single-use approval implementation evidence

## Read-only preparation — 2026-10-08

Worker: `/root/m9_02`. Status: **READY for later writer release; preparation only**. Read HEAD: `0a0a23ed9069e50b8dd314ae14d54664aaa341ab`, branch `ftc-workspace`. Root has not released product implementation. M1 remains the sole product writer; M1-01, M5-05 and M5-06 must be independently complete before root's explicit M9-02 release. This report grants no task credit, real user consent, host execution or robot authority.

Read root and Schema AGENTS, execution prompt, progress/shared contract rules, exact [M9-02 brief](M9-02-brief.md), [preflight](M9-02-preflight.md), [resume reconciliation](M9-02-resume-reconciliation.md), [M9 module plan](../tasks/robot-approvals-and-operations.md), relevant proposal ROB-02–ROB-07/AC-10/11 and design standalone ports, ownership, approval, isolation and test sections. Read reviewed M9-01 brief/report/review and current Operations, operation Schema and M9-01 test. There is no `packages/core/AGENTS.md`; the root rules apply to these Core paths. No product source/test, Git/index, ledger, checklist or brief was edited; no subagent or source probe was created. Only this preparation section and `m9-02/preparation/*` evidence were written.

### Reconciliation and settled implementation boundary

No unresolved source conflict was found. The exact brief's adopted contracts supersede recommendations in earlier preflight reports: synchronous owner-bound atomic `claim(userEvent)`, scoped exact synchronous `observe(revoke)`, and effectful injected `now`/`deadline({ prepared, claimedAt })` in the same trusted comparison domain. No asynchronous event-claim consumption gap, guessed timer/TTL/time unit, issuer, host route or producer change is authorized.

The reviewed sources remain unchanged and match the prior reconciliation:

| Source | SHA-256 |
| --- | --- |
| `packages/core/src/ftc/operations.ts` | `090da2676b7ba2298867467004e3cb8a0debf7046b35ec23661a4a6590441bb7` |
| `packages/schema/src/ftc-operation.ts` | `1c2e66f286fced3c1ed251c2f326b96c5fe07af78a990b6168b41a8f18eb4ae5` |
| `packages/core/test/ftc/robot-approvals-and-operations/m9-01.test.ts` | `ae346562f8068fbf3be72c074e00290bdd8f8ac9bfb3d2615d347f4a67108a41` |

Current Operations has only `prepareOperation`, with a private pending map and immutable original descriptors. The brief permits only Operations, its canonical Schema, the new M9-02 test and the exact M9-01 facade-key assertion after writer release. Preparation-only constructors stay valid with the optional approval port absent; the future method fails `approval_unavailable`. Canonical ApprovalRequest contains only operationID/fingerprint; the opaque event remains Core-only. Core re-exports the identical canonical Schema value. Seven named approval errors are added without a new Status literal.

M9's deployment `sourceRevision` remains a nonempty document `FtcJava.Revision[]` preparation projection. Future M5 complete saved-input identity is separate. No compatibility, producer conversion, saved-input completeness, successful/current artifact evidence or freshness inference was established here; no M5 source was changed or inspected to manufacture such a claim.

The future service must compare exact operation ID and fingerprint, capture caller scalars/event before waits, reserve immediately after a legitimate synchronous claim, and commit private consent atomically only after final owner/state/deadline guards. Exact trusted revocation/rejection is irreversible before, during and after acceptance; change-away/change-back cannot revive consent. Owner closure wins diagnostics, then the first tombstone, then unretired claimed/accepted is consumed. Authenticated mismatched events may retire their actual owner-known binding; untrusted lookup/assertions cannot retarget another binding. Expiry uses finite injected values, at `now >= deadline` or `deadline <= claimedAt`.

The returned `awaiting_approval` descriptor remains the exact deep-frozen preparation snapshot; private consent/deadline is future execution authority. No consent accessor or dispatch capability is added. Preserve the local beta.83-safe queued observer join. Caller interruption joins its resource release and remains interruption; post-claim failure/interruption retires consent with no late commit. Owner close first marks closed and clears all pending/approval/tombstone state, then joins preparation, approval and observer cleanup. Observe registration belongs to the owner-owned Scope so teardown cannot precede closed state.

### Fresh unchanged baseline

From `/Users/dylanxu/coding_tree/packages/core`, the exact command was:

```sh
PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH OPENCODE_TEST_HOME=/private/tmp/m9-02-home XDG_CONFIG_HOME=/private/tmp/m9-02-home/config XDG_DATA_HOME=/private/tmp/m9-02-home/data XDG_CACHE_HOME=/private/tmp/m9-02-home/cache /private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun test ./test/ftc/robot-approvals-and-operations/m9-01.test.ts
```

Actual result: **exit 0; 66 pass / 0 fail / 194 assertions across one file**, Bun **1.3.14**. Full exact output: [baseline log](m9-02/preparation/m9-01-baseline.log). Exact argv, cwd, environment overrides, timestamps, exit and before/after source hashes: [command metadata](m9-02/preparation/baseline-command.json). All fifteen stable source/contract hashes were equal before and after execution: [manifest](m9-02/preparation/source-sha256.txt), [verification](m9-02/preparation/source-verification.log). The runner used isolated task OPENCODE_TEST_HOME/XDG directories; HOME/CODEX_HOME were not reassigned.

This baseline verifies the unchanged preparation and held-cleanup regressions only. No M9-02 test, meaningful RED/GREEN, typecheck, new lifecycle probe, full repository suite or implementation check ran in this preparation.

### Prepared sequence and verification plan after explicit release

1. Add the exact `Deploy click authorizes only the displayed build and target` real-service test, narrow supplied fixture ports and minimal importable method scaffold; verify behavioral RED with the exact displayed digest assertion rather than a missing method/import exception. Preserve mandated reused `approval_consumed` and forged `untrusted_approval` assertions.
2. Add canonical ApprovalRequest/errors and minimum owner-local approval transitions; verify focused GREEN and the [prepared case matrix](m9-02/preparation/test-matrix.md). Keep all observer/clock/deadline waits interruptible and retain original immutable descriptors.
3. Run only new M9-02 then combined M9-01/M9-02 suites from Core, Core/Schema package `bun typecheck`, scoped lint/format/whitespace and actual identity/facade/import checks. Capture source/report hashes and exact command/exit/count evidence; expand named trust/lifecycle regressions only if changed shared behavior justifies it. Root freezes/commits and dispatches independent review before any completion accounting.

Actual displayed-action issuer, cross-window exact revocation ordering, clock-policy production configuration, M2/M3 caller membership, M5 successful/current artifact provenance/freshness, M8 physical identity/generation/capability production bindings, M9-03 controller coordination, M9-04 live revalidation, M9-05 execution/outcomes and M9-06 transport remain unimplemented/unrun here. M9-07/08 action isolation, M9-09 physical USB/Wi-Fi controllers, macOS/Windows packaged release, real toolchain/provider/model/credential and AC-10/AC-11 remain separate gates. A supplied event or zero-dispatch counter is not real consent or protected dispatch evidence.
