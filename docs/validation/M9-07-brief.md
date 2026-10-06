# M9-07 dispatch brief

Role: implement task M9-07 within M9, robot approvals and operations.
Read first: this brief, docs/tasks/robot-approvals-and-operations.md, root AGENTS.md, packages/desktop/AGENTS.md, docs/high-level-design.md Sections 8 and 10.
Prerequisites: none. Baseline revision d7aca195c0a47fadb0fc3788eefbe96f99ec68be. Shared checkout /Users/dylanxu/coding_tree on ftc-workspace.
Allowed write paths: the four task Files below; docs/validation/M9-07-implementation.md; docs/validation/m9-07/ for raw probe artifacts; narrowly needed local probe fixtures under packages/core/test/ftc-adapters/fixtures/action-boundary/. Ask coordinator for additional product paths. No existing command/build paths may be enabled or changed in this evaluation task.
Current decisions: macOS arm64 host; no Windows runner configured; no controller operation authorization. Run only harmless probes against owned local endpoints/processes. No real robot install/start/tune; report unavailable physical evidence. No supported isolation claim from PATH filtering, mocks, this harness sandbox or source review alone. If real OS restriction is unavailable, record unresolved gate and do not enable a production route.
Baseline: coordinator is provisioning pinned Bun 1.3.14 and dependencies; report before waiting on tools. No FTC tests yet. Existing regression baseline will be stored in docs/validation/baseline.md.
Verification: commands in exact task below, changed-package bun typecheck, focused lint and format from root. Coordinator provides runtime path once available. Inspect scripts before executing. Do not change unrelated baseline failures.
Report: docs/validation/M9-07-implementation.md, task/requirement/AC IDs, date, exact revision/diff, environment/versions, commands+cwd+exit/test counts, actual versus fixture classification, every assertion and unrun gate. Make a focused conventional commit of assigned files only if supported.
Do not delegate, change scope, weaken checks, or update any shared task checklist/ledger. Return DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED with short evidence summary; unavailable mandatory OS/physical evidence means task is BLOCKED even if automated subset passes.
Use Superpowers TDD for any new executable behavior; evaluations follow real probes without artificial red/green. Main agent owns independent review.

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

### M9-07 — Evaluate enforceable process and dashboard isolation

**Prerequisites:** None; implement using supplied port fixtures.

**Files:** `docs/validation/robot-action-isolation.md`, `packages/core/test/ftc-adapters/action-boundary-probe.test.ts`, `packages/desktop/src/main/panels-policy.ts`, `packages/core/test/ftc-evaluation/m9-07.test.ts`.

**Interfaces:** Produces a platform-specific execution-boundary decision with reproducible allow/deny probes; this is a prerequisite for production agent-controlled builds and command tools.

- [ ] **1. Prepare a reproducible evaluation:** Read the linked spec and create `packages/core/test/ftc-evaluation/m9-07.test.ts` for the automated portion of “unapproved process cannot reach controller or broker”. Record required real tools/assets/platforms in the evidence file above; missing prerequisites are **not run**, never a pass.
- [ ] **2. Execute the evaluation:** Probe direct ADB binary paths, USB APIs, robot HTTP/WebSockets, Gradle tasks, extensions/MCP and dashboard writes on macOS and Windows. Choose a mechanism that denies controller/broker authority to unapproved subprocesses while permitting required development, or restrict the exposed execution surface and record the unresolved gate. PATH filtering and prompts alone cannot pass. Prove mediated/blocked embedded controls before enabling them.
- [ ] **3. Run the recorded harness:** From `packages/core`, run `bun test ./test/ftc-evaluation/m9-07.test.ts` after provisioning the documented prerequisites. Expected: automated assertions pass; attach actual output. This does not replace the manual/physical observations in step 2.
- [ ] **4. Record the decision and remaining failures:** Save exact versions, environment, commands, observations and evidence links in the planned validation document. Only promote supported combinations with passing evidence; keep this task open while required checks fail or remain unrun.
- [ ] **5. Review and record completion:** Typecheck changed packages, review/commit the scoped changes and evidence, then update this checklist and [progress](progress.md).
