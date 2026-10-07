# M5-02 dispatch brief

Prepared, not dispatched. Coordinator records reviewed base/owner. Requires reviewed M5-01.



Parallel write scope is explicit. Do not stage, commit, edit checklists/progress, or spawn subagents. Coordinator owns Git, root barrels, generated artifacts and ledger. Read AGENTS.md and Schema AGENTS.md when applicable. Use Superpowers TDD and verification-before-completion. Test real implementation via controlled external ports/real temporary files, no globals/mocks of subject. Run package-local tests and bun typecheck, scoped lint/format. Use pinned Bun PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH and task-owned OPENCODE_TEST_HOME/XDG roots. Preserve prior passing evidence, do not rerun unrelated broad suites. Keep foreign lane errors separate; no foreign edits. Logs/report need commands, cwd, exit, counts, RED/GREEN, assertion map, SHA256 of final source, fixture/real distinction and unrun gates. Product production/platform enablement is not credited by isolated tests. Freeze candidate when reported; any later edit requires refreshed checks/hashes.

Report: docs/validation/M5-02-implementation.md; logs docs/validation/m5-02/.


## Producer-owned contracts

This task additionally owns packages/schema/src/ftc-java.ts additions for canonical EditProposal/EditResult/request/error records consumed by M3-03/M6. Serialize that path with M5 work. No consumer may duplicate the Java proposal contract. Do not implement M3 code approval policy or robot authority here.

## Module context

# M5 — Java development Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement one task at a time, or `superpowers:subagent-driven-development` if that execution method is selected. Check each step only after its evidence exists. This document plans work; it does not claim implementation.

**Goal:** Preserve document revisions, provide dependency-aware Java services, and produce trustworthy build/artifact evidence.

**Architecture:** M5 owns documents, language-service sessions and builds; views consume document facades. Inject filesystem, language-service, build and artifact ports plus toolchain values. Code authorization arrives through a trusted caller, while M5 independently enforces revision/scope.

**Tech Stack:** TypeScript, Effect, Monaco adapter, Eclipse JDT LS candidate, project Gradle wrappers.

**Spec:** [Requirements](../proposal.md), [high-level design](../high-level-design.md), especially its M5 contract and isolated-test row. Read [shared execution rules and progress](progress.md) before this plan.

**Coverage:** EDT-01, EDT-02; ENV-04–ENV-06; HW-03; ROB-02; AC-04, AC-08, AC-10.

## Global constraints

- Apply all [shared constraints](progress.md#global-constraints); they are part of every task.
- Develop against explicit ports/immutable records; do not import sibling implementations or their stores.
- Preserve Java FTC scope, macOS/Windows support, English/Simplified Chinese, and independent mode settings.
- All boxes start unchecked. No source document establishes implemented product functionality.

## File map and interfaces

Existing anchors (inspect before editing):

- `packages/app/src/context/file.tsx`
- `packages/opencode/src/lsp/server.ts`
- `packages/core/src/file-mutation.ts`
- `packages/core/src/process.ts`

Planned owned files/responsibilities (create missing files; modify existing files in place):

- `packages/schema/src/ftc-java.ts` — document/edit/build/artifact records
- `packages/core/src/ftc/java.ts` — document/build facade
- `packages/core/src/ftc/java/documents.ts` — revision and save rules
- `packages/core/src/ftc/java/language-service.ts` — scoped language-service adapter
- `packages/core/src/ftc/java/build.ts` — build evidence and artifacts
- `packages/app/src/ftc/editor.tsx` — Monaco view adapter

`DocumentSnapshot = { documentID, projectID, path, bufferRevision, diskRevision, text, dirty }`. `EditProposal = { projectID, edits: readonly { path, expectedRevision, replacement }[], explanation }`; revisions distinguish disk from buffer. `BuildEvidence = { buildID, projectID, sourceRevision, configurationRevision, inputChanged, exitCode, status, logs, artifact? }`; status is succeeded/failed/cancelled/outdated. `ArtifactRef = { buildID, projectID, sourceRevision, configurationRevision, digest, path }` is a local reference; public responses redact host paths where unnecessary. All evidence IDs resolve through an owner query, never an agent-supplied success flag.

Signatures below specify domain inputs/results; use the repository's Effect services and canonical Schema types as explained in [contract conventions](progress.md#contract-conventions). New API/file names are planning decisions, not claims that they exist.

## Review focus

- Dirty buffers survive layout changes and proposed agent edits (M5-01/M5-02).
- External edits during save must not be overwritten (M5-02).
- Unavailable LSP is not an empty successful diagnostic result (M5-04).
- A source/config change during a build makes its APK outdated (M5-05).
- A failed build must not reuse yesterday's APK (M5-06).


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

### M5-02 — Save and apply edits with conflict checks

**Prerequisites:** [M5-01](java-development.md#m5-01).

**Files:** `packages/core/src/ftc/java/documents.ts`, `packages/core/src/ftc/java.ts`, `packages/core/test/ftc/java-development/m5-02.test.ts`.

**Interfaces:** Produces `saveDocument({ projectID, path, expectedRevision }): DocumentSnapshot` and `applyEdits({ proposal: EditProposal, authorization }): EditResult`; authorization is supplied by the trusted code-change adapter, not arbitrary tool JSON.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/java-development/m5-02.test.ts`, add `dirty or externally changed files reject stale edits`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(result.kind).toBe('conflict'); expect(bufferText).toBe('unsaved'); expect(externalDiskText).toBe('external')
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/java-development/m5-02.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Check buffer/disk revisions and authorized file scope before writing. Preserve the proposal and both versions; return save/merge/defer choices. Preflight every file in a multi-file proposal and report partial filesystem failure honestly; never silently discard changes.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/java-development/m5-02.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): save and apply edits with conflict checks`.

