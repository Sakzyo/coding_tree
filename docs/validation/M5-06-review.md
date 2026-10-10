# M5-06 independent task review

## Spec Compliance

- ❌ **Needs fixes.** The five-path candidate implements the assigned artifact contracts, optional ports, scoped retention and historical identity, but complete current inputs are observed before asynchronous query cleanup and authorization. The final publication boundary can therefore issue or validate an artifact after its generation changed (`packages/core/src/ftc/java/build.ts:647`, `:681–693`, `:724–728`). This violates the exact brief's current-input and publication-boundary requirements (`docs/validation/M5-06-brief.md:48–49`).
- ⚠️ Production complete-input/dirty/recipe/output/cache/protected-path/current authority, real toolchains, cross-module composition, platform/packaging and robot/release acceptance remain unverified and explicitly NOT RUN. Fixture coverage does not establish these gates (`docs/validation/M5-06-brief.md:63`; `docs/validation/M5-06-implementation.md:93–95`).
- Reviewed base `e99b38f28d1b4b8e8179fd3b06c4d46b9ab0d13b` to head `7bcada6d9a3d2455ce4e2f26c81586fbcc63fd9f`, using the complete five-path review diff and `m5-06/implementation/final2-candidate-manifest.json`. The superseded draft is not the candidate. Root's independent five-source/ten-check/111-evidence hash reconciliation was supplied as controller evidence.

## Strengths

- Canonical schemas bind exact build/project/full string source/configuration identity, lowercase SHA-256 and absolute locator; the facade reexports the same identities and preserves the document-only unavailable behavior (`packages/schema/src/ftc-java.ts:196–239`; `packages/core/src/ftc/java.ts:25–57`).
- Capture occurs while process and execution are live; metadata and capability handles are captured before further work, provisional retention is discarded for ineligible builds, and immutable compilation evidence retains its prior meaning (`packages/core/src/ftc/java/build.ts:419–550`).
- Verification compares every issued field before protected reads, caller paths are never opened, and established invalidity is retained with original owner history (`packages/core/src/ftc/java/build.ts:633–668`, `:710–723`).
- Tests exercise the actual owner and temporary bytes, including exact failed/tampered/stale assertions, distinct build identities, no-output/error distinctions, and both JavaBuild and facade public Scope cleanup. The interruption-during-query-cleanup regression specifically prevents premature issuance (`packages/core/test/ftc/java-development/m5-06.test.ts:269–336`, `:510–586`, `:759–792`).
- No new sibling implementation or bootstrap import is introduced; runtime capabilities stay Core-only and the optional complete group preserves old build ports (`packages/core/src/ftc/java/build.ts:10`, `:56–117`; `packages/core/test/ftc/java-development/m5-06.test.ts:472–502`).

## Issues

### Critical (Must Fix)

- None found within the reviewed task scope.

### Important (Should Fix)

1. **Refresh complete authority at a settled publication boundary.** `packages/core/src/ftc/java/build.ts:681–693` and `:724–728` consume `recheck()`'s result after `Effect.scoped` has joined potentially asynchronous read/current finalizers. `current()` was already observed at line 647, and the later `artifactAuthorize()` checks project/root/Location only. It does not refresh source/configuration/generation/dirty state. With the existing trusted fixture, hold query cleanup after a clean generation-0 observation, change generation to 1, then release cleanup: `artifact()` issues a reference and `verifyArtifact()` returns `{valid:true}`. Thus an observation known to be old at publication is presented as current; M9 cannot trust this live verification boundary. The same gap affects protected content: the hash is computed at lines 639–642 before `current()` and cleanup can wait; changing retained bytes during either held boundary still returns `{valid:true}` for the already-issued digest.

   **Evidence:** `docs/validation/m5-06/review/publication-generation.test.ts:252–273`; `publication-generation-v3.log:4–50` records both incorrect successes and both failed assertions. The related content probe, `docs/validation/m5-06/review/publication-content.test.ts:253–271`, also fails both cases (`publication-content.log`). These probes change no production files and use the reviewed fixture's legitimate scoped finalizers and the same retained-file tampering model as the candidate's own test.

   **Repair:** establish a final complete-current observation whose settlement covers all query cleanup and subsequent asynchronous authorization, followed by synchronous eligibility/identity publication. The final settlement must cover both complete input authority and protected content continuity. A narrow settled observation or trusted validity/continuity capability can do this; simply repeating the same scoped `current()` call moves the same gap. Keep the original basis, typed authority/infrastructure failures, permanent invalidity, joined owner/caller cleanup, and no issued identity on interruption. Add actual-owner regressions for both issuance and verification when generation/dirty state changes during held cleanup and any final authorization boundary, and when protected bytes change while current observation or cleanup is held.

### Minor (Nice to Have)

- None identified separately from the Important freshness defect.

## Checks and evidence

- Read the task diff once in consecutive chunks; all five assigned paths have corresponding changes. No changed source was separately reread, no Git commands were run, no subagents were dispatched, and production code/ledger/checklists remain untouched.
- Read final manifest-selected logs rather than rerunning their suites: 53 focused Core tests/190 assertions; 62 build regressions/373 assertions; 50 document regressions/194 assertions; 49 Schema tests/107 assertions, all zero failures. Core/Schema types and scoped lint/format/whitespace/import checks exited zero; final lint records zero warnings/errors (`docs/validation/M5-06-implementation.md:54–67`; corresponding logs under `m5-06/implementation/`). Preserved intermediate failures were not represented as passing evidence.
- Named focused doubt: complete-current validity can become stale during query cleanup. Ran the two generation probe cases and, at the controller's request, two content cases for the same boundary from `packages/core` with pinned Bun 1.3.14 and isolated `/private/tmp/m5-06-review-xdg` XDG roots. Actual behavioral result: **0 pass / 2 fail / 5 assertions**, exit 1. The content probe separately reports **0 pass / 2 fail / 6 assertions**, exit 1; both current-wait and cleanup-wait cases incorrectly return valid. Exact argv/cwd/environment/probe and log hashes are in `m5-06/review/publication-generation-v3.json` and `publication-content.json`.
- The first two probe attempts failed only because a relocated test used an absolute Effect package-directory import without an entry file. Both original logs/metadata remain under `m5-06/review/`; they are harness failures, not product evidence. One focused environment inspection of Core/root tsconfig and the installed Effect dependency location resolved that import to the installed `dist/index.js`. No external product-code crawl was performed.
- Read the supplied producer reconciliation to assess the narrow current/capture contract; it does not establish a cleanup-settled current observation. No existing successful suite was rerun.

## Assessment

**Specification verdict: Needs fixes.** One Important publication-boundary requirement is missed.

**Code-quality verdict: Needs fixes.** The ownership, schema boundaries and lifecycle regression coverage are strong, but the reproducible asynchronous freshness gap makes a positive verification unreliable. Fix this one boundary and independently review the repair before crediting M5-06; production/platform/robot gates remain open.
