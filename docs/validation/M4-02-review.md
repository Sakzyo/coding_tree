# M4-02 independent task review

## Spec compliance

- **Issues found.** One valid Windows wrapper-path form is rejected by literal comparison in `packages/core/src/ftc/environment.ts:112-113`. The remaining reviewed behavior matches the task scope; no extra installation, build execution, production host binding, catalog promotion or robot operation was added.
- Review scope: base `577c7b3b83ae12a4ab004a235fc63ae4c23f8735`, task head `a94369c4c`, stable package `.superpowers/sdd/progress/review-577c7b3b8..a94369c4c.diff`. All three listed task files and the expressly assigned canonical Schema file have corresponding changes.
- **Cannot verify from this diff:** real macOS/Windows discovery, real process cancellation, FTC build readiness and production compatibility support. These are explicitly unrun in `docs/validation/M4-02-implementation.md:92-94`; retain their later-task gates. This review does not approve the complete M4 module or either real platform.

## Strengths

- `packages/core/src/ftc/environment.ts:23-47` validates the request before port calls, validates dependency snapshots, and owns an invocation scope. `packages/core/src/ftc/environment.ts:70-84` probes the five required components separately with exact selected pins and validates successful observations.
- `packages/core/src/ftc/environment.ts:143-162` requires a matching profile, complete project constraints and all five valid tools before producing a canonical descriptor. `packages/core/src/ftc/environment.ts:177-195` retains pending build verification and does not claim ready setup or confuse pending verification with absent binaries.
- `packages/core/src/ftc/environment/adapters.ts:6-19` keeps read-only discovery behind narrow scoped ports. `packages/core/test/ftc/environment-and-compatibility/m4-02.test.ts:66-91` checks temporary imported-file preservation; `packages/core/test/ftc/environment-and-compatibility/m4-02.test.ts:354-457` exercises success, recheck, interruption and typed-failure cleanup against the real service with injected resources.
- Recorded evidence includes the required behavioral RED, 38 focused passing cases/130 assertions, 100 resolver/inspection passing cases/227 assertions, package typechecks and clean scoped lint/format. Evidence is fixture-based and explicitly classified as such in `docs/validation/M4-02-implementation.md:20-22` and `docs/validation/M4-02-implementation.md:90-92`.

## Issues

### Critical

- None found within this task scope.

### Important

- **Rejects an equivalent Windows project wrapper path — `packages/core/src/ftc/environment.ts:112-113`.** The canonical path schema at `packages/schema/src/ftc-environment.ts:114` accepts Windows absolute paths using either separator. For project root `C:/fixture/import`, a successful wrapper observation `C:/fixture/import/gradlew.bat` is valid and names the project's wrapper. Inspection constructs `C:/fixture/import\gradlew.bat`, compares strings literally and reports `invalid_response`, preventing a candidate even when every tool/version matches. The existing Windows fixture at `packages/core/test/ftc/environment-and-compatibility/m4-02.test.ts:324-352` uses backslashes exclusively, so its passing result does not cover this contract-valid case. Compare paths with Windows path semantics, or enforce one canonical representation consistently at both boundaries; retain rejection of a global Gradle binary. Add a focused fixture for forward-slash/mixed-separator Windows paths.

### Minor

- None requiring action.

## Checks and verification limits

- No tests were rerun. The Windows finding follows directly from the accepted schema and deterministic string comparison; no real platform assumption is needed.
- Named unchanged-code check: evaluated production-profile enforcement. Inspected only `packages/core/src/ftc/environment/catalog.ts`; its evaluation/provenance checks at lines 25-28 prevent synthetic catalog evidence from becoming production support.
- Named unchanged-document check: descriptor completeness and candidate/readiness meaning. Checked the owning module contract at `docs/tasks/environment-and-compatibility.md:40`, the M4-02 excerpt at lines 89-106 and the later build-verification boundary at lines 175-194. The descriptor fields and pending-build interpretation fit those contracts.
- Two recorded Schema event-manifest failures remain the brief's acknowledged unrelated baseline (`docs/validation/M4-02-implementation.md:54-59`). They are not a task regression or a green full-Schema-suite claim.

## Assessment

**Task quality: Needs fixes.** The service is scoped, narrowly ported and meaningfully tested, with appropriately limited evidence claims. Fix the Windows wrapper comparison and verify its focused fixture before marking M4-02 complete.

## Scoped re-review — fix round 1

- Scope: fix base `446c005505d438a5181ad2d80f4c13f34702a629`, fix head `f075a4348`, stable fix-only package `.superpowers/sdd/progress/review-446c00550..f075a4348.diff`. This verdict supersedes the original open Important finding and Needs fixes assessment above; it does not broaden the original review scope.
- **Spec compliance: Compliant for the reviewed task.** The original Windows-wrapper separator finding is addressed at `packages/core/src/ftc/environment.ts:113-121`: `win32.join` constructs the project wrapper and `win32.relative` compares equivalent Windows paths, while macOS retains its previous literal comparison. The candidate continues to retain the observed path.
- **Strengths:** The five new cases at `packages/core/test/ftc/environment-and-compatibility/m4-02.test.ts:354-389` call the real implementation, cover forward and mixed separators, reject an outside-project batch wrapper and a global Gradle path, and assert aggregate state, wrapper cause and candidate presence/path. The repair is limited to a built-in path import, wrapper identity comparison and focused fixtures.
- **Critical:** None found in the repair.
- **Important:** Original finding addressed; no open findings and no new breakage identified in the repair.
- **Minor:** None requiring action.
- **Verification:** Reviewed the appended implementation evidence and stable fix diff, including behavioral RED (40 pass, 3 fail), focused GREEN (43 pass, 0 fail, 145 assertions), covering M4 GREEN (105 pass, 0 fail, 242 assertions), Core typecheck, zero-warning/error scoped lint and passing formatting evidence. No tests rerun: the source and existing focused evidence resolve the identified doubt.
- **Cannot verify / retained gates:** These are Windows path fixtures executed on macOS, not a real Windows filesystem or toolchain evaluation. Real platform/process discovery, production adapter cancellation, FTC build/setup readiness, production compatibility support and physical robot/platform checks remain the original explicitly unrun later-task gates; the unrelated Schema baseline failures remain unchanged.
- **Task quality: Approved.** The original blocking issue is fixed with direct regression coverage, and the repair preserves rejection of non-project wrappers and the candidate-versus-build-readiness boundary. This approves M4-02's reviewed implementation scope, not the full M4 module or its physical/platform gates.
