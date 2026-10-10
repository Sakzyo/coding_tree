# M5-06 implementation candidate — 2026-10-10

**DONE — candidate only.** Root commit, fresh independent specification/quality review, checklist and progress reconciliation remain pending. This report grants no task credit or production execution authority. No Git mutations, sibling implementation, shared checklist/ledger edits, production producer, host/API/Client wiring or robot work was performed by this worker.

The supplied checkpoint was `e99b38f28`; prerequisite M5-05 is reviewed at `03fd63ebd9bdd310ee56edad538ec7a774893169`. Before edits, all five producer hashes matched the frozen reconciliation. [Baseline hashes](m5-06/implementation/baseline-hashes.json) and [protected old tests](m5-06/implementation/protected-tests.json) preserve this check. Root-owned ledger changes already visible in the shared working tree were excluded from this worker's patch.

## Delivered scope and assumptions

Only these five assigned product/test paths changed:

- `packages/core/src/ftc/java/build.ts`: optional opaque `BuildProcess.apk`; optional complete `artifacts.capture/current` port group; provisional owner-lifetime retention; protected SHA-256; exact owner history; fresh immutable-basis revalidation; owner-managed cancellable query fibers and joined cleanup.
- `packages/schema/src/ftc-java.ts`: canonical readonly ArtifactRef, ArtifactQuery, ArtifactVerificationRequest, ArtifactVerificationResult and ArtifactError, with same-name Struct interfaces, domain identifiers, strict digest/absolute locator/complete string revision contracts and optional omission.
- `packages/core/src/ftc/java.ts`: exact canonical re-exports and document-only `artifact_unavailable` compatibility. Existing two constructors and old three required build ports remain compatible.
- `packages/core/test/ftc/java-development/m5-06.test.ts`: 51 actual owner/facade behavior tests using temporary files and trusted external capability fixtures.
- `packages/schema/test/ftc-java-artifact.test.ts`: 15 new canonical artifact contract tests.

[Scoped candidate patch](m5-06/implementation/candidate.patch) includes both new test files. The source hashes below freeze the final tested candidate; [candidate manifest](m5-06/implementation/candidate-manifest.json) freezes exact argv/cwd/exit, final command metadata/log hashes and the preserved evidence inventory.

The root-selected run-bound provisional capture design is implemented. Trusted capture must bind exact execution/output/full immutable basis/fixed recipe, allocate protected retention in the supplied separate artifact Scope and register idempotent fallback cleanup before any cancellable boundary. Core validates metadata and captured method handles and derives its own digest from actual protected bytes. The locator is presentation/identity metadata, never a caller pathname to read. `read()` returning undefined establishes missing retained bytes; typed read failures mean unavailable facts, not proven content changes. `current()` consumes the original basis and must carry comparable generation continuity across lease retirement, full canonical project/root/Location/toolchain/recipe authority and dirty exclusions; unsupported continuity fails typed. No released lease is used in a query. Production authority adapters are deliberately absent.

## Behavior and stable result vocabulary

Capture runs only after complete joined successful process observations and before process/lease retirement. It is provisional. Cancellation/outdated/failure/dirty/unobserved exclusions prevent issuance and discard retention; capture-specific errors preserve truthful saved-compilation evidence. Accepted cancellation while discarded retention cleanup is held wins terminal publication. Successful clean explicit no-output gives undefined; absent/incomplete artifact feature gives artifact_unavailable.

Each query freshly authorizes the owner project. Issuance protected-reads/hashes and checks complete current identity/generation/dirty state, joins its query Scope, then publishes one immutable exact-build ref after another owner/project check. Caller interruption while query cleanup is held cannot establish an issued ref. Queries do not substitute another successful build. The owner retains issued identity/history after established invalidation and releases retention on discard or actual public owner Scope closure. New owners have no old history.

Verification strictly captures canonical caller records, authorizes currentProject, looks up an issued exact owner ref and compares every field including locator before protected reading. Unknown/no-issued/foreign build claims return `{valid:false,reason:"unknown"}`; wrong project/source/configuration/digest/locator claims return identity after authorization. Established changed/missing bytes gives content; complete source/configuration/generation change gives stale; dirty exclusions gives dirty. Invalidation is permanent for the original owner basis, including later A-B-A/restored endpoints. Cached ref identity does not cache currency for otherwise eligible queries.

| Domain result | Meaning |
| --- | --- |
| `unknown`, `identity`, `content`, `stale`, `dirty` | Stable verification reason values; no arbitrary error text. |
| `invalid_artifact_input`, `artifact_unknown`, `artifact_unavailable`, `artifact_invalid` | Strict input, exact owner lookup, feature availability and established invalidity failures. |
| `artifact_provenance` | Invalid/mismatched capture metadata, ambiguous/wrong execution/output or unsupported provenance supplied through trusted capture. |
| `artifact_capture_failed`, `artifact_read_failed`, `artifact_current_failed`, `artifact_cleanup_failed` | Typed capture/protected byte/current authority/release infrastructure failures. |
| `project_unauthorized`, `owner_closed` | Fresh authority/lifetime failures. |

Caller interruption and genuine port defects remain observable. Runtime retention/capture/query capabilities remain Core-only. BuildEvidence and BuildRecord gained no artifact fields and retain immutable compilation meaning. M9's document-revision-array preparation projection remains unchanged; future owning integration must reconcile the complete M5 saved-source identity without lossy conversion.

## Task substeps and required coverage

1. Focused behavior: the exact `failed or changed artifacts cannot authorize deployment` test includes `expect(failedArtifact).toBeUndefined()`, `expect(tampered.valid).toBe(false)` and `expect(stale.valid).toBe(false)`. It also checks exact independently known SHA-256 of real fixture bytes `abc`, immutable ref identity, subsequent build identity and retained historical invalidity.
2. Baseline and behavioral RED: existing Core M5-05/M5-01/M5-02 baseline passed 112 tests / 567 assertions after isolated XDG configuration; existing Schema build contracts passed 11 / 33. The valid first RED exercised already-callable real owner `build`, observed truthful succeeded evidence, and failed on missing exact-live-output capture (expected 1, observed 0). No missing import/method established acceptance RED. Artifact query assertions were then added to this same real-owner suite while completing the implementation.
3. Minimal behavior: hash only protected retained bytes of exact clean successful current builds; bind generated build/project/full saved-source/configuration IDs, retain original basis and history, revalidate current authority/generation and refuse silent fallback. No new execution snapshot or leased-query authority.
4. Verification and cleanup: final focused, producer/document/Schema regressions, both changed-package typechecks and scoped lint/format/import/whitespace all pass. Both actual JavaBuild public Scope and composed Java facade public Scope are closed with held asynchronous capture/read/current cleanup; closure remains pending until cleanup is released, process/lease resources retire, retention release is once-only and escaped owner commands fail closed. Caller interruption capture/read/current and interrupted publication cleanup are covered.
5. Candidate report/evidence/scoped diff review: complete here. Commit, independent reviews and task credit are root-owned and pending, as instructed. Old tests and earlier evidence were preserved.

Additional cases cover initial/settlement dirty and absent observations, failed/cancelled/outdated/no-output/unavailable, exact output/execution mismatch, typed capture/read/current/discard-cleanup failures and genuine defects, post-lease real saved A-B-A, identical bytes in distinct builds, each public ref identity field forged without caller-path reads, running/unissued/unknown/fresh owners, missing protected bytes, authorization revocation at query boundaries, mutable caller capture, malformed port/current/input records, canonical omission/identifier/digest/strict contract checks and exact facade identity. The fixture owns real local source/APK bytes and an explicit monotonically updated generation; it is not a Gradle inventory or protected-path production adapter.

## Commands and complete evidence

All tests were run from their package directories using pinned Bun `/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun`; its directory was prepended to PATH for scripts. Isolated `/private/tmp/m5-06-xdg/{config,data,cache,state}` XDG roots avoid user-home writes. Each named command has an exact `.json` argv/cwd/exit record and a complete bounded `.log` in [implementation evidence](m5-06/implementation/). The [runner](m5-06/implementation/command-runner.py) preserves full combined stdout/stderr; its terminal tail is not the saved log. Commands were bounded to 60 seconds. No whole-package or whole-branch suite was run or claimed, following docs/prompt.md's relevant-check rule.

| Final evidence name | Exact test/check selection | Result |
| --- | --- | --- |
| `final-core-focused` | Core `bun test ./test/ftc/java-development/m5-06.test.ts` | 51 pass, 0 fail, 185 assertions |
| `final-core-build-regression` | Core `bun test ./test/ftc/java-development/m5-05.test.ts` | 62 pass, 0 fail, 373 assertions |
| `final-core-document-regression` | Core `bun test ./test/ftc/java-development/m5-01.test.ts ./test/ftc/java-development/m5-02.test.ts` | 50 pass, 0 fail, 194 assertions |
| `final-schema-focused` | Schema `bun test ./test/ftc-java-artifact.test.ts ./test/ftc-java-build.test.ts ./test/ftc-java.test.ts ./test/contract-hygiene.test.ts` | 49 pass, 0 fail, 107 assertions |
| `final-core-types-v2`, `final-schema-types` | `bun typecheck` from Core and Schema respectively | Both exit 0 |
| `final-lint` | Root `bun run lint --` all five assigned source/test paths | Exit 0; 0 warnings and 0 errors |
| `final-format` | Root `bun x --no-install prettier --check` all five paths | Exit 0 |
| `final-whitespace` | Root `git diff --check --` assigned paths | Exit 0; new files also passed formatting |
| `final-imports` | Core actual import smoke; five exact facade/schema identities, constructor/make availability | Exit 0; no owner/process started |

Final bounded selected totals: **163 Core tests / 752 assertions** and **49 Schema tests / 107 assertions**, each with 0 failures. These totals describe only the explicitly selected suites.

### Preserved failed/debug runs and repairs

- `baseline-core`: 111 pass / 1 fail because importing actual internal Location attempted default XDG config mkdir outside writable roots (`EPERM /Users/dylanxu/.config/opencode`). `baseline-core-isolated` reran the same unchanged tests with isolated XDG roots and passed 112 / 567. This was environment handling, not a producer repair.
- `behavioral-red`: first harness attempt removed temporary files too early because the helper returned an un-awaited promise through async disposal. Corrected helper awaiting retained the temporary directory. This error does not count as behavioral RED.
- `behavioral-red-valid`: actual owner behavioral RED, succeeded compilation but zero provisional captures. `capture-green` passed after run-bound capture implementation.
- `behavior-suite-first`: missing-byte fixture tried changing a callback after owner construction, while the implementation deliberately captures artifact callbacks at construction. Moved the change to the trusted reader's observed byte state. No production callback-lifetime weakening.
- `lifecycle-red`, `debug-capture-1`, `debug-capture-2`: convenience capture interruption timed out. Systematic debugging traced delivery/cancellation/worker interrupt/Scope close and found a fixture registration defect: capture signalled entry before registering fallback cleanup, allowing interruption in the gap. Registered cleanup before the first cancellable boundary. Unchanged production owner passed `capture-fixture-fix`. Temporary debug console instrumentation was removed; logs remain preserved.
- `boundary-red`: exposed real cancellation precedence while provisional discard cleanup was held, plus malformed capture/current observations reaching property access. Terminal evidence publication moved after discard cleanup; malformed observations now fail typed. A mutable-request probe initially reused an already-open reader entry gate; resetting that gate verified the intended asynchronous boundary without changing production decoding.
- `null-input-red`: strict null verification input reached property access. Optional access now feeds strict owner decode and yields invalid_artifact_input.
- `publication-red`: genuine caller interruption during joined query cleanup had prematurely issued a ref. `publication-green` moved issuance after its protected read/current Scope closes; interrupted queries have no issued identity. Owner fiber/query joins remain bounded to the existing lifetime.
- Early typechecks found narrowed union field access and fixture-only branded path/release inference errors; these were fixed without suppressing the package checker. One intentional null runtime-input test uses a single documented `@ts-expect-error` on that invalid call.
- `lint-first`: 3 unsafe assertion warnings, fixed with explicit comparison of the six canonical ref fields and the precise invalid-input test above. Final lint has 0 warnings/errors.

Every failure remains in original owned logs; none is relabelled a passing final result.

## Frozen tested sources

| Assigned path | SHA-256 |
| --- | --- |
| `packages/core/src/ftc/java/build.ts` | `f3ebbad72f066337cf99c2cfd93d8248ed9dfe7650cff007c28f454cdc46817f` |
| `packages/core/src/ftc/java.ts` | `8f1b06fe9fd9bac8cfe0cbe23621aa4e0eff6d44389de3388d5cf2c0b348b916` |
| `packages/core/test/ftc/java-development/m5-06.test.ts` | `a2d93321106672d402a23244253ec9d604295e5d91188719c85ea4523cf112ca` |
| `packages/schema/src/ftc-java.ts` | `ccbc5b19fd72b058adee48581d6241470861699fbbf87275f08dff2cc9b952d0` |
| `packages/schema/test/ftc-java-artifact.test.ts` | `6240012d11220a0eb1ba7930b2f279b9fb3d7e9a1ad2d27035231ed098967432` |

## NOT RUN / unavailable gates

Production complete-input/dirty/recipe/output/cache/protected-path/current authority adapters; actual FTC Gradle/JDK/SDK/offline builds; M4-06/M5-08/M9-04 composition; M5-03 and M9-07/08 production isolation; Windows/native/packaging; physical robot and release acceptance remain NOT RUN/unavailable. No fixture result authorizes production execution or robot operations. No public HttpApi/Protocol change or Client generation was assigned. No tests were run at repository root.
