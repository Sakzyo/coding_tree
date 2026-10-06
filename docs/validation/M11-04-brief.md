# M11-04 dispatch brief

Dispatched and independently reviewed; exact owner/base/evidence are recorded in docs/tasks/progress.md.

Read exact task below first, relevant source sections and AGENTS. M11-01/02 are reviewed; source preflight is docs/validation/M11-source-preflight.md, which is preparation, not course/support completion. Write original source-bounded explanations for Java fundamentals, FTC lifecycle, hardware/gamepads/telemetry and code organization. Use actual selected-version primary sources, retained pinned SDK sources and source/license provenance; no invented robot hardware names, measurements or achievements. Explanation and actual project application are both required by exercise criteria; building alone is not physical success.

Exact task content/test/manifest paths are assigned. Canonical ftc-knowledge.ts and knowledge.ts may be extended only as genuinely needed to validate paired current lesson/exercise payloads and expose the content through existing query records; no course engine, progress owner, future API/tool/host wiring or source fetch at import. Raise the smallest structured content contract before dependent code. Preserve all existing validator/query behavior and content ids/code/API/device tokens across en/zh. Read App localization guidance for term verification but do not edit App dictionaries. Use at least two maintained independent primary localization corpora and document uncertain terms. Original lesson text follows the existing project license; record upstream reference notices without claiming redistribution permission for unlicensed docs or compatibility certification.

Coordinator owns Git index/commits, ledger/checklists/root exports; no subagents or reviewer. Own only assigned disjoint M11 paths while M3/M4 work proceeds. No actual robot/toolchain execution or network at module initialization. No production supported-version/catalog promotion.

Verification: real content behavioral RED -> GREEN, actual validator/query plus new task suite, affected M11 regression, Core/Schema bun typecheck if touched, scoped lint/format, structured data and bilingual/source/identifier checks. Pinned Bun PATH /private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64, isolated test XDG/OPENCODE_TEST_HOME. Required examples/source/terminology should be reviewed against immutable primary snapshots; separate physical/native translation/course acceptance remains explicit.

Report docs/validation/M11-04-implementation.md with exact source/content hashes, commands/cwd/results/counts, source/license/translation provenance, assertion map and unresolved gates. Return frozen concise completion candidate; root independently reviews.

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

### M11-04 — Author Java and FTC foundation lessons

**Prerequisites:** [M11-01](ftc-knowledge.md#m11-01).

**Files:** `packages/core/resources/ftc/content/en/foundations.json`, `packages/core/resources/ftc/content/zh/foundations.json`, `packages/core/resources/ftc/content/manifest.json`, `packages/core/test/ftc/ftc-knowledge/m11-04.test.ts`.

**Interfaces:** Produces stable paired lessons for Java fundamentals, OpMode lifecycle, hardware/gamepads/telemetry and understandable code organization.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/ftc-knowledge/m11-04.test.ts`, add `foundation lessons require explanation and project application`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(missingRequiredTopics).toEqual([])
expect(exercise.requiresExplanation).toBe(true)
expect(exercise.requiresProjectApplication).toBe(true)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/ftc-knowledge/m11-04.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Write source-bounded explanations and small versioned examples, with explanation and project-application exercises. Verify terminology using package localization guidance. Keep student hardware names/measurements unknown unless supplied.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/ftc-knowledge/m11-04.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): author java and ftc foundation lessons`.
