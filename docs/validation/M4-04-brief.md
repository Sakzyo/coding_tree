# M4-04 dispatch brief

Dispatched and independently reviewed; exact owner/base/evidence are recorded in docs/tasks/progress.md.

Read exact task below first, applicable AGENTS and owning module context.

Extends reviewed M4 guided setup with automatic preparation through narrow download/cache/probe ports; no actual tool installation/download or host registration during isolated tests. Preserve completed valid components, explicit source/checksum/license/permission conditions, scoped cancellation and corrupt/incomplete asset rejection. Do not silently accept licenses or modify imported files/dependencies. Existing canonical descriptors/results remain owned by M4. A production downloader adapter must remain behind its OS/isolation evidence gates; this task tests actual orchestration/cache decisions with controlled external ports. Exact shared environment/adapters/schema paths are assigned only after M4-03 review completes; coordinate any additional fixture adaptation.

Parallel ownership: only assigned task paths may be edited. Coordinator owns root exports, migrations/generated files, host wiring, Git index/commits and completion ledger. No helpers/reviewers/subagents. Ask coordinator for unresolved contract decisions before dependent code.

Verify meaningful behavioral RED -> GREEN, exact task suite and affected regressions, changed-package bun typecheck, relevant Schema checks, scoped lint/format and cleanup/failure/concurrency. Pinned Bun PATH /private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64 with task-owned OPENCODE_TEST_HOME/XDG roots. No user app/server restart. Session/runtime changes need applicable existing Session regressions and retained performance baseline comparison when they affect session/timeline behavior. Do not repeat unrelated unchanged checks.

Report docs/validation/M4-04-implementation.md with exact tested hashes, commands/cwd/results/exit/counts, task assertion map, lifecycle contracts, fixture classification and unrun gates. Return concise frozen DONE/DONE_WITH_CONCERNS/NEEDS_CONTEXT/BLOCKED candidate.

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

### M4-04 — Download and prepare one missing prerequisite

**Prerequisites:** [M4-02](environment-and-compatibility.md#m4-02).

**Files:** `packages/core/src/ftc/environment.ts`, `packages/core/src/ftc/environment/adapters.ts`, `packages/core/test/ftc/environment-and-compatibility/m4-04.test.ts`.

**Interfaces:** Extends `prepareEnvironment` with `choice: 'automatic'`; consumes download/cache/probe ports, produces recoverable per-component setup results.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/environment-and-compatibility/m4-04.test.ts`, add `retry preserves completed components`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(reinstalledValidTools).toEqual([])
expect(corrupt.state).toBe("failed")
expect(cancelledReadyAssets).toEqual([])
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/environment-and-compatibility/m4-04.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Implement checksum-verified downloads, explicit license/system-permission steps, staging and deliberate retry for one component at a time. Preserve completed work and avoid silent system-wide Java changes; automatic steps use the same readiness criteria as guided setup.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/environment-and-compatibility/m4-04.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): download and prepare one missing prerequisite`.
