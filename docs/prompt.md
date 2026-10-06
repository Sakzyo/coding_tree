# FTC Programming Agent — Vibe Coding Starting Prompt

Use the following instructions as the implementation request for this repository. Generating or reviewing this document alone does not start implementation; when the user submits it for execution, begin the work described below.

## Mission and authoritative inputs

You are the main implementation agent and progress coordinator. Adapt this repository's existing OpenCode desktop application into the FTC Java development and learning workspace specified by the source documents. Delegate module implementation to subagents, coordinate their interfaces and dependencies, and run the available development, review, testing, and repair process autonomously.

This delegation is the development workflow used to build the application. It does not introduce another agent execution loop into the product or alter the product's code-change and robot-approval settings.

Read these sources before dispatching work:

1. Root `AGENTS.md`, then applicable package and directory instructions before changing their files.
2. [Requirements proposal](proposal.md): product scope, 48 functional requirements, and AC-01 through AC-13.
3. [High-level design](high-level-design.md): architecture, twelve module boundaries, state ownership, and evaluation gates.
4. [Progress and shared execution rules](tasks/progress.md): global constraints, contract conventions, prerequisite scheduling, traceability, and release gates.
5. Every module plan listed below: exact task IDs, files, interfaces, test assertions, prerequisites, and completion gates.

**Confirmed source choice:** use `docs/high-level-design.md` together with the detailed module plans in `docs/tasks/`. There is no required `docs/detailed-design.md`; do not invent or wait for that file.

The requirements define behavior, the design defines its architecture, and the module plans define the implementation work. This prompt adds execution and verification instructions; it does not remove any first-version requirement. Historical “planning only” labels in those sources do not block execution when the user submits this prompt as an implementation request. Preserve source content and task identities; do not rewrite the product contract to make an incomplete implementation pass.

Use the existing module plans as the implementation plan. Do not restart requirements discovery, regenerate all task plans, or request routine design or execution-method approval. If an implementation detail conflicts with a requirement, preserve the requirement and document the discrepancy; escalate only a decision the sources and repository cannot resolve without changing the agreed contract.

## Main-agent responsibilities

- Own scheduling, integration decisions, worker assignment, independent review, progress accounting, and the final evidence report. Route product code changes and review fixes through implementation subagents.
- Use the harness's actual subagent tools and supported capabilities. Create workers within this task, not separate user-facing chats. Do not claim delegation, execution, or review occurred without a corresponding worker report and verifiable result.
- Use the installed Superpowers workflow, especially `superpowers:subagent-driven-development`, `superpowers:test-driven-development`, `superpowers:requesting-code-review`, and `superpowers:verification-before-completion`. Apply repository and user instructions ahead of skill defaults. The execution method is already selected: subagents implement, and the main agent coordinates.
- Continue between tasks without asking whether to proceed. Answer worker questions from the authoritative sources and verified repository state. Record routine implementation decisions with their rationale and consequences.
- If a genuine ambiguity would change product scope, architecture, a public contract, or an authorization boundary, ask one focused question and keep independent work moving. Never resolve missing robot facts, measurements, credentials, or test results by invention.
- Do not start unrelated work, create a replacement application, or introduce a second model/tool orchestration loop. Minimal, scoped changes must trace to a task and requirement.

## Start and resume procedure

1. Inspect the current branch, commit, working-tree changes, source documents, installed tooling, and applicable instructions. Preserve all existing changes and untracked files. Use `dev` or `origin/dev` for comparison; do not assume `main` exists.
2. Read the current task checkboxes and validation evidence. The prompt-generation baseline was **0/12 modules and 0/94 tasks complete**; this is historical context, not permission to reset later progress. Reconcile checked tasks against the current implementation and evidence before resuming.
3. Build a dependency graph from each task's **Prerequisites**. Check for missing IDs, dependency cycles, and shared-file ownership. Distinguish a consumed contract supplied by a fixture from a prerequisite that requires real implementation or platform evaluation. Record shared-file/interface conflicts and their assigned owner before dispatch; implement canonical contracts once and reuse them in consumers.
4. Record baseline results for relevant existing tests and checks before changing behavior. Record required session/timeline performance baselines before touching that code. Separate existing failures from regressions introduced by this work.
5. Inspect available subagent tools, slot limits, OS runners, local models, SDKs, and authorized test resources. Do not assume Windows, a robot, a provider key, or model downloads are available. If subagent support is unavailable, report that execution-method blocker rather than claiming delegation occurred.
6. Establish an execution log in `docs/tasks/progress.md` and task evidence under `docs/validation/`. Record the next dependency-ready task, its owner, allowed write paths, prerequisites, and verification commands, then dispatch it.

If isolation is needed, reuse a suitable attached worktree or create one without losing the current source documents or user changes. Do not assume untracked task plans automatically transfer into a new worktree. If creating a branch, follow the repository's short, at-most-three-word, hyphen-separated naming rule without slashes. Local focused commits follow the module plans; pushing, merging, publishing, and signing releases require separate authorization.

## Module assignments and scheduling

Every module must receive implementation subagent coverage. Use task IDs as dispatch units; do not give a worker an entire module's integration work before its prerequisites are ready. A module may need several sequential workers as dependencies become available.

| Module | Plan and module responsibility | Tasks |
| --- | --- | ---: |
| M1 | [Desktop workspace](tasks/desktop-workspace.md): Solid views, layouts, independent settings, native dashboard host, bilingual UI, and release composition | 14 |
| M2 | [Projects and chats](tasks/projects-and-chats.md): local associations, chat membership, canonical-root execution gate | 6 |
| M3 | [Agent and context](tasks/agent-and-context.md): Session invariants, code modes, context, tools, and host wiring | 7 |
| M4 | [Environment and compatibility](tasks/environment-and-compatibility.md): compatible toolchains, automatic/guided setup, offline readiness | 7 |
| M5 | [Java development](tasks/java-development.md): documents, revisions, Java services, builds, and artifact identity | 8 |
| M6 | [FTC configuration and libraries](tasks/ftc-configuration-and-libraries.md): shared hardware manifest, inspection, and authorized edit proposals | 6 |
| M7 | [AI access and local inference](tasks/ai-access-and-local-inference.md): protected credentials, providers, local-only enforcement, managed runtimes | 8 |
| M8 | [Controller connections](tasks/controller-connections.md): discovery, controller identity, transports, and connection generations | 6 |
| M9 | [Robot approvals and operations](tasks/robot-approvals-and-operations.md): exact consent, controller coordination, mutation isolation, and outcomes | 9 |
| M10 | [Diagnostics and dashboard](tasks/diagnostics-and-dashboard.md): versioned telemetry/logs, freshness, provenance, and display descriptors | 6 |
| M11 | [FTC knowledge](tasks/ftc-knowledge.md): versioned bilingual references, both course tracks, and offline content | 10 |
| M12 | [Learning and personal progress](tasks/learning-and-progress.md): entry levels, project-linked attempts, and evidence-based progress | 7 |

Use the integration stages in `docs/tasks/progress.md`, rather than treating M1 through M12 as a serial dependency order. Prioritize the early feasibility gates: **M9-07**, **M5-03 after M4-01**, and **M8-04 after M8-01**. They determine production action isolation, actual FTC Java import, and robot protocol support. Start independent fixture-based work while unavailable evaluations remain blocked. Do not bypass those evaluations to enable dependent production adapters.

Use one code-writing implementer at a time in the shared checkout. The main agent alone edits the shared progress ledger and completion checkboxes; workers report completion candidates. Serialize changes to `composition.ts`, host registration, shared schemas, migrations, package manifests, lockfiles, and generated clients. Read-only investigation can run concurrently when it does not inspect a changing review snapshot. Respect the harness's concurrency limit; do not launch all twelve modules simultaneously.

## Worker and review protocol

Give each new task a fresh implementation context, its module responsibility, exact task excerpt, relevant source constraints, and the current consumed interfaces. Preserve the worker's identity so fixes can return to the same implementer. Workers must not spawn additional agents or their own reviewers; the main agent owns delegation and review.

**Task-brief adaptation for these plans:** task headings use `### M1-01 — ...`, not `### Task 1`. Do not pass these plans to the installed Superpowers `scripts/task-brief` helper, which requires `Task N` headings. The coordinator writes `docs/validation/<task-id>-brief.md` directly: locate the single exact `### <task-id> —` heading in its module plan and copy through the end of that task, stopping before the next task's anchor/heading or `## Module completion gate`. Keep all prerequisites, files, interfaces, assertions, commands and completion steps. Add the relevant module/global constraints and the dispatch fields below. Verify exactly one task was selected before dispatch; a missing or duplicate heading is a planning error. Preserve the original IDs and source headings. `docs/tasks/progress.md` remains the authoritative ledger if Superpowers also creates temporary working files.

Use a dispatch brief with this information:

```text
Role: implement task <M#-##> within module <M#>.
Read first: <task brief path>, <module plan>, relevant source sections and AGENTS.md.
Objective and acceptance: <exact task behavior, requirement IDs, assertions, and gates>.
Prerequisites: <verified contracts, completed implementation, and evaluation evidence>.
Allowed write paths: <owned files>; shared-file changes require coordinator assignment.
Current interfaces and decisions: <canonical types, revisions, constraints, relevant rulings>.
Verification: <commands with working directories and required non-unit evidence>.
Report path: docs/validation/<task-id>-implementation.md.
Do not delegate, change scope, weaken checks, or update the shared completion ledger.
Return DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED with evidence and concerns.
Identify the exact tested revision, each completed task assertion, and every unrun gate.
```

Each worker must:

1. Inspect actual implementation and test conventions before editing. Treat planned paths and signatures as work to verify/create, not proof that code exists.
2. For new executable behavior, write a meaningful failing test, run it, and confirm that it fails for the intended reason. Existing invariant tests may already pass; preserve and reuse them without forcing an artificial failure. For evaluation tasks, follow their evaluation checklist: provision available prerequisites, run the actual probe, and record the decision and evidence. Do not force an artificial red/green cycle onto a source review or physical observation.
3. Implement the smallest change that satisfies the task. Run the focused tests, required package typechecks, lint/format checks, and applicable adapter/integration checks. Fix failures autonomously and rerun the affected checks.
4. Self-review the diff for scope, contracts, test validity, and cleanup. Make a focused conventional commit containing only assigned changes when the checkout supports it.
5. Write the report with changed files, commits or exact diff, commands and working directories, results, evidence paths, assumptions, and unresolved checks. A successful command with zero selected tests is not a pass.

After implementation, the main agent supplies a **different reviewer** with the task brief, constraints, report, and a stable diff spanning the complete task. Require separate verdicts for specification compliance and code quality. Inspect evidence rather than accepting a worker's success claim. Resolve any “cannot verify” item against the sources and current code.

A worker's `DONE` is a completion candidate, not permission to check a task automatically. Reconcile the actual files and tested revision with the report, confirm all required assertions and gates, and require the independent review before updating progress. `DONE_WITH_CONCERNS` never hides failed or missing mandatory evidence.

Send actionable findings back to the implementer. Verify repairs with covering tests and a scoped independent re-review. Follow the Superpowers bounded review/fix loop, recording each round and any adjudication. A review retry limit cannot convert a real requirement gap, failed test, or unavailable acceptance check into completion: keep the task blocked or incomplete, preserve the evidence, and advance other ready work. Finish with an independent review of the complete implementation diff and cross-module acceptance coverage.

## Architecture and product constraints

All constraints in `docs/tasks/progress.md` and the module plans remain binding. Pay particular attention to these cross-module rules:

- Extend Electron, Solid, TypeScript/Bun, Effect, and OpenCode Session V2 within existing packages. Keep Java/FTC SDK robot development, macOS and Windows, English and Simplified Chinese, and all twelve independently testable modules in scope.
- Schema contracts contain validated serializable records. Core and Protocol depend on Schema; Server composes Core and Protocol. Client runtime may depend on Schema/Protocol but never Core/Server; `sdk-next` composes Client/Core/Server. Modules consume narrow ports or immutable values, never sibling implementations, private stores, or production bootstrap.
- Keep import-time code free of I/O and process startup. Scope initialization and disposal explicitly. Preserve Location-scoped services and the specified process-global Session, project, and controller coordinators.
- Preserve durable prompt admission before wake, exact retry/conflicting-ID behavior, steer/queue boundaries, one `llm.stream(request)` per provider turn, history reload, and Context Epoch ownership. Do not add automatic post-crash provider replay or use the legacy prompt loop.
- Canonical project roots enforce one active chat per project, including aliases, duplicate windows, prompt/resume/wake races, and interruption cleanup. Different projects remain independent. Drafts in a busy chat never become automatically runnable inputs.
- Preserve imported project files, SDKs, dependencies, custom Java, dirty buffers, and external edits. Keep setup, layout, inference, code mode, robot mode, and language independent. Configuration and source edits use revision checks and the selected code-change workflow.
- M6 owns one shareable `ftc-project.json` for hardware definitions and the managed pathing choice. Keep personal progress, chats, credentials, approvals, telemetry, and machine paths local. Allow PedroPathing, Road Runner, or neither, with at most one managed pathing library. Retain required Road Runner Dashboard/tuning dependencies. Never write or synchronize robot-side hardware configuration.
- M5 binds build evidence to saved source/configuration revisions and the produced APK digest. Failed, dirty, or changed inputs cannot masquerade as a current successful build. Missing language tooling is distinct from zero diagnostics.
- M9 alone authorizes app-issued robot mutations. Deployment, initialization/start, and tuning have separate exact-context consent. Revalidate project/chat, controller identity, connection generation, action parameters, observed state, and artifact immediately before dispatch. Prevent cross-project and USB/Wi-Fi-alias conflicts. No replay after reconnect/restart; disconnect does not prove a robot stopped.
- Prove action isolation at actual command/build/extension/dashboard execution boundaries through M9-07/M9-08. Prompt instructions and command-name/PATH filtering alone are insufficient. Keep unproven execution paths disabled. Dashboard content has no privileged preload bridge; repository/log/reference text cannot approve actions.
- Agent-readable telemetry remains independent of dashboard rendering and survives the agreed external-display fallback. Distinguish missing, stale, disconnected, malformed, and valid-zero observations; preserve controller and build provenance.
- Offline inference is verified local-only, without remote redirects, cloud proxying, or fallback. Prepared offline work may use the robot's local network. Protect provider credentials with the OS facility; never expose them through ordinary renderer listings, context, logs, or project files.
- Monaco/JDT LS, llama.cpp, storage choices, model profiles, exact versions, and hardware minima require their named evaluations. Use pinned, source-verified combinations and measured evidence. Do not convert synthetic test values or “latest” downloads into support claims.
- Use existing typed i18n and package-required terminology review. Preserve existing English source wording, placeholders, code/API/device names, and stable lesson IDs. Learning completion requires the specified explanation, application, and physical evidence; page visits and builds alone are insufficient.

## Automated verification

Own the full available test cycle: provision ordinary development dependencies, write tests, execute them, diagnose failures, implement repairs, and collect evidence without asking the user to run commands or interpret logs. Inspect scripts before running them and use the repository's pinned tooling and existing harnesses. Keep local test servers and data isolated; do not restart the user's existing app or server.

Complete unit coverage means every new or changed public behavior and applicable task assertion has tests covering normal inputs, invalid/conflicting inputs, failure, cancellation, persistence/reopen, concurrency, and cleanup as relevant. Add regression tests for discovered bugs. Do not duplicate production logic in tests, mock the module under test, weaken assertions, blanket-suppress typing/lint failures, or skip failing tests to make the suite green. Avoid global replacements; use real temporary files/databases and small explicit external ports.

Each isolated module suite must construct and test the actual module without booting a sibling module, full backend, Electron, real provider, downloaded model, FTC toolchain, or robot. Production adapter contracts, real-module composition, UI end-to-end tests, and real-system evaluations are additional layers. Construct and dispose fresh scopes repeatedly to detect leaks and hidden shared state.

The paths below are planned test selections until their tasks create them. Verify existence and collected test counts; do not report absent suites as passing. All test and typecheck commands run from the indicated **package directory**, never the repository root; never invoke raw `tsc`.

| Check | Working directory | Command or rule |
| --- | --- | --- |
| Core module unit tests | `packages/core` | `bun test ./test/ftc/<module-slug>`; use the exact slug in the module plan |
| Workspace module DOM tests | `packages/app` | `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc/desktop-workspace` |
| Workspace composed UI tests | `packages/app` | `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc-integration`; separate test-owned backend, outside the isolated module selection |
| Java editor DOM tests | `packages/app` | `bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc/java-development` |
| Existing app unit/browser regression | `packages/app` | `bun run test:unit` and `bun run test:browser`, selecting affected tests during iteration |
| Session regression | `packages/core` | `bun test ./test/session-prompt.test.ts ./test/session-runner.test.ts ./test/session-run-coordinator.test.ts` |
| Module boundaries and lifecycle | `packages/core` | `bun test ./test/ftc-boundaries.test.ts` |
| Real-module composition | `packages/core` | `bun test ./test/ftc-integration` |
| Environment API handlers | `packages/server` | `bun test ./test/ftc-environment.test.ts`; M4-06 must pass before M1-11 consumes its generated APIs |
| External adapter contracts | `packages/core` | `bun test ./test/ftc-adapters`, with documented prerequisites |
| Platform/content evaluation subset | `packages/core` | `bun test ./test/ftc-evaluation/<task-id>.test.ts`; record additional real-system evidence separately |
| Electron policy/IPC tests | `packages/desktop` | `bun test ./src/main/ftc`; supplement with actual host checks |
| Types | Every changed package | `bun typecheck`; include generated consumers and `bun run typecheck:e2e` in `packages/app` when applicable |
| UI end-to-end | `packages/app` | `bun run test:e2e -- <relevant test selection>`, following `e2e/AGENTS.md` and existing Playwright configuration |
| Lint | Repository root | `bun run lint -- <changed source paths>`; use existing Oxlint configuration and fix introduced findings |
| Formatting | Repository root | `bunx --no-install prettier --check <changed supported files>`; format only intended files |
| Public Protocol/HttpApi changes | `packages/client` | `bun run generate`, then `bun typecheck`; never hand-edit `src/generated` or `src/generated-effect` |
| Legacy JavaScript SDK surface changes | Repository root | `./packages/sdk/js/script/build.ts`, then relevant SDK package checks |
| Packaged application | `packages/desktop` on each target OS | `bun run build`, then `bun run package:mac` or `bun run package:win`, plus actual platform smoke checks |

After changed behavior passes focused checks, run the affected package regression suites and the cross-module checks at their integration milestones. At final integration, verify the combined revision, including all twelve isolated suites and applicable composed, UI, adapter, type, lint, format, generated-client, and build gates. Run required performance comparisons when session/timeline behavior changes. Repeat checks after fixes that invalidate their evidence; avoid rerunning unchanged suites without a reason.

## Unavailable resources and physical evidence

**Confirmed autonomy boundary:** automate all available tests and fixes; explicitly block unavailable physical/platform checks and never claim full release acceptance from them.

Use existing authorized resources and automate real-system checks where possible. If a required OS runner, controller, toolchain, model, credential, physical observation, or student capstone evidence is unavailable, record `BLOCKED: <specific reason>` or `NOT RUN: <missing prerequisite>`, identify the affected tasks and acceptance scenarios, and keep their boxes unchecked. Continue all independent ready work. Prepare reproducible harnesses and exact rerun instructions instead of asking the user to execute the test process.

Synthetic robot events and scripted approvals may exercise policies in tests; they are not real consent, controller operation, student explanation, or physical validation. Autonomous development does not grant blanket authorization to install/start/tune a real robot, accept licenses for the user, or bypass OS permissions. Missing authorization is a blocker for that action, not permission to simulate a passing real-world result.

Retain required gates even when they prevent downstream production enablement. Cross-compiling a Windows artifact on macOS does not establish Windows runtime support. A passing model API fixture does not establish local-model capability. A dashboard screenshot does not establish telemetry access. The agreed external Panels display fallback does not remove telemetry, action-mediation, editor, or learning requirements.

## Progress, evidence, and completion

Maintain `docs/tasks/progress.md` as the authoritative progress ledger, and update the owning module's task/substep boxes only after checking their evidence. Count completed entries in each module's **Task checklist**, not all nested substeps. Keep module, task, acceptance, and evaluation totals distinct.

For every dispatch, review, fix, and completion, record task ID, owner, status, dependencies, affected files/commit, next action, and evidence links. Use statuses such as `PENDING`, `IN_PROGRESS`, `IN_REVIEW`, `BLOCKED`, and `DONE`. Separate “implementation and isolated tests pass” from full task/module completion where platform or physical gates remain open. Record decisions as `Ruling: <decision> — <reason> — <consequence if wrong>`.

Provide concise progress updates with completed task/module counts, current work, and changed blockers. These are status reports, not checkpoints requiring a reply. When a worker blocks, record what would unblock it and dispatch another dependency-ready task. End only when the required work is verified, the user stops execution, or every remaining task is blocked by a recorded prerequisite or required decision.

Validation reports must contain task/requirement/AC IDs, date, tested revision, environment and versions, exact commands and working directories, exit results/test counts, fixture versus real-system classification, and collected logs/artifacts. Robot evidence additionally identifies controller/transport, project/build digest, action context, timestamps, and confirmed/failed/unknown outcome. Keep secrets out of all reports. Update `docs/compatibility-matrix.md` only from the evaluations; retain unsupported and not-run rows explicitly.

Before ending an execution session or handing off after context limits, reconcile live workers, save their state and pending reviews, update the ledger, and record the exact next ready tasks. On resumption, read the ledger and evidence rather than redispatching completed work. Retain durable validation evidence and never delete user files or sibling worktrees as cleanup.

Claim full first-release completion only when all 94 task gates, all twelve module gates, AC-01 through AC-13, the design evaluations, and M1-14's packaged macOS/Windows evidence pass. If new approved task changes alter the count, explain and update that baseline explicitly. Any required failed or unrun gate keeps release acceptance incomplete.

The final implementation report must state completed modules/tasks, actual tests and checks with evidence links, packaged artifacts if produced, unresolved findings/blockers, next dependency-ready work, and recorded rulings. If all currently executable work is complete but external validation remains unavailable, report that precise state without calling the product fully complete.

Begin execution by reading the sources, reconciling the current progress, and dispatching the first dependency-ready task. Continue through implementation, independent review, verification, and repair without routine human checkpoints.
