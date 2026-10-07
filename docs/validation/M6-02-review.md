# M6-02 independent task review

## Spec Compliance

- **Needs fixes.** The shared command, catalog validation, serializable errors, identifier preservation, and existing-manifest-only replacement satisfy the scoped contract, but the requested root and expected revision are not retained across the command's asynchronous read. A confirmed caller mutation can redirect publication to another project (`packages/core/src/ftc/configuration.ts:49`, `packages/core/src/ftc/configuration.ts:55`, `packages/core/src/ftc/configuration.ts:62`).
- Reviewed range: `a82570d5f..e4d498ca0`, supplied review package `.superpowers/sdd/progress/review-a82570d5f..e4d498ca0.diff`; task requirements and approved shape from `docs/validation/M6-02-brief.md:92` and `docs/validation/M6-02-implementation.md:7`.
- Cannot verify integration gates from this task: actual form/chat and i18n adapters, authoritative project/SDK catalog production and binding (M6-06), real FTC SDK/device support, physical wiring, Windows behavior, composed acceptance, and release/platform enablement. Synthetic catalog IDs and local hub IDs establish none of those capabilities (`docs/validation/M6-02-implementation.md:15`, `docs/validation/M6-02-implementation.md:65`).

## Strengths

- One scoped service method owns form/chat validation and delegates persistence to its own existing manifest owner; it does not import sibling implementations or start an owner during import (`packages/core/src/ftc/configuration.ts:23`, `packages/core/src/ftc/configuration.ts:37`, `packages/core/src/ftc/configuration.ts:61`).
- Missing names are identified before strict decode. Subsequent validation uses exact project-wide names, distinct hub IDs, selected per-hub/category port and type rules, and one device per category slot. Indexed error paths are deterministic; trimming is used only to reject whitespace-only names, while admitted strings remain unchanged (`packages/core/src/ftc/configuration.ts:78`, `packages/core/src/ftc/configuration.ts:88`, `packages/core/src/ftc/configuration.ts:94`).
- Canonical serializable contracts require version/revision identifiers and reject duplicate hub/category identities and duplicate port/type entries. Runtime services remain in Core, with the existing namespace import and direct Schema entrypoint (`packages/schema/src/ftc-configuration.ts:76`, `packages/schema/src/ftc-configuration.ts:83`, `packages/schema/src/ftc-configuration.ts:104`, `packages/schema/src/ftc-configuration.ts:119`).
- The admitted hardware is copied before I/O. The replacement spreads the current manifest and changes only hardware; absent manifests fail without initialization, and the owner receives the expected revision for staging-time checks (`packages/core/src/ftc/configuration.ts:48`, `packages/core/src/ftc/configuration.ts:50`, `packages/core/src/ftc/configuration.ts:64`).
- Tests exercise the real command, scoped owner, and temporary filesystem. They cover validation and exact fields, preservation of rejected bytes, persisted Unicode/case/whitespace identifiers, version-specific and hub-local rules, empty replacement, missing manifests, stale revisions, mutation of hardware ingress, and an external edit during staging. The narrow filesystem adapters inject scheduling events rather than replacing the subject (`packages/core/test/ftc/ftc-configuration-and-libraries/m6-02.test.ts:27`, `packages/core/test/ftc/ftc-configuration-and-libraries/m6-02.test.ts:53`, `packages/schema/test/ftc-hardware.test.ts:10`).

## Issues

### Critical (Must Fix)

- None found.

### Important (Should Fix)

- **Capture the command root and expected revision before I/O.** `packages/core/src/ftc/configuration.ts:49` reads the initial `input.root`, but `packages/core/src/ftc/configuration.ts:62` reads it again after awaiting `owner.readManifest`. Similarly, `packages/core/src/ftc/configuration.ts:55` and `packages/core/src/ftc/configuration.ts:63` reread `input.expectedRevision` after the asynchronous boundary. A caller may pass a mutable object to this readonly-shaped interface and change it while the read is pending. In a focused real-files probe, two projects began with identical manifest bytes/revisions; the command started against project A, a read-port callback changed the caller envelope's root to B, and the command successfully published its hardware into B while A remained unchanged. The owner's own revision/root protection cannot recover the original target because it receives the changed root. Capture `root` and `expectedRevision` once before validation/I/O and use those scalars throughout, including conflict errors and the owner update. Add a regression that mutates the command envelope during the read and proves the original target/revision remain authoritative; the existing hardware-copy regression does not cover this envelope.

### Minor (Nice to Have)

- No outstanding minor issue found. The retained initial full RED contains 14 between-test errors (`docs/validation/m6-02/red.log:26`), but the implementation report explicitly distinguishes that noisy run, supplies a clean focused missing-method RED, and supplies clean final GREEN evidence (`docs/validation/M6-02-implementation.md:35`, `docs/validation/m6-02/red-focused.log:24`, `docs/validation/m6-02/affected-green.log:84`).

## Checks and evidence

- Inspected the task's complete product/test hunks and supplied evidence; tool output truncation required retrieving unread portions of the package. Did not reread changed product functions from separate source files or run Git commands.
- **Named outside-diff risk: inherited canonical schema may normalize identifiers or admit personal fields.** Checked the unchanged `packages/schema/src/ftc-configuration.ts:6` through `packages/schema/src/ftc-configuration.ts:33`: string minimum length checks do not normalize strings; nested Device/Hub and Manifest reject excess fields; the revision requires a lowercase 64-character hexadecimal digest.
- **Named outside-diff risk: the new wrapper might bypass owner scope, canonical-root protection, or conditional persistence.** Checked `packages/core/src/ftc/configuration/manifest.ts:32` through `packages/core/src/ftc/configuration/manifest.ts:174`: owner resources are allocated inside the scoped Effect, disposal closes the owner, reads retain their original root, and updates capture root/revision before I/O and recheck observed bytes during staging. The existing final-check/rename external-writer race remains explicitly documented at `packages/core/src/ftc/configuration/manifest.ts:154`; this task is not filesystem CAS.
- **Focused unanswered concern: caller-envelope mutation across wrapper I/O.** From `packages/core`, ran one stdin probe using pinned Bun 1.3.14, `OPENCODE_TEST_HOME=/private/tmp/m6-02-review-home`, and task-owned XDG config/data/cache roots: `bun run -`. It imported the real Configuration/FSUtil/LayerNode implementations, created two real temporary projects with identical manifests, changed only the caller envelope's root during a real read, and asserted A's hardware count stayed 0 while B's became 1. Exit 0, output: `CONFIRMED: command began with first root, but mutation during read redirected publication to second root; first hardware=0, second hardware=1`. Temporary projects were removed in `finally`. This is a defect reproduction, not a passing acceptance check; no production files or tests were changed.
- Reviewed supplied RED/GREEN evidence without rerunning successful suites: Core M6-02 19 pass / 0 fail / 63 assertions (`docs/validation/m6-02/green.log:58`); affected M6-01/M6-02 43 pass / 0 fail / 130 assertions (`docs/validation/m6-02/affected-green.log:84`); Schema 11 pass / 0 fail / 15 assertions (`docs/validation/m6-02/schema-green.log:18`). Reported package-local Core/Schema typechecks exit 0, scoped lint 0 warnings/errors, formatting and diff checks pass (`docs/validation/M6-02-implementation.md:25`, `docs/validation/m6-02/lint.log:1`).
- Ran `shasum -a 256` once over the four frozen product/test files from the repository root, exit 0. All four match the supplied report/hash log (`docs/validation/m6-02/source-sha256.log:1`): Core `1afab570adc4b8374eff59223367df19a22b0ad9286ecd04bab56744a4c5a984`; Schema `0445dde0c7b137fb41848a3612c9d303463087064984477cc510802d072eb730`; Core test `7dc5163160b096ed0541914da138db109b684853aa94f7b51ac85589c3fdd269`; Schema test `34142f96559124a2fbc00c54e2c96baa8ba5b7b886e273f63ebf5ac874a58610`.
- No initial-manifest creation, Java generation, robot configuration changes, actual SDK discovery/support, or authoritative catalog binding is credited. No public Protocol/HttpApi/legacy SDK change appears in this task range. Product, index, Git state, and ledger were read-only; this review file is the sole checkout output.

## Assessment

**Spec compliance:** Needs fixes.

**Task quality:** Needs fixes.

**Reasoning:** The implementation is small, layered correctly, and supported by meaningful real-files tests, with honest fixture and integration limits. The confirmed asynchronous envelope mutation permits cross-project publication and must be fixed before this task is trusted.

## Scoped re-review — fix round 1 of 5

### Finding verdicts

- **I1 — Capture the command root and expected revision before I/O: ADDRESSED.** Repair range `e4d498ca0..6620d1bc1` captures both scalar values at the start of the command (`packages/core/src/ftc/configuration.ts:45`, `packages/core/src/ftc/configuration.ts:46`). The initial owner read, revision comparison, conflict payload, and owner update now use only those captured values (`packages/core/src/ftc/configuration.ts:51`, `packages/core/src/ftc/configuration.ts:57`, `packages/core/src/ftc/configuration.ts:60`, `packages/core/src/ftc/configuration.ts:64`). There is no post-read access to the caller envelope's root/revision.
- The two added real-files regressions reproduce the distinct failures and assert the required results: root mutation writes only the original project and preserves the second project's exact bytes/directory contents (`packages/core/test/ftc/ftc-configuration-and-libraries/m6-02.test.ts:296`); revision mutation still returns a conflict with the original expected revision and observed actual revision, preserving externally edited bytes (`packages/core/test/ftc/ftc-configuration-and-libraries/m6-02.test.ts:337`). Their filesystem read callbacks mutate only caller input, while retaining the real command and owner.

### New breakage in the fix diff

- **None.** The two scalar captures and replacement of envelope accesses do not alter hardware/catalog validation, owner lifecycle, manifest replacement, or error contracts. The added tests await the scoped real-files harness and clean up their temporary projects.

### Out-of-scope observations

- **None.** The earlier integration/platform/SDK/wiring and filesystem publication limitations remain unchanged; no additional product capabilities are credited by this repair.

### Verification evidence

- Read the scoped re-review prompt, appended fix report, and supplied fix diff. Output truncation required retrieving unread fix hunks/evidence; no product-source reread, Git command, suite rerun, new probe, or broader review was performed.
- Supplied regression RED demonstrates both original defects (`docs/validation/m6-02/fix1-red.log:40`, `docs/validation/m6-02/fix1-red.log:89`), followed by clean focused GREEN: 2 pass / 0 fail / 11 assertions (`docs/validation/m6-02/fix1-envelope-green.log:7`). Covering reported evidence is 21 pass / 74 assertions for M6-02, 45 pass / 141 assertions for M6-01/M6-02, and 16 pass / 25 assertions for Schema/hygiene (`docs/validation/M6-02-implementation.md:81`, `docs/validation/M6-02-implementation.md:82`, `docs/validation/M6-02-implementation.md:83`). Scoped lint and formatting are clean (`docs/validation/m6-02/fix1-lint.log:1`, `docs/validation/m6-02/fix1-format-check.log:2`).
- Historical worker typecheck failures were foreign M3 fixture diagnostics, not ignored M6 errors. The coordinator supplied subsequent package-local Core and Schema `bun typecheck` exit-0 evidence; inspected settled logs show only the invoked typechecker and no diagnostics (`docs/validation/m6-02/fix1-core-types-settled.log:1`, `docs/validation/m6-02/fix1-schema-types-settled.log:1`). The worker's earlier failure logs remain historical evidence.
- Ran `shasum -a 256 -c docs/validation/m6-02/fix1-source-sha256.log` from the repository root, exit 0: all four frozen repair files reported `OK`. Used the refreshed repair hash manifest, not the original candidate's historical hash log.
- Product, tests, index, Git state, and ledger remained read-only; only this report was appended.

### Final verdict

**Fix round:** All findings addressed; no new Critical/Important breakage.

**Final spec compliance:** Approved.

**Final task quality:** Approved.
