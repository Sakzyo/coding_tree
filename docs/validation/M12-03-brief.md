# M12-03 exercise-request brief — 2026-10-08

PREPARED ONLY, not dispatched. Root fills source checkpoint and writer ownership at dispatch. Read AGENTS.md (including Schema), docs/prompt.md, M12 exact task/module, proposal LRN-04, M12-01/02 implementation/review and docs/validation/M12-03-preflight.md. Reviewed M12-02 is the prerequisite; authored real course/capstone and platform/physical gates remain separate.

Allowed product paths: packages/core/src/ftc/learning.ts; packages/core/test/ftc/learning-and-progress/m12-03.test.ts; necessary producer-owned packages/schema/src/ftc-learning.ts and packages/schema/test/ftc-learning.test.ts canonical command/result extensions. No M11 metadata/runtime/content changes, M6 files, SQL/migration, composition, host, Protocol/Client, context/sanitizer or operations changes. Evidence docs/validation/M12-03-implementation.md and docs/validation/m12-03/* only. Root owns Git/index/ledger/shared exports; no subagents/worker commits.

## Reconciled task details

Use preflight option1: separate declared generic and wholly library-specific courses through a required trusted course/lesson binding port. Missing track classification is unavailable, never guessed foundation. Check declared track against canonical matching M11 ContentRecord metadata when lookup succeeds. Do not classify from ID/topic substrings, translated prose or project choice. No mixed-course lesson metadata support is introduced. Real M11 authored tracks/composition later supply trusted declarations; fixtures remain synthetic.

Add explicit command language en/zh; exercise lookups are localOnly:true with no fallback. Reuse canonical FtcKnowledge ContentQuery/Exercise and M6 ManifestSnapshot, Project.ID and existing concrete version checks. M12's consumed projectSnapshot is only an immutable applicability projection of same project/SDK/library facts, not a second ProjectContext/inspection store. Required trusted binding is request/project/configuration bound; do not blindly reuse a closed-over navigation binding belonging to another project. Capture/decode/copy all command scalars/nested snapshots before async waits; no caller-envelope mutation can retarget project/config/course/selection.

Return a lesson-level ExerciseRequest preserving ALL canonical exercise records/IDs/prompts/criteria in requiredEvidence, exact course/lesson/versions/project/configuration revision/SDK/library selection and explicit track foundations|pedro|road-runner. The planned signature selects a lesson and has no exercise selector; silently selecting first would discard required evidence. Keep omitted physical flags unspecified. No competence/completion/reading/build/physical requirement is inferred from prose. Do not require navigation entryPoints for exercise requests.

Neither allows declared generic Java/hardware/driver-control foundations, but returns pathing_required for declared library-specific work. Selected Pedro/Road Runner must match the course's declared library and exact supplied concrete version; wrong library/version is incompatibility, never migration or substitution. Generic SDK course remains applicable under an explicit library binding (reviewed M12-02 rule). Missing/invalid/local-unavailable/translation/version/lesson/binding failures use stable existing errors where applicable, never successful request/guidance.

This method returns only a request; no editing, agent startup, builds, robot operations, attempt/entry/skip persistence, configuration changes or automatic progress awards. Existing service lifecycle retains owned lookup cancellation/disposal semantics; source import starts no I/O. No new persistence or runtime.

## Verification

Read Superpowers TDD and write meaningful behavioral RED for exact neither-foundation/pathing_required case before implementation; then minimal GREEN. Follow preflight case matrix with real M12 service/temp SQLite and supplied canonical local content ports; no sibling startup or cloned applicability logic. Add schema/facade identity/optional omission and source-record provenance assertions. Multiple exercises, missing entryPoints, language/local absence, generic+library matching/incompatible, wrong project/config/version, captured-input mutation and lookup cleanup all matter.

Run focused M12-03, affected M12 suite + canonical M11 course metadata/M11-02/M11-04 regressions from packages/core; Schema ftc-learning test from packages/schema; package bun typecheck and scoped lint/format/diff checks. The planned ftc-boundaries.test.ts does not exist: verify actual scoped imports directly and never claim nonexistent command passed. Do not run models/provider/robot/toolchains/network, migration or Client generation.

Pinned Bun /private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64; isolate OPENCODE_TEST_HOME/XDG under /private/tmp/m12-03-home. Freeze source SHA256 and report commands/cwd/exits/counts/RED-GREEN/assumptions, fixture classification and every unrun real curriculum/composed/physical/platform gate. Return tested candidate; no completion checkbox credit before review.

## Exact original task excerpt

### M12-03 — Choose a track and return exercise requests

**Prerequisites:** [M12-02](learning-and-progress.md#m12-02).

**Files:** `packages/core/src/ftc/learning.ts`, `packages/core/test/ftc/learning-and-progress/m12-03.test.ts`.

**Interfaces:** Produces `requestExercise({ courseID, lessonID, projectSnapshot, configuration }): ExerciseRequest | { kind: 'pathing_required' }`; no editing or execution side effects.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/learning-and-progress/m12-03.test.ts`, add `neither permits foundations but blocks autonomous track`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(javaExercise.kind).toBe('exercise'); expect(autonomous.kind).toBe('pathing_required'); expect(operationCalls).toBe(0)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/learning-and-progress/m12-03.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Use the supplied managed-pathing selection and version to choose Pedro/Road Runner exercises. Return a request to the caller; guide selection when neither, without changing project configuration or starting the agent.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/learning-and-progress/m12-03.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): choose a track and return exercise requests`.
