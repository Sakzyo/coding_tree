# M4-03 independent task review

## Spec Compliance

- ❌ **Issues found:** guided installation advice is not bound to a validated requested profile when tools are missing. `packages/core/src/ftc/environment.ts:346` checks profile identity only if inspection has already produced a candidate, while `packages/core/src/ftc/environment.ts:521` obtains installation artifacts directly from the requested ID. This misses the task's actionable, platform/version-specific guidance requirement. See Important finding I1.
- ✅ The required build gate is implemented: inspection alone remains non-ready, dirty inputs cannot dispatch verification, and successful evidence must match the project, root, saved revisions and complete toolchain before a fresh context check and scoped cleanup allow ready. Evidence: `packages/core/src/ftc/environment.ts:363`, `:389`, `:399`, `:411`; `packages/schema/src/ftc-environment.ts:250`; `packages/core/test/ftc/environment-and-compatibility/m4-03.test.ts:83`, `:197`, `:222`, `:245`, `:271`, `:548`.
- ✅ Changes stay within the assigned module, producer-owned serializable Schema records, six English/Chinese messages and scoped parity test. Core runtime uses Effect, owns handles/maps/fibers and imports no App, Protocol, Server or sibling implementation. The inspection adapter still has no installer or robot-command port. Evidence: `packages/core/src/ftc/environment.ts:20`, `:249`, `:256`, `:283`; `packages/schema/src/ftc-environment.ts:218`; `packages/app/src/i18n/en.ts:1151`; `packages/app/src/i18n/zh.ts:1228`.
- ✅ The six-key localization exemption is acceptable within the explicitly assigned first-version language scope. It is an exact set, applies only to missing App keys outside Chinese, and retains pre-existing key, extra-key, placeholder and plural checks. English/Chinese phrases receive additional nonempty, translated-content and placeholder checks. Evidence: `packages/app/src/i18n/parity.test.ts:6`, `:118`, `:120`, `:136`, `:147`. Existing dictionary text is unchanged in the complete diff.
- ⚠️ **Cannot verify from this diff:** actual canonical project identity/root lookup, trustworthy saved/dirty revision tracking, actual successful M5 build execution and APK digest calculation. The injected context/build ports are the trust boundary, not proof of these external facts (`packages/core/src/ftc/environment.ts:256`, `:366`; `packages/schema/src/ftc-environment.ts:233`, `:250`). Root must retain these as M4-06/M5 integration gates and verify the eventual adapter does not call setup recursively or accept caller-asserted readiness.
- ⚠️ **Cannot verify from this diff:** real macOS/Windows inspection, installation permissions, supported-profile evaluation, rendered UI interpolation and Chinese editorial quality. These are explicitly unclaimed in `docs/validation/M4-03-implementation.md:129`; retain the named downstream platform/UI gates. Translation corpus inspection is reported at `docs/validation/M4-03-implementation.md:116`, but this review did not independently fetch those corpora or the unavailable Microsoft guide PDF.
- ⚠️ `readiness` is an explicitly documented local snapshot (`packages/core/src/ftc/environment.ts:276`, `:510`). It invalidates on deliberate recheck, not on every later filesystem edit. The host must refresh before treating a prior observation as current operational readiness; no live watcher or execution-time M9 validation is established by this task.

## Strengths

- Public records are Schema-owned and serializable, with branded project IDs, closed stable error/message sets and optional omission checks; runtime SetupRun stays Core-owned. Evidence: `packages/schema/src/ftc-environment.ts:218`, `:265`, `:271`, `:287`; `packages/core/src/ftc/environment.ts:249`; `packages/core/test/ftc/environment-and-compatibility/m4-03.test.ts:619`.
- Build verification preserves separate editor/build Java paths and pins, rejects malformed/false-current evidence and verifies every toolchain identity rather than relying on a success flag. Evidence: `packages/schema/src/ftc-environment.ts:259`; `packages/core/src/ftc/environment.ts:381`, `:570`; `packages/core/test/ftc/environment-and-compatibility/m4-03.test.ts:222`, `:298`.
- Cancellation interrupts the owned check and waits for scoped port cleanup; rechecks are deliberate, active same-project operations reject busy, and different projects/instances use independent state. Tests exercise actual Effect acquisition/release, fibers and streams instead of replacing the service with a mock. Evidence: `packages/core/src/ftc/environment.ts:307`, `:430`, `:468`, `:495`; `packages/core/test/ftc/environment-and-compatibility/m4-03.test.ts:343`, `:401`, `:438`, `:468`, `:733`.
- Failure handling prevents cleanup defects from publishing ready, keeps build-failed/stale/malformed outcomes distinguishable, and preserves unknown imported requirements without a candidate or build. Evidence: `packages/core/src/ftc/environment.ts:375`, `:381`, `:386`, `:422`; `packages/core/test/ftc/environment-and-compatibility/m4-03.test.ts:166`, `:235`, `:497`, `:548`.
- The added runtime complexity largely follows the exposed run/event/cancel lifecycle: one guided service, one instance-local map, one child scope per run and one owned check fiber. There is no universal registry, new daemon, production bootstrap, timer or automatic retry. Evidence: `packages/core/src/ftc/environment.ts:280`, `:287`, `:310`, `:438`, `:482`.

## Issues

### Critical (Must Fix)

- None found in the reviewed task scope.

### Important (Should Fix)

- **I1 — Validate the selected compatibility profile before producing installation advice.** `packages/core/src/ftc/environment.ts:346` gates profile mismatch handling on `candidateToolchain`, which is absent in the very missing-tool state guided installation must handle. `packages/core/src/ftc/environment.ts:521` then selects any catalog record whose ID matches the request without checking whether it is the coherent profile resolved for this host/project. A focused reproduction with valid synthetic dependency pins and all five probes missing returned:

  ```json
  {"profileID":"unknown","state":"missing","buildJdk":{"step":{"id":"buildJdk","state":"missing","cause":"binary_missing","recovery":"install"},"messageKey":"ftc.setup.install","os":"macos","osVersion":"fixture-os","architecture":"arm64"}}
  {"profileID":"win","state":"missing","buildJdk":{"step":{"id":"buildJdk","state":"missing","cause":"binary_missing","recovery":"install"},"messageKey":"ftc.setup.install","os":"macos","osVersion":"fixture-os","architecture":"arm64","version":"99","source":"https://fixtures.invalid/tool.zip","license":"fixture-license"}}
  ```

  The unknown profile emits an installation phrase without its required version/source values. The Windows/x64 profile emits its Java pin under a macOS/arm64 host label. Guided setup can therefore direct a user to the wrong prerequisite before ever obtaining a candidate; merely remaining non-ready does not make this advice correct. Resolve/validate the requested profile against the host and imported requirements independently of installed-tool availability, and obtain install metadata only from that validated result. Unknown, mismatched, unsupported or ambiguous selection must yield actionable profile/project review rather than installation advice with guessed or missing values. Preserve manual `requirements_unknown` behavior and avoid build dispatch. Add regression cases combining a missing tool with an unknown ID and with a known profile incompatible with the host/project. The existing profile test at `packages/core/test/ftc/environment-and-compatibility/m4-03.test.ts:189` uses available tools and does not cover this branch.

### Minor (Nice to Have)

- None identified separately from I1; remaining real-host, adapter, UI and subscriber-load checks are explicitly unclaimed integration gates rather than defects established by this diff.

## Checks and review limits

- Reviewed complete task package `.superpowers/sdd/progress/review-97b5f4ee6..575d0901e.diff`, base `97b5f4ee6`, head `575d0901e`, against the exact brief and implementation evidence. No Git commands, suites, typechecks, package-wide lint or formatting checks were rerun. Root supplied the six-file hash reconciliation for this snapshot.
- Inspected unchanged `inspectEnvironment` in `packages/core/src/ftc/environment.ts:35` through `:218` for the named risk that a missing tool suppresses candidate identity before the guided profile check. It confirms candidates require every tool ready (`:165`), while compatible profile resolution precedes that test (`:67`). Also inspected unchanged `packages/core/src/ftc/environment/adapters.ts:6` for the named risk of installer/build/robot operations crossing the read-only inspection boundary; its ports are limited to dependency snapshots and cancellable read-only tool discovery.
- Read owning M4 module context and App/Schema instructions for profile, import, serialization and localization boundaries. No other product sources were inspected for speculative risks.
- Read final supplied logs: focused **44 pass / 152 assertions**, covering **149 pass / 394 assertions**, localization parity **6 pass / 1003 assertions**, Schema hygiene **5 pass / 10 assertions**, Core/Schema/App typechecks and scoped lint/format success. Final outputs contain no warnings or unexplained failure noise. RED and initial failed typecheck logs are explicitly labelled historical evidence. These recorded runs do not cover I1.
- Ran only one named-doubt reproduction, using `bun -e` from `/Users/dylanxu/coding_tree/packages/core` with pinned Bun 1.3.14 and task-owned `/private/tmp/ftc-m4-03-review` OPENCODE/XDG paths. It created the real guided layer with synthetic immutable context/inspection/build fixtures, requested `unknown` then `win`, and printed the two records above. Exit **0**. Build port was `Effect.die("unexpected build")` and was never called. No product/test files, installers, toolchain/build processes, Git state, app/server or ledger were changed. Sole written deliverable is this review.
- Root must repair I1, obtain meaningful failing/passing missing-tool profile cases and reconcile the repaired source/evidence/review before completing M4-03. Do not convert this task review or fixture validation into real build, platform, production M5 composition or rendered UI acceptance.

## Assessment

**Task quality: Needs fixes.**

**Reasoning:** The build trust boundary, resource lifecycle and assigned localization/test scope are sound for an isolated guided-service candidate. Installation guidance currently bypasses compatibility-profile validation when tools are missing, so the task's main guided recovery path cannot be trusted until I1 is fixed.

## Scoped re-review — repair round 1

### Spec Compliance

- ✅ **Spec compliant within the reviewed task scope; I1 resolved.** Reviewed fix-only package `.superpowers/sdd/progress/review-13838cc97..c91019968.diff`, base `13838cc97`, head `c91019968`, and the appended implementation evidence. This verdict supersedes the original Needs fixes assessment above.
- `packages/core/src/ftc/environment.ts:41` privately exposes the existing inspection's resolver-matched profile alongside readiness. Public inspection still projects exactly the canonical readiness record at `:38`. The repair reuses the existing single dependency read and full-catalog resolution rather than performing a second read or filtering away ambiguity.
- `packages/core/src/ftc/environment.ts:360` through `:396` validates requested identity independently of candidate/tool availability, excludes unknown imported requirements from installation metadata, and changes unvalidated install actions into manual project/profile review. `setupSteps` now accepts the validated profile at `:548` and contains no requested-ID catalog lookup. Unknown, host-incompatible, project-incompatible, ambiguous and unevaluated selections cannot emit the malformed/wrong-profile advice reproduced in I1.
- The six regressions at `packages/core/test/ftc/environment-and-compatibility/m4-03.test.ts:780` exercise the real guided service. Assertions at `:843` through `:854` verify expected aggregate state, no install message/recovery, manual review, no version/source/candidate, zero build calls and exactly one dependency read. The `requirements_unknown` case retains missing/manual behavior. Existing valid-profile pinned instructions and valid Windows guidance remain covered by unchanged tests.
- ⚠️ **Cannot verify items unchanged:** production canonical root/context binding, real saved/dirty revision tracking, trustworthy M5 build/APK evidence, real platform support, UI interpolation and Chinese editorial acceptance remain separate downstream gates. This repair makes no new claims about them.

### Quality

- **Task quality: Approved.** The private result helper is a justified shared boundary: it preserves public inspection behavior, resource scope and snapshot coherence while eliminating the unsafe catalog lookup. No duplicated inspection/probing, new public contracts, imports, global state or resource-lifecycle mechanisms were introduced.
- **Critical:** None. **Important:** None outstanding; I1 closed. **Minor:** None found in I1 or introduced changes.
- Build-evidence gating and freshness checks are unchanged except for receiving the validated profile when constructing messages. Run fibers, cancellation, event publication, deliberate retry and project/instance isolation are untouched. The supplied covering run still exercises their existing cases.
- Read supplied evidence: six meaningful regression failures before repair; focused **50 pass / 206 assertions**; covering M4 **155 pass / 448 assertions**; parity **6 pass / 1003 assertions**; Core typecheck and scoped lint/format/diff checks passed. Final logs contain no warnings or unexplained failures. Root reported matching all six current source hashes; Schema/App sources are unchanged.
- No suites, typechecks, focused reproductions or Git commands were rerun, and no additional unchanged product sources were inspected: the fix diff and its regression assertions answer the original doubt without a new concrete ambiguity. Only this scoped verdict was appended to the authorized review file.
