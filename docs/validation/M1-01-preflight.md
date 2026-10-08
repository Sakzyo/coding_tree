# M1-01 desktop workspace preflight

Date: 2026-10-08. Read-only investigation for the coordinator; this is neither an implementation candidate nor completion evidence. Only this report was written. No product edits, commits, test execution, app/server restart, downloads, or additional agents were performed. Changing M9 files and learning implementation files were not inspected.

## Decision

M1-01 is ready for a **standalone, supplied-port implementation** after its exact brief and write allowlist are assigned. Its declared prerequisites are none. Keep it within a Solid workspace frame, browser-safe project/chat contracts, local selection/draft state, and recorded command/query/status ports. M2 owns associations, membership and execution admission; M3 owns conversation history and execution. No production frontend/backend composition or execution enablement belongs in this task.

The current checkout has canonical M2 records and registered endpoints. `packages/app/src/ftc/` and `packages/app/test-browser/ftc/` do not exist yet. Creating the three planned M1-01 files is appropriate; migrating the existing application route, replacing its chat implementation, or widening backend contracts is unnecessary for this task.

## Authoritative scope and inspected sources

- [Root instructions](../../AGENTS.md) and [app instructions](../../packages/app/AGENTS.md): surgical changes, `createStore`, package-local tests/typecheck, typed localization, no app/server restart, session/timeline benchmark before changes to those files.
- [Implementation prompt](../prompt.md): one product writer in the checkout, coordinator-owned shared files/ledger, worker reports rather than completion credit, isolated modules and separate production composition.
- [Exact M1-01](../tasks/desktop-workspace.md#m1-01): consumes ProjectContext/ChatRef/status through supplied facades; emits create/open/chat/submit/stop commands and retains unsent drafts. Core assertions: active owner identity, no submitted drafts, another project enabled. Smallest implementation reuses chat presentation and `createStore`; scoped cleanup is required.
- [Proposal PRJ-01–PRJ-04](../proposal.md): multiple local projects and separate chat histories/context; one active chat per project; different projects may run concurrently; idle transition never executes an unsent draft.
- [High-level design](../high-level-design.md), sections 3, 5, 6 and M1 isolated-test row: M1 owns UI composition/view state; modules consume narrow ports; histories stay Session-owned; user commands preserve exact targets; unmount removes subscriptions.
- [Shared rules](../tasks/progress.md#contract-conventions) and [M2 plan](../tasks/projects-and-chats.md): canonical contracts, structured errors, cancellation/cleanup, folder association rather than project-template generation.
- [Canonical project Schema](../../packages/schema/src/ftc-project.ts), [prompt Schema](../../packages/schema/src/prompt-input.ts), public M2 service declarations in [projects.ts](../../packages/core/src/ftc/projects.ts), [M2 Protocol group](../../packages/protocol/src/groups/ftc-project.ts), and existing generated Client M2 method declarations. These are read-only references, not browser runtime imports of Core.
- Current app conventions: [SDK context](../../packages/app/src/context/sdk.tsx), [server SDK context](../../packages/app/src/context/server-sdk.tsx), [language context](../../packages/app/src/context/language.tsx), [prompt ownership](../../packages/app/src/context/prompt.tsx), [PromptInput](../../packages/app/src/components/prompt-input.tsx), [PromptInput contracts](../../packages/app/src/components/prompt-input/contracts.ts), [router cleanup DOM test](../../packages/app/test-browser/solid-router-cleanup.test.ts), [submission-state tests](../../packages/app/test-browser/prompt-submission-state.test.ts), [app package scripts](../../packages/app/package.json), and [Happy DOM preload](../../packages/app/happydom.ts).

## Canonical contracts to consume

Import the module-owned namespace directly from `@opencode-ai/schema/ftc-project`; do not copy these payload definitions or import Core solely to obtain their types.

| Contract | Meaning and consumer constraint |
| --- | --- |
| `FtcProject.ProjectContext` | `{ projectID: Project.ID, canonicalRoot: AbsolutePath, location: Location.Info }`. `projectID` is the local M2 association ID; **it is not** the host Project ID at `location.project.id`. `canonicalRoot` owns project execution identity; the renderer must not recanonicalize it or substitute a display name. |
| `FtcProject.ChatRef` | `{ projectID, chatID: FtcProject.ChatID, sessionID: Session.ID }`. A chat ID and Session ID are distinct. Every submit, stop and history selection must retain the full mapping. |
| `FtcProject.FolderRequest` / `ProjectRequest` | `{ root: AbsolutePath }` / `{ projectID: Project.ID }`. Folder selection supplies the former. Chat listing, creation and active-owner query use the latter. |
| `FtcProject.OwnerStatus` | `{ projectID, active?: ChatRef }`. Absence of `active` means no current owner in a successful snapshot; query failure/loading is a separate state, not inferred idle. |
| `FtcProject.OwnerChanged` | Current volatile `ftc.project.owner.changed` event with OwnerStatus fields. There is no persisted claim, gate token or replay authority. There is no domain revision/sequence field in this payload. |
| `FtcProject.SubmitPrompt` | `{ chat, prompt: PromptInput.Prompt, id?, delivery?, resume? }`. Prompt text belongs at `prompt.text`; optional files/agents remain canonical PromptInput values. `resume:false` means durable admit-only submission, never draft storage. |
| `FtcProject.SubmitResult` | `{ kind: 'admitted', receipt: SessionInput.Admitted }` or `{ kind: 'busy', active: ChatRef }`. Busy response retains the local draft and reveals the owner; it does not queue a retry. An admission receipt is not completed model execution. |
| Domain failures | `AssociationError`, `ChatError`, `GateError`, `ExecutionUnavailable`; Protocol wraps its declared domain failures in `FtcProjectApiError`. Keep structured codes/recovery data; localize presentation without displaying arbitrary raw backend detail as trusted UI copy. |

Use the existing public payloads with the minimum browser facade. Current Protocol names and generated Client group are authoritative for eventual binding: `server.ftcProject` / `ftcProjects`, with `create`, `open`, `read`, `createChat`, `listChats`, `readChat`, `submit`, `resume`, `stop`, `active`. Core's corresponding association methods are `createProject`, `openProject`, `getProject`, `createChat`, `listChats`, `getChat`; do not invent a second schema identity because facade names differ.

`stop` takes the full ChatRef and returns no content. `active` takes ProjectRequest and returns OwnerStatus. M1-01 needs no new resume control, gate acquire/release methods, lease tokens, proof objects, migration, or API addition.

## Minimum standalone state and binding

1. **Supplied records and narrow ports.** Supply known ProjectContext records, per-project ChatRef query results, successful owner snapshots/current status updates, and localized presentation. A typed browser command facade uses the exact request/result shapes above; it may adapt browser Promise methods without importing an Effect Core service. Any asynchronous operation must have an explicit lifetime/cancellation boundary. No universal backend client or new application event bus.
2. **One `createStore` for UI state.** Keep selected project/chat, per-project selected chat if needed to restore selection, per-chat local draft, and query/command loading/error state. Key draft and history selection by the validated full project/chat/Session identity. Domain snapshots are supplied/read-only; renderer state is never an independent project gate or conversation repository.
3. **Existing chat presentation remains a supplied view boundary.** Pass selected ProjectContext/ChatRef plus local draft and explicit submit/stop handlers to a narrow chat presentation slot/facade. Use existing presentation where its dependencies permit. The current `PromptInput` still reads SDK, sync, file, layout, comments, permission and other providers even when state/submission props are supplied; importing it directly into the isolated frame pulls in the existing app context graph. A supplied presentation boundary permits later host reuse without requiring those contexts in M1-01. Do not build a second conversation transcript or model loop.
4. **Selection never executes.** Opening a project, switching chat, typing a draft, receiving history, receiving an owner event, idle transition, remount, and closing a component emit no submit/resume/wake command. Only an explicit submit action may invoke the submission port.
5. **Busy is project-local.** Display the active ChatRef when another chat owns the selected project and disable that other chat's run action while leaving drafting available. The active chat can still use its existing steer/queue semantics. An unrelated project's run action remains available according to that project's own status. Do not implement an application-wide busy flag.
6. **A raced submit still respects its result.** Capture its original full ChatRef and draft before invoking the facade. A busy or failed result preserves that draft and does not auto-retry. On admission, clear only the originally submitted draft if it has not been edited since capture. A later selection must not retarget an in-flight request or clear another chat's draft.
7. **Stop targets the displayed owner.** A stop-active action sends the exact owner ChatRef, even when another chat is selected. Keep ownership visible until authoritative status changes; the act of emitting stop is not evidence that execution has settled.
8. **Scope belongs to the component.** Construct subscriptions within its Solid owner; register returned disposers with `onCleanup`. Cancel/invalidate pending scoped queries on target change/unmount, ignore late responses, and never issue a user stop just because a view unmounted. Repeated fresh mounts have separate state and resources.

Known-project enumeration is a supplied input at this stage: the current M2 API has no `listProjects` endpoint. Chat membership comes from `listChats`; history is requested/presented using the selected `sessionID` through a narrow Session presentation boundary, not read from M2 or its tables. No new project-list/history API is required to satisfy M1-01.

## Exact write boundaries

**This preflight lane:** only `docs/validation/M1-01-preflight.md`.

**Proposed future M1-01 product allowlist, subject to coordinator dispatch:**

- `packages/app/src/ftc/facades.ts`
- `packages/app/src/ftc/workspace.tsx`
- `packages/app/test-browser/ftc/desktop-workspace/m1-01.test.ts`

Keep small supporting state/presentation logic in those files unless a real independent boundary requires a coordinator-approved additional path. A future implementation report belongs at `docs/validation/M1-01-implementation.md`; brief/review/evidence paths and commits remain coordinator-assigned.

**Localization adjustment requiring deliberate shared-file assignment:** existing app keys include `command.project.open`, `session.new.project.new`, `command.session.new`, `prompt.action.send`, `prompt.action.stop`, and loading/error keys. There is no inspected existing key for the complete busy-owner/draft-retention message. Prefer existing keys where their wording is correct. For new busy-owner, draft and recovery copy, assign only necessary entries in `packages/app/src/i18n/en.ts` and `packages/app/src/i18n/zh.ts` to the M1 writer before dispatch, or supply typed localization from an already assigned owner. Do not hardcode English, alter existing English wording/keys, or silently expand the three-file allowlist. Existing app typed i18n derives from the English dictionary, so new keys are shared contract edits. Terminology review must follow the app instructions; no translation approval or corpus validation was performed in this preflight.

**Excluded:** M9 or learning files; Core/Protocol/Server implementations; Schema; composition/host registration; generated clients; migrations; package manifests/lockfile; `packages/app/src/pages/session.tsx`, its timeline and SDK context; desktop/preload/native host files; progress ledger and task checkboxes. Existing app has Core package dependencies/imports; this does not permit new Core runtime edges in the M1 frame.

## Focused assertion and cleanup matrix

Use the actual exported M1 implementation with supplied boundary results, recorded command sinks and controlled deferred responses. Do not duplicate the UI decisions in fixtures. Include a rendered component/DOM path, not just a fixture that constructs an object containing expected fields.

| Scenario | Required observation |
| --- | --- |
| Named task test: `busy project identifies active chat without submitting drafts` | The real view exposes/renders the exact active `chatID`; draft submit sink remains `[]`; another project is enabled. Cover both initial busy snapshot and later owner change. |
| Project/chat selection | Two projects with multiple distinct chats route only selected Session history/presentation and project context. Switching back restores that chat's draft; no transcript/context leaks across projects or chats. |
| Create/open/new chat | Explicit actions emit exact FolderRequest/ProjectRequest, and successful canonical records are selected. Opening does not emit source/template/file writes. A rejected command does not fabricate a successful association/member. |
| Busy to idle | Draft entered while another chat owns the project survives busy clearing. After flushing effects/microtasks, submit/resume/admit/wake sinks remain empty. A subsequent explicit send sends it once. |
| Same active chat vs other project | The active chat retains deliberate submission semantics; only other chats in its project are blocked. Status of project A does not block project B. |
| Owner identity and stop | Full displayed owner project/chat/Session identity reaches stop sink. Selection changes after click do not alter the captured target. Stop request alone does not relabel the project idle. |
| Submit race returns busy | UI believed idle, supplied submit returns canonical busy result. Original draft survives; displayed active owner updates; idle later causes no replay. |
| Admitted vs error | Admission clears only the matching unchanged captured draft. Busy/error/disabled execution retains text, displays localized recovery, and never schedules a retry. Admission does not assert that model execution or robot work completed. |
| Draft edited or selection switched during request | Completion from A does not clear edited A text or B's draft and cannot overwrite B selection/history/errors. Test a deferred response, not only synchronous sinks. |
| Delayed project/chat/owner query | Response for a previous target does not replace current target data. An owner event arriving while an initial owner query is pending is not overwritten by the older query. Query failure/loading is visibly distinct from idle. |
| Canonical identity boundary | Supply a context where association `projectID` differs from `location.project.id`; emitted commands use association ID and canonical ChatRef. Renderer never constructs a new canonical root or imports a filesystem canonicalizer. |
| Invalid/conflicting membership result | Exercise the existing structured `project_changed`, `session_mismatch`, or `chat_session_conflict` failure from the supplied port. Retain the draft, show recovery, and do not invent a ChatRef, replace membership/history, or submit through a fallback raw Session API. |
| Localized presentation | All rendered labels, accessible names, placeholders and error text flow through typed localization. Switching supplied English/Chinese strings preserves IDs/drafts/selection and emits no commands. This is a narrow state/localization check, not M1-13 bilingual acceptance. |
| Unmount with active subscription | Every owner/history subscription disposer runs; sink listener counts return to zero. A fixture event after disposal neither changes a disposed view nor emits commands. Unmount does not stop a Session or delete domain records. |
| Unmount/target change with pending query | Scoped cancellation fires where supported; late settlement is ignored, creates no unhandled rejection/commands, and cannot repopulate disposed state. |
| Fresh construction twice | Construct/dispose twice with fresh stores/sinks; no first-instance draft, owner, listener or pending operation contaminates the second. Importing the module does not initiate I/O, network, backend or Electron work. |
| Import/fixture boundary | No Core/Server/sibling store/bootstrap import; no live M2/M3 instance, provider, network, robot/toolchain/model or Electron required by this suite. |

Happy DOM and browser Solid conditions already exist. The inspected DOM cleanup test uses `render`, `createComponent`, explicit owners, and disposal. App TS config has JSX preserve, while many current Bun browser tests call state helpers rather than execute their TSX component bodies. Before accepting a DOM test, confirm the new TSX view actually renders under the exact mandated Bun command; a JSX/harness import failure is not the intended behavioral RED. Use the existing component/DOM convention and a minimal supported rendering path rather than adding a tool download or silently dropping rendered assertions.

## Verification and boundaries of evidence

Future implementation commands, from `packages/app`:

```sh
bun test --conditions=browser --preload ./happydom.ts ./test-browser/ftc/desktop-workspace/m1-01.test.ts
bun typecheck
```

Record the intended behavioral RED, GREEN, selected test/assertion count, cleanup result, scoped diff, and independent review. Run relevant existing prompt/selection regressions if their behavior or shared presentation is touched. Tests/typechecks were **not run** for this document-only preflight.

Avoid existing session/timeline edits so M1-01 does not require their production benchmark baseline. If the coordinator authorizes those files, read their performance instructions and record the production baseline before editing; isolated microbenchmarks do not substitute.

| Evidence | What it can establish | What remains separate |
| --- | --- | --- |
| M1-01 supplied-port DOM suite | Selection/target routing, current status display, no auto-submit, draft safety, per-project availability, component cancellation/disposal | Persistence across app restart, canonical filesystem alias gate enforcement, actual provider execution, real backend concurrency |
| Existing M2 schemas/endpoints | Available canonical payloads and route names | New-root activation in the app host, execution enablement, frontend adapter composition |
| Later M1-11 | Generated Client/IPC bindings and controlled backend composition | Packaged/native platform and full release acceptance |
| Later M1-12/M1-13/M1-14 | Composed lifetime/import checks, full bilingual audit, packaged macOS/Windows acceptance | Physical/platform evidence cannot be replaced by fixtures |

The [2026-10-08 ledger checkpoint](../tasks/progress.md), [M2-06 activation implementation](M2-06-activation-implementation.md), and [approved repair re-review](M2-06-activation-fix1-review.md) supersede the original blanket new-root activation refusal: I2 is closed, and idle new-root activation now succeeds through the authoritative current-process fence held across the actual association commit. Active legacy ownership and unknown/uncovered host coverage still fail closed with `activation_unavailable`; this fence does not establish external-process or escaped OS-child containment, Windows behavior, or packaged host/release acceptance. FTC provider/tool/robot execution remains `execution_disabled` pending M9-07/08. An isolated M1 test may supply successful command results to test presentation; it must also cover applicable activation/execution refusals and must not present fixture success as enabling production execution. The app currently consumes a vendored Client archive, although generated repository Client M2 methods exist. Deliberate reconciliation of that client consumption, actual event binding, and route composition belongs to M1-11.

## Remaining details and coordinator decisions

No unresolved product/authorization decision blocks the standalone task. The approved sources resolve the central ownership and busy-draft rules.

- **Project creation:** M2 `createProject` associates an already prepared local folder. Template/SDK/source generation is M5/M6 work; M1-01 must not pretend a successful association created an FTC template. Supply folder requests at the view boundary.
- **Initial project enumeration / selected-view reopening:** exact app bootstrap source is not defined by M1-01 or the M2 API. Use supplied known contexts for standalone work; choose the production bootstrap in M1-11. Do not add a backend endpoint or persistent UI store here.
- **Draft lifetime:** the sources require local unsent drafts and safety across busy/selection changes; they do not promise draft persistence across component destruction or app restart. Keep them component-local for M1-01. If longer retention becomes necessary for layout composition, resolve it in the M1-02/host-view owner without putting drafts in Session admission.
- **Owner query/event ordering:** OwnerStatus has no revision. A facade should deliver a coherent current snapshot/update stream or the view should invalidate an older pending query when a current event arrives. A local request generation is UI bookkeeping, not a new domain sequence or persisted owner contract.
- **Chat reuse / rendering harness:** preserve the existing presentation boundary, and confirm the mandated Bun browser command exercises the actual frame. Importing the context-heavy app composer as a shortcut would undermine the isolated contract.
- **Shared localization:** explicitly assign the minimum English/Chinese keys before implementation. This is a coordinator path-ownership decision, not a request to change approved requirements.

The coordinator may use this report to prepare a future dispatch. No implementation was dispatched by this lane and no M1-01 checkbox, module count, or acceptance credit was changed.
