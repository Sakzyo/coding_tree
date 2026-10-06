# M12 — Learning and personal progress Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement one task at a time, or `superpowers:subagent-driven-development` if that execution method is selected. Check each step only after its evidence exists. This document plans work; it does not claim implementation.

**Goal:** Provide selectable course entry points and evidence-based personal progress across projects and both pathing tracks.

**Architecture:** M12 owns personal progress and project-linked attempts in local SQLite. Inject lesson lookup and repository; project/config/evidence arrive as immutable records. It returns exercise requests for the caller to route through M3/M5/M9, never starts work itself.

**Tech Stack:** TypeScript, Effect, SQLite/Drizzle, local bilingual course packs.

**Spec:** [Requirements](../proposal.md), [high-level design](../high-level-design.md), especially its M12 contract and isolated-test row. Read [shared execution rules and progress](progress.md) before this plan.

**Coverage:** LRN-01–LRN-05; LNG-01, LNG-02; ENV-06; AC-06, AC-12, AC-13.

## Global constraints

- Apply all [shared constraints](progress.md#global-constraints); they are part of every task.
- Develop against explicit ports/immutable records; do not import sibling implementations or their stores.
- Preserve Java FTC scope, macOS/Windows support, English/Simplified Chinese, and independent mode settings.
- All boxes start unchecked. No source document establishes implemented product functionality.

## File map and interfaces

Existing anchors (inspect before editing):

- `packages/core/src/database/database.ts`

Planned owned files/responsibilities (create missing files; modify existing files in place):

- `packages/schema/src/ftc-learning.ts` — entry/course/attempt/progress records
- `packages/core/src/ftc/learning.ts` — lesson/progress/evidence rules
- `packages/core/src/ftc/learning/sql.ts` — personal progress and attempts

`EntryLevel = 'java-beginner' | 'ftc-beginner' | 'experienced'`. `ExerciseRequest = { kind: 'exercise', courseID, lessonID, lessonVersion, projectID, track, requiredEvidence }`. `Attempt = { attemptID, courseID, lessonID, lessonVersion, projectID, configurationRevision, evidence, explanation }`; evidence includes reading/code/build/physical, source, timestamp and verified owner references or explicitly labelled student observation. `Progress` belongs to current local user, not project manifest or a new profile system.

Signatures below specify domain inputs/results; use the repository's Effect services and canonical Schema types as explained in [contract conventions](progress.md#contract-conventions). New API/file names are planning decisions, not claims that they exist.

## Review focus

- Language switch and app restart must preserve progress (M12-01).
- Skipping familiar material must not fabricate physical competence (M12-02).
- Neither blocks only pathing-specific autonomous work (M12-03).
- Attempts from different projects retain their original provenance (M12-04).
- Build/page completion alone cannot satisfy a physical capstone (M12-05).

## Task checklist

- [ ] [M12-01 — Persist personal progress with project-linked attempts](#m12-01)
- [ ] [M12-02 — Select entry level and skip familiar lessons](#m12-02)
- [ ] [M12-03 — Choose a track and return exercise requests](#m12-03)
- [ ] [M12-04 — Validate submitted evidence and retain provenance](#m12-04)
- [ ] [M12-05 — Evaluate both complete-robot capstones](#m12-05)
- [ ] [M12-06 — Wire exercise evidence collection through normal workflows](#m12-06)
- [ ] [M12-07 — Validate learning outcome and offline restoration](#m12-07)

## Execution tasks

<a id="m12-01"></a>

### M12-01 — Persist personal progress with project-linked attempts

**Prerequisites:** None; implement using supplied port fixtures.

**Files:** `packages/schema/src/ftc-learning.ts`, `packages/core/src/ftc/learning.ts`, `packages/core/src/ftc/learning/sql.ts`, `packages/core/test/ftc/learning-and-progress/m12-01.test.ts`.

**Interfaces:** Produces `progress({ courseID }): Progress` and private attempt storage keyed by stable lesson ID/version plus attempt ID.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/learning-and-progress/m12-01.test.ts`, add `progress survives reopen and language changes`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(reopenedProgress).toEqual(savedProgress); expect(chineseProgress).toEqual(englishProgress); expect(manifestWrites).toBe(0)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/learning-and-progress/m12-01.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Use existing local SQLite migration lifecycle with snake_case fields. Keep personal state outside ftc-project.json; associate each attempt with project/configuration/evidence versions and retain prior-version evidence without silently granting new-version completion.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/learning-and-progress/m12-01.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): persist personal progress with project-linked attempts`.

<a id="m12-02"></a>

### M12-02 — Select entry level and skip familiar lessons

**Prerequisites:** [M12-01](learning-and-progress.md#m12-01).

**Files:** `packages/core/src/ftc/learning.ts`, `packages/core/test/ftc/learning-and-progress/m12-02.test.ts`.

**Interfaces:** Produces `selectEntry({ courseID, entryLevel }): Progress`, `skipLesson({ courseID, lessonID }): Progress`, and `nextLesson({ courseID, language }): LessonResult`.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/learning-and-progress/m12-02.test.ts`, add `skip records a skip without claiming exercise completion`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(lesson.state).toBe('skipped'); expect(physicalExercise.complete).toBe(false); expect(next.language).toBe('zh')
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/learning-and-progress/m12-02.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Use supplied M11 lesson metadata for appropriate starts and skippable material. Keep explanation/application/physical prerequisites explicit; contextual teaching and structured course views use the same content IDs.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/learning-and-progress/m12-02.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): select entry level and skip familiar lessons`.

<a id="m12-03"></a>

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

<a id="m12-04"></a>

### M12-04 — Validate submitted evidence and retain provenance

**Prerequisites:** [M12-01](learning-and-progress.md#m12-01), [M12-03](learning-and-progress.md#m12-03).

**Files:** `packages/core/src/ftc/learning.ts`, `packages/core/test/ftc/learning-and-progress/m12-04.test.ts`.

**Interfaces:** Produces `submitAttempt({ request, evidence, explanation }): AttemptResult`; trusted caller resolves build/operation references, student-entered observations are labelled as such.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/learning-and-progress/m12-04.test.ts`, add `foreign or stale evidence cannot pass the selected exercise`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(wrongProject.code).toBe('evidence_mismatch'); expect(buildOnly.physicalComplete).toBe(false); expect(saved.projectID).toBe(originalProjectID)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/learning-and-progress/m12-04.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Check project/lesson/config versions and actual evidence status. Distinguish unavailable diagnostics from success, require explanation/application where specified, and preserve failed attempts. Never turn a model claim or lesson-page visit into robot evidence.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/learning-and-progress/m12-04.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): validate submitted evidence and retain provenance`.

<a id="m12-05"></a>

### M12-05 — Evaluate both complete-robot capstones

**Prerequisites:** [M12-04](learning-and-progress.md#m12-04), [M11-07](ftc-knowledge.md#m11-07), [M11-08](ftc-knowledge.md#m11-08).

**Files:** `packages/core/src/ftc/learning.ts`, `packages/core/test/ftc/learning-and-progress/m12-05.test.ts`.

**Interfaces:** Produces `evaluateCapstone({ courseID, track, attempts }): { complete, missingEvidence }`; consumes versioned capstone criteria.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/learning-and-progress/m12-05.test.ts`, add `complete robot requires driver mechanism autonomous and student validation`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(buildOnly.complete).toBe(false); expect(missing).toContain('physical'); expect(completeWithExplanationAndPhysical.complete).toBe(true)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/learning-and-progress/m12-05.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Require driver control, a mechanism, autonomous movement and student-performed configuration/tuning/diagnosis/deployment with independent explanation/application. Keep each pathing track's workflow separate; never equate passed unit tests with robot behavior.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/learning-and-progress/m12-05.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): evaluate both complete-robot capstones`.

<a id="m12-06"></a>

### M12-06 — Wire exercise evidence collection through normal workflows

**Prerequisites:** [M12-03](learning-and-progress.md#m12-03), [M12-04](learning-and-progress.md#m12-04), [M12-05](learning-and-progress.md#m12-05), [M11-02](ftc-knowledge.md#m11-02), [M5-06](java-development.md#m5-06), [M9-05](robot-approvals-and-operations.md#m9-05), [M10-05](diagnostics-and-dashboard.md#m10-05).

**Files:** `packages/protocol/src/groups/ftc-learning.ts`, `packages/server/src/handlers/ftc-learning.ts`, `packages/core/src/ftc/composition.ts`, `packages/core/test/ftc-integration/m12-06.test.ts`.

**Interfaces:** Produces typed course/progress/request/attempt APIs and a caller-owned evidence adapter over M5/M9/M10; M12 imports none of their implementations.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc-integration/m12-06.test.ts`, add `composed exercise retains normal edit and robot permissions`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(unapprovedRobotDispatches).toBe(0); expect(attempt.evidence[0].source).toBe(actualEvidenceSource); expect(progress.projectAttempts).toHaveLength(2)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc-integration/m12-06.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Register APIs, regenerate Client, and test exercise request→normal workflow→evidence submission, cross-project persistence and language changes. Course actions cannot skip plan approval, document conflicts or M9 policy.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc-integration/m12-06.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. This is a composed suite, not the module-only suite.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): wire exercise evidence collection through normal workflows`.

<a id="m12-07"></a>

### M12-07 — Validate learning outcome and offline restoration

**Prerequisites:** [M12-06](learning-and-progress.md#m12-06), [M11-10](ftc-knowledge.md#m11-10), [M1-10](desktop-workspace.md#m1-10), [M1-11](desktop-workspace.md#m1-11).

**Files:** `docs/validation/learning.md`, `packages/core/test/ftc-evaluation/m12-07.test.ts`.

**Interfaces:** Produces AC-12 evidence for entry levels, both languages/tracks and independently applied capstone work.

- [ ] **1. Prepare a reproducible evaluation:** Read the linked spec and create `packages/core/test/ftc-evaluation/m12-07.test.ts` for the automated portion of “student explains and applies both track outcomes”. Record required real tools/assets/platforms in the evidence file above; missing prerequisites are **not run**, never a pass.
- [ ] **2. Execute the evaluation:** Review beginner/FTC/experienced entry paths, skips, local materials and restored cross-project progress. Run both track capstone workflows with student explanation and actual physical evidence recorded separately from builds. Verify neither prompts library selection only when needed; do not mark complete from page visits or fixture attempts.
- [ ] **3. Run the recorded harness:** From `packages/core`, run `bun test ./test/ftc-evaluation/m12-07.test.ts` after provisioning the documented prerequisites. Expected: automated assertions pass; attach actual output. This does not replace the manual/physical observations in step 2.
- [ ] **4. Record the decision and remaining failures:** Save exact versions, environment, commands, observations and evidence links in the planned validation document. Only promote supported combinations with passing evidence; keep this task open while required checks fail or remain unrun.
- [ ] **5. Review and record completion:** Typecheck changed packages, review/commit the scoped changes and evidence, then update this checklist and [progress](progress.md).

## Module completion gate

- [ ] All 7 tasks above and their substeps are complete, with evidence attached.
- [ ] From `packages/core`: `bun test ./test/ftc/learning-and-progress`. Expected: isolated tests pass with no other product module, internet, provider key, downloaded model, installed FTC toolchain or robot. Extract any helper boundary still pulling in those dependencies.
- [ ] Production adapter contracts, composed checks and this module's required real-platform/physical checks pass; report these separately.
- [ ] `bun typecheck` passes in touched packages; public Protocol/HttpApi changes have regenerated clients; relevant acceptance evidence in [progress](progress.md) is linked.
