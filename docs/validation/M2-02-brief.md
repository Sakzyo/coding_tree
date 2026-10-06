# M2-02 dispatch brief

Dispatched 2026-10-06 to /root/m2_02, sole product writer. M2-01 complete with independent specification/quality review and no findings. Review base 2c36be13c2d15707ac09a73c4b62b6e968bab131.

Role: implement M2-02 chat-to-Session membership. Read exact task, owning module plan, root/applicable AGENTS and Schema conventions first. Consume actual M2-01 ProjectContext/repository API once committed; no duplicate association or ID schema.
Allowed writes: three exact task files, plus packages/schema/src/ftc-project.ts for canonical ChatRef/current command/error records required by this producer (omitted from task Files but assigned under shared-contract rules); task-owned test fixtures if needed; existing M2-01 test only for minimal required port-injection adaptation without weakening assertions; docs/validation/M2-02-implementation.md and docs/validation/m2-02/ evidence. Generated migration-only scope: packages/core/schema.json, src/database/schema.gen.ts, src/database/migration.gen.ts and this task's new migration file. Never hand-edit generated files or old migrations. No Session runtime/store writes, existing Project table changes, composition, manifest/lock, or premature gate implementation.
Identity mapping: M2 projectID denotes one canonical-root association using existing Project.ID. ProjectContext.location is Location.Info carrying the separate host project identity and canonical directory. Use the association ID for membership and the explicit location for Session access. Two different roots may share a host Project ID; aliases share one association. Never compare association ID directly to Session's host project ID and call that proof of membership.
Consume narrow injected createSession({location}) and Session lookup. Persist only chat metadata/membership; history/inbox/execution stay Session-owned. Validate returned/looked-up Session placement against association mapping, reject cross-chat/project mismatches, and keep different chats on distinct Sessions. Failure/cancellation must not leave falsely successful membership; report any actual ownership/transaction ambiguity before choosing compensation that could delete another owner's data.
Use actual temporary SQLite repositories and the real module, controlled Session access fixtures. Test reopen/order, distinct chats, two local roots sharing upstream host ID, missing/mismatched Sessions, and relevant failure/concurrency/lifecycle. Do not implement a second Session store/model loop or activate a Session merely by restoring membership.
Generate with existing Core migration script using a task-specific name, then run migration --check; inspect script before execution. Run meaningful RED→GREEN focused tests, M2-01 regression, database-migration checks, affected Schema contracts, Core/Schema bun typecheck and scoped lint/format. Preserve known unrelated baseline failures. No root tests, raw tsc or user app/server restart.
Tooling: prepend /private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64 to PATH; isolate test HOME/XDG under task-owned /private/tmp. No subagents/reviewers or shared progress/checklist edits. Focused conventional commit of assigned files only; coordinator may have concurrent docs. Report exact revision/commands/cwd/results/counts/assertion map and fixture limits in docs/validation/M2-02-implementation.md; return concise status/commit/tests/concerns.

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

### M2-02 — Persist separate chat-to-Session membership

**Prerequisites:** [M2-01](projects-and-chats.md#m2-01).

**Files:** `packages/core/src/ftc/projects.ts`, `packages/core/src/ftc/projects/sql.ts`, `packages/core/test/ftc/projects-and-chats/m2-02.test.ts`.

**Interfaces:** Consumes injected `createSession({ location })` and Session lookup. Produces `createChat({ projectID }): ChatRef` and `listChats({ projectID }): readonly ChatRef[]`.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/projects-and-chats/m2-02.test.ts`, add `reopen retains distinct chat Sessions`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(a.sessionID).not.toBe(b.sessionID); expect(reopened).toEqual([a, b])
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/projects-and-chats/m2-02.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Create Sessions only through Session access; persist membership without copying history. Reject Session/chat mismatches and test two projects using fresh temporary SQLite repositories.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/projects-and-chats/m2-02.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): persist separate chat-to-session membership`.
