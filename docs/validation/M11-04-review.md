# M11-04 independent task review

## Spec Compliance

- ✅ Spec compliant for the assigned foundation-content implementation: all four requested topics have paired original lessons and exercises, with stable IDs/version/order and mandatory explanation plus actual-project application. Evidence: `packages/core/resources/ftc/content/en/foundations.json:8`, `:25`, `:42`, `:59` and the corresponding Chinese lines; required behavioral assertions are in `packages/core/test/ftc/ftc-knowledge/m11-04.test.ts:20`.
- ✅ The conditionally assigned contract changes remain small, serializable and optional: exercise flags are true literals, criteria and exercise arrays must be nonempty, and older documents may omit lessons. Evidence: `packages/schema/src/ftc-knowledge.ts:31`, `:41`, `:57`.
- ✅ Actual content bytes retain digest/UTF-8/schema/identity checks, add concrete lesson-version and duplicate-ID checks, protect nested code literals, and compare paired lesson/exercise identities and order. Evidence: `packages/core/src/ftc/knowledge.ts:216`, `:251`, `:269`, `:293`, `:300`.
- ✅ The assigned M11-01 migration preserves the meaningful empty-production-pack validation check at `packages/core/test/ftc/ftc-knowledge/m11-01.test.ts:453`. The obsolete requirement that the evolving shipped manifest remain empty is superseded by real production-content validation and lookup at `packages/core/test/ftc/ftc-knowledge/m11-04.test.ts:20`.
- ✅ SDK applicability is explicitly limited to `11.1.0`; reference provenance and original-content license are distinguished, and neither content nor evidence claims platform certification, physical success or course completion. Evidence: `packages/core/resources/ftc/content/manifest.json:9`, `:11`, `packages/core/resources/ftc/content/en/foundations.json:5`, `docs/validation/M11-04-implementation.md:90`, `:155`.
- ⚠️ Official Chinese language-authority verification and native/domain acceptance are unverified. The two maintained primary developer corpora establish useful terminology evidence, but the failed authority lookup supplies none. The controller must retain this locale-readiness gate and must not describe the Chinese lessons as officially or natively approved. Evidence: `packages/app/AGENTS.md:35`, `docs/validation/M11-04-implementation.md:79`, `:86`, `:155`. This is distinct from the brief's implemented requirements to consult two corpora, preserve identifiers and document uncertain terms.
- ⚠️ Compilation in an actual student FTC project, macOS/Windows toolchain/editor acceptance, supervised configured-hardware observations, deployed-build association and student explanation/application assessment cannot be established by this diff or the TypeScript tests. The controller must preserve their unrun status rather than promote M11 or a course track to complete. Evidence: `docs/validation/M11-04-implementation.md:155` and the observation requirements at `packages/core/resources/ftc/content/en/foundations.json:37`, `:54`, `:71`.

## Strengths

- Exercises require specific project files/call sites and substantive explanations; predicted values, build results and actual observations are kept separate. Hardware names remain explicit placeholders until real configuration is supplied. Evidence: `packages/core/resources/ftc/content/en/foundations.json:20`, `:37`, `:54`, `:71`, with equivalent Chinese criteria.
- Versioned examples teach observation and pure calculations without motor commands or invented configuration/measurements. The lifecycle example checks stopping after waiting and during repetition, while hardware lookup is confined to initialization. Evidence: `packages/core/resources/ftc/content/en/foundations.json:29`, `:46`.
- Negative tests mutate real document bytes and recompute the digest, so validation failures demonstrate content/contract checks rather than merely a hash mismatch. They cover pairing, versions, duplicate IDs, false required flags, blank criteria and protected literals across lesson/exercise text. Evidence: `packages/core/test/ftc/ftc-knowledge/m11-04.test.ts:59`, `:77`.
- Query tests exercise the real module with injected narrow ports and verify language/version/local selection, nested content access and unchanged source metadata. No new search engine, network initialization, course engine, progress owner or host wiring is introduced. Evidence: `packages/core/test/ftc/ftc-knowledge/m11-04.test.ts:164`, `packages/core/src/ftc/knowledge.ts:216`, `packages/schema/src/ftc-knowledge.ts:31`.
- Durable evidence separates the expected RED and intermediate repaired failures from pristine final runs. The inspected final logs record focused 4/0/108, M11 regression 89/0/398, Schema 6/0/12, and clean scoped lint/format results. Evidence: `docs/validation/m11-04/red.log:10`, `green-focused-final.log:9`, `green-covering-final.log:98`, `schema-tests.log:13`, `lint-final.log:1`, `format-final.log:2`.

## Issues

### Critical (Must Fix)

- None found in this task range.

### Important (Should Fix)

- None found in the assigned implementation. Unverified acceptance gates are listed separately above.

### Minor (Nice to Have)

- `packages/core/test/ftc/ftc-knowledge/m11-01.test.ts:452`: after migration to a literal empty fixture, comparing that literal to the identical literal no longer tests product behavior. Remove this redundant assertion when revisiting the fixture; retain the real `validatePack` assertion at line 453. The test still verifies actual behavior, so this is not a blocking test-that-asserts-nothing finding.

## Checks and review boundaries

- Reviewed the stable complete task package `.superpowers/sdd/progress/review-06036d945..77f3ce1b8.diff` in bounded passes, base `06036d945`, head `77f3ce1b8`, including product `c425aad48` and durable-evidence `77f3ce1b8`. No Git commands or product/index/ledger edits were made.
- Named risk: compatibility of the expanded validator with existing content. The diff starts partway through `validateContent`; inspected only the cut-off function context at `packages/core/src/ftc/knowledge.ts:250` to confirm the existing hash, exact UTF-8 and identity checks remain before the nested checks. Existing no-lessons regression results are visible in `docs/validation/m11-04/green-covering-final.log:36` onward.
- Named risk: inaccurate selected-version lifecycle or telemetry teaching. Checked retained `LinearOpMode.java:53`, `:117`, `:149`, `:170` for wait/interruption/idle/stop behavior and `Telemetry.java:56`, `:104`, `:316` for explicit linear updates, automatic iterative updates and throttled transmission. These support the claims at `packages/core/resources/ftc/content/en/foundations.json:29`, `:46`.
- Named risk: hidden hardware initialization or invented encoder units. Checked retained `HardwareMap.java:69`, `:189`, `:209` and `DcMotor.java:176`; these support initialization-phase typed lookup, lookup failure and encoder-specific count units at `packages/core/resources/ftc/content/en/foundations.json:46`.
- Named risk: translation review based only on model knowledge or a failed authority lookup. Inspected `packages/app/AGENTS.md:23` through `:35`, pinned VS Code class/method terminology (`vscode-zh.txt:538`, `:554`) and Firefox expression/variable/function/scope terminology (`firefox-zh.txt:67`, `:491`, `:694`, `:757`, `:816`). The failed official lookup remains uncredited as documented at `docs/validation/M11-04-implementation.md:86`.
- Existing run evidence answers the implementation doubts raised by this review. No tests or suites were rerun. Root's independently matched seven product hashes and 22 source-snapshot hashes are recorded at `docs/validation/M11-04-implementation.md:161`; this review makes no new hash-audit claim.

## Assessment

**Task quality:** Approved, with the minor redundant assertion and explicit unverified acceptance gates above.

**Reasoning:** The task delivers focused bilingual foundation content through the existing validated knowledge records with a minimal optional schema extension and meaningful behavioral regression coverage. Its evidence supports content authoring and validator/query compatibility while preserving the distinction between software checks and actual translation, student, platform and robot acceptance.
