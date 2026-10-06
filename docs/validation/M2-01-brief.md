# M2-01 dispatch brief

Prepared, not dispatched. Coordinator assigns current review base at dispatch.

Role: implement M2-01 in Projects and chats; PRJ-01/03 foundation, AC-02/03 support.
Read: this exact brief, docs/tasks/projects-and-chats.md, docs/tasks/progress.md contract conventions, root/applicable AGENTS.md and packages/schema/AGENTS.md.
Prerequisites: none. Canonical folder identity and private repository ports supplied through tests; no sibling module bootstrap. Reuse existing Project/Location/Session schemas, never clone their ID types. Creation only associates an already prepared folder; M6/M5 own template edits. Preserve all project contents.
Allowed writes: four exact task files; Schema root barrel for its canonical domain export; docs/validation/M2-01-implementation.md and docs/validation/m2-01/ logs. Additionally reserved for this task's generated migration only: packages/core/schema.json, packages/core/src/database/schema.gen.ts, packages/core/src/database/migration.gen.ts, and new task-owned migration file under packages/core/src/database/migration/. Do not hand-edit generated artifacts or modify earlier migrations. No manifests/lock, Session runtime, existing project implementation or composition edits without coordinator assignment.
Migration workflow verified: from packages/core run `bun script/migration.ts --name ftc-project-association`; inspect actual script before execution and review scoped generated delta. `bun script/migration.ts --check` checks snapshot/registry/full schema. Do not run raw drizzle generation into tracked directories.
Architecture: FtcProject owns canonical ProjectContext in Schema and module-owned associations with snake_case columns; don't publish unused future Chat/Gate records prematurely. Scope effects/repository access; no import-time I/O/global state. Tests construct actual module with explicit identity port and actual temporary private database; include reopen and alias identity while retaining file contents. Cover errors/cancellation/concurrent association/fresh scope disposal as relevant. No robot authority.
Tooling: Bun 1.3.14 at /private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun; prepend its directory to PATH. Isolate OPENCODE_TEST_HOME and XDG data/config/cache/state under task-owned /private/tmp path. Baseline migration 18/18 pass / 39 assertions and migration --check exit 0 recorded before any database change at 75f1038c48f7b5c9afbbba91fef837d2a7794506. Known Schema two event-manifest failures remain unrelated.
Verification: behavioral RED→GREEN exact task selection in packages/core; database-migration regression plus migration --check; bun typecheck from changed Core/Schema packages; affected Schema contracts; scoped lint/format from root. Do not blanket rerun unrelated Core external suites. No test mocks of module, global replacements or duplicate production logic.
Self-review and make focused conventional commit of assigned files only; main may own concurrent docs, do not stage them. Report docs/validation/M2-01-implementation.md with date/environment/revision, command/cwd/exit/counts, assertion map and actual vs fixture/NOT RUN boundaries. Do not delegate or change shared ledger/checklists. Return DONE/DONE_WITH_CONCERNS/NEEDS_CONTEXT/BLOCKED with short commit/tests/concerns. Independent review follows through coordinator.

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

### M2-01 — Associate canonical project folders

**Prerequisites:** None; implement using supplied port fixtures.

**Files:** `packages/schema/src/ftc-project.ts`, `packages/core/src/ftc/projects.ts`, `packages/core/src/ftc/projects/sql.ts`, `packages/core/test/ftc/projects-and-chats/m2-01.test.ts`.

**Interfaces:** Consumes a folder-identity port and private repository. Produces `createProject({ root }): ProjectContext` and `openProject({ root }): ProjectContext`; creation associates an already prepared folder, while M6/M5 own template edits.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/projects-and-chats/m2-01.test.ts`, add `folder aliases reopen one project`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(alias.projectID).toBe(opened.projectID); expect(afterFiles).toEqual(beforeFiles)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/projects-and-chats/m2-01.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Resolve canonical filesystem identity before association; inspect folder access without modifying project files. Persist associations with snake_case columns; generate migrations through the existing Core migration workflow and test reopen.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/projects-and-chats/m2-01.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): associate canonical project folders`.
