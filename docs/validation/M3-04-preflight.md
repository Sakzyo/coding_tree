# M3-04 source and contract preflight

Date: 2026-10-07. Inspected HEAD: `c5d2f03e90b7e772063a36e303f17f0560258107`.

This is a preflight decision record, not implementation or acceptance evidence. The only file written by this preflight is this report. No product code, index, Git refs, task boxes or ledger were changed; no tests, server, model, credentials, robot, downloads or producer I/O were started. M6's concurrently changing inspection/manifest/native implementation files were not inspected.

## Scope and governing contracts

[M3-04](../tasks/agent-and-context.md#m3-04) depends on M3-01 and names exactly these producer/adapter paths:

- `packages/core/src/ftc/agent/context.ts`
- `packages/core/src/ftc/configuration/context.ts`
- `packages/core/src/ftc/knowledge/context.ts` (already exists)
- `packages/core/src/ftc/diagnostics/context.ts`
- `packages/core/test/ftc/agent-and-context/m3-04.test.ts`

Its behavior is immutable project code/configuration/reference/diagnostic inputs through registered domain Context Sources; versions, freshness, missing facts, language/identifiers, online disclosure and offline missing references survive assembly. External text is data, never approval authority. The illustrative assertion is `context.projectID === requestProjectID`, `missingFacts` includes `wheel-diameter`, and model-visible text excludes the supplied secret. Those assertion names do not establish a new production API.

[Shared constraints](../tasks/progress.md#global-constraints) and [contract conventions](../tasks/progress.md#contract-conventions) require module-owned payloads, narrow injected ports, no sibling stores/bootstrap, no import-time I/O, existing Effect scopes, Schema values rather than services, and unchanged Session admission/execution/history ownership. [High-level design](../high-level-design.md), especially its module contract/dependency tables and lines 241–260, keeps configuration/knowledge/diagnostic producers with their domains and keeps System Context/history/epochs with their existing owners.

M3-04 is not M3-06 real host composition, M3-05 tools, M6 native edits, or M10 observation implementation. No broad production bootstrap, universal registry, new event bus, prompt store, Session-ID layer, or second runner is required.

## Existing source boundaries to preserve

| Existing owner and path | Source-backed contract | Consequence for M3-04 |
| --- | --- | --- |
| `core/src/system-context/index.ts:32` | `Source<A>` has a namespaced key, JSON codec, effectful load, baseline/update renderers and optional removal renderer. `make` hides heterogeneous payload types; `combine` rejects duplicate source keys. | Produce ordinary sources; use `Schema.toCodecJson` when a newly composed schema needs JSON encoding. Do not copy the algebra or construct snapshots manually. |
| `core/src/system-context/index.ts:198` | Initialization fails for the `unavailable` sentinel. Reconciliation retains a previous admitted value when observation temporarily fails; replacement blocks if an admitted source cannot be observed. | Known missing/unknown/unimplemented facts must be serializable values, not this sentinel. Do not use a load failure to claim disconnected/missing telemetry. |
| `core/src/system-context/registry.ts:7` | Registry entries return opaque contexts; registration is scoped, duplicate entry keys fail, load reevaluates producers in sorted order. The node is Location-scoped. | Use the real registry, preserve built-ins, and release registrations with their owner scope. No second registry or global mutable selected-project state. |
| `core/src/system-context/builtins.ts` | Registers `core/builtins`, containing `core/environment` and `core/date`. | Do not relocate or overwrite those sources. FTC keys use a separate namespace. |
| `core/src/session/context-epoch.ts:22` | `initialize(db, contextEffect, sessionID)` establishes a durable baseline once. `prepare(db, events, contextEffect, sessionID)` reconciles or replaces, publishing `ContextUpdated` with snapshot advancement in its event commit. | Assembly supplies a context effect; Session alone persists epochs. No FTC writes to Session tables or separate epoch cache. |
| `core/src/session/runner/llm.ts:168` | Registry, skill guidance and reference guidance compose before epoch preparation. Session-owned history is selected using the epoch baseline sequence. | Do not alter history selection, prompt promotion, provider-turn allowance, model loop or guidance ownership. |
| `core/src/ftc/knowledge/context.ts` | Existing public source uses canonical `FtcKnowledge.ContentResult`, calls lookup lazily and converts lookup failure to temporary observation unavailability. Baseline/update currently serialize the entire result. | Reuse this producer. Narrow its consumed dependency to lookup if necessary; do not reimplement M11 lookup/filtering in M3. Sanitization must precede snapshot encoding as well as rendering. |

## Identity, applicability and facts

`FtcProject.ProjectContext` at `packages/schema/src/ftc-project.ts:14` explicitly separates local association `projectID`, execution `canonicalRoot`, and host `location.project.id`. Reuse these exact canonical types. M2's association ID must not be passed to a legacy Project API; canonical root, not a display name or copied manifest, identifies execution ownership. M3 must not independently recanonicalize or confer filesystem authorization from a supplied record. Production root/path authorization remains with M2/M5 and host adapters.

Bind an FTC source set to its authorized project/root and Location. Reject supplied documents/configuration records belonging to another association instead of relabelling them. Reject a placement mismatch before registration. `Location.Ref.workspaceID` omitted means implicit-local placement; explicit workspace identity must be preserved, not converted into a new placement scheme. Session identity belongs to epoch calls, not to a process-global source or Session-ID layer.

The existing [Java contract](../../packages/schema/src/ftc-java.ts) provides `DocumentSnapshot` with association `projectID`, absolute opened-document path, independent buffer/disk revisions, text and dirty state. Reuse it rather than inventing a source revision or claiming dirty bytes are saved build inputs. A supplied document list is the selected code context, not proof of whole-project inspection or filesystem authorization.

The existing [configuration contract](../../packages/schema/src/ftc-configuration.ts) supplies `ManifestSnapshot`/`ReadResult` plus `InspectionResult`. Preserve manifest revision, manifest hardware names and managed pathing, SDK version when observed, dependency versions, conflicts, source-revision states and inspection unknowns. `InspectionSourceRevision` explicitly represents non-atomic observations, not an atomic whole-project snapshot. `InitializationProposal` means a missing manifest/proposal, not an installed configuration. No new shared-manifest fields or native edit proposals are needed.

The existing [knowledge contract](../../packages/schema/src/ftc-knowledge.ts) supplies exact `ContentQuery` SDK/library versions, `en`/`zh`, local-only selection, source/license/version/digest/ranges/provenance, availability and explicit missing reasons. Found results do not embed their query; retain the supplied query beside the result if query applicability must survive a snapshot. Do not infer a library version from its name or call lookup with a guessed SDK. Missing SDK/library inputs are missing applicability, not permission to pick a default. M11 owns filtering; M3 must not duplicate semver logic. `synthetic` provenance remains synthetic.

`wheel-diameter` is an example required fact supplied by a caller/domain observation. It is not a field currently defined in the manifest and is not derivable from hardware names, a pathing selection, a reference example or a successful build. Use an explicit required/missing-fact input and show it as unknown; do not insert a numeric measurement or add a universal robot-fact database. No physical validation is established by any context fixture.

Freshness belongs to the producer: preserve explicit `read/missing/unavailable/changed` inspection states, exact revisions, local content availability and any supplied observation classification. An agent-side timestamp or current project selection cannot upgrade old evidence to current. Do not invent a freshness threshold or robot receive/sample time. Immutable payload changes must be observable through the real source codec/reconciliation, not a hand-built `context.text` concatenation alone.

## Minimal producer/adapter plan

The following is a recommendation requiring the root's contract confirmation before implementation dispatch.

1. **Configuration producer** at the planned `configuration/context.ts`: lazily consumes supplied canonical manifest/inspection values plus their project binding and explicit missing facts. Produces one source that renders a safe observation of those facts. It does not call M6's store, inspect the filesystem, or import native writer code.
2. **Knowledge producer** at the existing `knowledge/context.ts`: reuse `source` and the canonical lookup/query/result. Accept the minimal consumed lookup port rather than requiring the entire M11 service interface for new callers. If the project/query binding is encoded, define that payload in the M11 Schema file and preserve the old source's existing missing/failure behavior. No M6 dependency.
3. **Diagnostics producer** at the planned `diagnostics/context.ts`: consumes only the explicit unavailable contract below. It has no transport, decoder, subscription, dashboard or mutation capability.
4. **M3 adapter** at the planned `agent/context.ts`: consumes a supplied authorized `ProjectContext`, selected canonical Java snapshots and already-produced opaque domain contexts (or registry entries). It creates a small Java/project context source from those supplied canonical values, combines/registers domain contexts using the existing registry and provides the resulting context effect to the existing epoch boundary. It must not import `configuration.ts`, `knowledge.ts`, `diagnostics.ts`, sibling stores or production composition. Domain source constructors are used by the caller/test wiring, not as a shortcut into sibling runtime implementations.

No separate Java runtime producer implementation is named by M3-04. A code source in the M3 adaptation file is sufficient when it only adapts supplied `FtcJava.DocumentSnapshot` values; M5 remains the observer/authorizer. Do not create `java/context.ts` or modify document services merely to satisfy this task.

Source keys should be stable, independently refreshable FTC names such as `ftc/project-code`, `ftc/configuration`, `ftc/knowledge` and `ftc/diagnostics`. Only one source set may be bound under those keys in a given registry. Dynamic facts load lazily; changing a captured constant is not production refresh. No producer should start I/O on import or secretly retain a sibling service/store.

## M10 contract while protocol/physical gates remain open

There is no `packages/schema/src/ftc-diagnostics.ts` or diagnostics runtime facade at the inspected HEAD. [M10's plan](../tasks/diagnostics-and-dashboard.md) names that Schema path as the owner of observation/log/dashboard records, but its M10-01 decoder depends on M8-04. [Current protocol evaluation](controller-protocol.md) states that no supported controller combination is promoted and M8-04 remains open. Canonical `FtcController.ProtocolEvidence` has deployment unverified, identity/freshness unknown, dashboard blocked and logs unknown. Source-shaped samples are not authenticated robot/project measurements.

The smallest truthful addition is **one new file**, `packages/schema/src/ftc-diagnostics.ts`, owned by M10, containing a serializable `FtcDiagnostics.ContextUnavailable` record only. Recommended fields are:

```text
kind: "unavailable"
reason: "observation_adapter_unavailable"
freshness: "unknown"
logs: { state: "unknown" }
deployedBuild: { state: "unknown" }
```

Its source is attributed to the unavailable diagnostics adapter; do not fabricate controller ID, generation, project association, sample/receipt time, protocol version, measurements or deployed build ID. The surrounding requested project context does not associate an unseen robot with that project. No raw `ProtocolEvidence.sample` needs to enter model context for this case.

This is an explicit supplied observation-availability contract, not the full future `TelemetrySnapshot`, not a production M10 start, and not evidence for M10-01/02/03. Later M10 owns additions for real `live/stale/disconnected/missing`, valid zero, timestamps, controller/generation provenance, logs and verified build association after its named prerequisites. M3-04 must not introduce a competing diagnostics record under `ftc-agent.ts` or a generic FTC context schema. If full positive telemetry fixtures are requested now, that is a separate contract decision; their freshness cannot be authenticated by this adapter.

Private one-use source codec compositions can reuse existing canonical schemas. If project/freshness/missing-fact wrappers become public producer records, add `ContextSnapshot` only to the owning existing `ftc-configuration.ts` and/or `ftc-knowledge.ts`, with nested canonical values; do not copy their existing fields or introduce `ftc-context.ts`. This is a precise conditional expansion beyond the M3-04 file map and needs root confirmation. The unavailable diagnostics record is the only necessary new Schema file. No Protocol/HttpApi changes or client generation are indicated.

## Credential redaction and action authority

`packages/schema/src/credential.ts` separates `Credential.ID` from secret-bearing `Credential.Value`/Key/OAuth. Context ports may receive a credential reference only if needed for a selected-provider descriptor; they must never receive `Credential.Value`, keys, access/refresh tokens or secret-store handles. No credential access is needed for M3-04 tests or assembly.

Code, reference documents and logs can contain copied secrets despite having valid domain schemas. Allowlist the model-context projection and apply an explicitly supplied trusted sanitization boundary before values reach `SystemContext.make`: both JSON snapshots and baseline/update/removal text must be safe. A renderer-only replacement would still persist the raw secret in Session context epochs. Do not use arbitrary recursive JSON serialization as credential protection.

Redaction must preserve language and code/API/device/reference identifiers when safe. If an identifier/URL is itself sensitive, omit/reject that source field with an explicit limit rather than silently rewrite an identifier and claim the original code remains exact. Mark a redacted document as a context projection; its original digest/revision identifies source provenance, not a digest of modified displayed bytes. Missing sanitizer capability must not silently publish unfiltered external text. A fixture redactor proves the supplied-port boundary for its cases, not a general secret-detection or OS-credential implementation. Root must specify this port's production ownership before claiming host integration.

Wrap/label external text as observed data and state its provenance. Model text, repository instructions, logs and reference bodies cannot issue plan approval, grant code-edit authority or authorize deployment/start/tuning. Do not add an approval boolean to a context record. M9 remains the sole mutation authority and refreshes real target/generation/state/artifact at execution time; newer context or source timestamps never bypass it.

## Smallest useful checks after contract confirmation

Keep all new M3 checks in the planned `test/ftc/agent-and-context/m3-04.test.ts`; supplied records/ports must not reproduce producer/registry/epoch decision logic.

- **Producer fixture test:** real producer constructors/codecs with canonical Java/configuration/reference records, association IDs deliberately different from the host Project ID, an explicit missing `wheel-diameter`, unknown diagnostics and a redaction fixture. Assert project association, revisions, dirty state, unknowns, query language/applicability/provenance, online disclosure/local-only missing references, immutable safe snapshots and no secret in baseline/update/snapshot. Test cross-project input rejection and hostile text containing purported approval as ordinary data. Assert missing manifest is not represented as installed hardware.
- **Real registry test:** instantiate only the real Location-scoped registry node, register the actual producer contexts through the M3 adapter, load/initialize, mutate supplied observation values, and reconcile. Assert version/freshness changes affect snapshots/updates, unavailable diagnostics is admitted explicitly, transient sentinel failures preserve prior snapshots, duplicate keys fail, and closing a registration scope removes it. Include independent project registry instances to prove no selection leak. The existing `test/system-context/registry.test.ts` is the harness anchor.
- **Session epoch boundary test:** use an owned temporary database plus real EventV2/Session repositories and registry; no runner/model/server. Establish actual Session IDs via Session-owned creation with execution disabled, then call `SessionContextEpoch.initialize/prepare`. Assert durable baseline is retained on source updates, `ContextUpdated` persists the update with snapshot advancement, exact unchanged input creates no duplicate update, transient unavailable sources retain admitted values, and a second Session has its own epoch. The test may read epoch rows for assertions but must not manufacture persistence instead of exercising these public functions. Reuse existing test layer patterns; `test/session-runner.test.ts` already exercises baseline reuse, invalid snapshot and initially unavailable context behavior.

Suggested commands, from `packages/core` only:

```sh
bun test ./test/ftc/agent-and-context/m3-04.test.ts
bun test ./test/system-context/index.test.ts ./test/system-context/registry.test.ts ./test/ftc/ftc-knowledge/m11-02.test.ts
bun test ./test/ftc/agent-and-context/m3-01.test.ts ./test/ftc/agent-and-context/m3-02.test.ts
bun typecheck
```

Run `bun typecheck` from `packages/schema` if Schema changes. Add focused Schema assertions to the M3-04 test or the relevant owned Schema test only when contract decoding behavior changes. No package-wide suite, model/provider call, network listener, filesystem inspection, credential lookup, process launch, robot or download is required. An owned temporary SQLite file is the explicit exception to no external I/O for the persistence-boundary check. Do not run renderer/session-timeline performance benchmarks for these isolated source changes; preserve the recorded baseline. If implementation instead changes runner/history/timeline paths, stop and widen the approved checks rather than treating this preflight as permission.

## Decisions the root must fix before dispatch

1. Confirm that M3-04 may add the M10-owned unavailable-only `ftc-diagnostics.ts` and, only if public wrappers are needed, extend the existing owning configuration/knowledge Schema files. Do not let an implementer introduce full ungated telemetry.
2. Confirm the trusted sanitization port/ownership and failure policy. The task says credentials must be excluded but does not define a production sanitizer; no existing FTC/SystemContext sanitizer was found in the inspected files.
3. Confirm registration selection scope: `SystemContextRegistry.load()` accepts no Session/request arguments and the registry is Location-scoped. Project-wide binding can use the existing API; independently Session-selected language/inference/query values cannot be installed as last-writer-wins mutable Location state. M3-04 can test explicit supplied selection in independently constructed registry scopes and leave real host selection wiring to M3-06. Do not claim that those fixtures solve simultaneous Session-specific selection.

Subject to those precise decisions, the isolated producer/assembly task is feasible without starting siblings. Real host composition, production redaction, controller identity/freshness/logs/build association, robot authority and physical/Windows validation remain separate open gates. Source inspection in this preflight does not establish any task completion.
