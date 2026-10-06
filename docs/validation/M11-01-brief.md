# M11-01 dispatch brief

Prepared, not dispatched. Coordinator assigns current review base and owner before implementation.

Role: implement M11-01 local content-pack validation. Read this exact brief, owning module plan, root/applicable AGENTS and Schema conventions first.
Prerequisites: none. Start with small explicit local fixture packs; production content authoring belongs to later M11 tasks. This task cannot establish reviewed course coverage or supported library versions.
Allowed writes: four exact task paths, Schema root barrel if required by package conventions, task-owned test fixtures if inline files are inadequate, docs/validation/M11-01-implementation.md and docs/validation/m11-01/ evidence. No sibling module implementation, UI translations, content downloading at import time, production bootstrap, manifests/lockfiles or vector database. Do not create speculative future services.
Canonical ownership: FtcKnowledge owns ContentRecord and validation input/result/error records. Identical stable content IDs and content versions pair English/Simplified Chinese. Preserve language-independent domain codes and actual code/API/device identifiers; source/license/digest/applicability metadata is mandatory. Validate file bytes/digest and actual content identifiers against the package contract, not just trusting a declared valid flag. Define only records required by the current producer; later owners extend for queries/inventory.
Inputs must be injected files/manifest values; no implicit project-selection state, sibling stores, network fetch or import-time I/O. Fixture provenance is explicitly synthetic and cannot populate a supported content catalog. Missing files/translation/source/license, duplicate IDs, corrupt digest, invalid ranges and changed identifiers remain distinguishable invalid-content outcomes. Use existing repository conventions for version handling and hashing; do not invent compatibility evidence.
Source-preflight report, when available, is preparation for later authoring only. Floating Pedro docs now differ from the evaluated ftc:2.1.2 candidate; Road Runner core-only completion does not establish Actions/FTC/Dashboard/tuning integration. Never encode these as supported defaults merely because metadata exists.
Verification: meaningful behavioral RED→GREEN from packages/core for the exact task suite, changed Core/Schema bun typecheck, affected Schema contracts and scoped lint/format. Schema's two known event-manifest baseline failures are unrelated. Isolated tests must not require internet, credentials, installed toolchains, physical robot or application bootstrap. Cover fresh instances/disposal where effects actually acquire resources; do not invent I/O just to test cleanup.
Tooling: prepend /private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64 to PATH; dependencies are provisioned. No user app/server restart. No subagents/reviewer, no ledger/checklist edits. Commit assigned files only. Report exact revision/commands/cwd/results/counts, assertion map, fixture classification and unresolved gates in docs/validation/M11-01-implementation.md; return concise status/commit/test/concerns.

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

### M11-01 — Validate local content packages and bilingual IDs

**Prerequisites:** None; implement using supplied port fixtures.

**Files:** `packages/schema/src/ftc-knowledge.ts`, `packages/core/src/ftc/knowledge.ts`, `packages/core/resources/ftc/content/manifest.json`, `packages/core/test/ftc/ftc-knowledge/m11-01.test.ts`.

**Interfaces:** Produces `validatePack({ manifest, files }): PackResult`; identical content IDs/versions pair en/zh while source/license/digest/version ranges are mandatory.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/ftc-knowledge/m11-01.test.ts`, add `translation pair preserves stable IDs and code tokens`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(en.id).toBe(zh.id); expect(en.codeTokens).toEqual(zh.codeTokens); expect(missingSource.code).toBe('invalid_content')
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/ftc-knowledge/m11-01.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Use small local fixture packs first. Check duplicate IDs, absent files, digests, version ranges and preserved identifiers. Stable lesson IDs and domain error codes are language independent; no module initialization downloads content.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/ftc-knowledge/m11-01.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): validate local content packages and bilingual ids`.
