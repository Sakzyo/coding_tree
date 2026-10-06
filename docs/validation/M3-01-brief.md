# M3-01 dispatch brief

Prepared, not dispatched. Coordinator records current review base before assigning a fresh implementer.

Role: implement M3-01 in Agent and context. This pins required existing Session invariants before project-gate integration.
Read first: this brief, the owning module plan, root/applicable AGENTS, and existing Session tests that exercise the listed invariants. Reuse their coverage rather than copying it or forcing already-correct behavior to fail.
Prerequisites: none. Baseline at docs/validation/baseline.md records 127 passing Session tests / 342 assertions with isolated test data. Runtime Session code has not changed during M4/M5/M9 evaluations.
Allowed writes: the four exact task test files plus docs/validation/M3-01-implementation.md and docs/validation/m3-01/ evidence. Runtime fixes are allowed by the source task only when a meaningful regression exposes a violated invariant; report the concrete failure and obtain coordinator path assignment before editing runtime. No Schema, migrations, manifests, locks, registration, project gate implementation or new model/tool loop in this task.
Interfaces: consume real Session prompt/execution public contracts, actual temporary repositories and injected ports. No sibling FTC module bootstrap or duplicated logic in tests. If the existing suite already proves an assertion, map to its exact test and reuse it. New focused tests should demonstrate cross-boundary behavior that lacks coverage.
Verification: run exact task test and affected existing Session test files from packages/core, bun typecheck there, and scoped lint/format. Test real cleanup, concurrency and effect lifecycle as relevant without global replacements. Preserve the no-automatic-post-crash-provider-retry boundary. No timeline/performance change is expected; if runtime changes affect that boundary, discuss required benchmark coverage with coordinator first.
Tooling: prepend /private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64 to PATH. Isolate OPENCODE_TEST_HOME/XDG data/config/cache/state under a task-owned /private/tmp directory. Do not restart the user's app/server.
No subagents; only coordinator edits progress/checklists. Commit only owned changes with the source task's conventional message. Report actual revision, command/cwd/exit/counts, assertion-to-test map, gaps and concerns in docs/validation/M3-01-implementation.md. Return DONE/DONE_WITH_CONCERNS/NEEDS_CONTEXT/BLOCKED with short commit/test/concern summary.

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

### M3-01 — Pin Session admission and continuation invariants

**Prerequisites:** None; implement using supplied port fixtures.

**Files:** `packages/core/test/session-prompt.test.ts`, `packages/core/test/session-runner.test.ts`, `packages/core/test/session-run-coordinator.test.ts`, `packages/core/test/ftc/agent-and-context/m3-01.test.ts`.

**Interfaces:** Consumes existing SessionV2 prompt/execution public contracts and real temporary repositories. Produces focused regression coverage; change runtime only if a test exposes a violated required invariant.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/agent-and-context/m3-01.test.ts`, add `admission precedes wake and exact retry reconciles`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(inputRowsForMessage).toHaveLength(1); expect(order).toEqual(['admit', 'wake']); expect(streamCalls).toBe(providerTurns)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/agent-and-context/m3-01.test.ts`. Expected: the new behavior fails for the intended missing behavior. Existing Session invariants may already pass: record that baseline and reuse their assertions without forcing a failure.
- [ ] **3. Implement the smallest behavior:** Cover conflicting message IDs, historical projected retry reconciliation, resume:false, same-Session join, steer safe-boundary promotion, one-at-a-time queue promotion, provider allowance reset and history reload. Preserve EventV2 replay ownership and no automatic post-crash provider retry; reuse current passing tests rather than duplicating them.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/agent-and-context/m3-01.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `test(ftc): pin session admission and continuation invariants`.
