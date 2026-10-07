# Spec Compliance — Approved

- The exact M6-01 behavior is implemented: absent reads return an explicit proposal, updates require the current byte revision, unknown shared fields and unsupported versions fail, and publication uses a complete staged file. All four requested files are present; the additional Schema barrel/test and validation evidence serve this task. Evidence: `packages/core/src/ftc/configuration/manifest.ts:98`, `:114`, `:231`, `:240`; `packages/schema/src/ftc-configuration.ts:8`; `packages/core/test/ftc/ftc-configuration-and-libraries/m6-01.test.ts:26`.
- Approval covers detected revision conflicts and the supplied adapter's documented concurrency boundary. It does **not** establish the broader statement that external edits can never be lost: a noncooperating writer can change the target after the last check and before rename. This is a known guarantee limit, not merely missing test coverage. Evidence: `packages/core/src/ftc/configuration/manifest.ts:142`, `:150`; `docs/validation/M6-01-implementation.md:3`, `:67`.
- Cannot verify from this task diff: host composition must share the Location owner for each canonical root; independently constructed owners do not share locks. Windows filesystem behavior, application wiring, catalog relationships assigned to M6-02, and platform/release acceptance remain unverified. Evidence: `packages/core/src/ftc/configuration.ts:19`; `packages/core/src/ftc/configuration/manifest.ts:35`; `docs/validation/M6-01-implementation.md:69`.

# Strengths

- Recursive excess-field rejection is encoded in the canonical Device, Hub and Manifest schemas themselves, and direct default-decoder tests exercise all three depths. The complete manifest has only hardware and one managed pathing choice besides its version. Newer versions are rejected before publication. Evidence: `packages/schema/src/ftc-configuration.ts:8`, `:18`, `:24`; `packages/schema/test/ftc-configuration.test.ts:11`; `packages/core/src/ftc/configuration/manifest.ts:240`.
- Both the initial comparison and the check after staging compare SHA256 revisions of actual file bytes. Exclusive linking protects create-only initialization even when a file appears at publication; replacement uses one rename of a complete file. The tests assert preserved external bytes, one successful concurrent update, a fixed expected digest, and a fresh owner's reread. Evidence: `packages/core/src/ftc/configuration/manifest.ts:126`, `:142`, `:155`, `:185`; `packages/core/test/ftc/ftc-configuration-and-libraries/m6-01.test.ts:26`, `:81`, `:306`.
- Canonical root and target checks surround reads and are repeated after staging. The symlink/retarget tests assert that foreign and original project contents are preserved. These are useful checks while remaining short of atomic no-follow filesystem operations. Evidence: `packages/core/src/ftc/configuration/manifest.ts:49`, `:57`, `:142`; `packages/core/test/ftc/ftc-configuration-and-libraries/m6-01.test.ts:260`, `:347`.
- Cleanup captures parent and staging device/inode values, then checks identity and canonical placement before recursive removal. Unverifiable or relocated staging is retained. The joined uninterruptible child is awaited, is not a daemon, and completes before the enclosing operation releases its lock. Existing real-filesystem tests cover cancellation and foreign directories at retargeted/replaced roots. Evidence: `packages/core/src/ftc/configuration/manifest.ts:189`; `packages/core/test/ftc/ftc-configuration-and-libraries/m6-01.test.ts:136`, `:389`, `:467`.
- Revisioned events carry previous revision and canonical root; unchanged observations and unchanged updates do not emit duplicate revision events. The service owns instance-local state, publishes no import-time work, and shuts down its PubSub on scope disposal. Evidence: `packages/core/src/ftc/configuration/manifest.ts:32`, `:39`, `:81`; `packages/core/test/ftc/ftc-configuration-and-libraries/m6-01.test.ts:232`, `:439`.

# Issues

## Critical

- None found within the reviewed task boundary.

## Important

- None found within the reviewed task boundary. The documented last-check/rename and cleanup no-follow races must remain explicit limits; neither this review nor the passing tests prove protection against them (`packages/core/src/ftc/configuration/manifest.ts:142`, `:224`).

## Minor

- `packages/core/test/ftc/ftc-configuration-and-libraries/m6-01.test.ts:280`: the scope-closure test starts its event collection only after disposal and checks only a retained read. It proves that new subscribers terminate and retained reads fail; it does not exercise an already subscribed consumer or an in-flight/queued update during owner closure. Add a focused lifecycle test when composing the Location owner so the broader lifetime claim is demonstrated. The existing publication-time `active()` check and cancellation tests reduce the concern; no failing behavior is established here (`packages/core/src/ftc/configuration/manifest.ts:152`).

# Checks and Evidence Limits

- Reviewed the complete one-task diff for `e2fe3f44c..f3de7a3c7`, recovering output-truncated evidence chunks. No changed product file was separately reread, no Git command was run, and no product/index/ledger changes were made.
- Examined the saved final results: Core 24 pass / 0 fail / 67 assertions; Schema 5 pass / 0 fail / 7 assertions; both package typechecks; scoped lint with zero warnings/errors; formatting success. Earlier harness/lint failures are identified as superseded in the implementation report and were not mistaken for valid behavioral RED evidence. Evidence: `docs/validation/m6-01/green.log:29`, `docs/validation/m6-01/schema-green.log:10`, `docs/validation/m6-01/core-types.log:1`, `docs/validation/m6-01/schema-types.log:1`, `docs/validation/m6-01/lint.log:1`, `docs/validation/m6-01/format-check.log:2`.
- Named boundary check — captured filesystem identity: inspected the unchanged public FSUtil passthrough and pinned platform implementation. FSUtil forwards the underlying filesystem; the pinned implementation constructs FileInfo values from native stat, including device and inode, rather than rereading mutable identity through getters. Native stat follows symlinks, so the module's additional realPath checks remain necessary and do not eliminate races. Evidence: `packages/core/src/fs-util.ts:200`; `node_modules/.bun/@effect+platform-node-shared@4.0.0-beta.83+43902b222b0d7d3e/node_modules/@effect/platform-node-shared/src/NodeFileSystem.ts:482`, `:493`.
- Named boundary check — serialization ownership: inspected the unchanged KeyedMutex implementation. It counts holders and waiters and releases/removes entries through an ensuring finalizer; it adds no process-global ownership. Evidence: `packages/core/src/effect/keyed-mutex.ts:23`.
- Inspected the saved public-FSUtil finalizer probe and its four-mode result. It supports the narrowly stated cancellation-boundary workaround; it does not establish a particular upstream defect. Evidence: `docs/validation/m6-01/finalizer-probe.ts:11`, `:37`; `docs/validation/m6-01/finalizer-probe.log:1`.
- No successful suite was rerun and no new probe was needed. Recorded runs are implementer evidence, not independently repeated tests. Cleanup can retain orphan staging on relocation/unavailable identity and cannot atomically exclude retargeting after its last check. Evidence: `packages/core/src/ftc/configuration/manifest.ts:203`, `:222`; `docs/validation/M6-01-implementation.md:7`, `:69`.

# Task Quality — Approved

The implementation is cohesive and task-scoped, with meaningful real-filesystem assertions for conflicts, initialization, cancellation and cleanup. Approval is for the isolated M6-01 contract and its stated adapter limits; it does not credit Windows support, host owner sharing, or immunity to noncooperating filesystem races.
