# M12-02 dispatch brief — 2026-10-07

Base: `e798d3162`; prerequisites M12-01 independently approved. Read `docs/validation/M12-02-preflight.md` for exact current gaps, public ports and path ownership. This brief accepts its minimum extension with decisions below; preflight recommendations are not completed implementation evidence.

## Exclusive ownership and report

Assigned: `packages/core/src/ftc/learning.ts`, `packages/core/src/ftc/learning/sql.ts`, `packages/schema/src/ftc-learning.ts`, `packages/schema/src/ftc-knowledge.ts`, `packages/core/src/ftc/knowledge.ts` (only metadata validation/equivalence), `packages/core/test/ftc/learning-and-progress/m12-02.test.ts`, `packages/schema/test/ftc-learning.test.ts`, new `packages/schema/test/ftc-course-metadata.test.ts`, new `packages/core/test/ftc/ftc-knowledge/course-metadata.test.ts`, narrow compatibility assertions in existing M12-01 test only if needed. No production content/prose/resources, Session/M2/M6/host/UI/Protocol/barrel/package/lock/generated/index/Git/ledger edits. Report `docs/validation/M12-02-implementation.md`; logs `docs/validation/m12-02/`. No subagents. Request ownership before additional source.

Root alone runs `packages/core/script/migration.ts` generator after stable own SQL, then owns generated schema/migration/snapshot artifacts and delta evidence. Do not hand edit generated artifacts or apply to user DB. No other migration writer is active. Tell root when SQL is ready; use disposable owned DBs for focused tests.

## Accepted producer/consumer contracts

- Adopt the preflight's optional canonical M11 metadata: ContentDocument.entryPoints with exactly java-beginner/ftc-beginner/experienced keys mapping existing lesson IDs; Lesson.skippable; Exercise.requiresPhysicalValidation. Omission means unknown/unavailable and never an exemption. Existing ordered lessons define order. Course identity/version is the canonical document identity/version; validate record/document/version/language/local availability. Extend M11 paired-language structural validation for presence/value equality, entry references and existing identity uniqueness. Preserve existing mandatory explanation/application requirements and exact identifiers/prose.
- Use supplied clearly synthetic metadata for this isolated software task. No actual foundation start/skip/physical policy is invented or production content enabled. Production metadata authoring/bilingual content review remains a named M11/M12-06/07 composed acceptance gate. Public APIs must report missing metadata rather than silently choose a start.
- EntryLevel is exactly 'java-beginner' | 'ftc-beginner' | 'experienced' in FtcLearning. M11 uses fixed entry map keys so no cyclic Schema dependency. Preserve existing M12 LessonLookup.lessons and bare-Lesson[] attempt-only compatibility; add an optional current course lookup port with explicit applicability/current content-version binding supplied by the trusted caller, never a project store/default SDK/latest version. M12 consumes public canonical ContentResult values only, no M11 implementation/store startup. Compare current lesson snapshot/course ordered ID/version snapshot rather than combining mixed versions.
- Commands selectEntry/skipLesson bind the current resolved course/lesson snapshot during the call and return its version. No extra expected-version wire fields: stale viewed-page rejection is not promised by current signatures; later UI consumer must present the returned current binding. Reject mixed snapshots. Capture immutable ingress/port results before asynchronous boundaries. New personal writes happen only after validated current content/policy.
- selectEntry changes navigation's starting point, leaving earlier lessons' status/evidence untouched. With no selected entry, use the first supplied lesson without persisting fabricated selection. nextLesson returns the first lesson at/after the selected entry that is not explicitly skipped. A recorded submitted/failed/cancelled/unknown attempt alone never advances or awards competence. Keep returned canonical explanation/application and true/false/unknown physical requirements intact.
- skipLesson allows explicit skippable:true only; false/omitted metadata rejects. It records a version-bound navigation preference, retains all attempts/evidence and gives no exercise/physical completion. Use existing canonical LessonProgress.status extended with skipped (no redundant state alias). Skipped takes precedence as navigation status while retaining attempt IDs. No completion field hardcoded merely to satisfy a test; verify actual storage/results contain no manufactured evidence/award.
- Minimal M12 personal tables: ftc_learning_entry keyed(course_id,course_version) and ftc_learning_skip keyed(course_id,course_version,lesson_id,lesson_version), snake_case fields. No new profile/user/language/project identity keys. Existing caller-owned local-user DB scopes own connection/lifecycle; do not dispose a borrowed DB or runtime-import Database/Global. Entry reselection updates only current version; exact skips idempotent/concurrent atomic. Preserve all older navigation rows/attempts across upgrades; current version inherits no old entry/skip. Failed content/invalid writes do not mutate personal state. Strict malformed stored-row errors with stable recovery.
- Canonical LessonResult tags: lesson carrying current courseID/courseVersion/requested language/canonical Lesson; no_next as navigation outcome with the same binding, never course completion; unavailable retains the actual missing-content/metadata reason and requested language/courseID. New commands have typed domain errors for invalid input/stored state/lookup/policy conflicts. Existing attempt-only Progress retains shape when course lookup capability is absent; optional current version/entry metadata appears only when available. Missing capability/metadata is explicit for new navigation commands.
- No exercise requests/evidence evaluator/prerequisite graph/agent edits/builds/deployment/robot operations in M12-02. Unknown physical facts stay unknown. No production UI/Windows/physical/classroom acceptance from fixtures.

## Verification and freeze

Pinned Bun1.3.14 at /private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64; task-owned OPENCODE_TEST_HOME and all four XDG roots including STATE in /private/tmp. Package-local bun tests/bun typecheck only; scoped lint/format/diff. Implement meaningful RED→GREEN all three entry choices, explicit/unknown skip policy, physical requirement preservation without award, exact en/zh identities, no recorded-attempt navigation promotion, malformed/missing/mixed course values no writes, idempotent skips/reopen/version upgrades/historical retry, independent DBs/import no I/O and disposal/cancellation. Producer metadata/bilingual validators tested independently; no sibling runtime in module-only test. Real own DB predecessor→generated migration→repeat→reopen separate integration evidence. Root provides actual generated artifacts once SQL stable; run generator --check after final artifact state. Cover M12-01 and affected M11/Schema suites; retain foreign lane diagnostics, no unrelated broad baseline suite. Full report contains exact commands/cwd/exits/assertions, TDD chronology, hashes, interfaces, limitations and self-review; return compact DONE/DONE_WITH_CONCERNS/NEEDS_CONTEXT/BLOCKED plus report. Root commits and independently reviews; no checkbox before approval.


## Binding global constraints


- Preserve the twelve-module design inside the existing Electron/Solid/OpenCode application. Do not add twelve packages, a new daemon, a universal service registry or a second agent loop.
- Java/FTC SDK, macOS and Windows, English and Simplified Chinese remain first-version scope. No Blocks, robot hardware-configuration synchronization, app-operated AI billing service or extra student-profile system.
- Canonical Schema contracts contain serializable values, not runtime services. Keep Schema → Core/Protocol → Server dependencies; Client runtime can depend on Schema/Protocol but never Core/Server. `sdk-next` composes Client/Core/Server. Import namespaces through their existing self-export pattern; do not alias/star-import new code.
- Each module consumes narrow ports/immutable records and owns its tables/files/maps. No sibling implementation imports, private-store access or bootstrap imports. Importing a module starts no I/O; scope construction/disposal owns processes and subscriptions.
- Reuse Effect layers in Core. Services stay Location-scoped except the explicitly process-global Session execution/project/controller coordinators. Tests create independent instances without resetting globals.
- Preserve Session durable admission before wake, exact retry/conflicting-ID behavior, steer/queue promotion, one stream per provider turn, current-history reload and separate Context Epoch ownership. No automatic provider-work replay after crash.
- Preserve existing project files, SDKs, dependencies and unsaved edits. Canonical project roots identify execution ownership; a copied manifest does not copy chats or controller identity. At most one active chat per project, while separate projects may run concurrently; drafts never auto-execute.
- Keep setup choice, layout, inference mode, code mode, robot mode and language independent. Plan/direct code permission never grants deployment, start or tuning.
- Project `ftc-project.json` stores shared hardware definitions and exclusive managed pathing choice only. Personal progress/chats/credentials/approvals/telemetry/machine paths remain local and outside it.
- PedroPathing, Road Runner or neither: at most one managed pathing library. Retain version-required Road Runner FTC Dashboard/tuning tools. Ask before resolving imported conflicts; do not silently remove team code.
- M5 builds identify saved source/configuration revisions and APK digest. Dirty or changed inputs cannot be passed off as a current successful build. M9 refreshes target/generation/state/artifact at execution time.
- M9 is the only app-issued robot mutation authority. Deliberate Deploy authorizes that exact deployment without redundant confirmation; it never authorizes a start. Agent observation mode blocks initialization/start/tuning. No command/build/extension/dashboard bypass; no replay after reconnect or restart.
- Disconnection does not prove a robot stopped. Keep confirmed success, failure, cancelled and unknown outcomes distinct. Preserve missing/stale/disconnected/valid-zero diagnostics and verified versus unknown deployed-build association.
- Offline inference is verified local-only, with no remote redirects/cloud proxy/fallback. Prepared offline use may still connect to the robot's local network. Missing cached models/tools/dependencies/content remain visible.
- Protect credentials with the OS facility and expose references only. Dashboard pages have no privileged preload bridge; repository instructions, dashboard text, logs and references are not approval authority.
- Monaco/JDT LS, llama.cpp, SQLite/JSON and exact versions are design recommendations pending their named evaluations. Pin tested versions and resource/platform support using evidence; do not select arbitrary latest releases or invent hardware minima.
- All UI/native copy uses existing typed i18n. Preserve English source wording when touching existing keys, placeholders and code/API/device names. Follow package terminology/source-review instructions for translations; stable domain errors/lesson IDs are language-independent.
- If Protocol or Server HttpApi changes, run `bun run generate` from `packages/client`; never hand-edit `src/generated` or `src/generated-effect`. If legacy JS SDK surfaces change, regenerate with `./packages/sdk/js/script/build.ts`.
- Run tests and `bun typecheck` from package directories, never repository root or raw `tsc`. Follow touched package instructions, including session/timeline benchmark baselines and no restarting the user's app/server.
- Keep scoped changes; no unrelated cleanup. Use short branch names without slashes (at most three hyphen-separated words) and conventional commit messages. The default comparison branch is `dev`/`origin/dev`.



## Exact task excerpt

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

