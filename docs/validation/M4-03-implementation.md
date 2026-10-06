# M4-03 implementation evidence

Date: 2026-10-06. Status: **DONE_WITH_CONCERNS**, frozen completion candidate awaiting coordinator commit and independent review. Assignment base: `32dbfd69b317d8e4188674dcd5aab465160a5e0e`; independently reviewed M4-02 prerequisite: `f075a4348`. Reconciled shared HEAD: `9b71593fbd0311138cfd2fb2d8a1edfce6801c3f`. Other lanes advanced HEAD independently. This worker did not stage, commit, edit task/progress checklists, or spawn another agent.

The intentional interruption preserved the complete implementation and successful checks. On resumption, all six source hashes still matched the saved [SHA256SUMS](m4-03/SHA256SUMS), the exact brief and latest handoff were reread, and the saved candidate was inspected. No product/test edits or repeated successful suites were necessary. The missing final `prettier --check` was run and passed; this report is the remaining deliverable.

## Accepted contract and behavior

The coordinator approved the narrow guided facet before dependent implementation, then explicitly assigned the six-message English/Chinese dictionaries and scoped parity test when existing keys proved insufficient.

- Existing `Environment.Service` / `Environment.layer(inspectionPorts)` remains an inspection-only public contract. `Environment.GuidedService` / `guidedLayer({ inspection, context, builds })` adds the guided facet in the same M4 module. No new package, registry, daemon, sibling implementation import, or host registration was introduced.
- `prepareEnvironment({ choice: "guided", profileID, projectID })` starts the first inspection and build-verification attempt and returns a Core-owned `SetupRun`. `projectID` is required because both state and the context lookup are project-bound; the Schema contracts reuse the current `Project.ID` brand with nonempty/trimmed request validation. A prepare semaphore serializes handle replacement, not the per-project checks.
- `SetupRun.result` awaits the current attempt while active and otherwise returns its latest result. `recheck()` deliberately rereads the context, dependencies and five separate tool probes, invalidates old build readiness, then repeats verification if prerequisites permit. There is no extra verification mode, timer, automatic retry, or startup replay. `readiness({ projectID })` reads the latest local observation without external I/O; an unobserved project returns pending/missing, never ready. Later source changes become visible through deliberate recheck; this is not a live filesystem watch.
- The `context.read` port supplies an immutable `SetupContext`: the canonical M4 inspection request plus saved source/configuration revisions and dirty state. The `builds.verify` port receives project ID, canonical root, candidate toolchain and those saved revisions. Both ports perform their work in the check's Effect scope and own resource cleanup there. No installer/download/configuration port exists in guided mode.
- Reviewed M4 inspection is reused directly. Missing tools produce version/platform/source/license instructions; incompatible imports are not rewritten. Unknown imported requirements remain manual `requirements_unknown` with no candidate and no build. A candidate must match the explicitly requested profile before it can be verified. Distinct build and editor Java paths/pins remain separate.
- `FtcEnvironment.BuildRequest` and `BuildVerification` describe the M4 verification-port exchange and setup summary only. They do not claim to implement or replace M5's future `BuildEvidence`/build execution service. The future M4-06 adapter must obtain real M5 saved-revision/APK evidence without recursive setup calls. `verified` requires project/root/toolchain, saved source/configuration revisions, a SHA-256 APK digest and `current: true`; failed/stale outcomes remain distinct.
- A verified record alone does not establish readiness. M4 decodes it strictly, matches every toolchain path/version and project/revision field, rereads the current context, and rejects dirty, malformed or changed snapshots. A flag alone, mismatched result or inspection alone cannot become ready. Only a complete matching result after scoped cleanup produces ready. The digest and actual build success remain the trusted port's responsibility; fixture records do not prove either physically occurred.
- Schema owns only serializable request/context/step/result/event/error/verification records with stable identifiers. `SetupRun`, Effect services, fibers, deferred completion, streams and maps stay Core-owned. Core carries a closed set of six typed dictionary keys; it does not import App runtime code. The focused tests verify those keys against actual App dictionaries.

## Lifetime, events, cancellation and recovery

Each service instance owns its own per-project map inside the caller's Effect layer scope. Importing the module, creating a layer or reading an unknown project's readiness starts no probe or build. The host must retain the guided service scope for the lifetime of its run handles; returning a handle after disposing that scope returns a cancelled/stale handle, not detached background work.

Each prepare creates a child scope, a step/event PubSub and an owned check fiber. Events are scoped, process-local records, with a replay window of 16 recent records for late subscribers; this is not a durable event log. Inspection emits current component steps; build settlement emits the build step and a terminal `settled` result. Stream subscriptions are owned by their consuming Effect scopes. Replacing an idle/cancelled run closes its old child scope and shuts its PubSub down; service disposal closes all children and subscriptions.

An active same-project prepare/recheck returns `busy`. Different project IDs and independent service instances can check concurrently. Cancellation marks the run terminal, interrupts its owned check and waits for port finalizers before settling its result/event. Cancellation does not publish ready. A cancelled run rejects recheck; an explicit new prepare retries with a fresh child scope. An idle run may deliberately recheck a failed result without reinstalling tools. Disposed services reject prepare/readiness and stale run rechecks with `closed`.

Typed build failures produce `build_failed` / `verify_build`, while malformed responses and stale evidence produce separate causes. Unexpected context/probe/finalizer defects become non-ready failed setup, preserving a recoverable review step; mixed interruption remains cancellation. A failing finalizer cannot publish ready, but these synthetic finalizers do not prove production process cleanup. No project file, SDK, dependency or global machine configuration is changed by this implementation.

## RED → GREEN and verification

The initial focused test was written before implementation. The corrected baseline loads the real module and fails because `Environment.guidedLayer` is absent: **0 pass, 1 fail, 1 assertion, exit 1** ([red.log](m4-03/red.log)). This baseline tests the missing public guided entrypoint; it does not yet observe a wrong ready/missing transition because no guided service existed. The final version exercises the full transition using deferred evidence: before the supplied build result arrives, readiness is non-ready; after matching evidence, readiness is ready.

A further behavioral RED exposed a real error-classification defect: a typed build-port failure was incorrectly reported as `invalid_response`, rather than `build_failed`. The two-case focused selection produced **1 pass, 1 fail, 4 assertions, exit 1** ([build-failure-red.log](m4-03/build-failure-red.log)); the smallest production fix preserves the typed failure branch. Final focused/covering runs include that assertion and pass.

The newly added localization test was run with the six Chinese messages absent. It failed on missing translated content, not parsing/imports: **0 pass, 1 fail, 5 filtered, 2 assertions, exit 1** ([i18n-red.log](m4-03/i18n-red.log)). Restoring the required messages makes the complete affected parity suite pass.

Initial command preparation included a wrong working-directory path and a test-parenthesis error; both were corrected before recording the valid baseline. An intermediate locale-removal attempt left a wrapped string and produced a parse error; it was corrected before replacing `i18n-red.log` with the behavioral missing-message result. Intermediate Core typechecking also identified deferred-generic and error-union inference failures ([core-typecheck-initial.log](m4-03/core-typecheck-initial.log), exit 2); these were repaired within owned paths. Later canonical project branding required making the fixture with `Project.ID.make`. The final covering suite and typecheck verify that final fixture/source snapshot. No final failures are omitted below.

All commands use Bun **1.3.14 (`0d9b296a`)**, with this pinned PATH prefix:

```sh
PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH
```

Core test commands additionally use task-owned locations:

```sh
OPENCODE_TEST_HOME=/private/tmp/ftc-m4-03-state/home
XDG_DATA_HOME=/private/tmp/ftc-m4-03-state/data
XDG_CONFIG_HOME=/private/tmp/ftc-m4-03-state/config
XDG_CACHE_HOME=/private/tmp/ftc-m4-03-state/cache
XDG_STATE_HOME=/private/tmp/ftc-m4-03-state/state
```

The existing Core preload disables model fetching and uses its test database configuration. No user app/server was restarted.

| CWD                                          | Exact command after the environment prefix                                                                                                                                                                                                                                           | Exit / result                                                                                      | Evidence                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `/Users/dylanxu/coding_tree/packages/core`   | `bun test ./test/ftc/environment-and-compatibility/m4-03.test.ts`                                                                                                                                                                                                                    | 1; missing guided baseline, 0 pass / 1 fail / 1 assertion                                          | [RED](m4-03/red.log)                                    |
| `/Users/dylanxu/coding_tree/packages/core`   | `bun test ./test/ftc/environment-and-compatibility/m4-03.test.ts --test-name-pattern 'typed.*failure'`                                                                                                                                                                               | 1; 1 pass / 1 fail / 37 filtered / 4 assertions                                                    | [Failure RED](m4-03/build-failure-red.log)              |
| `/Users/dylanxu/coding_tree/packages/core`   | `bun test ./test/ftc/environment-and-compatibility/m4-03.test.ts`                                                                                                                                                                                                                    | 0; 44 pass / 0 fail / 152 assertions                                                               | [Focused GREEN](m4-03/green.log)                        |
| `/Users/dylanxu/coding_tree/packages/core`   | `bun test ./test/ftc/environment-and-compatibility`                                                                                                                                                                                                                                  | 0; 149 pass / 0 fail / 394 assertions across all three M4 files; includes all 44 final M4-03 cases | [Final covering snapshot](m4-03/regression.log)         |
| `/Users/dylanxu/coding_tree/packages/core`   | `bun typecheck`                                                                                                                                                                                                                                                                      | 0                                                                                                  | [Core](m4-03/core-typecheck.log)                        |
| `/Users/dylanxu/coding_tree/packages/schema` | `bun typecheck`                                                                                                                                                                                                                                                                      | 0                                                                                                  | [Schema](m4-03/schema-typecheck.log)                    |
| `/Users/dylanxu/coding_tree/packages/schema` | `bun test ./test/contract-hygiene.test.ts`                                                                                                                                                                                                                                           | 0; 5 pass / 0 fail / 10 assertions                                                                 | [Schema contracts](m4-03/schema-contracts.log)          |
| `/Users/dylanxu/coding_tree/packages/app`    | `bun typecheck`                                                                                                                                                                                                                                                                      | 0                                                                                                  | [App](m4-03/app-typecheck.log)                          |
| `/Users/dylanxu/coding_tree/packages/app`    | `bun test ./src/i18n/parity.test.ts --test-name-pattern 'guided setup has six'`                                                                                                                                                                                                      | 1; 0 pass / 1 fail / 5 filtered / 2 assertions                                                     | [i18n RED](m4-03/i18n-red.log)                          |
| `/Users/dylanxu/coding_tree/packages/app`    | `bun test ./src/i18n/parity.test.ts`                                                                                                                                                                                                                                                 | 0; 6 pass / 0 fail / 1003 assertions                                                               | [Complete affected parity suite](m4-03/i18n-parity.log) |
| `/Users/dylanxu/coding_tree`                 | `bun node_modules/.bin/oxlint packages/core/src/ftc/environment.ts packages/core/test/ftc/environment-and-compatibility/m4-03.test.ts packages/schema/src/ftc-environment.ts packages/app/src/i18n/en.ts packages/app/src/i18n/zh.ts packages/app/src/i18n/parity.test.ts`           | 0; 0 warnings / 0 errors                                                                           | [Lint](m4-03/lint.log)                                  |
| `/Users/dylanxu/coding_tree`                 | `bun node_modules/.bin/prettier --check packages/core/src/ftc/environment.ts packages/core/test/ftc/environment-and-compatibility/m4-03.test.ts packages/schema/src/ftc-environment.ts packages/app/src/i18n/en.ts packages/app/src/i18n/zh.ts packages/app/src/i18n/parity.test.ts` | 0; all matched; performed on resumption because the final check was missing                        | [Format](m4-03/format-check.log)                        |
| `/Users/dylanxu/coding_tree`                 | `git diff --check -- packages/core/src/ftc/environment.ts packages/core/test/ftc/environment-and-compatibility/m4-03.test.ts packages/schema/src/ftc-environment.ts packages/app/src/i18n/en.ts packages/app/src/i18n/zh.ts packages/app/src/i18n/parity.test.ts`                    | 0                                                                                                  | [Scoped diff](m4-03/diff-check.log)                     |

The focused GREEN precedes the fixture's final canonical `Project.ID.make` typing-only adjustment; the final covering run reruns every focused case against that exact frozen source, with unchanged runtime fixture values. Schema's successful typecheck/contracts run predates that Core-test-only adjustment and remains valid. Successful checks were not repeated merely because HEAD advanced through unrelated lanes or because this turn resumed.

No full Core/App/Schema suite was run for this scoped task. The shared execution rules prescribe relevant checks; unrelated known Schema event-manifest failures remain documented in M4-02 evidence, and unrelated App suite failures do not authorize edits. No Protocol/HttpApi or legacy SDK surface changed, so client generation was not applicable.

## Assertion map

Anchors refer to `packages/core/test/ftc/environment-and-compatibility/m4-03.test.ts` at the frozen source hashes below.

| Test anchor / cases                       | What the real implementation verifies                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 83; required readiness case               | Deferred build evidence leaves readiness non-ready; matching evidence becomes ready; public snapshot and canonical result agree      |
| 127; 5 missing-tool cases                 | Missing asset identity, platform/version/source/license instructions, no build dispatch                                              |
| 166; unknown imported requirements        | Manual requirement review, no descriptor, no build                                                                                   |
| 189; requested profile                    | Candidate mismatch is incompatible and cannot be verified                                                                            |
| 197; 6 malformed/mismatched build cases   | Wrong project/root/revisions, false current flag or invalid APK digest cannot produce ready/evidence                                 |
| 222; toolchain binding                    | A different Java path is stale and fails readiness                                                                                   |
| 235; 2 failed/stale build cases           | Distinct build cause with verify recovery and localized message                                                                      |
| 245; 4 freshness cases                    | Changed source/config revision, root or dirty state after verification invalidates readiness                                         |
| 271; initial dirty state                  | No build invoked for dirty inputs                                                                                                    |
| 298; deliberate retry                     | All five probes run again, failed build can deliberately recover, exact scoped request retains separate Java paths/revisions         |
| 343; active cancellation                  | Busy same-project operations, finalizer completion, cancelled result/event, terminal old handle, successful explicit new prepare     |
| 401; service disposal                     | Active build lease closes; saved result becomes cancelled; stale prepare/recheck handles reject closed scope                         |
| 438 and 468; project/instance concurrency | One cancelled project cannot change another ready project; instances keep distinct readiness                                         |
| 481; scoped events                        | Current steps include build and terminal result exposes ready                                                                        |
| 497; 2 typed failures                     | Context/build leases release; typed build failure is `build_failed` rather than malformed response                                   |
| 519; success cleanup                      | Five probe leases and one build lease close before ready is returned                                                                 |
| 548; cleanup defect                       | Failed finalizer cannot publish ready or build evidence                                                                              |
| 563; 4 invalid requests                   | Automatic mode, missing/empty/excess input rejected before context I/O                                                               |
| 595; construction/snapshot                | Factory/layer construction and snapshot query perform no context read; invalid query rejected                                        |
| 619; canonical records                    | Undefined optional fields omit keys, JSON roundtrip, nine stable/unique public identifiers                                           |
| 655; dictionary boundary                  | Every produced key exists in English/Chinese, phrases differ, placeholders match                                                     |
| 676; Windows values                       | Supplied Windows/x64 context selects corresponding pinned installation instructions and separate Java pins                           |
| 710; 3 malformed contexts                 | Invalid/excess snapshots fail before any build                                                                                       |
| 733; probe cancellation                   | Pending probe lease closes; no build dispatch follows cancellation                                                                   |
| App parity test, new case at 136          | Exactly six complete English/Chinese messages; existing all-locale key/placeholder/plural checks continue for every pre-existing key |

## Localization rationale and source review

The coordinator explicitly restricted first-version FTC guided messages to English and Simplified Chinese. The previous all-locale parity test would require translations in all other supported languages despite that scope. Its change exempts **exactly** `ftc.setup.install`, `permission`, `review`, `recheck`, `verify`, and `available` in non-Chinese App locales. It does not exempt a prefix or future key, alter UI/Desktop domain coverage, relax existing placeholders/plurals/extra-key checks, or change language fallback mechanics. A new complete/nonempty/placeholder-preserving English/Chinese test replaces the missing cross-locale requirement for these six keys. The complete affected parity suite passes; independent review should assess this explicit scope decision.

A structural removal of only the six newly added entries from each dictionary was compared byte-for-byte with `git show HEAD:<dictionary path>` before interruption; both comparisons were true. Existing English and Chinese source copy was preserved. App typechecking validates the new keys in the existing typed dictionary system. All six Chinese phrases are translated; none is unexplained retained English.

Maintained independent primary corpora inspected on 2026-10-06:

- [Microsoft VS Code Simplified Chinese localization corpus](https://raw.githubusercontent.com/microsoft/vscode-loc/main/i18n/vscode-language-pack-zh-hans/translations/main.i18n.json): installation actions use 安装 (for example plugin/browser and extension installation entries); agent permission controls use 权限. Its task UI uses 生成 for build-task labels, a context-specific alternative considered rather than mechanically copied.
- [Mozilla Firefox Simplified Chinese preferences corpus](https://raw.githubusercontent.com/mozilla-l10n/firefox-l10n/main/zh-CN/browser/browser/preferences/preferences.ftl): update installation and version entries use 安装 / 版本; privacy controls use 权限; developer-build context uses 构建配置. This supports 构建 in the saved-project build-verification phrase rather than VS Code's task-menu 生成.
- [Unicode CLDR Chinese plural rules](https://www.unicode.org/cldr/charts/48/supplemental/language_plural_rules.html): Chinese uses the `other` cardinal category. These six phrases contain no count/plural family, so no plural mechanism was introduced.
- [Microsoft Localization Style Guides](https://learn.microsoft.com/en-us/globalization/reference/microsoft-style-guides): the official index and Chinese (Simplified) guide link were inspected. The guide's redirect failed in the browsing tool, so the PDF's detailed recommendations were **not** verified. Do not treat the index as evidence that its full guide was applied.

The translation uses complete imperative phrases in the task's installation/permission/recheck/build context. Dynamic identifiers are deliberately retained through placeholders: component IDs, exact versions, URLs, OS names/version, and architecture codes. Java/SDK/ADB/wrapper identifiers are not renamed. “重新检查” is a contextual complete-phrase choice; the VS Code corpus search did not supply an exact phrase match. Native-speaker editorial review and full Microsoft PDF review remain unrun, not implied by placeholder/term checks. No product copy was assembled through locale-specific grammar in Core.

## Fixture classification and remaining gates

All host facts, catalog/version/resource/checksum entries, paths, source/config revisions, APK digest, permission failures and build results in M4-03 tests are synthetic. Effect resource leases establish local lifecycle semantics only. The Windows case uses supplied Windows records on the macOS test host. No actual toolchain probing, process, build, download, installer, machine permission change, project edit, controller access or robot operation occurred. Browsing retrieved localization source text only.

**Not run / not claimed:** production M4-06 host/API/M5 adapter composition; an actual FTC wrapper build or APK digest calculation; real saved/dirty filesystem revision tracking; real macOS or Windows tool inspection/permissions/installation; clean-host compatibility evaluation and support-catalog promotion (M4-07); offline dependency/model/content preparation; UI rendering/interpolation/native-language review; production subscription backpressure/load behavior; Electron/server registration; robot discovery, deployment, start or tuning; any physical acceptance scenario. Existing M5/M8/M9 mandatory gates remain open and were not changed. These future gates do not invalidate the isolated guided-service candidate, but prevent claiming full product/platform readiness.

## Frozen source SHA-256

All six values were independently recalculated on resumption and matched the interrupted candidate. No source changed during report completion.

```text
56c482010033ec5267b102ba9680c58f66a852d2bb03c77c47646488fdd6260f  packages/core/src/ftc/environment.ts
32fbbc070f0a1d877238867247f72d30028853d4669b88948e224901932db868  packages/schema/src/ftc-environment.ts
325ef69ad996ea27f8f7bfbcfb03cd501a32892468ba7c4d9f25fb476a5c94d3  packages/core/test/ftc/environment-and-compatibility/m4-03.test.ts
d178d52b8605127e3cebca264924e8017bcb77643f701e44cdca980e36e0ec6e  packages/app/src/i18n/en.ts
aa1918ea6c914b7c5854f957e9a25a5c828201369a6b56be1ee8f362a6832e9c  packages/app/src/i18n/zh.ts
310ad2c1a9ce989aa8b244f9b1819a9c3c8b530291306dce646867753a4195e7  packages/app/src/i18n/parity.test.ts
```

Deliverables are precisely these six assigned files, this report, and `docs/validation/m4-03/`. The coordinator owns the stable commit, independent review, ledger/checklist updates and later integration. No approval or completed checklist is claimed by this candidate.

## Independent-review fix round 1 of 5

Original reviewed candidate: `575d0901e`. Fix base: `13838cc9778c80c3411e6ff5b0d404aa288a11b4`. Status: **fix candidate frozen for coordinator commit and same-reviewer scoped re-review**. The original report/hash sections above are historical evidence of the reviewed candidate; the updated source manifest below identifies this fix. No staging, commits, ledger edits, new agents, host/toolchain/build/installer work or unrelated changes were made by this worker.

Read [M4-03-review.md](M4-03-review.md) before implementation. Important I1, verbatim:

> - **I1 — Validate the selected compatibility profile before producing installation advice.** `packages/core/src/ftc/environment.ts:346` gates profile mismatch handling on `candidateToolchain`, which is absent in the very missing-tool state guided installation must handle. `packages/core/src/ftc/environment.ts:521` then selects any catalog record whose ID matches the request without checking whether it is the coherent profile resolved for this host/project. A focused reproduction with valid synthetic dependency pins and all five probes missing returned:
>
>   ```json
>   {"profileID":"unknown","state":"missing","buildJdk":{"step":{"id":"buildJdk","state":"missing","cause":"binary_missing","recovery":"install"},"messageKey":"ftc.setup.install","os":"macos","osVersion":"fixture-os","architecture":"arm64"}}
>   {"profileID":"win","state":"missing","buildJdk":{"step":{"id":"buildJdk","state":"missing","cause":"binary_missing","recovery":"install"},"messageKey":"ftc.setup.install","os":"macos","osVersion":"fixture-os","architecture":"arm64","version":"99","source":"https://fixtures.invalid/tool.zip","license":"fixture-license"}}
>   ```
>
>   The unknown profile emits an installation phrase without its required version/source values. The Windows/x64 profile emits its Java pin under a macOS/arm64 host label. Guided setup can therefore direct a user to the wrong prerequisite before ever obtaining a candidate; merely remaining non-ready does not make this advice correct. Resolve/validate the requested profile against the host and imported requirements independently of installed-tool availability, and obtain install metadata only from that validated result. Unknown, mismatched, unsupported or ambiguous selection must yield actionable profile/project review rather than installation advice with guessed or missing values. Preserve manual `requirements_unknown` behavior and avoid build dispatch. Add regression cases combining a missing tool with an unknown ID and with a known profile incompatible with the host/project. The existing profile test at `packages/core/test/ftc/environment-and-compatibility/m4-03.test.ts:189` uses available tools and does not cover this branch.

### Confirmed defect and repair

Six added real-service cases combine all five tools missing with an unknown requested ID, a Windows/x64 requested profile on the macOS/arm64 host, incompatible project requirements, an ambiguous catalog, an unevaluated requested profile, and unknown imported requirements. Before the fix, all six failed on observable state or installation advice: **0 pass / 6 fail / 44 filtered / 10 assertions, exit 1**. The unknown/Windows cases reproduced the independent review's bypass; the other cases verify the named resolver/manual boundaries. See [fix-round1-red.log](m4-03/fix-round1-red.log).

The existing scoped inspection body now returns its resolver-matched profile through a **private** `inspectEnvironmentResult` helper, alongside the same canonical readiness record. The public `inspectEnvironment` and inspection-only Effect service still return exactly Readiness. Both guided setup and public inspection share that implementation; no public Schema contract, catalog resolver, adapter, producer metadata or host API changed.

Guided setup validates the requested ID against the full-catalog resolver result independently of tool availability. Only a matched requested profile with known imported requirements is passed to `setupSteps`/failure-message construction. Instruction construction no longer looks up an arbitrary catalog entry by requested ID. Invalid/unsupported/mismatched/ambiguous profiles remain incompatible, and missing-tool actions become manual project/profile review without install recovery or version/source metadata. Unknown imported requirements retain missing/manual `requirements_unknown` and no candidate/build. The full resolver's ambiguity, evaluation, host/resource and project-version rules remain in force; the code does not filter the catalog to bypass them or silently choose another requested profile.

The helper reuses the **same single dependency snapshot** already read by inspection; every new case asserts one dependency read and zero build calls. The original five valid-profile missing-tool cases still assert actionable pins/source/license/platform metadata; the Windows valid-profile case still passes. Existing build gating, cancellation/finalizers, events, retry, public inspection and concurrency cases remain covered.

The final focused suite is **50 pass / 0 fail / 206 assertions**, and the full covering M4 selection is **155 pass / 0 fail / 448 assertions** across three files. See [focused GREEN](m4-03/fix-round1-green.log) and [covering M4](m4-03/fix-round1-regression.log). The new table starts at test line **780** (title at 781); each of its six cases asserts aggregate state, absence of install messages and install recovery, manual review for build Java, absence of unvalidated version/source fields, absent candidate, zero builds and exactly one dependency read. Original test anchors above did not move because the regressions were appended.

### Fix verification commands

Commands used the same pinned Bun PATH and task-owned OPENCODE/XDG environment recorded above. Test and typecheck commands ran from their package directories.

| CWD                                        | Command                                                                                                                                          | Exit / result                                    | Evidence                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | --------------------------------------------------- |
| `/Users/dylanxu/coding_tree/packages/core` | `bun test ./test/ftc/environment-and-compatibility/m4-03.test.ts --test-name-pattern 'missing tools with'`                                       | 1; 0 pass / 6 fail / 44 filtered / 10 assertions | [RED](m4-03/fix-round1-red.log)                     |
| `/Users/dylanxu/coding_tree/packages/core` | `bun test ./test/ftc/environment-and-compatibility/m4-03.test.ts`                                                                                | 0; 50 pass / 0 fail / 206 assertions             | [Focused GREEN](m4-03/fix-round1-green.log)         |
| `/Users/dylanxu/coding_tree/packages/core` | `bun test ./test/ftc/environment-and-compatibility`                                                                                              | 0; 155 pass / 0 fail / 448 assertions            | [Covering](m4-03/fix-round1-regression.log)         |
| `/Users/dylanxu/coding_tree/packages/core` | `bun typecheck`                                                                                                                                  | 0                                                | [Core types](m4-03/fix-round1-core-typecheck.log)   |
| `/Users/dylanxu/coding_tree/packages/app`  | `bun test ./src/i18n/parity.test.ts`                                                                                                             | 0; 6 pass / 0 fail / 1003 assertions             | [Affected parity](m4-03/fix-round1-i18n-parity.log) |
| `/Users/dylanxu/coding_tree`               | `bun node_modules/.bin/oxlint packages/core/src/ftc/environment.ts packages/core/test/ftc/environment-and-compatibility/m4-03.test.ts`           | 0; 0 warnings / 0 errors                         | [Lint](m4-03/fix-round1-lint.log)                   |
| `/Users/dylanxu/coding_tree`               | `bun node_modules/.bin/prettier --check packages/core/src/ftc/environment.ts packages/core/test/ftc/environment-and-compatibility/m4-03.test.ts` | 0                                                | [Format](m4-03/fix-round1-format-check.log)         |
| `/Users/dylanxu/coding_tree`               | `git diff --check -- packages/core/src/ftc/environment.ts packages/core/test/ftc/environment-and-compatibility/m4-03.test.ts`                    | 0                                                | [Scoped diff](m4-03/fix-round1-diff-check.log)      |

Only Core source/tests changed in this fix. Unchanged Schema/App typechecks and Schema contracts were not rerun; their prior passing evidence remains applicable. The App parity selection was explicitly required for this review fix and still passes without dictionary/parity-test changes. No broader unchanged suite was rerun. All previously named production/M5/build/platform/UI/Chinese editorial/robot gates remain unrun and unchanged; these six synthetic records do not evaluate a real Windows host or installed toolchain.

### Updated frozen source SHA-256

[fix-round1-SHA256SUMS](m4-03/fix-round1-SHA256SUMS) records all six original task source files; only the Core implementation and focused test hashes changed.

```text
e33c0d5eb10b9eaef505c296e1385c1ea359cfc8aa481d9785dd6c4d5f9cfda3  packages/core/src/ftc/environment.ts
32fbbc070f0a1d877238867247f72d30028853d4669b88948e224901932db868  packages/schema/src/ftc-environment.ts
5383c571635f34f4c6175e334ea6f89595c77888e156087f3c890aa62f8ce566  packages/core/test/ftc/environment-and-compatibility/m4-03.test.ts
d178d52b8605127e3cebca264924e8017bcb77643f701e44cdca980e36e0ec6e  packages/app/src/i18n/en.ts
aa1918ea6c914b7c5854f957e9a25a5c828201369a6b56be1ee8f362a6832e9c  packages/app/src/i18n/zh.ts
310ad2c1a9ce989aa8b244f9b1819a9c3c8b530291306dce646867753a4195e7  packages/app/src/i18n/parity.test.ts
```

I1 is addressed by this implementation and its behavioral regressions, pending the coordinator's stable commit and independent same-reviewer verdict. The worker does not credit task/checklist completion.
