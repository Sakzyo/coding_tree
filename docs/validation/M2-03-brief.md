# M2-03 dispatch brief

Prepared, not dispatched. Requires independently reviewed M2-01/M2-02. Coordinator records actual owner/base before dispatch.

Role: implement M2-03 atomic canonical-root execution ownership. Read exact task below, module plan, root/applicable AGENTS, and current M2 facade/Schema. Preserve existing Session ownership; no Session runtime changes or host composition in this task.
Allowed writes: exact task gate/test files; packages/schema/src/ftc-project.ts for producer-owned validated GateLease/GateResult/request/error records omitted by task Files; docs/validation/M2-03-implementation.md and docs/validation/m2-03/ evidence. Any required narrow repository/facade lookup addition needs coordinator assignment after a concrete gap is shown. No new migrations, manifests/locks, generated clients, bootstrap, or future submit/stop implementations.
Consume immutable canonical ProjectContext/ChatRef and narrow project/chat resolution ports from reviewed M2 contracts. Validate membership/location mapping rather than treating a caller-supplied ChatRef as authority. Association projectID is distinct from host Project ID; gate ownership key is canonicalRoot. Different association labels or host IDs cannot split one canonical root; separate roots sharing a host ID remain independent.
Gate initialization/cleanup is explicitly scoped; importing starts no I/O or shared state. Production singleton composition comes later. Lease tokens are opaque process-local ownership identities, not persisted or reusable approval credentials. Atomic acquisition and token-checked release must survive races, aliases/duplicate views, stale release, independent projects and independent test instances. Define same-chat acquisition behavior clearly for M2-04 reservations without implementing admission early. Do not let failure/cancellation strand ownership; report unresolved lifecycle ambiguity to coordinator.
Tests use actual gate and controlled narrow consumed ports; no sibling bootstrap/global replacements. Include independent scoped instances, invalid/mismatched membership and realistic concurrent acquisitions where relevant. Prepared controlled canonical aliases do not establish Windows physical-filesystem evidence.
Verification: meaningful behavioral RED→GREEN focused M2-03 tests from packages/core; covering M2 module tests; changed Core/Schema bun typecheck; affected Schema contracts and scoped lint/format. Existing Session files are unchanged, so no blanket runtime/external test reruns without concrete risk. Use pinned Bun1.3.14 at /private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64, isolated task-owned OPENCODE_TEST_HOME/XDG roots.
Self-review/commit only assigned files using task message. No subagents or shared ledger/checklist edits. Report exact tested revision, command/cwd/results/counts, assertion mapping, cancellation/cleanup behavior and remaining gates in docs/validation/M2-03-implementation.md. Return DONE/DONE_WITH_CONCERNS/NEEDS_CONTEXT/BLOCKED with concise evidence.

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

### M2-03 — Acquire one atomic project execution lease

**Prerequisites:** [M2-01](projects-and-chats.md#m2-01), [M2-02](projects-and-chats.md#m2-02).

**Files:** `packages/core/src/ftc/projects/gate.ts`, `packages/core/test/ftc/projects-and-chats/m2-03.test.ts`.

**Interfaces:** Produces `acquire(chat: ChatRef): GateResult`, `release(lease: GateLease): void`, and `activeChat({ projectID }): ChatRef | undefined`; keyed by canonical root, not manifest ID.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/projects-and-chats/m2-03.test.ts`, add `same project contends while another runs`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(same.kind).toBe('busy'); expect(other.kind).toBe('acquired'); expect(active.chatID).toBe(first.chatID)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/projects-and-chats/m2-03.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Implement the actual scoped gate with atomic acquisition and token-checked release; race concurrent acquisitions, aliases and duplicate views. Importing the module must create no global state.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/projects-and-chats/m2-03.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): acquire one atomic project execution lease`.
