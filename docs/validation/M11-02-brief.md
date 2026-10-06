# M11-02 dispatch brief

Prepared, not dispatched. Coordinator records owner and actual reviewed base before dispatch.

Read the exact excerpt below first; owning module context and applicable AGENTS.md also bind this work.

Version- and language-specific queries over reviewed M11 validated content records with narrow repository/search ports. No real course authoring, network fetch, supported-version promotion or global selected project. Schema owner may add canonical query/result records with coordinator assignment; avoid local duplicate contracts. Context Source adapter belongs to knowledge domain; ask coordinator to assign its exact path if required by this task.

Parallel scheduling: only explicitly assigned disjoint paths may be edited. Coordinator exclusively owns Git staging/commits, Schema root barrel, migrations/generated files, host wiring and progress/checklists. Never spawn subagents or reviewers. Report ambiguity to coordinator before dependent implementation.

Verification: meaningful behavioral RED -> GREEN, exact focused suite and affected covering regressions, changed-package bun typecheck, affected Schema contracts, scoped lint/format. Use pinned Bun PATH /private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64 and task-owned OPENCODE_TEST_HOME/XDG roots. Do not rerun unchanged broad suites; do not restart user app/server. Foreign unfinished lane errors never authorize edits.

Report: docs/validation/M11-02-implementation.md, exact source file SHA256 values, commands/cwd/results/exit/counts, assertion map, cleanup/failure/cancellation/concurrency behavior and unrun gates. Return concise DONE/DONE_WITH_CONCERNS/NEEDS_CONTEXT/BLOCKED candidate.

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

### M11-02 — Query references by explicit version and language

**Prerequisites:** [M11-01](ftc-knowledge.md#m11-01).

**Files:** `packages/core/src/ftc/knowledge.ts`, `packages/core/test/ftc/ftc-knowledge/m11-02.test.ts`.

**Interfaces:** Produces `lookup(query: ContentQuery): ContentResult` and `search({ query: ContentQuery, text }): ContentResult`; consumes only content repository/search ports.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/ftc-knowledge/m11-02.test.ts`, add `incompatible or absent local reference never appears as current`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(result.records.map(x => x.id)).toEqual(['sdk-fixture-v1']); expect(missing.kind).toBe('missing'); expect(networkCalls).toBe(0)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/ftc-knowledge/m11-02.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Filter by explicit SDK/library applicability before ordinary text search. Return source/version/local availability; do not read M6 or store a global active project. Provide domain Context Source data for M3 through a public adapter.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/ftc-knowledge/m11-02.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): query references by explicit version and language`.
