# M4-05 dispatch brief

Base: a232ce6ca. Read this first; exact task excerpt is the requirement.

Parallel write scope is explicit. Do not stage, commit, edit checklists/progress, or spawn subagents. Coordinator owns Git, root barrels, generated artifacts and ledger. Read AGENTS.md and Schema AGENTS.md when applicable. Use Superpowers TDD and verification-before-completion. Test real implementation via controlled external ports/real temporary files, no globals/mocks of subject. Run package-local tests and bun typecheck, scoped lint/format. Use pinned Bun PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH and task-owned OPENCODE_TEST_HOME/XDG roots. Preserve prior passing evidence, do not rerun unrelated broad suites. Keep foreign lane errors separate; no foreign edits. Logs/report need commands, cwd, exit, counts, RED/GREEN, assertion map, SHA256 of final source, fixture/real distinction and unrun gates. Product production/platform enablement is not credited by isolated tests. Freeze candidate when reported; any later edit requires refreshed checks/hashes.

Report: docs/validation/M4-05-implementation.md; logs docs/validation/m4-05/.

## Module context

# M4 — Environment and compatibility Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement one task at a time, or `superpowers:subagent-driven-development` if that execution method is selected. Check each step only after its evidence exists. This document plans work; it does not claim implementation.

**Goal:** Resolve coherent toolchains and make automatic, guided, and prepared-offline readiness explicit.

**Architecture:** Inject probes, downloads/cache, inventory and a build-verification port. M4 consumes model/content availability snapshots and never owns or starts those modules. Supply M5 a resolved descriptor so setup and builds cannot recurse.

**Tech Stack:** TypeScript, Effect, local catalog files, process/download adapters.

**Spec:** [Requirements](../proposal.md), [high-level design](../high-level-design.md), especially its M4 contract and isolated-test row. Read [shared execution rules and progress](progress.md) before this plan.

**Coverage:** ENV-01–ENV-06; PRJ-01; AC-01, AC-02, AC-06.

## Global constraints

- Apply all [shared constraints](progress.md#global-constraints); they are part of every task.
- Develop against explicit ports/immutable records; do not import sibling implementations or their stores.
- Preserve Java FTC scope, macOS/Windows support, English/Simplified Chinese, and independent mode settings.
- All boxes start unchecked. No source document establishes implemented product functionality.

## File map and interfaces

Existing anchors (inspect before editing):

- `packages/opencode/src/lsp/server.ts`
- `packages/core/src/process.ts`
- `packages/core/src/database/database.ts`

Planned owned files/responsibilities (create missing files; modify existing files in place):

- `packages/schema/src/ftc-environment.ts` — profile/readiness/toolchain records
- `packages/core/src/ftc/environment.ts` — setup/readiness service
- `packages/core/src/ftc/environment/catalog.ts` — profile validation and selection
- `packages/core/src/ftc/environment/adapters.ts` — probe/download/inventory adapters
- `packages/core/resources/ftc/compatibility.json` — evaluated profiles
- `packages/protocol/src/groups/ftc-environment.ts` — typed setup/readiness API and setup events
- `packages/server/src/handlers/ftc-environment.ts` — project-bound adapters over M4's public service

`ToolchainDescriptor = { profileID, buildJdk, editorJdk, androidSdk, adb, gradleWrapper, versions }`, with resolved local paths and pinned version strings. `Readiness = { state: 'ready' | 'missing' | 'incompatible' | 'failed', steps, missingAssets }`. Steps carry stable ID, state, cause and recovery code. Profiles carry OS/architecture, component versions, checksums/licenses and evidence references; an unevaluated profile cannot be labelled supported.

Signatures below specify domain inputs/results; use the repository's Effect services and canonical Schema types as explained in [contract conventions](progress.md#contract-conventions). New API/file names are planning decisions, not claims that they exist.

## Review focus

- Different editor/build JDKs must not overwrite each other (M4-01/M4-02).
- Cancelled or corrupt downloads must not become ready assets (M4-04).
- Guided setup cannot complete before a verified build (M4-03/M4-06).
- An imported project outside the matrix must remain unchanged (M4-02).
- Offline readiness must list missing dependencies as well as models/content (M4-05).


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

### M4-05 — Report prepared offline availability

**Prerequisites:** [M4-01](environment-and-compatibility.md#m4-01), [M4-02](environment-and-compatibility.md#m4-02).

**Files:** `packages/schema/src/ftc-environment.ts`, `packages/core/src/ftc/environment.ts`, `packages/core/test/ftc/environment-and-compatibility/m4-05.test.ts`.

**Interfaces:** Produces `offlineReadiness({ tools, dependencies, models, content }): Readiness`; consumes immutable asset inventories with IDs/version/checksum and availability.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/environment-and-compatibility/m4-05.test.ts`, add `missing cache entry does not disable available local features`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(result.missingAssets).toContain('gradle-dependency-fixture'); expect(availableFeatures).toContain('editing')
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/environment-and-compatibility/m4-05.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Check cached Gradle/Android dependencies, tool binaries, selected model and lesson/reference assets independently. Do not infer offline readiness from a working internet build or start M7/M11 to query their stores.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/environment-and-compatibility/m4-05.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): report prepared offline availability`.

