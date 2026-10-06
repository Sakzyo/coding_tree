# Independent dependency audit — 2026-10-06

Reviewer: `/root/dependency_audit`, read-only; no active M9-07 files inspected. No unavoidable implementation cycle found. This supplements the declared prerequisite graph without changing task IDs or scope.

| Producer / consumer | Finding and scheduling resolution |
| --- | --- |
| M2-01/03 → M3-02, M1-01 | M2 owns canonical ProjectContext, ChatRef, GateResult and GateLease in ftc-project.ts (projects plan:33, agent plan:91). Publish the contracts once before consumers; controlled gate behavior is sufficient for isolated tests. |
| M5-01/02 → M3-03, M6-04/05 | M5 owns EditProposal/EditResult (Java plan:40, agent plan:116, configuration plan:131). Schedule their canonical schemas first. Explicitly assign ftc-java.ts to M5-02 although its Files list omits it, because it introduces applyEdits request/result/error records. |
| M5/M8 → M9-01/03/04 | Deploy needs ArtifactRef; coordinator needs ControllerIdentity; live revalidation needs ConnectionDescriptor (operations plan:41, Java plan:173, controllers plan:36). Owner publishes contracts; fixtures supply external behavior only. |
| M3-04 / M10-03/05 | M3-04 lists domain context producers that later domain tasks extend. Assign one writer; keep producers domain-owned. |
| Public method/API owner → M1-11 | Some task Files omit Schema/API registration paths. Explicitly reserve them for the backend owner per progress:86; M1-11 only consumes generated facade APIs (workspace:296). |
| M1-09 / M9-08 | Apparent control-mediation cycle is broken by an injected control port or blocked controls for M1-09. M9-08 composes real mediation later (workspace:254); no enablement without evidence. |
| M5-05 / M4-06 / M3-05 before M9-08 | Fixtures may support module/composition tests; they do not authorize unrestricted production process access (operations:226). |
| M4-01 / M6-04 before M4-07 | Label candidate/fixture profiles; do not make them supported new-project defaults (environment:81; progress:203). |

Ruling: Add these contract publication and shared-path reservations to dispatch scheduling — the source contract conventions require one canonical owner and first-method schemas — omission would create incompatible duplicates. This is implementation scheduling, not a scope change.

The initial generated prerequisiteKinds labels were too broad for evaluation consumers. Corrected: M9-09→M9-08, M4-07→M4-06, M12-07→M1-11 and other actual evaluations require real prerequisite implementation. Exact task text remains authoritative; never schedule from labels alone.

## Source-evaluation implications recorded 2026-10-06

The completed [M8 source audit](M8-04-source-preflight.md) supplies constraints for upcoming M8-04/M10 tasks: telemetry is string lines, browser frame history is not robot logs, readiness needs more than socket-health 200, plugin hashes cannot verify controller identity, and fixed frontend ports/extra plugin proxies need explicit routing and mutation controls. M10 decoders must retain these distinctions rather than invent typed measurements, robot-log availability, sample timestamps or deployed-build provenance. Source-derived fixtures cannot pass real protocol gates.

The pinned Panels setup guide mentions SDK 12 while available Java-evaluation cache includes FTC 11.1; these independent inputs must not be combined into a supported setup profile without actual compatible-combination evidence. Production compatibility catalog remains empty until its owner evaluations pass.

## Inference and credential preflight

[M7 read-only preflight](M7-runtime-preflight.md) identifies reusable Session model/LLM routing and the current secret-bearing Credential/Integration paths. M7-02 must establish a protected operation boundary while preserving explicitly selected migration only; M7 must not introduce a second tool/continuation loop. No installed local runtime/model was observed in bounded conventional locations, so real M7-08 evaluation still needs authorized pinned assets and OS evidence. Existing pinned Bun and hardware baseline remain available despite the preflight worker's restricted PATH/sysctl probe.

## Knowledge source version drift

[M11 source preflight](M11-source-preflight.md) records immutable candidates and floating-document gaps. Pedro current installation no longer describes evaluated ftc:2.1.2. Road Runner core-only M5 evidence omits Actions/FTC/Dashboard/quickstart integration; source docs and linked quickstarts declare different tuples. Future M11-03/07/08 must select reviewed version-matched source records and preserve Dashboard/tuning requirements without assuming compatibility. Source/notice provenance must be recorded per content/package; no inferred documentation license or production support promotion.

## M2 canonical-root integration risk

Current `packages/core/src/project.ts` derives Git identity from remote/root commits and returns `Project.ID.global` for non-Git folders. High-level-design.md:241 requires distinct local canonical-root execution ownership mapped explicitly to existing Project/Location/Session identities. M2 must not collapse separate non-Git folders or clones merely because an upstream Project ID is shared. Added this concrete risk to M2-01 brief; canonical ID schema reuse does not replace explicit root/location mapping. Representation must be checked against later chat/session association APIs before implementation is committed.

M2-01 mapping confirmed: its projectID is a persisted canonical-root association ID using existing Project.ID; Location.Info preserves the host project.id/directory separately. Future M2/M3/M1 consumers must distinguish association IDs from host Project IDs and derive ownership from canonicalRoot. Session adapters use the explicit location mapping; never equate two distinct roots because their host IDs match, or send association IDs to legacy Project APIs.

## Session gate host and lifetime audit

[M3 gate preflight](M3-gate-preflight.md) identifies the actual V2 host in Server routes, absent terminal-settlement hooks, and resume/wake busy-outcome gaps. M3-02 needs explicitly assigned coordinator lifecycle/type paths; M2-06 must wire the real Server V2 root, not only planned legacy app-runtime.ts. M2-03/04/05 must agree on reservation ownership across concurrent admissions, settlement and admit-only behavior before integration. Source inspection is not new runtime evidence.
