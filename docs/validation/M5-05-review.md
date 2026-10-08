# M5-05 independent review

Date: 2026-10-09 (Asia/Shanghai). Reviewer: `/root/m5_05_review`, separate from implementer `/root/m5_05`. Round 1, complete frozen candidate review.

**Specification verdict: APPROVED for the adopted isolated M5-05 scope.**

**Code-quality verdict: APPROVED.** Critical findings: none. Important findings: none. Minor findings: none. No repairs or additional probe are requested. The coordinator retains task-credit, checklist and Git ownership.

## Reviewed identity and scope

- Source base: `dd00790ac`; frozen reviewed head: `03fd63ebd9bdd310ee56edad538ec7a774893169`. The intermediate `928066c85` checkpoint changed documentation only. The manifest's older `head` identifies its pre-commit working-tree baseline; its five source hashes and report hash identify the tested candidate now committed at the reviewed head.
- Read the complete [five-path review diff](M5-05-review.diff) once, in contiguous bounded segments covering lines 1–2285, including all implementation and test additions. Its SHA-256 is `ec56aa0cdd1a9b897e4f2db1579375ff5a15ac5de2bfc14c1acfe314f0bbb228`.
- Independently checked current Git HEAD and all five source hashes plus the implementation-report hash against [candidate-manifest.json](m5-05/final/candidate-manifest.json): all match. The coordinator separately reconciled every command/log/patch hash and exit before release.
- Read root/Schema instructions, the review protocol, ledger/global constraints, M5 module/exact task, [adopted brief](M5-05-brief.md), preflight and resume reconciliation, relevant proposal/design requirements, the final [implementation report](M5-05-implementation.md), manifest and legible archived logs. Read stable `packages/core/src/location.ts` and `packages/core/src/project/schema.ts` to resolve the actual internal producer contract.
- Candidate review began only after the coordinator's explicit frozen release. No implementation, test, Git, ledger or brief edits; no delegation, application startup, provider, toolchain, robot or network actions. No test suite or behavioral probe was rerun to regenerate evidence. This review document is the only reviewer-written file.

| Frozen file | SHA-256 |
| --- | --- |
| `packages/core/src/ftc/java/build.ts` | `02ad95b5e59b8d8602fb2300d03530c3708992b16376148df7b487ea8dd143d9` |
| `packages/core/src/ftc/java.ts` | `44f7c5810f506a97fd213f96743d559d50bc7212c064d45cf097af2d9ef2f6b3` |
| `packages/core/test/ftc/java-development/m5-05.test.ts` | `02bf37061a5ac19f732498f5685c60401ce3953068eea5d2e81a1baecf5ae7d7` |
| `packages/schema/src/ftc-java.ts` | `85bebc90f9f1841e4974ce619f5d9099b0e63c343df6ed528b0ec86a1029101d` |
| `packages/schema/test/ftc-java-build.test.ts` | `063f914d0fdeda70b694982d8d1d5bbde8701656187a549e00c177c31caeec9b` |

Implementation-report SHA-256: `153f3a6105ca9aba4665f9dc52da8c69f812113754ffa713a603183b8493dff9`.

## Specification assessment

| Requirement or adopted contract | Source and evidence assessment |
| --- | --- |
| M5-05 exact `outdated`, `inputChanged: true`, and `cancelled` assertions | The real owner uses retained source/configuration/generation observations. The exact source-change test exercises saved temporary bytes and the public cancel handle. The original behavioral RED reports succeeded instead of outdated; the final case passes. |
| Canonical request/result/error/query identities | FtcJava defines the contracts once; Java re-exports exact values. Canonical ProjectContext and ToolchainDescriptor are reused. Runtime execution capability and result/cancel Effects remain Core-only. Strict excess-property decoding rejects command, task, environment, output, artifact and execution fields. Identifier, optional omission, readonly contract and facade identity coverage is present. |
| Complete saved-input identity and immutable lease | The owner requires complete immutable scope, independent nonempty source/configuration/generation identities, matching project/toolchain and wrapper/build-JDK/SDK recipe binding. It retains the acquired Scope and exact opaque capability. Discovery, atomic complete capture, actual filesystem/tool authority and fixed recipe remain explicit trusted-port responsibilities. The declared seven-file fixture covers unopened/add/delete/rename/wrapper/Gradle/resource/config changes, ABA and output/cache exclusions without claiming a real Gradle inventory. |
| Authority and immutability | Request, project, basis, validations, output and typed error records are copied/validated/frozen. Full canonical project/root/Location/workspace/host-project equality is checked against authoritative resolution at admission, execution, query and currency boundaries. Lease/descriptor mismatches and revoked authority cannot produce success. Mutation tests cover ingress, retained basis, output, process handles and historical errors. |
| EDT-02 and ENV-04 actual build observations | Concurrent output/termination collection retains ordered stdout/stderr and actual present/absent exit or signal. Invalid ordering fails typed and preserves only valid observed output. Output completeness is explicit; failures are not converted into successful build output. Previously observed exit survives cancel/join without a new exit observation. This establishes isolated evidence semantics, not environment readiness. |
| Source/configuration change and terminal precedence | Cancellation accepted before publication wins; established saved/configuration/generation change otherwise yields outdated even with a nonzero exit. Success additionally requires observed exit zero, no signal, complete output and no observed failure. Revalidation failure cannot establish unchanged success or invent inputChanged. |
| ENV-05 and dirty document preservation | The build never saves/discards document buffers. Public real-document reads supply initial/settlement exclusion provenance in fixture tests. Dirty-before/during cases preserve saved bytes, buffer text and revisions. Evidence explicitly identifies savedInputsOnly, excludes buffer text, and leaves unavailable settlement exclusions absent. Historical saved-basis success grants no displayed-program or deployment currency. |
| Public ownership, cancellation and handoff | startBuild returns an owner-issued ID/result/cancel handle; readBuild rejects unknown/foreign identities and injected evidence. The acquisition scope transfers into the owned worker. Undelivered admission interruption cancels and joins; convenience-build interruption preserves the caller's interruption after cleanup. A result-waiter interruption alone leaves the owner-held run available. Repeated result/cancel/query shares the immutable terminal evidence. |
| Cleanup and concurrency | Publication follows process release, authoritative lease release and scoped fallback cleanup. Held process/lease cleanup keeps the public record running. Owner closure retires admissions, cancels/joins provisional and active work and clears retention. Same-root aliases are busy; distinct roots proceed independently. The local observer helper addresses the reproduced Effect beta.83 completion-observer issue without sibling imports. |
| Constructor and module compatibility | Java.layer retains existing document ports and supplies typed build_unavailable methods; layerWithBuilds explicitly composes scoped M5 owners. Construction/import starts no build/acquisition. JavaDocuments and old document tests are unchanged. No sibling FTC store/runtime, bootstrap, Schema root-barrel, Protocol/Client, artifact API or production adapter change is present. |
| ROB-02, ENV-06 and acceptance boundaries | No artifact/digest/current-deployment assertion or production command authority is issued. Offline tool availability and real deployment remain outside this isolated result. AC-04/AC-10 and broader ENV/ROB acceptance require the separate production/platform gates below. |

## Location producer concern

The stable Core producer returns `Location.Service.of({ directory, workspaceID: ref.workspaceID, project, vcs })`; implicit local placement therefore includes an own undefined workspaceID and Core VCS metadata. The final private RuntimeProject decoder validates that documented optional shape, including the pure existing ProjectSchema.Vcs record, and creates a narrow canonical Location.Info projection. Unknown project/location fields and malformed workspace/VCS/store/root fields still fail. Public FtcJava.BuildRequest Schema remains strict and rejects the internal representation.

The regression uses the actual Service.of constructor through Java.layerWithBuilds without constructing its runtime layer or starting Project services. The corrected producer RED fails with invalid_build_input, and the corresponding GREEN passes with 10 assertions. Additional tests exercise normalization at lease/validation boundaries and rejection of invented authority fields. This resolves the source-backed compatibility concern; no uncovered doubt justified an additional probe.

## Verification evidence inspected

Environment: Bun 1.3.14 (`0d9b296a`), pinned `/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun`; Effect 4.0.0-beta.83; macOS arm64. Task-owned OPENCODE_TEST_HOME/XDG directories are recorded in command metadata; HOME/CODEX_HOME are not repurposed. These are the implementer's archived runs, not new reviewer executions.

| Working directory | Archived command/check | Result |
| --- | --- | --- |
| `packages/core` | `bun test ./test/ftc/java-development/m5-05.test.ts` | [62 pass, 0 fail, 373 assertions](m5-05/final/core-focused.log), exit 0 |
| `packages/core` | `bun test ./test/ftc/java-development/m5-01.test.ts ./test/ftc/java-development/m5-02.test.ts` | [50 pass, 0 fail, 194 assertions](m5-05/final/core-m5-regression.log), exit 0 |
| `packages/schema` | `bun test ./test/ftc-java-build.test.ts ./test/ftc-java.test.ts ./test/contract-hygiene.test.ts` | [34 pass, 0 fail, 85 assertions](m5-05/final/schema-focused.log), exit 0 |
| Core and Schema package directories | `bun typecheck` | [Core](m5-05/final/core-types.log) and [Schema](m5-05/final/schema-types.log) clean, each exit 0 |
| Repository root | Lint and formatting of the exact five paths | [Lint](m5-05/final/lint.log): zero warnings/errors; [format](m5-05/final/format.log): all matched files pass; each exit 0 |
| `packages/core` | Actual module imports and eight exact contract identities | [Passed](m5-05/final/imports.log), exit 0; no owner/process started |
| Repository root | Scope whitespace/import audit and protected-source comparison | [Audit](m5-05/final/scope-whitespace.json) and [protected baseline](m5-05/final/protected-baseline.json) pass |

Inspected genuine failed regressions: [saved-source change](m5-05/red.log), [held pending owner close](m5-05/held-pending-owner-close-red.log), [admission handoff and unordered output](m5-05/handoff-output-red.log), [already observed exit](m5-05/observed-exit-red.log), and corrected [Location producer RED](m5-05/final/location-producer-red.log)/[GREEN](m5-05/final/location-producer-green.log). Final source tests cover their fixes. Earlier fixture/lint/probe failures and the superseded final snapshot are explicitly preserved and excluded from final passing evidence.

## Quality and remaining gates

The implementation keeps policy in the actual owner, observations in narrow ports, and state within one scoped owner. The lifecycle bookkeeping and local wait helper correspond to covered admission/cancellation/cleanup races; no speculative service framework or production executor was introduced. Tests exercise real owner methods and fixture observations rather than copying status decisions. The facade changes are additive, and protected document implementation/tests remain unchanged.

Approval is limited to the adopted M5-05 isolated behavior. Production complete inventory/dirty-document/fixed-recipe bindings, actual root/tool-byte/symlink race authority, native descendant isolation on macOS and Windows, M9-08 execution isolation, actual Gradle/wrapper/JDK/SDK/offline builds, M4 readiness composition, M5-06 APK digest/current artifact issuance, editor integration, packaged platform and robot/release acceptance remain unavailable or not run. The harmless pinned-Bun direct-child/pipe test establishes only its own controlled boundary. Comprehensive package/composition suites were not run or claimed. No module or first-release acceptance follows from this review.
