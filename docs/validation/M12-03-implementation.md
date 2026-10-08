# M12-03 preparation and implementation evidence

Date: 2026-10-08. Product source base: `768ec206c`; coordinator documentation checkpoint `f3677d94b`. Status: **DONE — tested isolated implementation candidate, awaiting coordinator independent review and commit.** Root explicitly released this worker after the M9-01 independent review gate. No Git/index/ledger/checklist changes, commits, subagents, M9 file inspection or sibling product edits were performed. Read-only scoped Git diff/check commands collected evidence; root retains completion authority.

## Sources and reconciled decisions

Read the exact `M12-03-brief.md`, preflight and resume reconciliation; root and Schema AGENTS; `docs/prompt.md`; M12 module/exact task; proposal LRN-04 and M12 design; reviewed M12-01/02 reports; current learning/canonical learning, knowledge, configuration and project contracts; canonical local-query behavior; predecessor harness/cleanup conventions; foundation content; and Superpowers TDD with its good-tests reference. Memory supplied only general module ownership and prior applicability context; live source and the brief control this task.

Preserve the reviewed M12-02 behavior: generic SDK-wide records remain applicable under an explicit installed-library binding, malformed record pairs fail, and library-specific records require matching version applicability. Preserve old optional navigation and bare-lessons ports. `layer(lookup, db)` borrows the externally scoped DB; public lookup effects own their scoped cleanup. No new owner/registry or `owner_closed` contract is assigned.

The implementation uses separate wholly generic/library-specific courses, trusted declarations rather than IDs/topics/prose, explicit en/zh and localOnly lookup, and all canonical exercises in a lesson-level request. Neither permits generic foundations; pathing guidance follows valid local translated library-specific course/lesson verification. Curriculum library/version facts supplied for neither never become installed project facts.

## Baseline actually run

Environment: Darwin arm64; pinned Bun `1.3.14`, executable `/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun`. Each test invocation prepended that directory to PATH and set `OPENCODE_TEST_HOME=/private/tmp/m12-03-home` plus XDG DATA/CONFIG/CACHE/STATE under its `data`, `config`, `cache`, `state` children. No user database or application was opened. Test DBs are the predecessor tests' disposable SQLite files.

| Check | Cwd | Exact Bun arguments | Exit and counts | Evidence |
| --- | --- | --- | --- | --- |
| Unchanged Core learning and canonical M11 selections | `/Users/dylanxu/coding_tree/packages/core` | `test ./test/ftc/learning-and-progress ./test/ftc/ftc-knowledge/course-metadata.test.ts ./test/ftc/ftc-knowledge/m11-02.test.ts ./test/ftc/ftc-knowledge/m11-04.test.ts` | 0; 83 pass, 0 fail, 477 assertions; 5 files | `m12-03/baseline-core.log` |
| Unchanged canonical learning Schema | `/Users/dylanxu/coding_tree/packages/schema` | `test ./test/ftc-learning.test.ts` | 0; 4 pass, 0 fail, 23 assertions; 1 file | `m12-03/baseline-schema.log` |
| Source SHA-256 freeze and post-baseline verification | repository root | `shasum -a 256 -c docs/validation/m12-03/baseline-source-sha256.txt` | 0; all nine sources match | `m12-03/baseline-source-sha256.txt` |

The current learning source hash is `33d6c3d3d8f6ae7a769355fb95f33ef99f3f1382a05dcb38fae2b4878f171884`; canonical learning Schema hash is `5499e84078c458f0390144170b1a7e3fd63d061945ed6eb40853351af7cca352`, matching the reviewed prerequisite. The M12-03 focused test and planned `ftc-boundaries.test.ts` are absent; neither was executed or credited. This unchanged baseline is not the meaningful M12-03 RED.

## Implemented behavior and ownership

Only four assigned product/test paths changed: `packages/core/src/ftc/learning.ts`, new `packages/core/test/ftc/learning-and-progress/m12-03.test.ts`, `packages/schema/src/ftc-learning.ts`, `packages/schema/test/ftc-learning.test.ts`. No SQL, migrations, producer content/metadata/runtime, composition, host, Protocol/Client, barrel, package or lockfile changes.

Canonical Schema defines `ExerciseProjectSnapshot`, `RequestExerciseCommand`, `Track`, `ExerciseRequest` and `ExerciseResult`. The command consumes canonical Project ID and M6 ManifestSnapshot, explicit language, course/lesson and a small SDK/installed-library applicability projection. The result binds exact course/lesson versions, project/configuration revision, SDK, managed selection and supplied installed-library facts; requiredEvidence retains every ordered canonical M11 exercise record. Optional physical flags remain omitted, false or true as supplied. Core exposes the exact Schema identities.

`requestExercise` decodes, clones and recursively freezes the entire command before invoking the required exercise-specific binding capability. The optional `LessonLookup.exercise` facet preserves existing bare-lessons and navigation callers; exercise calls without it fail unavailable. Its trusted reply contains the complete captured request, concrete course version, declared track, and separate content-library/version facts. Strict decoding/copying and complete request comparison prevent closed-over navigation bindings or caller mutation from changing course/lesson/language, project/configuration, selection or versions. Missing/invalid declarations fail closed.

The existing content resolver is shared between exercise and navigation calls. Navigation's wrapper continues to require entryPoints; exercise resolution does not. Canonical queries use explicit language, exact supplied SDK/library facts and localOnly:true. Exactly one matching course ID/version/language record is required. Declaration/record generic-versus-library metadata, SDK/library ranges, record/document identity, local availability, unique IDs, concrete lesson versions, present entry-reference validity and current lesson structural policy remain validated. Generic SDK courses under selected libraries retain the reviewed M12-02 applicability behavior.

With neither, trusted library-specific curriculum facts support local translation/content/lesson verification before `pathing_required`; they are never returned as installed facts or an exercise request. Selected libraries require the declared track, canonical library name and exact supplied concrete version to agree. Missing content/translation/local bytes or lesson, malformed/mixed snapshots, incompatible versions, invalid input and failed ports return existing typed errors with stable recovery actions. No reading/build/physical/completion requirement is inferred from prose.

The method has no persistence or operation surface. Borrowed DB ownership and producer self-scoped effects are unchanged. Source import has no added startup/I/O path; actual fresh-process import behavior is covered by retained M12-01 regression. All three supplied binding/content/lesson stages are tested for success, failure and interruption cleanup while the DB remains usable. A separate suspended-finalizer case proves `Fiber.interrupt` waits for asynchronous producer cleanup before completing.

## TDD chronology and repaired development checks

1. Created the focused real-service/temp-SQLite test first. `red-missing-method.log` observes absent `requestExercise`; this is setup chronology, not the credited behavioral RED. Root explicitly allowed an importable minimal scaffold. Added a temporary always-pathing-required method, then reran: `red-behavior.log` exits 1, 0 pass/1 fail, with the intended assertion **expected exercise, received pathing_required** for foundations. No dependency/import/harness failure. This scaffold was replaced with the real implementation.
2. Added the canonical Schema consumer test before Schema implementation; `red-schema.log` exits 1 for the absent contract. Implemented minimal canonical contracts, shared content resolution and the method. `green-initial.log`: exit 0, 1 pass, 6 assertions; exact original task behavior passes.
3. Added the required failure, binding, mutation, multi-exercise, provenance and cleanup cases. `expanded-green.log`: exit 0, 43 pass/233 assertions. No cloned applicability algorithm or sibling startup is used: tests supply declared synthetic canonical ports and operate the actual service/temp SQLite.
4. Initial Core typecheck found only the new fixture's overly narrow language annotation; the expanded check found readonly test-port annotations. Corrected them using a mutable test fixture shape with canonical method types. Initial Schema development check used the wrong Effect Array introspection property and an encoded branded-ID comparison type; corrected the test to use the actual canonical `.value` and JSON round-trip expectation. All failures are retained in initial/expanded logs and superseded by final clean checks. No product or foreign diagnostic was suppressed.
5. Added source-record criteria/prose preservation, binding-reply mutation during suspended content lookup, and explicit asynchronous cleanup waiting. Scoped lint initially reported three unnecessary test non-null assertions; removed them. Final checks below are frozen after these changes.

## Frozen final verification

Reproducible driver: `m12-03/verify.sh`. Full exact commands/cwds/exits: `m12-03/verification.tsv`. Every driver command uses the same pinned Bun/PATH/task home and XDG roots described above. Test/typecheck commands are package-local; only scoped tooling/diff/hash checks run at root. All final entries exit 0.

| Check | Cwd | Result | Evidence |
| --- | --- | --- | --- |
| `bun test ./test/ftc/learning-and-progress/m12-03.test.ts` | Core | 46 pass, 0 fail; 247 assertions, 1 file | `m12-03/focused-final.log` |
| `bun test ./test/ftc/learning-and-progress ./test/ftc/ftc-knowledge/course-metadata.test.ts ./test/ftc/ftc-knowledge/m11-02.test.ts ./test/ftc/ftc-knowledge/m11-04.test.ts` | Core | 129 pass, 0 fail; 724 assertions, 6 files | `m12-03/core-covering-final.log` |
| `bun test ./test/ftc-learning.test.ts` | Schema | 5 pass, 0 fail; 32 assertions, 1 file | `m12-03/schema-final.log` |
| `bun typecheck` | Core, Schema separately | both clean | `m12-03/core-typecheck-final.log`, `m12-03/schema-typecheck-final.log` |
| oxlint on four owned TypeScript files | root | 0 warnings, 0 errors | `m12-03/lint-final.log` |
| Prettier check on four owned TypeScript files | root | clean | `m12-03/format-final.log` |
| `git diff --check --` four owned paths | root | clean | `m12-03/diff-check-final.log` |
| Frozen four-file SHA-256 verification | root | all match | `m12-03/source-freeze-check.log`, `m12-03/source-sha256.txt` |

Direct actual import inventory is `m12-03/import-boundaries.txt`: Core consumes canonical Schema, Effect, semver, its own repository and a type-only DB infrastructure contract; no sibling/runtime/bootstrap/operations import. The absent planned ftc-boundaries test was never executed or credited. `m12-03/tracked-product.patch` contains the three tracked-file changes from product source base; the new test is separately frozen in source-sha256.txt. Self-review inspected that scoped diff and the new test. No broader unrelated package suite was run, following the brief's explicit bounded/non-execution verification selection.

Coverage includes neither foundations/guidance and empty tables; both selected tracks; generic SDK-wide courses with both library bindings; wrong library/track/exact version before lookup; every captured request-binding field; missing classification/content pairs; concrete versions; Chinese/local-only queries; missing translation/local availability/lesson; mixed version, duplicate exercise and declaration/metadata incompatibility; preserved all exercise IDs/prompts/criteria and physical true/false/omitted policy; no prose-derived build/reading requirements; caller, binding-reply and returned-content mutation; back-to-back project/configuration isolation; exact facade/schema identities and encoded optional omission; nine cleanup combinations and delayed cleanup waiting. A nominal zero-operation counter retains the planned exact assertion; the substantive no-operation evidence is the consumed API/import boundary plus unchanged configuration and empty personal tables, not physical robot observation.

Final SHA-256:

```text
4f9937077d82a417629de4b1955e0ebd0ada16cee33b5cb76c4cb18cfae776c0  packages/core/src/ftc/learning.ts
34ca3697d2292ef2d69b2c4a54288d9b81aacda47b80138579753dda53adda35  packages/core/test/ftc/learning-and-progress/m12-03.test.ts
2b4e0d4f36efd1a7d030417bd449938736dc7d5a950f2a5a1d3b662977cebc5d  packages/schema/src/ftc-learning.ts
369d3ebbeb23a88c8ba70e078975c043c10defd57684be65eb345ab7d8f34135  packages/schema/test/ftc-learning.test.ts
```

## Gaps and unrun gates

Actual source gap remains the absent combined trusted production project/curriculum binding adapter. Current M2 context has project identity without SDK/library facts; M6 manifest has managed selection without installed version; inspection observations are not an atomic authority. The assigned consumed port can be tested with declared synthetic fixtures, while production provenance belongs to later composition/authored-content work. This does not block the isolated scope defined by the brief.

NOT RUN: authored M11-07/08 autonomous tracks/capstones, real curriculum/student assessment, trusted production composition/adapter, M12-04 evidence evaluation, M12-05 capstones, M12-06 routing, offline restoration/course acceptance, Chinese terminology review, physical configuration/tuning/diagnosis/deployment, macOS/Windows UI/runtime/packaging/release acceptance. No providers, models, network, toolchains, migration generation/user-DB migration, Client generation, agent startup, builds or robot operations were run. Predecessor learning regressions include actual tracked migrations only inside disposable test databases. Fixtures exercise isolated software behavior; source-labelled provenance fixtures remain synthetic declarations, not authenticated production sources or real competence evidence. No open implementation check failure remains; review and coordinator completion credit are pending.
