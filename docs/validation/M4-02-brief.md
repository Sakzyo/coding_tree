# M4-02 dispatch brief

Prepared, not dispatched. Coordinator records current review base before assignment.

Role: implement M4-02 Environment inspection. Read this brief, owning module plan, root/applicable AGENTS and Schema guide first.
Prerequisite M4-01 complete at f7d2a93eabae724f29875a29840b000cee8749fb, independently reviewed. Consume FtcEnvironment canonical Profile/Host/ProjectVersions/Catalog/ResolveResult and existing pure resolver in packages/core/src/ftc/environment/catalog.ts. Missing imported dependency constraints are not proof of compatibility; M4-01 matching alone does not establish readiness.
Allowed writes: exact task files plus packages/schema/src/ftc-environment.ts for this task's canonical Readiness/ToolchainDescriptor/request/error records required by the module contract, and owned docs/validation/M4-02-implementation.md / docs/validation/m4-02/ evidence. This is an explicit shared-schema assignment; no consumer-local duplicate. No production catalog promotion, host registration, manifests/locks, existing project files or runtime tool installation.
Architecture: actual Effect module using narrow injected read-only probe/dependency ports. Distinguish missing binary, denied/manual permission, unsuccessful probe and incompatible project. Build/editor Java are separate resolved paths and pins; never rely on a global Java choice. Keep candidate toolchain discovery separate from M4-03/06 build-verified readiness. Importing the module starts no process or I/O; scope owns cleanup/cancellation.
M5-03 available-host evidence at docs/validation/java-import.md uses canonical artifacts plus explicit local evaluation paths because this descriptor did not yet exist. It does not authorize a supported production combination; native import failed, shadows only passed sampled macOS cases, and Windows remains unrun. Do not edit that harness in this task without coordinator assignment.
Verification: focused behavioral RED→GREEN with actual module and injected read probes/temporary imported files; verify unchanged files, independent Java versions, wrapper/SDK/ADB states, malformed/failure/cancellation and fresh-scope disposal. Run relevant M4-01 resolver regression, affected Schema contracts, bun typecheck from Core and Schema package directories, scoped lint/format. Known Schema event-manifest baseline failures are unchanged and unrelated. Tests must not require actual toolchains/downloads/Electron/network/robots.
Tooling: prepend /private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64 to PATH. Isolate Core test HOME/XDG state under task-owned /private/tmp paths. No user app/server restart. Production process isolation remains gated by M9-07/M9-08.
No subagents, no shared progress/checklist edits. Commit assigned files only. Report exact revision/commands/cwd/results/counts/assertion map, fixture-versus-real classification and unrun gates in docs/validation/M4-02-implementation.md. Return DONE/DONE_WITH_CONCERNS/NEEDS_CONTEXT/BLOCKED with short commit/test/concern summary.

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

### M4-02 — Inspect tools and imported project requirements

**Prerequisites:** [M4-01](environment-and-compatibility.md#m4-01).

**Files:** `packages/core/src/ftc/environment.ts`, `packages/core/src/ftc/environment/adapters.ts`, `packages/core/test/ftc/environment-and-compatibility/m4-02.test.ts`.

**Interfaces:** Consumes read-only process probes and project dependency snapshots. Produces `inspectEnvironment({ host, project, catalog }): Readiness` plus a candidate ToolchainDescriptor.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/environment-and-compatibility/m4-02.test.ts`, add `inspection preserves incompatible imported files`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(afterFiles).toEqual(beforeFiles); expect(result.state).toBe('incompatible'); expect(probes).toContain('adb')
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/environment-and-compatibility/m4-02.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Probe build/editor Java separately, Android SDK, ADB and the project's Gradle wrapper. Reuse working tools, identify required permissions/manual steps and distinguish missing binaries from probe failure.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/environment-and-compatibility/m4-02.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): inspect tools and imported project requirements`.
