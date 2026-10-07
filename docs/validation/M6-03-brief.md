# M6-03 dispatch brief — 2026-10-07

Base: `118a1ac80`. Status: IN_PROGRESS. M6-01 is independently approved; M6-02 repair is independently approved. This is read-only project inspection, independent of M2 host wiring and M3 policy review.

Exclusive writer paths: `packages/core/src/ftc/configuration/inspection.ts`, `packages/schema/src/ftc-configuration.ts` (only canonical inspection records/errors), `packages/core/test/ftc/ftc-configuration-and-libraries/m6-03.test.ts`, new `packages/schema/test/ftc-inspection.test.ts`; report `docs/validation/M6-03-implementation.md`, evidence `docs/validation/m6-03/`. No existing configuration/manifest/Java/Session/host/SQL/event-manifest/barrel edits. Request ownership before any additional source file. Coordinator owns Git/index/commits/root exports/ledger. No subagents.

## Concrete boundary decisions

- Export a narrow same-domain Inspection facade with make/layer if needed and inspectProject({ root }); consumers import its public namespace. Use supplied read-only filesystem ports and the public M6 manifest-read port. Do not start an additional manifest owner or sibling implementation to satisfy an isolated test. For filesystem identity use the public FSUtil contract; actual filesystem tests may bind the infrastructure adapter. Import starts no I/O and owning Scope disposal rejects escaped APIs and interrupts in-flight reads.
- Capture root/port observations before asynchronous boundaries, retain canonical project scope across reads, reject external/symlink-retargeted source paths. Read representative root/TeamCode Gradle/Java files using explicit supported layouts; no Gradle, wrapper, Java, process, network or build execution. Never follow inspection into unrelated directories. Preserve exact file bytes. No migration/proposals/writes.
- Canonical producer-owned inspection records belong in ftc-configuration.ts. Result retains sdkVersion, dependencies, detectedPathing, conflicts, sourceRevisions with language-independent error/unknown reasons. Record source paths and hashes of the actual bytes used (manifest included when present); absent or changed/unsupported inputs remain explicit. Do not claim an atomic whole-project snapshot; stale inputs are checked again by future proposal/edit consumers.
- Support clear static literal coordinates/versions in representative Groovy/Kotlin Gradle and Java imports. Dynamic or unsupported Gradle constructs are explicit unknowns; never execute/evaluate them or infer a version from an arbitrary substring/comment. Both observed pathing libraries and a manifest mismatch require a conflict/decision. Missing/unsupported/incomplete inspection is not conclusive neither. Differentiate observed dependencies from managed selection; never remove team code or claim technical incompatibility. SDK/pathing detection is source evidence, not proven dependency resolution/build/physical support.
- Use repository-owned pinned fixtures/reference evidence for representative coordinates/imports. If external exact package facts are needed, verify primary official sources and record them; do not invent compatibility claims. No downloads/install/live app/server/provider/robot operations.
- Tests exercise real inspection with controlled public ports plus temporary files where filesystem safety is asserted. No subject mocks, globals or sibling runtime fixtures. Include meaningful behavior RED→GREEN, dynamic unknowns/comments/static detection/mismatches/file preservation/cancellation/canonical scope. Do not mirror parser implementation or add broad speculative Gradle support.
- Pinned Bun1.3.14: PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH. Task-owned OPENCODE_TEST_HOME plus all four XDG_CONFIG_HOME/XDG_DATA_HOME/XDG_CACHE_HOME/XDG_STATE_HOME roots in /private/tmp. Tests and bun typecheck from package directories. Scoped lint/format/diff; affected M6/Schema contracts required, no unrelated package-wide baseline reruns.

## Report contract

Return DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT or BLOCKED with compact tests/concerns and report path. Full report records interfaces, assumptions, exact source scope, meaningful RED/GREEN chronology, commands/cwd/exits/assertions, scope cleanup, unknown and platform limits, self-review and source SHA256. Freeze candidate and wait for coordinator independent review; do not claim composed acceptance.

# M6 — FTC configuration and libraries Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement one task at a time, or `superpowers:subagent-driven-development` if that execution method is selected. Check each step only after its evidence exists. This document plans work; it does not claim implementation.

**Goal:** Keep one shareable hardware/pathing manifest and return version-correct code proposals without directly changing Java or robot configuration.

**Architecture:** A versioned project JSON repository is authoritative. M6 consumes read-only project inspection plus compatibility/reference values; form and chat use the same commands. It returns EditProposal values for M3/M5 rather than writing source files.

**Tech Stack:** TypeScript, Effect Schema, JSON/filesystem adapters, Gradle/Java inspection.

**Spec:** [Requirements](../proposal.md), [high-level design](../high-level-design.md), especially its M6 contract and isolated-test row. Read [shared execution rules and progress](progress.md) before this plan.

**Coverage:** FTC-02–FTC-06; HW-01–HW-04; ENV-05; PRJ-01; AC-02, AC-07, AC-08.

## Global constraints

- Apply all [shared constraints](progress.md#global-constraints); they are part of every task.
- Develop against explicit ports/immutable records; do not import sibling implementations or their stores.
- Preserve Java FTC scope, macOS/Windows support, English/Simplified Chinese, and independent mode settings.
- All boxes start unchecked. No source document establishes implemented product functionality.

## File map and interfaces

Existing anchors (inspect before editing):

- `packages/core/src/file-mutation.ts`
- `packages/schema/src/schema.ts`

Planned owned files/responsibilities (create missing files; modify existing files in place):

- `packages/schema/src/ftc-configuration.ts` — manifest/validation/proposal records
- `packages/core/src/ftc/configuration.ts` — shared commands
- `packages/core/src/ftc/configuration/manifest.ts` — atomic revisioned JSON storage
- `packages/core/src/ftc/configuration/inspection.ts` — read-only dependency/code inspection
- `packages/core/src/ftc/configuration/proposals.ts` — Java/Gradle edit proposals

`Manifest = { schemaVersion: 1, hardware: readonly Hub[], managedPathing: 'pedro' | 'road-runner' | 'neither' }`; Hub has stable local ID and devices `{ category, port, type, name }`, validated against the selected SDK/device catalog. `ManifestSnapshot = { revision, manifest }`, revision hashes current bytes. `MappingStatus = { state: 'consistent' | 'pending' | 'conflict', affectedPaths, manifestRevision }`. Project-local `ftc-project.json` excludes machine paths, credentials, chats, progress, observations and approvals.

Signatures below specify domain inputs/results; use the repository's Effect services and canonical Schema types as explained in [contract conventions](progress.md#contract-conventions). New API/file names are planning decisions, not claims that they exist.

## Review focus

- External manifest edits must not be lost (M6-01).
- Duplicate names and invalid category/port/type combinations must fail (M6-02).
- Hardware rename must report stale Java references until an authorized edit lands (M6-05).
- Both detected libraries require a decision without deleting team code (M6-03/M6-04).
- Choosing neither cannot accidentally add pathing dependencies (M6-04).


## Global constraints

- Apply all [shared constraints](progress.md#global-constraints); they are part of every task.
- Develop against explicit ports/immutable records; do not import sibling implementations or their stores.
- Preserve Java FTC scope, macOS/Windows support, English/Simplified Chinese, and independent mode settings.
- All boxes start unchecked. No source document establishes implemented product functionality.

## File map and interfaces

Existing anchors (inspect before editing):

- `packages/core/src/file-mutation.ts`
- `packages/schema/src/schema.ts`

Planned owned files/responsibilities (create missing files; modify existing files in place):

- `packages/schema/src/ftc-configuration.ts` — manifest/validation/proposal records
- `packages/core/src/ftc/configuration.ts` — shared commands
- `packages/core/src/ftc/configuration/manifest.ts` — atomic revisioned JSON storage
- `packages/core/src/ftc/configuration/inspection.ts` — read-only dependency/code inspection
- `packages/core/src/ftc/configuration/proposals.ts` — Java/Gradle edit proposals

`Manifest = { schemaVersion: 1, hardware: readonly Hub[], managedPathing: 'pedro' | 'road-runner' | 'neither' }`; Hub has stable local ID and devices `{ category, port, type, name }`, validated against the selected SDK/device catalog. `ManifestSnapshot = { revision, manifest }`, revision hashes current bytes. `MappingStatus = { state: 'consistent' | 'pending' | 'conflict', affectedPaths, manifestRevision }`. Project-local `ftc-project.json` excludes machine paths, credentials, chats, progress, observations and approvals.

Signatures below specify domain inputs/results; use the repository's Effect services and canonical Schema types as explained in [contract conventions](progress.md#contract-conventions). New API/file names are planning decisions, not claims that they exist.

## Review focus

- External manifest edits must not be lost (M6-01).
- Duplicate names and invalid category/port/type combinations must fail (M6-02).
- Hardware rename must report stale Java references until an authorized edit lands (M6-05).
- Both detected libraries require a decision without deleting team code (M6-03/M6-04).
- Choosing neither cannot accidentally add pathing dependencies (M6-04).


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

# Task 3

### M6-03 — Inspect imported SDK and pathing dependencies

**Prerequisites:** [M6-01](ftc-configuration-and-libraries.md#m6-01).

**Files:** `packages/core/src/ftc/configuration/inspection.ts`, `packages/core/test/ftc/ftc-configuration-and-libraries/m6-03.test.ts`.

**Interfaces:** Produces `inspectProject({ root }): { sdkVersion, dependencies, detectedPathing, conflicts, sourceRevisions }`; unresolved dynamic Gradle expressions are explicit unknowns.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/ftc-configuration-and-libraries/m6-03.test.ts`, add `ambiguous imports stay untouched`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(result.conflicts.length).toBeGreaterThan(0); expect(afterFiles).toEqual(beforeFiles); expect(dynamic.version).toBeUndefined()
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/ftc-configuration-and-libraries/m6-03.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Read representative Java/Gradle/project layouts without executing arbitrary build code. Detect Pedro/Road Runner/neither and conflicts with the manifest. Do not claim unsupported Gradle syntax was fully understood or silently migrate existing code.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/ftc-configuration-and-libraries/m6-03.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): inspect imported sdk and pathing dependencies`.

