# M12-01 dispatch brief

Base 1dd9f1ba3; prerequisite-free personal persistence task.



Parallel write scope is explicit. Do not stage, commit, edit checklists/progress, or spawn subagents. Coordinator owns Git, root barrels, generated artifacts and ledger. Read AGENTS.md and Schema AGENTS.md when applicable. Use Superpowers TDD and verification-before-completion. Test real implementation via controlled external ports/real temporary files, no globals/mocks of subject. Run package-local tests and bun typecheck, scoped lint/format. Use pinned Bun PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH and task-owned OPENCODE_TEST_HOME/XDG roots. Preserve prior passing evidence, do not rerun unrelated broad suites. Keep foreign lane errors separate; no foreign edits. Logs/report need commands, cwd, exit, counts, RED/GREEN, assertion map, SHA256 of final source, fixture/real distinction and unrun gates. Product production/platform enablement is not credited by isolated tests. Freeze candidate when reported; any later edit requires refreshed checks/hashes.

Report: docs/validation/M12-01-implementation.md; logs docs/validation/m12-01/.


## Shared artifact ownership

M12 owns its Schema/Core/SQL definitions; coordinator exclusively owns Schema root export and generated migration/schema/snapshot/registry artifacts. Send SQL readiness notice; coordinator runs existing `bun script/migration.ts --name ftc-learning-progress` from packages/core, then you verify reopen/upgrade/migration checks. Do not hand-edit generated files or user databases. Existing lesson/reference Schema is owned by M11 and may be consumed canonically; inject lookup instead of starting M11. Store recorded attempts/provenance without fabricating evidence-based completion (M12-04/05). No student-profile system, cloud/personal manifest or automatic execution.

## Module context

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

