# M8-01 dispatch brief

Prepared; coordinator must record verified prerequisite and current review base at dispatch.

Role: implement M8-01 in Controller connections, ROB-01 (AC-10 support).
Prerequisites: none. Injected recorded ADB transport responses may exercise real facade/parser; do not start a real ADB daemon or contact devices in the isolated suite.
Allowed writes: exact four task files; docs/validation/M8-01-implementation.md and docs/validation/m8-01/. Canonical ControllerCandidate discovery contract owned here in ftc-controller.ts; reserve ControllerIdentity/ConnectionDescriptor semantics from module plan for later owning tasks, do not duplicate them in consumer modules. Schema barrel only if existing conventions require it.
Decisions: port-based Effect service; zero import-time I/O, no sibling module bootstrap. Distinguish unauthorized/offline/available/missing-tool/error/empty results; transport addresses never prove stable physical identity. Hardware guidance cannot fabricate connected Expansion Hubs or wiring. No mutation capability in discovery.
Verification: behavioral RED→GREEN focused core unit selection; valid/invalid/multiple/empty responses, transport failures, cancellation and fresh-scope cleanup as applicable; changed Schema/Core types; scoped lint/format and relevant schema tests.
Work from /Users/dylanxu/coding_tree. Read root/applicable AGENTS.md and the owning module plan. Preserve repo and source constraints. No subagents or separate reviewer; coordinator owns review. Only coordinator edits shared completion checkboxes/ledger. Make a focused conventional commit of assigned files only; do not stage sibling work.
Tooling: prepend /private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64 to PATH; Bun 1.3.14, dependencies provisioned frozen. Baselines: docs/validation/baseline.md. Existing Schema two event-manifest expectation failures and App one locale failure are unrelated; don't repair them here. Tests and bun typecheck run from each package directory; lint/format from root against changed paths. No manifest/lock/generated/registration edits unless explicitly assigned.
Report must map each required assertion/gate to concrete code/evidence with date, OS/architecture/tools, exact commands/cwd/exit/counts, revision and fixture-versus-real classification. Cover failure/cancellation/cleanup as relevant. Return DONE/DONE_WITH_CONCERNS/NEEDS_CONTEXT/BLOCKED with commit, concise test summary and report path.
Report path: docs/validation/M8-01-implementation.md.

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

### M8-01 — Parse discovery and authorization states

**Prerequisites:** None; implement using supplied port fixtures.

**Files:** `packages/schema/src/ftc-controller.ts`, `packages/core/src/ftc/controllers.ts`, `packages/core/src/ftc/controllers/adb.ts`, `packages/core/test/ftc/controller-connections/m8-01.test.ts`.

**Interfaces:** Produces `discoverControllers(): readonly ControllerCandidate[]`; candidates include transport address, device kind if known, authorization and explanatory error codes.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/controller-connections/m8-01.test.ts`, add `unauthorized device is visible without deployment side effects`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(candidate.authorization).toBe('unauthorized'); expect(mutationCalls).toEqual([])
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/controller-connections/m8-01.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Use recorded ADB responses through an injected transport; distinguish unauthorized/offline/available devices, multiple targets and empty discovery. Include Control Hub/phone guidance and attached Expansion Hub context without inventing physical configuration.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/controller-connections/m8-01.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): parse discovery and authorization states`.
