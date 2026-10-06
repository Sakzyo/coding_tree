# M4-01 dispatch brief

Role: implement task M4-01 within M4 Environment and compatibility.
Read first: this brief; docs/tasks/environment-and-compatibility.md; root AGENTS.md; packages/schema/AGENTS.md; docs/tasks/progress.md contract conventions.
Objective/acceptance: exact task below, ENV-04 and supporting ENV-01–06; coherent validated profiles with separately identified build/editor JDKs, never arbitrary newest dependencies or unsupported compatibility claims.
Review base: `705d41839dc1e64e12343c62777ce500e022d3a1`.
Prerequisites: none. Fixtures are synthetic; real compatibility catalog should remain explicitly unevaluated/empty until actual evaluations supply supported entries. Do not download FTC assets or start product tools in isolated tests.
Allowed write paths: four exact task files below; docs/validation/M4-01-implementation.md and docs/validation/m4-01/ logs. Schema barrel only if its existing conventions require current-domain export; ask coordinator for any other shared file. Do not change package manifests/lockfiles, Session code, composition or ledger.
Current interfaces: no FTC schema modules existed at session baseline. M4 owns canonical FtcEnvironment schemas; use repository namespace projection and flat exports. Records are validated, readonly and serializable. Pure resolveProfile stays synchronous (not an Effect). Paths/versions that are local or synthetic must not be presented as measured support.
Tooling: Bun 1.3.14 at /private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun; prepend directory to PATH. Coordinator handles repository dependency provisioning. Relevant baseline results in docs/validation/baseline.md. Dependency provisioning is complete. Core/Desktop/App/Schema typechecks pass. The unchanged Schema full suite has 13 passes and 2 pre-existing event-manifest expectation failures; record these by name if running that suite and do not repair them in this task. Session regression passes 127/127 using isolated XDG directories.
Verification: exact focused test from packages/core; bun typecheck from packages/schema and packages/core; affected schema contract suites; root bun run lint -- <changed source paths>; root bunx --no-install prettier --check <assigned supported files>. Follow source conventions and meaningful red/green coverage for profile validation, invalid metadata, host/project incompatibility, independent runtimes, and evaluation status.
Report path: docs/validation/M4-01-implementation.md. Include task/requirement/AC IDs, tested revision/diff/commit, date/environment/versions, each command cwd and exit/test counts, assertion coverage, fixture classification and unrun gates. Make focused conventional commit of assigned files only.
Do not delegate, change scope, weaken checks, or update shared completion checkboxes/ledger. Return DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED plus brief commit/test/concern summary. Independent review is coordinator-owned.

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

### M4-01 — Validate compatibility profiles

**Prerequisites:** None; implement using supplied port fixtures.

**Files:** `packages/schema/src/ftc-environment.ts`, `packages/core/src/ftc/environment/catalog.ts`, `packages/core/resources/ftc/compatibility.json`, `packages/core/test/ftc/environment-and-compatibility/m4-01.test.ts`.

**Interfaces:** Produces `resolveProfile({ host, projectVersions, catalog }): { kind: 'matched', profile } | { kind: 'unsupported', reasons }`; host contains OS, architecture and available resources.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/environment-and-compatibility/m4-01.test.ts`, add `profile pins independent editor and build runtimes`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(selected.editorJdk.version).toBe('21'); expect(selected.buildJdk.version).toBe('17'); expect(unsupported.kind).toBe('unsupported')
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/environment-and-compatibility/m4-01.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Use clearly labelled synthetic test profiles (21/17 are fixture values, not released FTC support claims). Encode coherent combinations, source/license/checksum metadata and evaluation status; never choose independently latest dependencies.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/environment-and-compatibility/m4-01.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): validate compatibility profiles`.
