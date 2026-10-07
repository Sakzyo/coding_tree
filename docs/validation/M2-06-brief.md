# M2-06 dispatch brief

All stated prerequisites reviewed. Source checkpoint at dispatch recorded by coordinator.



Parallel write scope is explicit. Do not stage, commit, edit checklists/progress, or spawn subagents. Coordinator owns Git, root barrels, generated artifacts and ledger. Read AGENTS.md and Schema AGENTS.md when applicable. Use Superpowers TDD and verification-before-completion. Test real implementation via controlled external ports/real temporary files, no globals/mocks of subject. Run package-local tests and bun typecheck, scoped lint/format. Use pinned Bun PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH and task-owned OPENCODE_TEST_HOME/XDG roots. Preserve prior passing evidence, do not rerun unrelated broad suites. Keep foreign lane errors separate; no foreign edits. Logs/report need commands, cwd, exit, counts, RED/GREEN, assertion map, SHA256 of final source, fixture/real distinction and unrun gates. Product production/platform enablement is not credited by isolated tests. Freeze candidate when reported; any later edit requires refreshed checks/hashes.

Report: docs/validation/M2-06-implementation.md; logs docs/validation/m2-06/.


## Approved integration decisions and additional ownership

Read M2-06-preflight.md and reviewed M2-04/05/M3-02 reports. The source-backed preflight identified both actual V2 hosts and the missing exact-admission terminal callback seam.

1. Managed raw V2 prompt is refused with a typed error requiring the FTC submit facade, before durable admission (including resume:false). This protection must exist at the composed Core admission boundary as well as HTTP; a runtime-only exact reservation proof may allow M2's own admit-only port, never model JSON. Unmanaged compatibility keeps existing semantics; failed managed resolution never falls back.
2. FTC API exposes create/open/read project, create/list/read chats, submit, explicit resume, stop, active owner and scoped owner changes. Reuse existing event infrastructure; no new universal bus, durable drain identity or persisted/replayed execution ownership/token. Root/gate owner changes carry only serializable current project/chat status.
3. Cover actual standalone/SDK Server routes and OpenCode's instance HttpApi host. Managed legacy execution routes fail closed while histories remain readable, without migration or a legacy loop bridge. Do not interrupt unrelated running legacy work or silently associate a root while a known legacy run is still active; define/test activation fencing or return typed unavailable/busy if safe idle cannot be established.
4. Real-host managed execution is explicitly disabled before admission/provider/tool work until M9 action isolation/enforcement gates pass. Existing generic Bash is unrestricted (M9-07 report); the unused disabled evaluation decision is not enforcement. Controlled-runtime composition proves API/concurrency only. Actual FTC production execution/platform/module acceptance stays blocked. No caller ready boolean, JSON authority or fixture may enable the host.

Additional task-owned paths required by actual code, after the above decisions: canonical ftc-project.ts errors/API records, M2 projects.ts/projects/gate.ts/projects/sql.ts public lookup methods and a same-domain execution/membership/folder adapter; generic SessionRunCoordinator/local-execution tracked-wake terminal seam and composed Core Session admission guard (src/session.ts, session/execution.ts, session/execution/local.ts, session/run-coordinator.ts) plus focused existing tests; protocol api.ts/new group; Server handlers.ts/session handler/routes.ts and new project handler; actual OpenCode instance HttpApi server.ts and managed legacy execution entry guards in its session handlers; required SDK-next embedded-host binding; generated Client files only via its existing generate script. The task list's app-runtime.ts is legacy; do not touch it as evidence of V2 wiring.

Schema root barrel, migration/index/Git and ledger stay coordinator-owned. No SQL schema change is expected; ask before introducing tables/migrations. Source owners M3-03 and M6 work touch disjoint files. No unrelated command/tools/credential/settings/UI/LLM/history changes. Additional paths outside the concrete preflight list require a named demonstrated dependency and coordinator ownership, not broad refactoring.

Tracked wakes accept a bounded runtime terminal callback, attach atomically to the applicable ownership chain, and use a fresh successor bucket once old Scope.close starts. Callbacks settle even without execution acquisition/provider work; interrupted/failing/coalesced chains and Scope disposal cannot leak or release newer claims. Keep durable admission, steer/queue, exact retries, one stream/turn, history reload and explicit post-crash resume intact. Domain admission-to-chain mapping stays M2-owned; composition contains wiring only. Keep import-only module code free of database/bootstrap I/O (borrowed ports/types as in M12).

Read performance evidence before touching Session runtime; existing matched M3 baseline is historical, not a new callback/host benchmark. Record a scoped before/after comparison and required affected regressions; do not restart user app/server or invoke real provider/robot/toolchain. Use test-owned processes/ports/temp databases and all XDG roots, including XDG_STATE_HOME. Public Protocol/HttpApi changes require packages/client `bun run generate` + typecheck and all changed/consumer package checks; inspect scripts first and do not hand-edit generated files.

Before product coding, send final minimal factory/host graph and precise callback/admission guard/activation-fence contracts for a quick coordinator ruling. The four choices above are decided; do not reopen requirements or ask the user routine questions.

## Module context

# M2 — Projects and chats Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement one task at a time, or `superpowers:subagent-driven-development` if that execution method is selected. Check each step only after its evidence exists. This document plans work; it does not claim implementation.

**Goal:** Persist project/chat associations and enforce one active chat per canonical project without changing Session ownership.

**Architecture:** M2 owns its local repository and project gate. Inject folder identity, Session access and execution notifications; never read or write Session tables. The host shares one gate across windows while tests create independent scoped instances.

**Tech Stack:** TypeScript, Effect, SQLite/Drizzle, filesystem identity adapters.

**Spec:** [Requirements](../proposal.md), [high-level design](../high-level-design.md), especially its M2 contract and isolated-test row. Read [shared execution rules and progress](progress.md) before this plan.

**Coverage:** PRJ-01–PRJ-04; AC-02, AC-03.

## Global constraints

- Apply all [shared constraints](progress.md#global-constraints); they are part of every task.
- Develop against explicit ports/immutable records; do not import sibling implementations or their stores.
- Preserve Java FTC scope, macOS/Windows support, English/Simplified Chinese, and independent mode settings.
- All boxes start unchecked. No source document establishes implemented product functionality.

## File map and interfaces

Existing anchors (inspect before editing):

- `packages/core/src/project.ts`
- `packages/core/src/session.ts`
- `packages/core/src/session/execution/local.ts`
- `packages/core/src/session/run-coordinator.ts`

Planned owned files/responsibilities (create missing files; modify existing files in place):

- `packages/schema/src/ftc-project.ts` — browser-safe project/chat/gate records
- `packages/core/src/ftc/projects.ts` — public service and association rules
- `packages/core/src/ftc/projects/sql.ts` — module-owned associations
- `packages/core/src/ftc/projects/gate.ts` — canonical-root execution ownership

`ProjectContext = { projectID, canonicalRoot, location }`; reuse existing Project/Location/Session ID schemas. `ChatRef = { projectID, chatID, sessionID }`. `GateLease = { projectKey, chatID, sessionID, token }`, where `token` is opaque and process-local. `GateResult = { kind: 'acquired', lease } | { kind: 'busy', active: ChatRef }`. Repository results contain no model history.

Signatures below specify domain inputs/results; use the repository's Effect services and canonical Schema types as explained in [contract conventions](progress.md#contract-conventions). New API/file names are planning decisions, not claims that they exist.

## Review focus

- Folder symlink/case aliases must share ownership (M2-01/M2-03).
- Admission failure must release only its unused reservation (M2-04).
- An old completion callback must not release a newer run (M2-05).
- A draft in a busy chat must never become an admitted input (M2-04).
- Reopening the database restores associations, not active ownership or provider work (M2-02/M2-06).


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

### M2-06 — Expose project API and compose the execution gate

**Prerequisites:** [M2-01](projects-and-chats.md#m2-01), [M2-02](projects-and-chats.md#m2-02), [M2-03](projects-and-chats.md#m2-03), [M2-04](projects-and-chats.md#m2-04), [M2-05](projects-and-chats.md#m2-05), [M3-02](agent-and-context.md#m3-02).

**Files:** `packages/protocol/src/groups/ftc-project.ts`, `packages/server/src/handlers/ftc-project.ts`, `packages/core/src/ftc/composition.ts`, `packages/opencode/src/effect/app-runtime.ts`, `packages/core/test/ftc-integration/m2-06.test.ts`.

**Interfaces:** Binds M2 Session ports to M3 and M3 gate ports to M2 only in host wiring. Produces typed commands/events for M1 and one process-wide gate.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc-integration/m2-06.test.ts`, add `composed duplicate windows cannot bypass gate`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(maxActiveForProject).toBe(1); expect(otherProjectStarted).toBe(true); expect(restartedActive).toBeUndefined()
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc-integration/m2-06.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Register handlers in existing API/handler composition and regenerate Client. Add composed prompt/resume/wake/stop race tests with real M2/M3, persist separate histories across reopen, and require explicit post-crash resume. Keep this suite outside module-only selection.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc-integration/m2-06.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. This is a composed suite, not the module-only suite.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): expose project api and compose the execution gate`.

