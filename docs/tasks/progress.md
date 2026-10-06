# FTC development progress

Date: 2026-10-06
Planning baseline: `d7aca195c`

**Implementation progress: 0 / 12 modules complete; 3 / 94 tasks complete.**

These checkboxes track future development, not completion of this planning document. The existing OpenCode foundation is reused, but its presence does not prove that the FTC tasks are done. Both inputs describe unimplemented or unevaluated product work, so every implementation box starts unchecked.

**Source of scope:** [requirements proposal](../proposal.md) and [high-level design](../high-level-design.md). This breakdown follows the design's twelve modules and preserves all 48 functional requirements and all 13 acceptance scenarios. It does not start product implementation or turn unevaluated recommendations into compatibility claims.

## Module checklist

- [ ] **M1 — [Desktop workspace](desktop-workspace.md)** — 0 / 14 tasks.
- [ ] **M2 — [Projects and chats](projects-and-chats.md)** — 1 / 6 tasks.
- [ ] **M3 — [Agent and context](agent-and-context.md)** — 0 / 7 tasks.
- [ ] **M4 — [Environment and compatibility](environment-and-compatibility.md)** — 1 / 7 tasks.
- [ ] **M5 — [Java development](java-development.md)** — 0 / 8 tasks.
- [ ] **M6 — [FTC configuration and libraries](ftc-configuration-and-libraries.md)** — 0 / 6 tasks.
- [ ] **M7 — [AI access and local inference](ai-access-and-local-inference.md)** — 0 / 8 tasks.
- [ ] **M8 — [Controller connections](controller-connections.md)** — 1 / 6 tasks.
- [ ] **M9 — [Robot approvals and operations](robot-approvals-and-operations.md)** — 0 / 9 tasks.
- [ ] **M10 — [Diagnostics and dashboard](diagnostics-and-dashboard.md)** — 0 / 6 tasks.
- [ ] **M11 — [FTC knowledge](ftc-knowledge.md)** — 0 / 10 tasks.
- [ ] **M12 — [Learning and personal progress](learning-and-progress.md)** — 0 / 7 tasks.

Check a module only after its task checklist, substeps, module completion gate and assigned acceptance evidence pass. Update its count here after each task. Task completion is a count of checked entries in the module's **Task checklist**, not a count of all substep boxes. Counts are maintained here manually; do not mark a module complete just because its isolated suite passed.

## How to execute one task

1. Read its module plan, linked source sections, interfaces, prerequisites and applicable package `AGENTS.md`. Use the task ID as the work unit.
2. Consume prerequisite **contracts** through supplied values/ports for isolated work. A task that explicitly composes real modules also requires their implementations. Never start a live sibling merely to satisfy a module test.
3. Follow the task's test/implement/verify checkboxes. One task produces one independently reviewable behavior or a reproducible evaluation decision. Run only the relevant checks and required package typechecks.
4. Record evidence in the owning task or `docs/validation/`, make a focused conventional commit, then check the task and update module/total counts. Stage intended files only.
5. If a platform, robot, model, source review or prerequisite is unavailable, record **not run** or **blocked: reason** beside that task and keep its box unchecked. Never substitute fixture evidence for an actual integration result.

The test code snippets are core assertions inside the named test, not standalone programs. Arrange their named outputs by calling the task's real interface with the fixture inputs described there; do not copy production decision logic into fixtures. No test files or validation reports named below are claimed to exist yet.

## Suggested execution sequence

Modules can be constructed independently. This sequence schedules integration milestones; the linked per-task prerequisite lists are the authoritative dependency graph.

| Stage | Ready work and exit milestone |
| --- | --- |
| Early feasibility | Start [M9-07](robot-approvals-and-operations.md#m9-07) immediately; after [M4-01](environment-and-compatibility.md#m4-01) run [M5-03](java-development.md#m5-03); after [M8-01](controller-connections.md#m8-01) run [M8-04](controller-connections.md#m8-04). Resolve action isolation, real Java import and robot protocols before dependent production adapters. |
| Workspace and AI foundation | M2 project/chat storage and gate; M3 Session regressions/code policy; M7 provider/runtime work; M1 standalone workspace/settings. Compose [M2-06](projects-and-chats.md#m2-06) and [M7-07](ai-access-and-local-inference.md#m7-07). |
| FTC development workflow | M4 setup, M5 document/build services, M6 configuration/library proposals, M11 reference contracts/content. Expose setup/readiness APIs and compose build verification in [M4-06](environment-and-compatibility.md#m4-06) before [M1-11](desktop-workspace.md#m1-11) binds the workspace; compose [M6-06](ftc-configuration-and-libraries.md#m6-06) and the editor. |
| Robot integration | M8 connections, M9 approvals/mutation enforcement, M10 diagnostics, M1 robot/Panel views. Prove [M9-08](robot-approvals-and-operations.md#m9-08) before enabling production command/build/robot authority. |
| Learning and release integration | M11 both course tracks, M12 progress/evidence, M1 real API wiring/localization. Finish [M1-12](desktop-workspace.md#m1-12) and [M1-14](desktop-workspace.md#m1-14) only after all dependent evaluations. |

Tasks initially ready with supplied fixtures: [M1-01](desktop-workspace.md#m1-01), [M2-01](projects-and-chats.md#m2-01), [M3-01](agent-and-context.md#m3-01), [M4-01](environment-and-compatibility.md#m4-01), [M5-01](java-development.md#m5-01), [M6-01](ftc-configuration-and-libraries.md#m6-01), [M7-01](ai-access-and-local-inference.md#m7-01), [M7-02](ai-access-and-local-inference.md#m7-02), [M8-01](controller-connections.md#m8-01), [M9-01](robot-approvals-and-operations.md#m9-01), [M9-07](robot-approvals-and-operations.md#m9-07), [M11-01](ftc-knowledge.md#m11-01), [M12-01](learning-and-progress.md#m12-01).

Content and contracts may precede UI integration. Hardware evaluations may run as soon as their specific prerequisites are ready. Stage completion is not first-release completion.

<a id="global-constraints"></a>

## Global constraints

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

<a id="contract-conventions"></a>

## Contract conventions and shared wiring

Public signatures in module plans show domain inputs/results. Implement effectful Core methods as the existing `Effect.Effect<Result, DomainError>` service methods; observation/model streams use scoped Effect streams. Pure validators stay synchronous. Reuse canonical existing Project/Location/Session/model/stream/receipt types rather than copying them. New records are readonly validated Schema values; avoid `any`. Stable domain errors carry structured cause/recovery data and are localized only at presentation.

Source-facing schemas live at the exact `packages/schema/src/ftc-*.ts` path in the owning task. That module owns its payload definitions; consumers import the Schema contract or declare their minimal consumed port, never its implementation. The task that first introduces a public method also defines its request/result/error schemas and cancellation/cleanup contract. No task may leave a referenced type undefined.

`packages/core/src/ftc/composition.ts` is a **planned composition-only adapter**: it binds public Core facades to consumed ports, not Server/Protocol handlers or UI. Existing host roots register runtime wiring; `packages/protocol/src/api.ts` and `packages/server/src/handlers.ts` register new groups/handlers in their own layers. Module code never imports composition. Share this file deliberately across integration tasks, with each task adding only its wiring. Do not add an application event bus or workflow authority there.

Migrations use existing Core generation scripts and module-owned snake_case tables; do not hand-edit generated migration/schema registries. Each persisted record added in M2/M4/M7/M9/M12 needs reopen and migration checks in its owning task. Shared database connection does not grant cross-module transactions/table access.

Code-plan and robot-approval records describe decisions but are **not bearer authorization supplied by model JSON**. Production user approvals enter through authenticated narrow host/API adapters, with identity/revision/context revalidated by the owner. Read-only fixture ports cannot turn into stale production authorization.

## Verification commands

All paths below are proposed test selections created by the tasks, unless already present. Provision repository dependencies before running them; module tests must not download product assets.

| Check | Working directory | Command / passing result |
| --- | --- | --- |
| Core isolated module | `packages/core` | `bun test ./test/ftc/<module-slug>` — real module passes with only supplied ports/temporary resources. Each plan provides its exact slug. |
| UI isolated module | `packages/app` | `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc/desktop-workspace` — DOM tests pass without Electron/backend. |
| UI production composition | `packages/app` | `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc-integration` — M1-11 uses a test-owned composed backend; excluded from the isolated module directory. |
| Production composition | `packages/core` | `bun test ./test/ftc-integration` — actual module wiring passes with controlled external ports. |
| Environment API handlers | `packages/server` | `bun test ./test/ftc-environment.test.ts` — M4-06 exposes project-bound setup/readiness results, events and cancellation before M1-11 integration. |
| External adapters | `packages/core` | `bun test ./test/ftc-adapters` — satisfy documented technology prerequisites; these are not isolated-module evidence. |
| Platform/content evaluations | `packages/core` | `bun test ./test/ftc-evaluation/<task-id>.test.ts` — task-specific automated subset; attach separate manual/physical records. |
| Electron host policies | `packages/desktop` | `bun test ./src/main/ftc` — policy/IPC adapter checks; also validate actual Electron/safeStorage behavior in the host. |
| Module boundaries | `packages/core` | `bun test ./test/ftc-boundaries.test.ts` — no forbidden imports, private-store access or bootstrap dependencies. |
| Existing Session regression | `packages/core` | `bun test ./test/session-prompt.test.ts ./test/session-runner.test.ts ./test/session-run-coordinator.test.ts` — invariants remain passing. |
| Types | Every changed package | `bun typecheck` — no errors. |
| Public clients | `packages/client` | `bun run generate`, then `bun typecheck` — generated code derives from reviewed Protocol/HttpApi. |
| Packaged app | `packages/desktop`, target OS | `bun run build`, then `bun run package:mac` or `bun run package:win` — successful artifacts plus actual platform smoke checks. |

Do not install toolchains/models/robot dependencies during isolated suites. Use real temporary files/databases/parsers; controlled port implementations supply external results only. Keep the actual logic under test. Contract suites check real and controlled adapters for identity, revisions, errors, cancellation and cleanup. Real-platform evaluation prerequisites must be documented and missing resources must produce explicit not-run records, not silently skipped success.

## Requirement traceability

| Requirement | Owning executable tasks |
| --- | --- |
| PRJ-01 | [M2-01](projects-and-chats.md#m2-01), [M4-02](environment-and-compatibility.md#m4-02), [M6-03](ftc-configuration-and-libraries.md#m6-03), [M6-04](ftc-configuration-and-libraries.md#m6-04), [M1-01](desktop-workspace.md#m1-01) |
| PRJ-02 | [M2-02](projects-and-chats.md#m2-02), [M1-01](desktop-workspace.md#m1-01) |
| PRJ-03 | [M2-02](projects-and-chats.md#m2-02), [M2-06](projects-and-chats.md#m2-06), [M1-01](desktop-workspace.md#m1-01) |
| PRJ-04 | [M2-03](projects-and-chats.md#m2-03), [M2-04](projects-and-chats.md#m2-04), [M2-05](projects-and-chats.md#m2-05), [M2-06](projects-and-chats.md#m2-06), [M3-02](agent-and-context.md#m3-02), [M1-01](desktop-workspace.md#m1-01) |
| PRJ-05 | [M1-02](desktop-workspace.md#m1-02), [M5-01](java-development.md#m5-01) |
| EDT-01 | [M5-03](java-development.md#m5-03), [M5-04](java-development.md#m5-04), [M5-07](java-development.md#m5-07), [M5-08](java-development.md#m5-08), [M1-07](desktop-workspace.md#m1-07) |
| EDT-02 | [M5-04](java-development.md#m5-04), [M5-05](java-development.md#m5-05), [M3-04](agent-and-context.md#m3-04), [M1-07](desktop-workspace.md#m1-07) |
| ENV-01 | [M4-02](environment-and-compatibility.md#m4-02), [M4-03](environment-and-compatibility.md#m4-03), [M1-03](desktop-workspace.md#m1-03) |
| ENV-02 | [M4-04](environment-and-compatibility.md#m4-04), [M4-07](environment-and-compatibility.md#m4-07) |
| ENV-03 | [M4-03](environment-and-compatibility.md#m4-03), [M4-06](environment-and-compatibility.md#m4-06) |
| ENV-04 | [M4-01](environment-and-compatibility.md#m4-01), [M4-06](environment-and-compatibility.md#m4-06), [M5-05](java-development.md#m5-05) |
| ENV-05 | [M4-02](environment-and-compatibility.md#m4-02), [M6-03](ftc-configuration-and-libraries.md#m6-03), [M6-04](ftc-configuration-and-libraries.md#m6-04), [M3-03](agent-and-context.md#m3-03) |
| ENV-06 | [M4-05](environment-and-compatibility.md#m4-05), [M4-07](environment-and-compatibility.md#m4-07), [M5-08](java-development.md#m5-08), [M7-04](ai-access-and-local-inference.md#m7-04), [M11-09](ftc-knowledge.md#m11-09), [M12-07](learning-and-progress.md#m12-07) |
| AI-01 | [M7-02](ai-access-and-local-inference.md#m7-02), [M7-03](ai-access-and-local-inference.md#m7-03), [M1-03](desktop-workspace.md#m1-03), [M1-04](desktop-workspace.md#m1-04) |
| AI-02 | [M7-04](ai-access-and-local-inference.md#m7-04), [M7-07](ai-access-and-local-inference.md#m7-07), [M1-03](desktop-workspace.md#m1-03), [M1-04](desktop-workspace.md#m1-04) |
| AI-03 | [M7-01](ai-access-and-local-inference.md#m7-01), [M7-05](ai-access-and-local-inference.md#m7-05), [M7-06](ai-access-and-local-inference.md#m7-06), [M7-08](ai-access-and-local-inference.md#m7-08), [M1-04](desktop-workspace.md#m1-04) |
| AI-04 | [M3-03](agent-and-context.md#m3-03), [M3-07](agent-and-context.md#m3-07), [M9-01](robot-approvals-and-operations.md#m9-01), [M1-05](desktop-workspace.md#m1-05) |
| AI-05 | [M3-04](agent-and-context.md#m3-04), [M6-05](ftc-configuration-and-libraries.md#m6-05), [M10-03](diagnostics-and-dashboard.md#m10-03), [M11-02](ftc-knowledge.md#m11-02) |
| AI-06 | [M7-03](ai-access-and-local-inference.md#m7-03), [M7-04](ai-access-and-local-inference.md#m7-04), [M11-02](ftc-knowledge.md#m11-02), [M1-03](desktop-workspace.md#m1-03), [M1-04](desktop-workspace.md#m1-04) |
| AI-07 | [M3-05](agent-and-context.md#m3-05), [M7-03](ai-access-and-local-inference.md#m7-03), [M7-08](ai-access-and-local-inference.md#m7-08), [M9-05](robot-approvals-and-operations.md#m9-05) |
| FTC-01 | [M11-04](ftc-knowledge.md#m11-04), [M11-07](ftc-knowledge.md#m11-07), [M12-02](learning-and-progress.md#m12-02), [M12-05](learning-and-progress.md#m12-05), [M11-05](ftc-knowledge.md#m11-05), [M11-06](ftc-knowledge.md#m11-06), [M11-08](ftc-knowledge.md#m11-08) |
| FTC-02 | [M11-03](ftc-knowledge.md#m11-03), [M6-04](ftc-configuration-and-libraries.md#m6-04), [M1-06](desktop-workspace.md#m1-06) |
| FTC-03 | [M6-04](ftc-configuration-and-libraries.md#m6-04), [M11-07](ftc-knowledge.md#m11-07), [M5-08](java-development.md#m5-08), [M11-08](ftc-knowledge.md#m11-08) |
| FTC-04 | [M6-03](ftc-configuration-and-libraries.md#m6-03), [M6-04](ftc-configuration-and-libraries.md#m6-04), [M1-06](desktop-workspace.md#m1-06) |
| FTC-05 | [M6-04](ftc-configuration-and-libraries.md#m6-04), [M11-03](ftc-knowledge.md#m11-03), [M8-04](controller-connections.md#m8-04), [M11-08](ftc-knowledge.md#m11-08) |
| FTC-06 | [M11-01](ftc-knowledge.md#m11-01), [M11-02](ftc-knowledge.md#m11-02), [M11-09](ftc-knowledge.md#m11-09), [M11-10](ftc-knowledge.md#m11-10) |
| HW-01 | [M1-06](desktop-workspace.md#m1-06), [M6-02](ftc-configuration-and-libraries.md#m6-02) |
| HW-02 | [M6-01](ftc-configuration-and-libraries.md#m6-01), [M6-02](ftc-configuration-and-libraries.md#m6-02), [M6-06](ftc-configuration-and-libraries.md#m6-06), [M1-06](desktop-workspace.md#m1-06) |
| HW-03 | [M6-05](ftc-configuration-and-libraries.md#m6-05), [M6-06](ftc-configuration-and-libraries.md#m6-06), [M5-02](java-development.md#m5-02), [M3-03](agent-and-context.md#m3-03) |
| HW-04 | [M6-05](ftc-configuration-and-libraries.md#m6-05), [M6-06](ftc-configuration-and-libraries.md#m6-06), [M11-04](ftc-knowledge.md#m11-04), [M1-06](desktop-workspace.md#m1-06), [M11-06](ftc-knowledge.md#m11-06) |
| PAN-01 | [M10-04](diagnostics-and-dashboard.md#m10-04), [M1-09](desktop-workspace.md#m1-09), [M1-14](desktop-workspace.md#m1-14) |
| PAN-02 | [M10-01](diagnostics-and-dashboard.md#m10-01), [M10-05](diagnostics-and-dashboard.md#m10-05), [M10-06](diagnostics-and-dashboard.md#m10-06) |
| PAN-03 | [M10-02](diagnostics-and-dashboard.md#m10-02), [M10-06](diagnostics-and-dashboard.md#m10-06) |
| PAN-04 | [M10-03](diagnostics-and-dashboard.md#m10-03), [M3-04](agent-and-context.md#m3-04), [M3-05](agent-and-context.md#m3-05) |
| ROB-01 | [M8-01](controller-connections.md#m8-01), [M8-03](controller-connections.md#m8-03), [M8-06](controller-connections.md#m8-06) |
| ROB-02 | [M5-05](java-development.md#m5-05), [M5-06](java-development.md#m5-06), [M9-06](robot-approvals-and-operations.md#m9-06), [M9-09](robot-approvals-and-operations.md#m9-09) |
| ROB-03 | [M9-02](robot-approvals-and-operations.md#m9-02), [M1-08](desktop-workspace.md#m1-08), [M9-09](robot-approvals-and-operations.md#m9-09) |
| ROB-04 | [M9-01](robot-approvals-and-operations.md#m9-01), [M9-02](robot-approvals-and-operations.md#m9-02), [M9-09](robot-approvals-and-operations.md#m9-09), [M1-05](desktop-workspace.md#m1-05) |
| ROB-05 | [M8-02](controller-connections.md#m8-02), [M9-03](robot-approvals-and-operations.md#m9-03), [M9-04](robot-approvals-and-operations.md#m9-04) |
| ROB-06 | [M8-05](controller-connections.md#m8-05), [M9-05](robot-approvals-and-operations.md#m9-05), [M10-02](diagnostics-and-dashboard.md#m10-02), [M9-09](robot-approvals-and-operations.md#m9-09) |
| ROB-07 | [M9-07](robot-approvals-and-operations.md#m9-07), [M9-08](robot-approvals-and-operations.md#m9-08), [M3-05](agent-and-context.md#m3-05), [M1-09](desktop-workspace.md#m1-09) |
| LRN-01 | [M12-01](learning-and-progress.md#m12-01), [M12-02](learning-and-progress.md#m12-02), [M12-03](learning-and-progress.md#m12-03), [M1-10](desktop-workspace.md#m1-10) |
| LRN-02 | [M11-04](ftc-knowledge.md#m11-04), [M11-07](ftc-knowledge.md#m11-07), [M12-05](learning-and-progress.md#m12-05), [M11-05](ftc-knowledge.md#m11-05), [M11-06](ftc-knowledge.md#m11-06), [M11-08](ftc-knowledge.md#m11-08) |
| LRN-03 | [M3-05](agent-and-context.md#m3-05), [M11-04](ftc-knowledge.md#m11-04), [M12-04](learning-and-progress.md#m12-04), [M12-05](learning-and-progress.md#m12-05), [M11-05](ftc-knowledge.md#m11-05) |
| LRN-04 | [M11-07](ftc-knowledge.md#m11-07), [M12-03](learning-and-progress.md#m12-03), [M11-08](ftc-knowledge.md#m11-08) |
| LRN-05 | [M12-01](learning-and-progress.md#m12-01), [M12-04](learning-and-progress.md#m12-04), [M12-05](learning-and-progress.md#m12-05), [M12-07](learning-and-progress.md#m12-07), [M11-09](ftc-knowledge.md#m11-09) |
| LNG-01 | [M1-13](desktop-workspace.md#m1-13), [M11-10](ftc-knowledge.md#m11-10), [M3-07](agent-and-context.md#m3-07) |
| LNG-02 | [M11-01](ftc-knowledge.md#m11-01), [M1-13](desktop-workspace.md#m1-13) |

## Acceptance checklist

The proposal's passing-evidence definitions remain authoritative. These checkboxes are additional release checks, not duplicates of unit-test completion.

- [ ] **AC-01 — New environment:** [M4-07](environment-and-compatibility.md#m4-07). Record evidence in `docs/validation/environment.md`; pending.
- [ ] **AC-02 — Existing project:** [M2-01](projects-and-chats.md#m2-01), [M6-03](ftc-configuration-and-libraries.md#m6-03), [M6-06](ftc-configuration-and-libraries.md#m6-06), [M4-07](environment-and-compatibility.md#m4-07). Record evidence in `docs/validation/environment.md`; pending.
- [ ] **AC-03 — Project/chat organization:** [M2-06](projects-and-chats.md#m2-06), [M3-02](agent-and-context.md#m3-02). Record evidence in `docs/validation/projects-and-chats.md`; pending.
- [ ] **AC-04 — Editor and layouts:** [M5-08](java-development.md#m5-08), [M1-02](desktop-workspace.md#m1-02), [M1-07](desktop-workspace.md#m1-07). Record evidence in `docs/validation/java-development.md`; pending.
- [ ] **AC-05 — Online AI and code modes:** [M3-07](agent-and-context.md#m3-07), [M7-03](ai-access-and-local-inference.md#m7-03). Record evidence in `docs/validation/agent-workflows.md`; pending.
- [ ] **AC-06 — Offline AI and prepared offline work:** [M4-07](environment-and-compatibility.md#m4-07), [M7-08](ai-access-and-local-inference.md#m7-08), [M11-09](ftc-knowledge.md#m11-09), [M12-07](learning-and-progress.md#m12-07). Record evidence in `docs/validation/local-inference.md`; pending.
- [ ] **AC-07 — Library choices:** [M6-06](ftc-configuration-and-libraries.md#m6-06), [M5-08](java-development.md#m5-08), [M11-10](ftc-knowledge.md#m11-10). Record evidence in `docs/validation/ftc-configuration.md`; pending.
- [ ] **AC-08 — Shared hardware definitions:** [M6-06](ftc-configuration-and-libraries.md#m6-06), [M5-02](java-development.md#m5-02), [M1-06](desktop-workspace.md#m1-06). Record evidence in `docs/validation/ftc-configuration.md`; pending.
- [ ] **AC-09 — Dashboard and diagnostics:** [M10-06](diagnostics-and-dashboard.md#m10-06), [M1-09](desktop-workspace.md#m1-09), [M1-14](desktop-workspace.md#m1-14). Record evidence in `docs/validation/diagnostics.md`; pending.
- [ ] **AC-10 — Controller connections and deployment:** [M8-06](controller-connections.md#m8-06), [M9-09](robot-approvals-and-operations.md#m9-09). Record evidence in `docs/validation/robot-operations.md`; pending.
- [ ] **AC-11 — Robot action boundaries:** [M9-07](robot-approvals-and-operations.md#m9-07), [M9-08](robot-approvals-and-operations.md#m9-08), [M9-09](robot-approvals-and-operations.md#m9-09). Record evidence in `docs/validation/robot-action-isolation.md`; pending.
- [ ] **AC-12 — Learning outcome:** [M12-07](learning-and-progress.md#m12-07), [M11-10](ftc-knowledge.md#m11-10). Record evidence in `docs/validation/learning.md`; pending.
- [ ] **AC-13 — Bilingual experience:** [M1-13](desktop-workspace.md#m1-13), [M11-10](ftc-knowledge.md#m11-10), [M3-07](agent-and-context.md#m3-07). Record evidence in `docs/validation/localization.md`; pending.

## Design evaluation gates

- [ ] **Module independence:** [M1-12](desktop-workspace.md#m1-12); all twelve isolated suites, port contracts and fresh-scope disposal pass.
- [ ] **FTC-aware editor:** [M5-03](java-development.md#m5-03), [M5-08](java-development.md#m5-08), [M4-07](environment-and-compatibility.md#m4-07); actual Android/FTC/pathing symbols on both platforms, separate JDKs and prepared offline operation.
- [ ] **Managed local AI:** [M7-08](ai-access-and-local-inference.md#m7-08), [M3-07](agent-and-context.md#m3-07); measured runtime/model/backend/capability and local-only evidence.
- [ ] **Project execution:** [M2-06](projects-and-chats.md#m2-06), [M3-02](agent-and-context.md#m3-02); duplicate-window races, aliases, interruption, draft non-execution and independent projects.
- [ ] **Shared and personal state:** [M6-06](ftc-configuration-and-libraries.md#m6-06), [M2-06](projects-and-chats.md#m2-06), [M12-06](learning-and-progress.md#m12-06); external-file conflicts, restart and language continuity without shared personal data.
- [ ] **Panels display and data:** [M8-04](controller-connections.md#m8-04), [M10-06](diagnostics-and-dashboard.md#m10-06), [M1-09](desktop-workspace.md#m1-09), [M1-14](desktop-workspace.md#m1-14); resources, forwarding, observations, freshness and mediated/blocked writes; external fallback retains data.
- [ ] **Robot action mediation:** [M9-07](robot-approvals-and-operations.md#m9-07), [M9-08](robot-approvals-and-operations.md#m9-08); real OS bypass attempts fail across command/build/extension/dashboard paths.
- [ ] **Deployment and control:** [M9-09](robot-approvals-and-operations.md#m9-09); actual supported controllers/transports, approvals, state confirmation and no replay.
- [ ] **Complete learning experience:** [M11-10](ftc-knowledge.md#m11-10), [M12-07](learning-and-progress.md#m12-07); both languages/tracks, restoration and independently explained/applied capstones.

## Evidence and completion rules

Each validation record identifies task/requirement/AC, commit, date, OS/architecture, toolchain/SDK/library/Panel/model/runtime versions as relevant, fixture versus real system, exact commands and outcomes. Robot rows additionally identify controller, transport, project/build digest, action context, observation time and confirmed/failed/unknown outcome. Link logs/screenshots/artifacts only when actually collected; exclude credentials.

`docs/compatibility-matrix.md` is created/updated by the evaluation tasks and records tested combinations, unsupported combinations and not-run rows. Future new-project/model selection may use only evaluated combinations. External Panels display is the agreed fallback; missing telemetry/editor/action-mediation/learning functionality remains unresolved scope, not a silent downgrade.

The first release is complete only when all module, acceptance and evaluation boxes pass and [M1-14](desktop-workspace.md#m1-14) records packaged-platform evidence. Documentation generation, fixture builds, dashboard screenshots and code compilation alone do not satisfy physical-robot or student-learning requirements.

## Execution log — 2026-10-06

Execution authorized by `docs/prompt.md`. Implementation baseline `d7aca195c0a47fadb0fc3788eefbe96f99ec68be`. Existing `docs/prompt.md` and all task plans were untracked and preserved. Branch: `ftc-workspace`. Counts reconciled: **0/94 tasks, 0/12 modules**; all acceptance/evaluation gates pending.

Preflight: [dependency/ownership scan](../validation/execution-preflight.md), [exact task index](../validation/task-index.json). 94 unique IDs; no missing prerequisites or dependency cycles. Rulings and all shared-file/task consistency rows are recorded in preflight.

| Task | Owner | Status | Dependencies / allowed paths | Evidence / next action |
| --- | --- | --- | --- | --- |
| M9-07 | `/root/m9_07` | BLOCKED | None; four task files plus owned probe evidence; no production enablement | [Brief](../validation/M9-07-brief.md); evaluate available OS boundary, record unavailable Windows/physical gates |
| M4-01 | `/root/m4_01` | DONE | No prerequisite; canonical profile schemas and resolver | Approved at `f7d2a93eabae724f29875a29840b000cee8749fb`; [report](../validation/M4-01-implementation.md), [review](../validation/M4-01-review.md) |
| M5-03 | `/root/m5_03` | BLOCKED | Available-host evaluation independently approved at `8dfc591ed`; Windows/import/production provenance/isolation gates open | [Report](../validation/M5-03-implementation.md), [review](../validation/M5-03-review.md); no support promotion |

| M8-01 | `/root/m8_01` | DONE | Approved `858c8d070`; fixture-based discovery and scoped read cleanup | [Report](../validation/M8-01-implementation.md), [review](../validation/M8-01-review.md); later real-device/platform gates remain open |

| M8-04 | `/root/m8_04` | BLOCKED | Available-host subset approved at `7c11931c2`; real ADB/hardware/Windows/identity/log/dashboard gates open | [Report](../validation/M8-04-implementation.md), [review](../validation/M8-04-review.md); no production promotion |

| M2-01 | `/root/m2_01` | IN_PROGRESS | No prerequisites; four task files, canonical Schema export, generated migration files and owned report/logs | [Brief](../validation/M2-01-brief.md); canonical-root associations with actual temporary SQLite and preserved files |

Recorded execution priority: M9-07 evaluation first; M4-01 then early M5-03 evaluation; M8-01 then early M8-04 evaluation. Current task states above and latest execution entries below supersede this initial ordering. Continue independent canonical-contract work when evaluation gates block. Only coordinator edits this ledger/checklists; one product-code writer at a time.

- Tooling: pinned Bun 1.3.14 and 4663 locked packages installed successfully. Baseline Session suite passes 127/127 with isolated test data; Schema baseline has two existing event-manifest expectation failures; App/Schema typechecks pass. [Evidence](../validation/baseline.md).
- Read-only reviewer `/root/dependency_audit` completed [canonical-contract scheduling audit](../validation/dependency-audit.md). Ruling: publish M2 gate, M5 edit/artifact, and M8 identity/connection Schema records through their owners before consumers; explicitly reserve omitted Schema/API registration paths when needed. Fixture ports do not duplicate contracts or satisfy production evaluation gates.

- M9-07 implementation candidate: `fbea951a3`; available host subset 8 pass / 4 explicitly NOT RUN / 0 fail; Core/Desktop typechecks and scoped lint/format pass. [Report](../validation/M9-07-implementation.md). Task gate remains BLOCKED by listed mandatory real-platform checks; independent review pending.

- M9-07 independent review requires process-tree timeout cleanup and listener acquisition cleanup. [Review](../validation/M9-07-review.md). Fix round 1/5 assigned to the same implementer; no task completion credited.

- M9-07 fix round 1/5 candidate `705d41839`: descendant-cleanup regression RED 3 failures, GREEN 3 pass / 12 assertions; host subset 11 pass / 4 NOT RUN / 36 assertions; Core/Desktop types, lint and format pass. Scoped re-review pending; external gates remain blocked.

- M9-07 scoped re-review approved `705d41839`: both findings addressed, no new breakage. Feasible subset reviewed; task remains **BLOCKED**, checkbox open. Unblock requires Windows execution, physical controller/USB evidence, real broker/extension/Electron boundaries and isolated FTC build compatibility; see [gate rows](../validation/robot-action-isolation.md#unresolved-mandatory-gates).
- M4-01 dispatched next, review base `705d41839dc1e64e12343c62777ce500e022d3a1`. Owner `/root/m4_01`; **IN_PROGRESS**; no prerequisites. Allowed four exact task paths plus its report/logs (Schema export only if required); [brief](../validation/M4-01-brief.md). Verification: focused actual resolver tests, Schema/Core types, scoped lint/format. Current counts **0/94 tasks, 0/12 modules**.

- Ruling (M4-01): omitted project-version constraints are unconstrained for profile selection; supplied versions match exactly and multiple matches return unsupported/ambiguous. Profiles must still pin complete toolchains. Reason: new-project selection can precede dependency detection. Consequence: a matched selection alone does not certify an imported project whose dependencies remain unknown; inspection/readiness owns that gate.
- M4-01 verification ruling: focused new resolver/Core tests plus full affected Schema suite, both package types and scoped lint/format satisfy this task. The user prompt requires affected regression checks; a blanket full Core run would include unrelated external/runtime suites. Integration milestone suites remain required later.

- M4-01 candidate `88890fecfa5a40ecde88f08fbeb8308fe23076e0`; **IN_REVIEW** by `/root/m4_01_review`. Focused 31 pass / 63 assertions; Schema contracts 8 pass; Core/Schema types and lint/format pass; full Schema 13 pass / 2 unchanged baseline failures. [Report](../validation/M4-01-implementation.md), [complete task diff](../validation/M4-01-review.diff). Worker returned DONE_WITH_CONCERNS for existing baseline failures/unrun later evaluations; no completion credited until review.

- M4-01 review found Important version-pinning gap: `latest.release`, `latest.integration` and `1.+` match despite being dynamic. [Review](../validation/M4-01-review.md). Status **IN_PROGRESS**, fix round 1/5 to same `/root/m4_01`; preserve exact build metadata and add artifact/constraint regressions. No task completion credited.

- Existing production App benchmark baseline completed: 7/7 pass in 13.1 minutes, isolated preview/browser, App source unchanged. Raw output and status-bearing metrics saved in [baseline record](../validation/baseline.md#production-renderer-performance-baseline). No existing app/server restart. Future Session/timeline UI changes must compare applicable scenarios against this baseline.

## Interrupted execution handoff — 2026-10-06

Execution was interrupted while M4-01 fix round 1 was finishing. No new task dispatched after interruption. Reconciled live workers: `/root/m4_01` interrupted; M4/M9 reviewers completed; no active implementation worker. Completed benchmark process exited 0 and its preview listener closed.

Current branch `ftc-workspace`, HEAD `88890fecfa5a40ecde88f08fbeb8308fe23076e0`. **0/94 tasks, 0/12 modules complete**. M9-07 available subset approved at `705d41839`; full task BLOCKED by recorded platform/physical gates. M4-01 remains IN_PROGRESS; initial candidate committed, review fix remains uncommitted in Schema/test/report and `docs/validation/m4-01/fix1-*` evidence. Fix report states 54 focused passes/89 assertions, 8 Schema contract passes, Schema/Core types and scoped lint/format pass; independent scoped re-review is still required. Do not credit task completion yet.

Next action on explicit resumption: resume same `/root/m4_01` to reconcile its existing fix and complete scoped commit; avoid repeating completed tests unless code changes or evidence is invalid. Give same `/root/m4_01_review` the fix-only stable diff from `88890fecfa5a40ecde88f08fbeb8308fe23076e0`, require verdict on dynamic selectors and new breakage. Then reconcile task/substep counts if approved. Only after M4-01 is complete dispatch M5-03 from prepared exact brief; then M8-01/M8-04. Preserve all uncommitted coordinator docs and worker files; no reset/cleanup. Main evidence checkpoint commit remains pending.

## Resumed execution — 2026-10-06

User explicitly requested continuation. Reconciled `ftc-workspace` at `88890fecfa5a40ecde88f08fbeb8308fe23076e0`; preserved all coordinator docs and pending M4-01 repair. Resumed same `/root/m4_01` for scoped commit; existing tested source identities/evidence retained. Next is scoped re-review, then M5-03 after completion. Counts remain **0/94 tasks, 0/12 modules**.

- M4-01 fix round 1 committed `fff70c0e14d50d68cdc77865cd8d123394a8d059`; saved source blobs/evidence unchanged, 54 focused passes / 89 assertions and 8 Schema contract passes; types/lint/format pass. **IN_REVIEW** by same `/root/m4_01_review` against [fix-only diff](../validation/M4-01-fix1-review.diff).

- M4-01 fix round 1 re-review found same pinning defect still open for Gradle `latest.milestone` / custom status family. **IN_PROGRESS**, round 2/5 to `/root/m4_01`, base `fff70c0e14d50d68cdc77865cd8d123394a8d059`. Reject whole `latest.<status>` family rather than enumerated examples; [review](../validation/M4-01-review.md). No new unrelated findings; no completion credited.

- M4-01 fix round 2 committed `f7d2a93eabae724f29875a29840b000cee8749fb`; eight new RED failures then 62 passing tests / 97 assertions, Schema regressions 8/8, Core/Schema types and lint/format pass. **IN_REVIEW**, same reviewer and [fix-only diff](../validation/M4-01-fix2-review.diff).

- M4-01 **DONE** at `f7d2a93eabae724f29875a29840b000cee8749fb`, final scoped review approved with no open findings. 62 focused tests / 97 assertions, 8 Schema contracts, both package types and lint/format pass; two unchanged Schema baseline failures remain unrelated. Canonical profile schemas and pure whole-combination resolver are ready; production catalog deliberately empty. Checked exactly M4-01 task and five substeps. **1/94 tasks, 0/12 modules**; next M5-03 evaluation.

- M5-03 **IN_PROGRESS**, owner `/root/m5_03`, review base `75f1038c48f7b5c9afbbba91fef837d2a7794506`; M4-01 verified complete. [Exact brief](../validation/M5-03-brief.md). Allowed task paths plus owned Java-import fixtures/report/logs; no composition, manifests or generic process enablement. Verify actual JDT LS candidate FTC/Android/generated/Pedro/Road Runner symbol behavior on available host; record Windows/unavailable prerequisites explicitly. Existing Android Studio JBR21 and cached FTC/Gradle/Pedro assets are candidate inputs only.

- Concurrent read-only investigation `/root/m8_protocol_preflight` prepares pinned Panels source facts for later M8-04. No checkout mutations, product implementation, device access or completion claim; allowed primary-source inspection and owned temporary downloads only. M5-03 remains the sole product-code writer.

- Prepared M2-01 migration ownership before future dispatch: its task explicitly requires generated migrations but omits generated paths. Reserved only new migration plus Core schema.json/schema.gen.ts/migration.gen.ts and Schema barrel, using existing Core generator. Baseline 18 migration tests pass and migration --check passes. [Prepared brief](../validation/M2-01-brief.md). No M2 implementation dispatched yet.

## Interrupted execution handoff 2 — 2026-10-06

User interruption reconciled: `/root/m5_03` and `/root/m8_protocol_preflight` interrupted; M4 reviewer complete. No new worker dispatched afterward. A filtered process inventory found no remaining task-owned Java-import/Panel processes matching the verified task roots; no process termination was needed.

Branch `ftc-workspace`, HEAD `75f1038c48f7b5c9afbbba91fef837d2a7794506`. Counts **1/94 tasks, 0/12 modules**. M4-01 DONE with independent review, final code `f7d2a93eabae724f29875a29840b000cee8749fb`; reviewed evidence/checklists committed in 75f1038c4. M9-07 remains BLOCKED by external gates.

M5-03 is partial and uncommitted: language-service.ts, java-import adapter/evaluation tests and fixtures exist. No implementation report or final GREEN/typecheck evidence yet. `docs/validation/m5-03/red.log` records one intended not-implemented behavioral failure; `gradle-native.log` records a malformed owned Groovy init script at `/private/tmp/m5-03-tools/native-init.gradle:1`, not an FTC compatibility failure. Worker verified installed JBR 21; downloaded JDT LS 1.46.1-202504011455 with matching official checksum; FTC v11.1 resolved to 203c2d373765f0c66d121e3ec1cc3a18835f6534. Assets remain in `/private/tmp/m5-03-tools`; real symbol outcomes are still unverified.

Next on resumption: continue same `/root/m5_03`, fix its evaluation init script, complete real host probes and covering tests, report/commit, then independent review. Resume `/root/m8_protocol_preflight` read-only to finish its source audit; [partial handoff](../validation/M8-04-source-preflight.md) retains reported findings and exact temporary root. Then M8-01/M8-04; M2-01 brief and DB baseline are prepared. Preserve all uncommitted worker/coordinator files. Do not re-dispatch M4-01 or rerun its unchanged tests.

## Resumed execution 3 — 2026-10-06

Explicit user continuation received. Reconciled `ftc-workspace` at `75f1038c48f7b5c9afbbba91fef837d2a7794506` with the exact saved partial source/evidence; no user changes discarded. Same `/root/m5_03` resumed as sole product writer; same `/root/m8_protocol_preflight` resumed read-only. M4-01 remains complete; counts **1/94 tasks, 0/12 modules**. Next after M5 evidence/review: M8-01, early M8-04, then canonical project storage work.

- Read-only Panels preflight completed; [source audit](../validation/M8-04-source-preflight.md) pins both repositories and npm dependency with archive/integrity evidence. Critical design inputs: frontend fixed 8002 routing, no stable physical identity in examined payloads, textual telemetry/log limitations, plugin mutations/queue behavior and optional Limelight routes. Source-derived fixtures only; all real endpoint/forwarding/platform/mediation gates remain NOT RUN. No completion credited to M8-04.

- M5-03 interim evidence: corrected actual FTC probe compiles with Gradle (`gradle-native-compile.log`, BUILD SUCCESSFUL); pinned JDT LS native-import run still fails symbol checks (`native-test.log`/`native-result.json`). Worker is evaluating the planned Gradle-derived classpath fallback; no support claim or task completion. Earlier missing-cache/malformed-init/wrong generated-symbol attempts remain setup evidence only.

- M5-03 interim update: actual native FTC/Pedro 2.1.2/Road Runner core 1.0.1 projects compile, but pinned JDT LS 1.46.1 native Android import fails. Gradle-derived shadow baseline passes FTC/Android/generated BuildConfig completion/definition/valid+invalid diagnostic checks; separate pathing shadow probes are pending. No M5-03 completion or supported-combination promotion yet. Worker reports owned SDK auto-download platform-tools 37.0.1 reused byte-identical preexisting license state; installed user SDK 35.0.1 unchanged, subsequent commands disable auto-download. Final report will retain exact provenance.

- Ruling: retain owned `/private/tmp/m5-03-tools` pinned tools, sources, caches/setup scripts and import artifacts through independent review/follow-on work — reproducibility and reuse require them; stopped processes and disposable per-run scratch cleanup provide runtime disposal. No user project/SDK files are cleanup targets. Coordinator will own any later targeted asset cleanup. Worker reports no remaining owned JDT/Gradle processes between probes.

## Resumed execution 4 — 2026-10-06

User requested continuation. Reconciled `ftc-workspace` at `8dfc591ed4307a8c51ac5af3d6c32310ecbabeac`; preserved all coordinator documents. M5-03 available-host evaluation is committed and enters independent review against base `75f1038c48f7b5c9afbbba91fef837d2a7794506`. Native pinned JDT LS Android import failed on compiling fixtures; Gradle-derived shadows passed tested symbol checks on macOS. Covering suite: 13 pass, 11 skip, 0 fail; typecheck/lint/format passed. Windows and production gates remain open; no task checkbox changed. Counts remain **1/94 tasks, 0/12 modules**. Next after review/fixes: M8-01, M8-04, then M2-01. Retain owned M5 tool assets through review.

- M5-03 independent review by `/root/m5_03_review`: available-host specification and quality approved at `8dfc591ed4307a8c51ac5af3d6c32310ecbabeac`; no Critical/Important findings. Reviewer independently verified all 136 retained shadow inventory digests. Full task remains **BLOCKED** by Windows ownership/import, production integration/runtime provenance/isolation. Checkbox remains open. [Review](../validation/M5-03-review.md).
- M5-03 minor (deferred): failed Gradle cleanup may skip temporary-directory removal; use inner finally later (`m5-03.test.ts:120`).
- M5-03 minor (deferred): probe stores selected responses/notifications rather than complete outgoing-request/response envelopes; retain request parameters for stronger per-run audit (`probe.py:26`). Current source and response edits support observations.
- M5-03 minor (deferred): explicitly annotate upstream compiler deprecation notes in validation output (`gradle-native-compile.log:14`); do not modify preserved FTC sources. These three minors are carried into final whole-branch review.
- Read-only `/root/m7_runtime_preflight` is checking existing inference/credential contracts and installed local-runtime prerequisites. No product edits, secret inspection, model downloads or service calls authorized by this assignment.

- M8-01 dispatched to fresh `/root/m8_01`, review base `4082deb639d4aca5451d9df2580d06c74e6bb34a`. No prerequisites; sole product-code writer. Allowed exact task files, canonical Schema export and owned report/logs. Verify discovery states/multiple/empty/malformed/error and cleanup with injected read transport; no actual ADB daemon/device/mutation. Core/Schema types and affected contract checks required. Counts **1/94 tasks, 0/12 modules**.

- Read-only `/root/m7_runtime_preflight` completed; [report](../validation/M7-runtime-preflight.md). Reusable existing model routes/LLM streams and secret-bearing credential paths identified. Bounded conventional runtime/model inventory found no installed candidate. No services/secrets/downloads/tests touched; M7-08 remains unrun. Coordinator retains verified pinned Bun/hardware baseline. M8-01 is sole product writer.

- Ruling (M8-01 interface): successful empty discovery returns `[]`; missing-tool/transport/malformed-response are typed failures rather than invented candidates. Candidate state and authorization remain separate; unrecognized states stay unavailable with explanatory codes. Reason: the source specifies an array of actual candidates. Consequence if wrong: consumers must revise their failure mapping; no hardware/identity guarantee follows from discovery.
- Prepared M3-01 and M4-02 briefs for later sequential dispatch. M4-02 explicitly owns required Readiness/ToolchainDescriptor additions to the existing canonical Schema domain despite omission from the task Files line, following the recorded first-method contract rule. No implementation dispatched for these tasks.

- M8-01 interim verification: 18 focused tests / 65 assertions pass; initial RED was behavioral (stubbed empty discovery, no import failures). Initial GREEN corrected a test-only Effect 4 Fiber API assumption; original log retained. Typechecks, Schema regression and scoped lint/format pending.
- Ruling (M8-01 verification): use task-focused Core regression for new unregistered port-only modules, affected Schema contracts/full Schema baseline comparison, changed-package types and scoped lint/format. No blanket external/runtime Core suite is justified by this change; cross-module milestone suites remain mandatory. Reason: developer instruction limits expanded checks to new changes/unresolved concerns; consequence if wrong: an unrelated interaction could escape until integration coverage, so any new concrete shared-boundary concern triggers focused expansion.

- M8-01 candidate `858c8d070afedde5ed9dd0cacb76f05577757556`: 22 focused tests / 81 assertions, Core/Schema types, 8 Schema contracts, lint/format pass. Full Schema suite has only the two documented baseline failures. Fixture-only parsing/lifecycle; no physical or Windows support claim. [Report](../validation/M8-01-implementation.md). Stable review package prepared; independent review pending.

## Interruption handoff 4 — 2026-10-06

Execution was deliberately interrupted while M8-01 independent review was running. Reconciled workers: `/root/m8_01` completed, `/root/m7_runtime_preflight` completed, `/root/m8_01_review` interrupted; no active implementation worker. Parent shell commands had completed. M8-01 created no processes/listeners/real ADB connection; no user service was touched.

Current branch `ftc-workspace`, HEAD `858c8d070afedde5ed9dd0cacb76f05577757556`. M8-01 implementation is committed, 22 focused tests / 81 assertions pass; Core/Schema types, 8 Schema contracts, lint/format pass. Two full-Schema failures match baseline. Task stays **IN_REVIEW**, unchecked until reviewer verdict. Stable full review diff `docs/validation/M8-01-review.diff`, base `4082deb639d4aca5451d9df2580d06c74e6bb34a`. Report `docs/validation/M8-01-implementation.md`. Counts remain **1/94 tasks, 0/12 modules**.

M5-03 available-host subset is independently approved at `8dfc591ed4307a8c51ac5af3d6c32310ecbabeac`, task remains BLOCKED; three deferred minors recorded above and in its review. Coordinator evidence checkpoint commit `4082deb639d4aca5451d9df2580d06c74e6bb34a` preserves Java review, M8 source audit, M2/M3 briefs and baseline evidence. Current uncommitted coordinator-only files include progress, M8-01 brief/review diff, M4-02 brief, M7 preflight and dependency audit. Preserve them.

Next on explicit resumption: continue same `/root/m8_01_review` with stable diff/brief/report; request separate specification and quality verdicts without redoing already-read sections or unchanged tests. If findings, use original `/root/m8_01` for bounded fixes and scoped re-review. If approved, reconcile M8-01 checklist/counts, then dispatch fresh M8-04 from prepared exact brief using the current canonical ControllerCandidate/DiscoveryError/Adb.DiscoveryTransport contract. M8-04 must retain the source audit's fixed WebSocket port, missing stable identity/log route, source-derived fixture and mutation-boundary limitations; physical/Windows gates remain NOT RUN. Follow with M2-01; M3-01 and M4-02 briefs are also prepared and checked against exact task-index excerpts. Do not rerun completed M4/M5/baseline checks without changed behavior or concrete unresolved risk. Retain `/private/tmp/m5-03-tools` and `/private/tmp/m8-panels-preflight-11d69a98` for upcoming work.

## Resumed execution 5 — 2026-10-06

Explicit continuation received. Reconciled `ftc-workspace` at `858c8d070afedde5ed9dd0cacb76f05577757556`, preserving coordinator changes. Harness lists only `/root`; previous implementation/reviewer agents are no longer resumable. Therefore dispatch a fresh M8-01 reviewer with the same brief/report and regenerated stable full diff (`M8-01-review-resume.diff`, base `4082deb639d4aca5451d9df2580d06c74e6bb34a`). This is recovery of the interrupted review, not a second review seat. Existing test evidence stays valid; do not rerun unchanged suites. Counts **1/94 tasks, 0/12 modules**. Next: review/fixes, M8-04, then M2-01.

- M8-01 complete (commits `4082deb639d4aca5451d9df2580d06c74e6bb34a`..`858c8d070afedde5ed9dd0cacb76f05577757556`, independent spec/quality review clean). Checked exactly task entry and five substeps; **2/94 tasks, 0/12 modules**. Physical/Windows/identity/protocol gates remain in later owning tasks.
- Ruling (M8-04 contracts): this task may add canonical endpoint/protocol-evidence records to `packages/schema/src/ftc-controller.ts` when required by its public producer contract, despite omission from task Files. Reserve ControllerIdentity/ConnectionDescriptor lifecycle semantics for M8-02/03. Reason: one canonical producer-owned schema prevents duplicate downstream types; consequence if wrong: these small records may need revision when actual protocol evidence is obtained, and no unverified support claim may be encoded.

- M8-04 dispatched to fresh `/root/m8_04`, sole product writer, review base `4a915eacb41f15bd54cb4617df08b4c181222f6a`. Prerequisite M8-01 independently complete. Allowed exact task paths plus task-owned fixtures/report/logs and canonical endpoint/protocol-evidence records only. Use retained pinned source audit/assets; no device probing, real robot mutation, new production registration or support-catalog promotion. Verify relevant discovery/endpoint/evaluation checks, lifecycle/failure paths, changed package types and scoped lint/format. Counts **2/94 tasks, 0/12 modules**.

- Concurrent read-only `/root/m11_source_preflight` prepares primary-source/version/license/terminology anchors for M11, using evaluated candidate FTC/Pedro/Road Runner versions without promoting support. No product/content/index changes, robot access or license acceptance. M8-04 remains sole product writer.

- M8-04 interim: worker reports 44 source-derived unit tests passing for scoped injected forwarding and narrow protocol reads. Owned loopback HTTP/WebSocket/raw-forward evaluation is in progress; types, final regressions and report remain pending. No real ADB/device access or registration; dashboard control routing stays blocked and robot identity/log/deployed revision evidence remains unknown.

- Read-only M11 preflight complete; [source map](../validation/M11-source-preflight.md). Coordinator verified 38 fetched snapshot hashes against saved provenance. Pedro floating-doc and Road Runner docs/auxiliary/quickstart version gaps are explicit; no compatibility/content completion claimed. Prepared exact M11-01 fixture-validator brief for later dispatch. M8-04 remains sole product writer.

- M8-04 scoped candidate delivered: product `29be4123ad812e66d26d225b899a46fa9b5d233d`, evidence `3e9a64ca554408608ef6078c2e154123f3f687ad`. Required evaluation 3 pass / 5 explicit skips; affected selection 85 pass / 14 skips / 0 fail; Core/Schema types, lint/format pass. [Report](../validation/M8-04-implementation.md), [protocol findings](../validation/controller-protocol.md). Available-host subset enters independent review; full task remains open for actual ADB/hardware/Windows/identity/log/dashboard gates. No production registration or real-device access. Counts **2/94 tasks, 0/12 modules**.

- M8-04 independent review found one Important canonical-evidence validation defect; [review](../validation/M8-04-review.md). Whitespace-only/surrounding-whitespace plugin IDs/versions pass NonEmptyString decoding but violate canonical trimmed Text on successful output. Fix round 1/5 assigned to original `/root/m8_04`, fix base `3e9a64ca554408608ef6078c2e154123f3f687ad`. Add meaningful regressions, reject rather than normalize malformed declarations, rerun covering endpoint/evaluation/discovery tests and changed-package checks.
- M8-04 minor (deferred): interruption tests cover post-acquisition disposal, not pending forward acquisition; validate bounded delayed host acquisition before production use (`controller-endpoints.test.ts:83–108`, `adb.ts:118–121`). Carry to final whole-branch review and actual host transport gate.

- M8-04 fix round 1/5 candidate `7c11931c2a5af1f711dd2d584d15727259141398`: canonical trimmed/nonempty declaration checks, eight real-reader regressions RED→GREEN; covering selection 87 pass / 5 explicit skips / 0 fail / 203 assertions, Core types and scoped lint/format pass. Fix report has exact commands/results/logs. Same reviewer receives fix-only package from `3e9a64ca554408608ef6078c2e154123f3f687ad`; scoped verdict pending.

- M8-04 fix round 1/5 complete (1 Important addressed, 0 open; `3e9a64ca5`..`7c11931c2`). Scoped independent review approves specification/quality of the available-host subset with no new findings. Prior acquisition-interruption Minor remains deferred. Full task **BLOCKED**, unchecked: actual controller/Windows/production ADB/resource graph/identity/log/freshness/dashboard evidence unavailable. Counts **2/94 tasks, 0/12 modules**. Next M2-01 canonical project association.

- M2-01 dispatched to fresh `/root/m2_01`, sole product writer, review base `e65f6c386b4abc97582d4814eb98a9ae3c97045a`. Allowed task files, Schema barrel and explicitly reserved generated migration/snapshot/registry files only. Existing database/migration paths remain unchanged since passing recorded baseline. Verify alias/root identity, persistent reopen, non-mutating folder inspection, distinct roots despite shared upstream IDs, concurrency/failure/cleanup as relevant, migration regression/check, Core/Schema types and scoped lint/format. Public context must map local root to existing Project/Location/Session identities explicitly. Counts **2/94 tasks, 0/12 modules**.

- Ruling (M2-01 identity mapping): canonical ProjectContext.projectID identifies a persisted M2 association per canonicalRoot using the existing Project.ID schema; Location.Info retains the separate existing host project.id/directory and directory=canonicalRoot. Persist both in M2's row without writing/FK into existing Project tables. Reason: the existing resolver shares IDs across roots, while planned createChat({projectID}) must address one local association; high-level-design.md:241 requires explicit mapping. Consequence if wrong/misused: passing an association ID to a host Project API would resolve incorrectly, so document the distinction and test shared upstream IDs/location consistency. Canonical-root gate remains the owner key.
- M2-01 initial behavioral RED established with actual temporary SQLite initialization: 0 pass/1 fail, explicit not-implemented association behavior, no import/migration harness failure. Identity mapping confirmed to worker; implementation proceeds.

- M2-01 interim: 13 new association tests plus 18 migration regressions pass (31 total / 89 assertions); 8 affected Schema contracts / 17 assertions pass. Cases include actual symlink/reopen/content preservation, shared upstream IDs across distinct roots, eight concurrent database connections, cancellation/access/write errors, mapping refresh, fresh scopes and migration preserving existing Project rows. Final types/lint/format/report/commit pending. Prepared M2-02 brief with explicit canonical ChatRef Schema and generated migration ownership, pending reviewed M2-01.

- M2-01 candidate `917fc044bad306de4428e24fb8c2655bfff50e12` enters **IN_REVIEW** against `e65f6c386b4abc97582d4814eb98a9ae3c97045a`. Focused association + migration suite 31 pass / 89 assertions; Core/Schema types, 8 Schema contracts, migration check, lint/format pass. Generator structural audit records only seven new DDL records for the M2-owned table, no changed/removed existing DDL. [Report](../validation/M2-01-implementation.md). Independent reviewer receives complete stable diff; task remains unchecked, counts **2/94 tasks, 0/12 modules**.

- M2-01 **DONE** at `917fc044bad306de4428e24fb8c2655bfff50e12`: independent specification and quality review passes with no findings; coordinator verified all nine tested source hashes against current files. Checked exactly task entry and five substeps. [Review](../validation/M2-01-review.md). Counts **3/94 tasks, 0/12 modules**. Production folder binding/Windows and later chat/gate behavior remain outside this isolated task.
