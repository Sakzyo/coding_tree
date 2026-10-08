Specification: **Compliant** for the assigned preparation-only task.

Quality: **Approved**, with one minor test-diagnostic finding.

Reviewed candidate `768ec206c` against base `5fdd801e1`, using the complete four-path product diff in `docs/validation/M9-01-review.diff`, the assigned brief, implementation report, and root/Schema constraints. This is a task review, not a whole-branch or production acceptance review.

### Specification checks

- Trusted preparation compares project, canonical ChatRef including a schema-valid Session ID, initiator, independent mode, target/generation, verified-target status and exact action capability before semantic validation: `packages/core/src/ftc/operations.ts:128`. Opaque caller validation remains mandatory in the injected policy at `operations.ts:31` and `operations.ts:98`; it is absent from the serializable request. Observation rejects agent controls while eligible deployments and direct-user requests remain awaiting approval (`operations.ts:153`, `operations.ts:114`; focused tests at `m9-01.test.ts:155` and `m9-01.test.ts:169`).
- Canonical action-specific records preserve required non-null JSON state/value and exact nonempty text; zero/false are not rejected by truthiness (`packages/schema/src/ftc-operation.ts:10`, `ftc-operation.ts:37`; `m9-01.test.ts:306`). Structural ingress rejects excess request/action fields, encodes optional omission, copies and deeply freezes before asynchronous policy/parameter work (`operations.ts:79`, `operations.ts:85`, `operations.ts:95`; mutation tests at `m9-01.test.ts:336` and `m9-01.test.ts:408`).
- `sourceRevision` is a nonempty array of canonical `FtcJava.Revision` records (`ftc-operation.ts:32`). The named external-contract risk was whether this representation invents M5 producer authority: checked only `packages/schema/src/ftc-java.ts:32` and brief decision 2 at `docs/validation/M9-01-brief.md:11`. The representation satisfies the assigned M9 projection decision. Successful/current build identity, source-set completeness and producer conversion are not established or claimed by these records.
- Fingerprints hash canonical key-sorted JSON covering the complete validated request and mode, exclude only the newly generated operation ID, and have covering equality/context-change tests (`operations.ts:116`, `operations.ts:175`; `m9-01.test.ts:375`, `m9-01.test.ts:438`). Only accepted immutable contexts enter the owner-local map after the final active guard (`operations.ts:63`, `operations.ts:110`, `operations.ts:120`).
- Owner cleanup marks closed and clears pending contexts before closing the owned preparation Scope; caller interruption releases only its preparation. The local deferred fiber observer is narrowly explained and covered by held asynchronous cleanup tests (`operations.ts:65`, `operations.ts:73`, `operations.ts:166`; `m9-01.test.ts:476`, `m9-01.test.ts:508`, `m9-01.test.ts:560`).
- The runtime API has only preparation; both ports are read-only checks and runtime imports include no host/transport/mutation implementation (`operations.ts:3`, `operations.ts:31`, `operations.ts:49`). The exact mandated dispatch counter assertion at `m9-01.test.ts:77` is constant and is not independent dispatch evidence; the actual facade assertions at `m9-01.test.ts:78` and inspected implementation establish this task's capability boundary. No approval/dispatch, SQL, timer, expiry, subscription or host wiring was introduced.
- All assigned files have their corresponding implementation/test hunks, with the coordinator-owned root Schema export also included (`packages/schema/src/index.ts:16`). Browser-safe contracts, optional omission, exact emitted ID prefix and exact facade identities are covered at `m9-01.test.ts:608`. No Protocol/Server contract or generated client change requires regeneration.

### Strengths

- The trust boundary rejects conflicting assertions rather than silently coercing them, and separates structural input checks from explicitly supplied version-specific semantic support (`operations.ts:79`, `operations.ts:128`, `operations.ts:104`).
- Tests exercise the actual service and deterministic supplied ports, including malicious assertion changes, delayed caller mutation, asynchronous resource release, owner independence and immutable output (`m9-01.test.ts:183`, `m9-01.test.ts:336`, `m9-01.test.ts:508`). The implementation report explicitly preserves fixture versus production limits (`docs/validation/M9-01-implementation.md:72`).

### Issues

**Critical:** None found.

**Important:** None found.

**Minor — parameterized test names lose case identity:** `packages/core/test/ftc/robot-approvals-and-operations/m9-01.test.ts:272` and `m9-01.test.ts:296` use `$#`, but the actual pinned Bun output renders every variant as the same `($)` name (`docs/validation/m9-01/focused-final.log:28` through `:48`). Distinct malformed/unsupported cases become harder to identify from a failure report. Use an explicit descriptive case label supported by this runner. This does not invalidate the behavioral assertions or block this task.

### Evidence and limits

- Inspected the actual recorded RED failure (`docs/validation/m9-01/red.log:10`), final focused result **66 pass / 0 fail / 194 assertions** (`focused-final.log:71`), and combined result **125 pass / 0 fail / 453 assertions across four files** (`trust-lifecycle-final.log:156`). Final Core/Schema package typecheck logs each contain `tsgo --noEmit`; the report records exit 0 (`M9-01-implementation.md:50`). Final lint records **0 warnings / 0 errors** (`m9-01/lint.log:1`), and format records all matched files formatted (`m9-01/format.log:2`). No suites were rerun: source inspection identified no concrete unresolved behavioral doubt.
- Historical lint warnings and initial test/typecheck failures are disclosed as resolved in `M9-01-implementation.md:24` and `:32`; they are not current failures. The combined log includes multiline fixture source in existing M6 test titles (`trust-lifecycle-final.log:117`); that pre-existing diagnostic verbosity is outside this task. The new M9 test-name noise is the minor finding above.
- **Cannot verify production authority from this diff; separately required gates:** actual M2/M3 caller/project/chat/Session composition; M5 successful/current artifact producer binding and M9-04 freshness; M8 verified controller identity, generation and capability provenance; M9-02 exact single-use approval; M9-03–06 coordination/state/transport/outcomes; M9-07 enforceable action isolation and M9-08 all production host entry points; M9-09 physical controllers/transports; macOS/Windows app and packaged-release checks. These are explicitly deferred in `M9-01-implementation.md:74`. Preparation fixtures do not satisfy AC-10/AC-11 or promote the blocked isolation ruling.
- Review used the full product diff in bounded output segments and one named canonical-revision contract check. No changed product file was separately reread, no Git/index state was mutated, and no focused probe was needed. The coordinator's twelve frozen-hash verification is accepted as supplied evidence, not claimed as a reviewer rerun.

### Assessment

**Task quality: Approved.** The scoped implementation satisfies the assigned immutable preparation, trust, independent action-policy and cleanup contract. The minor naming issue affects diagnostics only; all real-host, producer, platform and physical acceptance remains separate.
