# M8-04 dispatch brief

Prepared; coordinator must record verified prerequisite and current review base at dispatch.

Role: implement evaluation M8-04 in Controller connections, ROB-01/05, PAN-01/02/03 and FTC-05; AC-09/10 and Panels evaluation remain pending until actual evidence.
Prerequisite: M8-01 complete after independent review. Consume owned canonical ControllerCandidate and injected ADB port; preserve existing discovery behavior.
Allowed writes: exact task paths; fixtures under packages/core/test/ftc-adapters/fixtures/controller-endpoints as needed; docs/validation/M8-04-implementation.md and docs/validation/m8-04/. Ask coordinator before shared schema changes needed for newly exposed public contracts.
Source/protocol ruling: proposal pinned Panels commit 11d69a98e39c43a7d9edc5932275897c034f7a30. Inspect primary source at that exact revision and preserve provenance; don't assume ports8001/8002 universal. Source review is not actual robot runtime validation. ADB installed at /Users/dylanxu/Library/Android/sdk/platform-tools/adb (last inspected1.0.41/35.0.1); no real controller/Windows resource or mutation authorization asserted. Use owned local listener fixtures for deterministic endpoint/forwarding adapter checks; physical runtime rows remain NOT RUN when unavailable. No installs/start/tuning or probing unknown devices. No production mutation enablement (M9-07/M9-08 gates remain open).
Verification: exact core evaluation selection and relevant discovery/adapter regressions; versioned malformed/disconnected/resource/identity cases, owned forward cleanup/cancellation/conflicts; changed-package types and scoped lint/format. Capture real protocol resource/HTTP/WebSocket/plugin identity evidence where available, explicit unknown/missing outcomes otherwise; fixtures cannot promote compatibility support.
Work from /Users/dylanxu/coding_tree. Read root/applicable AGENTS.md and the owning module plan. Preserve repo and source constraints. No subagents or separate reviewer; coordinator owns review. Only coordinator edits shared completion checkboxes/ledger. Make a focused conventional commit of assigned files only; do not stage sibling work.
Tooling: prepend /private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64 to PATH; Bun 1.3.14, dependencies provisioned frozen. Baselines: docs/validation/baseline.md. Existing Schema two event-manifest expectation failures and App one locale failure are unrelated; don't repair them here. Tests and bun typecheck run from each package directory; lint/format from root against changed paths. No manifest/lock/generated/registration edits unless explicitly assigned.
Report must map each required assertion/gate to concrete code/evidence with date, OS/architecture/tools, exact commands/cwd/exit/counts, revision and fixture-versus-real classification. Cover failure/cancellation/cleanup as relevant. Return DONE/DONE_WITH_CONCERNS/NEEDS_CONTEXT/BLOCKED with commit, concise test summary and report path.
Report path: docs/validation/M8-04-implementation.md.

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

### M8-04 — Evaluate and implement read endpoints and USB forwarding

**Prerequisites:** [M8-01](controller-connections.md#m8-01).

**Files:** `packages/core/src/ftc/controllers/adb.ts`, `packages/core/src/ftc/controllers/panels.ts`, `packages/core/test/ftc-adapters/controller-endpoints.test.ts`, `docs/validation/controller-protocol.md`, `packages/core/test/ftc-evaluation/m8-04.test.ts`.

**Interfaces:** Produces versioned identity/capability evidence and `readEndpoints` for dashboard/data/log access; forwarding is owned and scoped.

- [ ] **1. Prepare a reproducible evaluation:** Read the linked spec and create `packages/core/test/ftc-evaluation/m8-04.test.ts` for the automated portion of “dashboard and data endpoints resolve for supported protocol”. Record required real tools/assets/platforms in the evidence file above; missing prerequisites are **not run**, never a pass.
- [ ] **2. Execute the evaluation:** Inspect selected pinned Panels/ADB versions and capture protocol fixtures with provenance. Verify all required HTTP/WebSocket/plugin resources, identity evidence and USB forwarding; ports 8001/8002 are the proposal's inspected revision, not universal constants. Record missing telemetry/control features explicitly and use findings in M9/M10.
- [ ] **3. Run the recorded harness:** From `packages/core`, run `bun test ./test/ftc-evaluation/m8-04.test.ts` after provisioning the documented prerequisites. Expected: automated assertions pass; attach actual output. This does not replace the manual/physical observations in step 2.
- [ ] **4. Record the decision and remaining failures:** Save exact versions, environment, commands, observations and evidence links in the planned validation document. Only promote supported combinations with passing evidence; keep this task open while required checks fail or remain unrun.
- [ ] **5. Review and record completion:** Typecheck changed packages, review/commit the scoped changes and evidence, then update this checklist and [progress](progress.md).
