# M5-06 fix round 1 implementation — 2026-10-10

**DONE — repair candidate only.** The publication-boundary finding against `7bcada6d9a3d2455ce4e2f26c81586fbcc63fd9f` is repaired in the assigned scope. Root commit, original-reviewer scoped re-review, ledger/checklist reconciliation and task credit remain pending. The user requested stopping after this active task; this worker started no other task. No Git mutations, shared ledger/checklist edits, subagents, production producer, host/API/Client wiring or robot execution occurred.

## Finding, chosen boundary and guarantees

The independent reviewer reproduced both artifact issuance and valid verification after input generation changes during asynchronous query cleanup. Protected bytes changed while `current()` or cleanup was held also returned valid. Earlier positive suites did not establish publication freshness; their final2 evidence and the original independent probes remain immutable.

The root ruled that the newly introduced Core-only artifact observation results may be refined to trusted settled confirmation handles. The repair changes only `packages/core/src/ftc/java/build.ts` and its assigned `m5-06.test.ts`; the five-path freeze also includes the unchanged facade and canonical Schema source/test. Existing public artifact schemas, queries, reason/code vocabulary, exact facade identities, document/build constructors and old three build ports are unchanged.

Two narrow runtime result contracts were added:

- `ArtifactBytesObservation { bytes, confirm }`: protected actual `Uint8Array` (or an explicit missing-byte observation) plus a captured, exact-retention/observed-byte-bound synchronous continuity check. It remains callable after query cleanup and final authorization. True proves those observed protected bytes remain unchanged through the immediately following synchronous publication; false establishes content change; undefined means unavailable proof. It must be side-effect-free and must not be fabricated as constant true. Core computes SHA-256 from the actual observed bytes; the producer never asserts a digest or overall validity.
- `ArtifactCurrentObservation { validation, confirm }`: initial complete `InputValidation` plus an exact-owner/original-basis-bound, side-effect-free synchronous confirmation returning fresh complete `InputValidation`, or undefined if complete input/recipe/dirty/generation/authority continuity cannot be established. It must work after every query cleanup, carry comparable continuity across execution-lease retirement (including A-B-A), and cover canonical project/root/Location/toolchain/fixed-recipe authority and the original complete basis through synchronous publication. No released execution lease is reused.

The owner captures method handles and returned byte/validation fields before any subsequent wait and validates their runtime shape. It hashes and rechecks the original basis, joins all scoped read/current cleanup, then finishes the final asynchronous project authorization. Both trusted confirmations, strict complete-current decoding, Core identity/generation/dirty/content checks and ref/result publication then run within **one `Effect.sync` callback**. No asynchronous cleanup, authorization, scoped re-query or producer I/O follows confirmation before publication. Initial and final established invalidity remain permanent history; a confirmed stale/dirty basis stays invalid even when content proof is subsequently unavailable. Genuine confirmation exceptions remain defects. Owner closure and caller interruption cannot run a late publication or establish a ref before cleanup/authorization finishes.

Missing confirmation handles or undefined proof return typed `artifact_unavailable`. Malformed current/content confirmations (including Promise results) return `artifact_current_failed` / `artifact_read_failed`; they are not evidence of change. Known established source/configuration/generation changes return `artifact_invalid` or verification reason `stale`; dirty changes use `dirty`; protected-content changes use `content`. Positive paths still return exact immutable refs and `{valid:true}` only with both complete proofs.

These guarantees are a **trusted producer contract**, not a claim that a production adapter exists. A real producer must provide complete settled authority and protected-content continuity, or fail typed/remain unavailable. Repeated scoped observations alone do not meet the contract. No polling, watch service, production path reader, execution snapshot, sibling producer or general workflow was added.

## RED/GREEN and independent probe preservation

Before changing production code, 34 actual-owner probes reproduced the finding: **0 pass / 34 fail / 86 assertions**, exit 1 in `publication-red`. The failures are intended behavioral assertion failures against real successful issuance/verification, not missing imports/selectors or unavailable features.

The exact original reviewer generation cases (`artifact` and `verify`) and content cases (`current` and `queryCleanup`) were appended to the existing actual-owner suite with their scenarios and assertions intact, then strengthened with specific `artifact_invalid` and `stale`/`content` reason checks. Original files/logs under `m5-06/review/` were not edited. [Preservation evidence](m5-06/fix1/preserved-review-and-final2.json) verifies both original probe hashes/log hashes against their reviewer metadata and all 111 prior final2 evidence entries. [Baseline source](m5-06/fix1/baseline-source.json) verifies all five `7bcada6d9` Git source hashes against the existing final2 manifest.

The only adaptation needed by those reviewer cases is the trusted fixture's new observation result shape: reader now returns its real byte snapshot plus a synchronous comparison against its exact retained test file; `current` returns its complete observation plus a synchronous fresh observation of the fixture's declared source file, configuration/generation/dirty state and canonical authority. The fixture's serialized authority uses `readFileSync` on its internally fixed temporary paths, never caller/model locators. It is explicitly a controlled one-source fixture, not a real complete Gradle inventory, protected-path adapter or external-writer continuity mechanism. Extra default-void read/current cleanup gates and final authorization control support new repair cases and do not alter the original reviewer scenarios. One existing foreign-current-authority fixture changed only to wrap its same invalid validation in the new result shape; its assertion is preserved. Earlier M5-05/document/Schema tests are unchanged.

Additional coverage exercises both issuance and verification with real source writes, configuration/generation/dirty changes and real protected-file tampering during separately held **read cleanup**, **current cleanup** and **final asynchronous authorization**. These cases require exact established-change results, so an arbitrary infrastructure failure cannot satisfy them. Unsupported content/current proofs are tested separately for both query methods, including no issued identity after failure. Malformed/missing/async confirmation results and genuine callback defects remain separately observable. Existing actual public JavaBuild/Java facade held capture/read/current cleanup and once-only retention-release tests remain green; additional public owner close and caller interruption during final authorization prove no late issuance, plus the earlier interruption-during-query-cleanup no-issued regression.

`publication-green-first` passed 87 cases after the boundary repair. `unsupported-proof-red` recorded four wrong error-code assertions (unknown proof was reported as read/current failure), with one genuine-defect case already passing; the minimal unavailable-proof mapping then passed. Early `types-first` failed only in new test ternaries whose different Effect success types needed a common undefined mapping on the issuance success branch; production had no reported type error. The reviewer assertions were retained. Final formatting initially needed a second Prettier pass for one chained test expression; the original failed format log and before snapshot are preserved. No failed run was overwritten or presented as passing.

## Final checks and exact evidence

All commands are bounded to 60 seconds and use pinned `/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun`. Tests/typechecks run from their package directories; the pinned runtime directory is prepended to PATH and fixture XDG roots are `/private/tmp/m5-06-fix1-xdg/{config,data,cache,state}`. [Runner](m5-06/fix1/command-runner.py) records full combined output, exact argv/cwd/exit/environment and log hashes in new fix1 files. Its terminal tail is not the stored complete output. No whole-package/whole-branch suite was run or claimed, per docs/prompt.md's relevant-check rule.

| Final evidence | Selection | Result |
| --- | --- | --- |
| `final-core-focused-v2` | Core `bun test ./test/ftc/java-development/m5-06.test.ts` | 101 pass, 0 fail, 346 assertions |
| `final-core-build-regression` | Core `bun test ./test/ftc/java-development/m5-05.test.ts` | 62 pass, 0 fail, 373 assertions |
| `final-core-document-regression` | Core `bun test ./test/ftc/java-development/m5-01.test.ts ./test/ftc/java-development/m5-02.test.ts` | 50 pass, 0 fail, 194 assertions |
| `final-schema-focused` | Schema artifact/build/document/hygiene four-file selection | 49 pass, 0 fail, 107 assertions |
| `final-core-types-v2`, `final-schema-types` | `bun typecheck` in Core and Schema | Both exit 0 |
| `final-lint-v2` | Root scoped lint over all five assigned paths | Exit 0; 0 warnings/errors |
| `final-format-v3` | Root scoped Prettier check over all five paths | Exit 0 |
| `final-whitespace` | Root `git diff --check 7bcada6d9 --` five assigned paths | Exit 0 |
| `final-imports` | Actual Core imports, exact canonical artifact identities/constructor availability | Exit 0; no owner/process started |

Selected totals are **213 Core tests / 913 assertions** and **49 Schema tests / 107 assertions**, with 0 failures. Earlier regression checks remain valid across the final artifact-only confirmation precedence refinement; the affected focused suite/types and scoped lint/format checks were refreshed afterward. All full logs and metadata are preserved in [fix1 evidence](m5-06/fix1/). [Manifest](m5-06/fix1/candidate-manifest.json) freezes the five final source identities and exact ten selected check/log hashes; [repair diff](m5-06/fix1/candidate.patch) is bounded to this task's paths against the reviewed candidate.

## Frozen five-path repair source

| Assigned path | SHA-256 |
| --- | --- |
| `packages/core/src/ftc/java/build.ts` | `5f5d1e62525903cc8a4cebfeb2003e826af54e5a147aa1ed01cbb06a4085fc48` |
| `packages/core/src/ftc/java.ts` | `8f1b06fe9fd9bac8cfe0cbe23621aa4e0eff6d44389de3388d5cf2c0b348b916` |
| `packages/core/test/ftc/java-development/m5-06.test.ts` | `cac1c940b0ca76d5221afbcd43855743ecf1ac32847e08f20c40c563f2b59c3b` |
| `packages/schema/src/ftc-java.ts` | `ccbc5b19fd72b058adee48581d6241470861699fbbf87275f08dff2cc9b952d0` |
| `packages/schema/test/ftc-java-artifact.test.ts` | `6240012d11220a0eb1ba7930b2f279b9fb3d7e9a1ad2d27035231ed098967432` |

## Remaining gates and handoff

Root commit and original-reviewer specification/quality re-review are pending; no task credit is claimed. Production complete-input/dirty/recipe/output/cache/protected-path/current settled authority and content-confirmation adapters remain unavailable/NOT RUN. Actual FTC Gradle/JDK/SDK/offline builds; M4-06/M5-08/M9-04 composition; M5-03 and M9-07/08 production isolation; Windows/native/packaging; physical robot and release acceptance remain NOT RUN/unavailable. M9's document-revision-array preparation projection is unchanged and still requires owning integration with complete M5 saved-source identity. No fixture result authorizes production execution or robot operations. Stop after this active task's required re-review/checkpoint; do not begin another task.
