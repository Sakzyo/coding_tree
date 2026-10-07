### Spec Compliance

- **Needs fixes.** The save/edit contracts and conflict handling meet the scoped requirements except for the final authority boundary: `packages/core/src/ftc/java/documents.ts:466` checks code permission before another asynchronous scope check, allowing a revoked grant to reach the write. See Important I1.
- Reviewed task range: base `8a0b5881b`, head `23eed3535`, using `.superpowers/sdd/progress/review-8a0b5881b..23eed3535.diff`, `docs/validation/M5-02-brief.md`, and `docs/validation/M5-02-implementation.md`. Review follows the Superpowers task-reviewer specification and quality rubric.
- Cannot verify production integration from this diff: the authenticated code-change adapter, conditional filesystem adapter, Monaco/host wiring, Windows behavior, packaged acceptance, and crash recovery remain gates. The test filesystem performs real reads/writes but does not establish atomic exclusion against arbitrary external processes (`packages/core/test/ftc/java-development/m5-02.test.ts:29`; `docs/validation/M5-02-implementation.md:61`).
- Existing opened files are the implemented scope. M6-04 creation requires a later producer-owned contract; no creation capability or duplicate M3 proposal-identity registry is credited here (`packages/core/src/ftc/java/documents.ts:140`, `packages/schema/src/ftc-java.ts:48`).

### Strengths

- Revision matching includes document identity and both independent counters, protecting fresh owners from old proposals. Schema owns the serializable contract and the Java facade re-exports it directly (`packages/schema/src/ftc-java.ts:33`; `packages/core/src/ftc/java/documents.ts:525`; `packages/core/src/ftc/java.ts:6`).
- Open captures a copy of actual bytes, and observation preserves buffer text/revision while advancing disk state. Fatal UTF-8 decoding, BOM preservation, and Unicode round-trip validation avoid silently rewriting different bytes (`packages/core/src/ftc/java/documents.ts:152`, `:201`, `:288`, `:441`).
- Agent edits reject dirty buffers; conflicts expose both current buffer and disk text with actionable choices. The merge test consumes the observed revision and performs a guarded save (`packages/core/src/ftc/java/documents.ts:179`, `:379`; `packages/core/test/ftc/java-development/m5-02.test.ts:600`).
- Proposal content and revision records are copied and frozen before external authorization/project I/O. The trusted port receives the complete proposal and opaque authorization; returned grants are checked against project, canonical root, and paths. M3 remains responsible for approval identity and exact proposal binding (`packages/core/src/ftc/java/documents.ts:234`, `:430`; `packages/core/test/ftc/java-development/m5-02.test.ts:478`).
- Canonical duplicate rejection and ordered locks accompany full proposal preflight. Later conflicts and uncertain write failures retain already-confirmed snapshots rather than claiming all-or-nothing success or attempting unsafe rollback (`packages/core/src/ftc/java/documents.ts:444`, `:449`, `:458`, `:491`; `packages/core/test/ftc/java-development/m5-02.test.ts:281`).
- Owner-scoped operations release pending external resources, and confirmed commit plus snapshot/event publication share a cancellation boundary. Focused tests cover caller cancellation, owner disposal, and cancellation after confirmed write (`packages/core/src/ftc/java/documents.ts:125`, `:209`; `packages/core/test/ftc/java-development/m5-02.test.ts:684`, `:864`).

### Issues

#### Critical

- None found in the scoped review.

#### Important

- **I1 — Revoked code authority can still write during the last scope check.** `packages/core/src/ftc/java/documents.ts:466-468`: after the last `checkChanges`, `checkScope` awaits project resolution and canonical root/target resolution (`:129-145`, with `authorize` at `:98-112`). If code mode changes or the approval is revoked during those awaits, `commit` proceeds without checking authority again. This is an actual Core admission gap before the conditional adapter is invoked, separate from the acknowledged production filesystem transaction gate. A focused real-file probe revoked the grant from `filesystem.realpath` after the third successful `codeChanges.check`; the operation still returned `applied` and wrote `agent`. Move the final trusted code-authority check after awaited scope validation, immediately before entering commit, and add a regression for revocation during final scope resolution. Preserve the adapter's commit-time canonical-path and expected-byte checks. For later files, continue returning earlier confirmed commits honestly when revocation stops the proposal.

#### Minor

- **M1 — Two test names overstate their assertion coverage.** `packages/core/test/ftc/java-development/m5-02.test.ts:383` says it tests unopened/new-file targets, but tests only a duplicate symlink and a missing new file; it never creates an existing unopened target. `:600` says explicit merge or save, but exercises only merge followed by save. The implementation appears to support both omitted cases; add direct existing-unopened and save-with-the-returned-fresh-pair cases, or narrow the evidence wording. This does not independently block the task.

### Checks and evidence

- Read the complete task diff in bounded sections after the initial combined tool output was truncated. No Git commands, index changes, ledger edits, or product changes were made. No subagents were used.
- One additional source read was necessary because the supplied diff omitted the body of `authorize`: inspected `packages/core/src/ftc/java/documents.ts:92-124` solely for the named risk that asynchronous scope validation follows the final code-permission check.
- `shasum -a 256 -c docs/validation/m5-02/source-sha256.txt`, repository cwd, exit 0: all five source/test hashes match the frozen manifest.
- Inspected retained successful logs without rerunning suites: focused Core 28 pass / 110 assertions (`docs/validation/m5-02/focused-final.log:33`), affected Core 61 pass / 204 assertions (`docs/validation/m5-02/affected-final.log:70`), Schema/hygiene 23 pass / 52 assertions (`docs/validation/m5-02/schema-final.log:30`). Final Core/Schema typecheck, lint, and format logs are clean. Earlier errors/warnings are retained and identified as corrected attempts, not presented as final successes.
- **One focused new probe**, cwd `packages/core`, command `PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH bun run -` with an inline script, exit 0. The script constructed the real `JavaDocuments` owner, opened a real temporary `Main.java` containing `saved`, and submitted a clean revision-0 proposal replacing it with `agent`. The trusted check counted calls and failed once `revoked` became true. The realpath port set `revoked = true` during the final scope resolution when the count was 3. The conditional write port compared actual bytes before writing. Observed output:

  ```json
  {"result":"applied","checks":3,"revoked":true,"writes":1,"disk":"agent"}
  ```

  This establishes I1: there was an asynchronous Core boundary after the last permission check at which authority changed, and no subsequent permission check rejected the write. The temporary directory was removed in `finally`; the probe added no test or product files.

### Assessment

**Task quality: Needs fixes.**

The revision, conflict, byte-preservation, partial-outcome, and cancellation design is well supported by real implementation tests. The reproduced final-check ordering defect permits a revoked code grant to mutate source, so approval requires correcting I1 and validating that precise boundary.

### Scoped re-review — fix round 1

#### Finding verdicts

- **I1 — ADDRESSED.** In repair range `23eed3535..a82570d5f`, `packages/core/src/ftc/java/documents.ts:466-468` now completes asynchronous `checkScope`, performs the final trusted `checkChanges`, and immediately enters conditional commit. The authority check therefore observes revocation during the final scope resolution that bypassed the original ordering. Existing conditional placement/byte checks and partial-result handling are retained.
- `packages/core/test/ftc/java-development/m5-02.test.ts:989` adds two real-owner/real-file regressions, revoking authority during final scope resolution before either the first or second target. Assertions verify the denied target never reaches the conditional writer, its disk/buffer remain unchanged, and the second-target case reports the first committed snapshot with `edit_unauthorized` and no uncertain path. The controlled realpath port targets the exact original boundary without mocking the implementation.

#### New breakage in the fix diff

- **None.** No new Critical or Important findings. The production change is solely the ordering of the existing final checks; the new regression assertions exercise both zero-write and partial-commit outcomes.

#### Out-of-scope observations

- No new observations. Original Minor M1 remains deferred and non-blocking; it was not reopened in this scoped review. Previously listed production authorization/filesystem, editor/host, Windows, creation, packaged acceptance, and recovery gates remain unverified.

#### Re-review checks

- Read the Superpowers scoped re-review rubric, appended implementation report, and complete repair diff once. Scope was limited to original I1 and breakage introduced by the repair. No subagents, Git/index/product/ledger changes, or suite reruns.
- Confirmed retained regression RED evidence: both denied targets reached the writer under the previous order, producing **0 pass / 2 fail / 4 assertions** (`docs/validation/m5-02/fix-1-red.log:55`). Confirmed GREEN evidence: **2 pass / 0 fail / 15 assertions** (`docs/validation/m5-02/fix-1-green.log:7`).
- Confirmed final retained evidence: focused Core **30 pass / 125 assertions** (`docs/validation/m5-02/fix-1-focused.log:35`), affected Core **63 pass / 219 assertions** (`docs/validation/m5-02/fix-1-affected.log:72`), and Schema/hygiene **23 pass / 52 assertions** (`docs/validation/m5-02/fix-1-schema.log:30`). Core/Schema typecheck and lint, formatting, and scoped diff-check logs support the report's successful checks. The retained branded-path assertion type error was corrected; final checks show no remaining failure or warning.
- Ran `shasum -a 256 -c docs/validation/m5-02/source-sha256.txt` from repository cwd: exit 0; all five refreshed hashes match. No additional behavioral probe was warranted because the new RED/GREEN regressions cover the precise original defect and both commit positions.

#### Final verdict after fix round 1

- **Fix round: All findings addressed, no new Critical/Important breakage.** Original Important I1 is closed; no blocking finding remains.
- **Spec Compliance: Approved** for the scoped M5-02 owner/contracts, subject to the existing integration gates.
- **Task Quality: Approved.** The corrected ordering closes the reproduced authority gap and the targeted regressions protect both first-file denial and honest reporting after an earlier commit. Minor M1 remains deferred.
