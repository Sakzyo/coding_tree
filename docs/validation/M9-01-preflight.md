# M9-01 preparation-only preflight

Date: 2026-10-08. Investigator: `/root/m9_01_preflight`. Read snapshot: `11b3fe90e95f24108b6d8e536fce1d97be81d0f9`.

This is a source-backed implementation proposal, not implementation, a passing test report, or permission to operate a robot. Only this document was written. No changing M3 context or Schema paths were inspected.

## Source contract and exact scope

[M9-01](../tasks/robot-approvals-and-operations.md#m9-01) has no implementation prerequisite and explicitly permits supplied fixtures. Its files are `packages/schema/src/ftc-operation.ts`, `packages/core/src/ftc/operations.ts`, and `packages/core/test/ftc/robot-approvals-and-operations/m9-01.test.ts`. The first task defines the public request/result/error schemas and cleanup contract under [contract conventions](../tasks/progress.md#contract-conventions).

Implement only typed preparation: validate identity and action parameters, enforce independent robot policy, retain immutable requested context, and return an operation ID/context fingerprint with `status: awaiting_approval`. Preparation cannot approve, acquire controller ownership, dispatch, build, install, initialize, start, tune, or retry anything. Keep the operation map process-local and scoped. Do not add a database, timers, approval TTL, subscriptions, transport, host registration, barrel exports, Protocol/Server APIs, generated clients, or product settings.

[ROB-03/ROB-04](../proposal.md#37-robot-connections-deployment-and-actions) and the [M9 design](../high-level-design.md) distinguish deployment consent from agent control policy: observation rejects **agent** initialize/start/tune; deployment remains eligible for a separate explicit user action in either robot mode. Direct-user requests are distinguishable and do not inherit the agent observation restriction. In this task, all eligible requests still await approval; a claimed user initiator cannot authorize itself. M9-02 owns the trusted Deploy event and exact single-use approval.

[M9-07 evidence](robot-action-isolation.md) remains **BLOCKED** with no approved production combination. The existing Bash tool retains host-user authority and the disabled dashboard policy is not wired into Electron. M9-01 does not consume a mutation adapter and cannot promote any M9-07/M9-08 gate. An isolated preparation fixture is safe precisely because it has no dispatch capability.

## Existing canonical contracts and missing producers

| Domain | Verified current contract | Consequence for M9-01 |
| --- | --- | --- |
| Project | `FtcProject.ProjectContext`, using canonical `Project.ID` and `AbsolutePath` | `projectID` is the local M2 association ID, not `location.project.id`. Resolve/validate through an injected port; never read M2 tables. |
| Chat | `FtcProject.ChatID`, `FtcProject.ChatRef` with `Session.ID` | Agent preparation requires matching project/chat/Session membership from trusted caller resolution. A model-supplied chat label is insufficient. Direct-user preparation may omit chat. |
| Controller | `FtcController.ControllerCandidate` and `ProtocolEvidence` | Neither establishes physical identity. `ProtocolEvidence.identity` is literally `unknown`, and `deployment` is `unverified`; these cannot grant mutation eligibility. |
| Java | `FtcJava.DocumentSnapshot`, `Revision`, `EditProposal`, document errors | There is no current canonical build/artifact contract. Revisions are not successful build evidence. |
| Agent facade | Stable `Agent.Ports.policy.check`, trusted event port, opaque runtime edit authorization | Reuse this trust pattern, not the code-change permission itself. The facade separates asserted mode from trusted policy and uses scoped cleanup; code approval cannot authorize robot operations. |

Controller identity/generation/connection capabilities are planned in [M8-02/M8-03](../tasks/controller-connections.md#m8-02). The ledger's M8-04 ruling explicitly reserves their lifecycle semantics for those tasks. Build evidence/artifact references are planned in [M5-05/M5-06](../tasks/java-development.md#m5-05), not M5-04. Do not define competing `ControllerIdentity`, `ConnectionDescriptor`, `ArtifactRef`, or sibling-owned IDs inside M9.

## Proposed minimum API and trust boundary

Public Schema namespace: `FtcOperation`, using the existing self-export convention and direct file entrypoint. Re-export exact canonical values from the Core `Operations` facade. Public records contain serializable values; trusted caller objects remain Core-only.

The domain signature `prepareOperation({ request, robotMode })` needs a trusted caller input at the runtime boundary. Recommended Core signature:

```ts
prepareOperation({ request, robotMode, caller }):
  Effect.Effect<FtcOperation.PreparedOperation, FtcOperation.OperationError>
```

`caller: object` is an opaque runtime handle validated by a narrow injected identity/policy port. It is not a JSON token or a new approval credential. An alternative is two authenticated host-bound facades, one for agent requests and one for direct user requests; each internally supplies its caller. Either approach must reject fabricated objects and prevent an agent from selecting the user route. Since no host is wired in M9-01, use controlled identity fixtures and test the rejection explicitly.

The injected `policy.check({ caller, request })` returns this minimal trusted grant:

```ts
{
  project: FtcProject.ProjectContext,
  chat?: FtcProject.ChatRef,
  initiator: "user" | "agent",
  robotMode: "observation" | "actions-with-approval",
  controllerID: string,
  generation: string,
  verified: boolean,
  capabilities: readonly ("deploy" | "initialize" | "start" | "tune")[]
}
```

This is an M9 consumed-port projection, **not** a canonical M8 descriptor. The host must source it from trusted project membership, independent robot settings, selected target identity/generation, and evaluated capability facts. No M2/M3/M5/M8 implementation/store is imported. Capability names here denote the requested operation kinds; they do not invent Panels plugin or connection capability vocabulary.

Service checks compare the request project/chat, initiator, controller ID, generation, and `robotMode` claim against the grant, reject unknown identity, and require the exact requested capability. An agent grant requires a valid matching `ChatRef`; direct users need a valid project association but no active agent chat. Caller-provided fields never substitute for these facts. Do not silently coerce claimed user to agent or a mismatched mode to the trusted mode: reject the mismatch so the caller sees the failed assertion.

Structural validation belongs to M9. A separate narrow read-only `parameters.check({ action, projectID, controllerID, generation })` port can validate supported OpMode, field/value, expected-state shape, or deployment artifact binding where source semantics are unspecified. It returns `Effect.Effect<void, OperationError>` and receives no execution capability. M9-04 still owns live pre-dispatch revalidation; successful preparation does not prove state freshness at execution time.

## Canonical operation records: proposed shape

| Record | Required fields / checks |
| --- | --- |
| `RobotMode` | Closed literals `observation`, `actions-with-approval`. No code/layout/inference fields. |
| `OperationID` | M9-owned branded generated ID with exact emitted prefix; e.g. `operation_`. |
| `OperationRequest` | `Project.ID`, optional `FtcProject.ChatID`, initiator user/agent, nonempty trimmed controller reference, generation token, discriminated `Action`. |
| `Action` deploy | `kind: deploy`, required immutable artifact binding; trusted artifact validation required. No `opMode` or implicit start. |
| `Action` initialize/start | Separate discriminants, nonempty trimmed `opMode`, required `expectedState`. Both need their own capability. |
| `Action` tune | Nonempty trimmed `field`, present JSON `value`, required `expectedState`. Preserve valid zero/false; reject non-JSON numbers and missing values. Field-specific admissibility comes from the supplied validator. |
| `PreparedOperation` | Original validated request fields plus `operationID`, `status: awaiting_approval`, independent `robotMode`, immutable `contextFingerprint`. No permission/transport handle. |
| `OperationError` | Structured code and optional relevant project/chat/controller context; no localized strings or reusable authority. Suggested codes: `invalid_operation_input`, `untrusted_caller`, `project_unauthorized`, `chat_unauthorized`, `initiator_mismatch`, `robot_mode_mismatch`, `controller_unknown`, `context_changed`, `unsupported_operation`, `invalid_parameters`, `artifact_invalid`, `observation_only`, `owner_closed`. |

Fingerprint input must cover project/chat, initiator, controller ID/generation, robot policy, and the complete action including artifact binding, state and value. Use deterministic canonical JSON encoding plus a digest, not caller-supplied fingerprints or bare `JSON.stringify` key-order equality. Copy and deeply freeze the decoded context before any async port wait so caller mutation cannot retarget it. Store only accepted prepared contexts; a rejection must leave no pending record.

Do not implement future running/succeeded/failed/cancelled/unknown transitions in this task. A status vocabulary schema can reserve the documented literals without adding lifecycle APIs. Construction and import start no external I/O. Owner disposal clears pending records, interrupts owned port waits, and prevents a suspended call from adding a record after closure. Cancelling one preparation cannot close the owner or affect a different preparation.

## Producer-contract alternatives and unresolved semantics

The following are source gaps, not permission to invent robot facts:

1. **Artifact binding:** the source plans full `ArtifactRef = { buildID, projectID, sourceRevision, configurationRevision, digest, path }`, but the canonical schema does not exist. Recommended isolated preparation option: define an explicitly M9-owned `DeploymentArtifactContext` projection containing the needed binding fields, validated only by the injected artifact/parameter fixture. It must not be advertised as M5 `ArtifactRef`; omit the unused host path. Alternative: coordinator assigns a serialized producer-contract task to M5 before M9 implementation. Do not write M5 schemas from the M9 task without that ownership ruling.
2. **Generation type:** the source requires change/equality but specifies no representation. The candidate interface above uses an opaque nonempty string token to avoid inventing incrementing numeric semantics. A coordinator contract ruling is needed before making that public choice. Keep producer conversion in later composition.
3. **Expected state and tuning values:** no canonical robot lifecycle enum, expected-state record, field catalog, or tuning ranges are specified. Do not guess FTC/Panel states. Recommended preparation option: preserve required JSON context and let a trusted version-specific validator reject missing, null, malformed, or unsupported state/field/value combinations. Alternative: await an evaluated producer schema. This task cannot establish production support from fixture acceptance.
4. **Capability provenance:** operations use exact action-kind eligibility, while M8 capability vocabulary/provenance is not defined yet. A supplied verified grant is sufficient for unit preparation; production must derive capability evidence from evaluated adapters. Existing discovery or source-derived Panels records are insufficient.
5. **Direct-user controls:** ROB-04 explicitly scopes observation restrictions to the agent; the task explicitly distinguishes direct users. Permit direct-user preparation to await approval in observation mode. If intended product behavior instead prohibits all in-app controls in that mode, that changes the agreed policy and needs user clarification. Do not apply that broader restriction silently.

The coordinator can resolve representation/projection decisions from these alternatives without authorizing robot operation. Real action semantics or a changed authorization boundary must remain explicit.

Before assigning the schema writer, record these exact coordinator decisions in the implementation brief: (1) caller handle versus authenticated bound facades; (2) M9 deployment-binding projection versus early M5 producer contract; (3) generation representation; (4) expected-state/value representation and mandatory trusted semantic-validator port; (5) action-kind capability projection and its fixture-only provenance. Recommended choices are the caller handle, M9 projection, opaque string generation, required JSON state/value with semantic validation, and action-kind capabilities. The established project/chat types and agent-only observation restriction already follow the source and do not require rediscovery.

## Focused tests and verification plan

Use the actual Operations service and small supplied ports; no sibling startup, UI, SQLite, installed toolchain, provider, live controller, process or network listener. Test:

- Exact task case: observation agent start fails with `observation_only`; observation deployment prepares as `awaiting_approval`; dispatch count is zero. The service has no dispatch port or execute method.
- Initialize, start, and tune independently fail for observation agents; each prepares awaiting approval in actions-with-approval. Deploy works in both modes subject to artifact validation.
- Direct-user requests remain distinguishable, may omit chat, and never become approved merely because initiator is user. A forged user assertion from an agent caller fails.
- Unknown caller; missing project/chat; wrong project/chat/Session membership; malformed IDs; initiator/mode mismatch; unknown physical identity; selected-target/generation mismatch all fail without retention.
- Capability mismatch is action-specific; `start` capability does not allow initialize/tune/deploy. Unsupported protocol/action remains explicit.
- Missing/empty OpMode or field; missing expected state; missing tune value; unsupported field/value/state fail. Valid zero/false remains accepted when the trusted validator supports it.
- Deploy binds the requested successful current artifact projection to the same project; invalid/failed/stale artifact fixture is rejected. Successful deployment preparation does not imply program start.
- Caller mutation during a delayed port wait cannot alter prepared target, mode, state, field/value, or artifact digest. Equivalent canonical JSON receives equivalent context fingerprints; changed context changes the fingerprint.
- Separate service instances have separate maps. Scope disposal and caller cancellation release delayed port resources; post-disposal calls fail, and late completion creates no record.
- Schema/facade identity, omitted optional fields, exact generated ID prefix, and no runtime authority in serializable schema are verified alongside the changed contract.

First run the focused missing-behavior test from `packages/core` and record behavioral RED, then implement and record GREEN. Run `bun typecheck` from `packages/core` and `packages/schema`; contract assertions can live in the assigned focused Core file if no additional test file is assigned. Check scoped imports directly; the planned `packages/core/test/ftc-boundaries.test.ts` does not currently exist. Do not claim its execution.

This preflight ran source reads only. No product tests, typechecks, robot probes, or release checks were run, and no task checkbox was changed.
