# M11-02 implementation evidence

Date: 2026-10-06. Assigned checkpoint: `97b5f4ee65ae2cec1143463a95e741869de61c92`; reviewed M11-01 baseline: `9b71593fb`. Shared checkout HEAD advanced to `13838cc9778c80c3411e6ff5b0d404aa288a11b4` during final evidence capture. Candidate is uncommitted for coordinator staging and independent review. This worker changed only the assigned knowledge implementation, knowledge Context Source adapter, canonical knowledge Schema module, focused tests, and this evidence directory/report. No checklist, ledger, host wiring, content manifest, content files, index, dependencies or generated surface was edited.

## Delivered behavior and explicit contract ruling

The coordinator approved these semantics before dependent implementation:

- `repository.read()` supplies unknown byte-bearing `PackInput` snapshots; the real reviewed `validatePack` revalidates them on every observation. A caller's claimed valid flag is not an admission boundary. Invalid content fails with `invalid_content` and the validator's structured errors.
- `repository.available(record)` observes current local-use availability separately from snapshot integrity. It never fetches content. Validated snapshot records/documents supply identity, digest, source, license, provenance and applicability; the availability port supplies only a boolean. A fixture confirms later in-place mutation of the original bytes cannot alter the already decoded snapshot.
- Explicit ID/topic selection, SDK applicability, exact library identity/range, requested language and current local availability precede text search. Generic SDK material remains applicable with a selected library; library-specific material requires that exact library and a matching version. There is no installed-version upgrade or preferred-newest substitution. Both ID and topic, when supplied, must match.
- Query versions must be concrete SemVer, with no `v` prefix or version range; library and libraryVersion must be supplied together. Unknown extra query fields, unknown languages and blank search text fail before repository access. Schema owns structural serializable contracts; Core owns the version/pair semantics.
- `localOnly: true` excludes unavailable records. `localOnly: false` lookup can return compatible metadata with `locallyAvailable: false` and no document. Neither setting grants network access. Body-text search sees only available, already applicable language candidates even when `localOnly` is false. Unavailable metadata cannot match a body search.
- Found records preserve the canonical `ContentRecord` fields and add explicit `locallyAvailable` plus an optional validated `ContentDocument`. Missing results preserve the exact decoded request and distinguish `not_found`, `incompatible`, `not_local` and `no_match`. The contract also reserves `missing_translation`; the current complete-pack validator rejects an incomplete bilingual pack as invalid content, so missing cached translations are observed as `not_local`, not replaced by English.

`FtcKnowledge.Service` uses an injected Effect layer without sibling/bootstrap imports or implicit active-project state. `lookup(ContentQuery)` and `search(SearchRequest)` run actual query/filter/lookup logic. The search port accepts one validated compatible available document at a time and returns only a boolean, so it cannot inject a different record or provenance. The fixture implements ordinary case-insensitive body substring matching; production search/repository adapters and host registration remain later integration work.

Canonical readonly contracts added in Schema: `ContentQuery`, `SearchRequest`, `ContentReference`, `ContentResult`, `QueryError`. Core reexports the exact `ContentQuery` and `ContentResult` schema identities. No Schema root barrel change was needed because the existing namespace export exposes its new members.

The public domain-only `FtcKnowledgeContext.source({ key, service, query })` adapts explicit knowledge queries to `SystemContext.Source<ContentResult>`. Its codec and rendered JSON preserve provenance/missing data. Query creation is suspended until observation. Typed query failures become `SystemContext.unavailable`; a missing reference remains actual observed data. It performs no host registration, other-domain assembly, Context Epoch ownership or permission/approval decisions.

## Lifecycle and concurrency

Import and layer/source construction perform no port I/O. Every query owns an `Effect.scoped` observation; repository, availability and search acquisitions close on success, typed failure or interruption. Interruption propagates as Effect interruption, never a fabricated missing/found response. There is no cache, global selection, process, subscription, background fiber or module-owned mutable state to dispose. Independent service instances and concurrent/back-to-back explicit SDK/library/language queries remain independent. No network-capable port exists; `networkCalls === 0` in the required fixture is bounded evidence of that injected-capability setup, not a system-wide network interception test.

## RED and GREEN evidence

The focused test was written first against a minimal importable correctly typed service stub that returned missing. [red.log](m11-02/red.log): **0 pass / 1 fail / 1 assertion**, Bun exit 1. The required assertion failed with expected `found`, received `missing`; the validator/import/test harness worked.

Expanded behavior before implementation: [red-expanded.log](m11-02/red-expanded.log), command excludes the pending-interruption test so the missing implementation cannot hang it: **3 pass / 17 fail / 1 filtered / 21 assertions**, exit 1. These failures exercise missing filter/search/input/error/Context Source behavior.

Initial implementation: [green-initial.log](m11-02/green-initial.log), **11 pass / 10 fail / 42 assertions**, exit 1. Ten failures were a harness mismatch: Effect Result's `_tag` property is readable but not an enumerable deep-equality member. Assertions were changed to inspect readable tags or match the actual failure payload; no production behavior was weakened to satisfy them. [green-focused.log](m11-02/green-focused.log): **21 pass / 0 fail / 44 assertions**, exit 0. Core's initial typecheck also identified a union document narrowing, Effect suspend error inference, and a type-only import; all resolved locally.

Additional boundary/lifecycle/contract cases characterized the implementation without requiring a production behavior change. [green-edge.log](m11-02/green-edge.log): **26 pass / 0 fail / 57 assertions**. [snapshot-characterization.log](m11-02/snapshot-characterization.log): **27 pass / 0 fail / 59 assertions**; the original byte array is mutated in place during availability and the validated original document survives. The earlier exploratory snapshot log is named `red-snapshot.log` but is **green**; it is not claimed as RED evidence. One attempted characterization command had an incorrect relative redirection path and never invoked Bun; it was rerun from Core. No repository-root tests ran.

Final focused command: [green-focused-final.log](m11-02/green-focused-final.log), **27 pass / 0 fail / 59 assertions**, exit 0. Covering M11 validator/query suite: [green-covering.log](m11-02/green-covering.log), **85 pass / 0 fail / 290 assertions**, exit 0. The final adapter change only suspends public lookup creation; its focused adapter regression and Core typecheck were rerun afterward. No unchanged broad suite was repeated.

## Exact verification commands

Every Bun/Bunx command used `PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH`, Bun **1.3.14 (0d9b296a)**. Tests additionally used task-owned roots:

```sh
OPENCODE_TEST_HOME=/private/tmp/m11-02/home
XDG_DATA_HOME=/private/tmp/m11-02/data
XDG_CONFIG_HOME=/private/tmp/m11-02/config
XDG_CACHE_HOME=/private/tmp/m11-02/cache
```

| Cwd               | Command after environment prefix                                                                                                                                                                            | Final result and evidence                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `packages/core`   | `bun test ./test/ftc/ftc-knowledge/m11-02.test.ts`                                                                                                                                                          | Exit 0; 27/0; 59 assertions; `green-focused-final.log` |
| `packages/core`   | `bun test ./test/ftc/ftc-knowledge`                                                                                                                                                                         | Exit 0; 85/0; 290 assertions; `green-covering.log`     |
| `packages/schema` | `bun test ./test/contract-hygiene.test.ts ./test/compatibility.test.ts`                                                                                                                                     | Exit 0; 6/0; 12 assertions; `schema-contracts.log`     |
| `packages/core`   | `bun typecheck`                                                                                                                                                                                             | Exit 0; `core-typecheck-final.log`                     |
| `packages/schema` | `bun typecheck`                                                                                                                                                                                             | Exit 0; `schema-typecheck-final.log`                   |
| Repository        | `bunx --no-install oxlint packages/schema/src/ftc-knowledge.ts packages/core/src/ftc/knowledge.ts packages/core/src/ftc/knowledge/context.ts packages/core/test/ftc/ftc-knowledge/m11-02.test.ts`           | Exit 0; 0 warnings/errors; `lint.log`                  |
| Repository        | `bunx --no-install prettier --write packages/schema/src/ftc-knowledge.ts packages/core/src/ftc/knowledge.ts packages/core/src/ftc/knowledge/context.ts packages/core/test/ftc/ftc-knowledge/m11-02.test.ts` | Exit 0; scoped formatting                              |
| Repository        | `bunx --no-install prettier --check packages/schema/src/ftc-knowledge.ts packages/core/src/ftc/knowledge.ts packages/core/src/ftc/knowledge/context.ts packages/core/test/ftc/ftc-knowledge/m11-02.test.ts` | Exit 0; `format.log`                                   |
| Repository        | `git diff --check -- packages/schema/src/ftc-knowledge.ts packages/core/src/ftc/knowledge.ts packages/core/src/ftc/knowledge/context.ts packages/core/test/ftc/ftc-knowledge/m11-02.test.ts`                | Exit 0                                                 |
| Repository        | `shasum -a 256 packages/schema/src/ftc-knowledge.ts packages/core/src/ftc/knowledge.ts packages/core/src/ftc/knowledge/context.ts packages/core/test/ftc/ftc-knowledge/m11-02.test.ts`                      | `source-sha256.txt`, hashes below                      |

The expanded RED command was `bun test ./test/ftc/ftc-knowledge/m11-02.test.ts --test-name-pattern '^(?!interruption)'` from Core. Intermediate lint found three deliberate invalid-input type assertion warnings; those test cases now use narrowly documented `@ts-expect-error` lines, with a clean final typecheck and zero lint warnings.

## Assertion map

All line numbers below refer to `packages/core/test/ftc/ftc-knowledge/m11-02.test.ts`.

| Test line | Enforced behavior                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 58        | Required older SDK reference only; source/version/document/local provenance; unavailable Chinese reference missing; zero network capability calls |
| 97        | Explicit library v1/v2, SDK v2 Chinese, other-library exclusion, generic SDK applicability; concurrent independent requests                       |
| 120       | Only compatible available English candidate reaches text search; validated document/digest preserved; no text match stays missing                 |
| 141       | Unavailable metadata marked false without document; cannot satisfy search even with `localOnly: false`                                            |
| 157       | ID/topic absence and version incompatibility retain exact request and correct missing reason                                                      |
| 166, 185  | Eight malformed request rows and blank search fail before repository observation                                                                  |
| 191       | Corrupt bytes fail through real pack validator with `invalid_content`                                                                             |
| 206       | Port mutation cannot replace the validated document snapshot                                                                                      |
| 243       | Repository failure cleanup and search failure remain typed failures, not missing                                                                  |
| 270       | Pending repository interruption releases acquisition; independent new instance still queries                                                      |
| 303       | Exact canonical facade identities, stable unique identifiers, undefined optional encoding                                                         |
| 319       | Layer construction does no observation; success closes resources; actual result decodes through canonical result schema                           |
| 346       | Malformed availability/search responses fail with `invalid_response`                                                                              |
| 361       | Incomplete bilingual pack rejected without language substitution                                                                                  |
| 415       | Pending search interruption closes its acquired resource                                                                                          |
| 446       | Missing Context Source snapshot remains observed data; failed query blocks initialization as unavailable                                          |

## Frozen source SHA-256 inventory

```text
5d393c5b618859991dbd33531b92adc60b9a37de9288df5a2032e7e08c19e821  packages/schema/src/ftc-knowledge.ts
041a465bfc646260db625cea95ffe061110fdeef525310556f5dcdbe7c0a33bf  packages/core/src/ftc/knowledge.ts
196e0f4e7e9b38d8c473bc98dcbeaf2fde1ca9582df9d05243084f3842a76d79  packages/core/src/ftc/knowledge/context.ts
cdce27d921fe532c74e2cdd4a7309fe892c2c455cca11d03dfc798dc11b37468  packages/core/test/ftc/ftc-knowledge/m11-02.test.ts
```

## Fixture limits and unrun gates

Every content/source/license/range in this task is synthetic. Real content authoring, bilingual semantic/source/license review, platform caching/filesystem adapters, source support promotion, upstream network fetching, production search/indexing, prepared offline packaging, host wiring, UI/Protocol/Server APIs and full product/platform/hardware validation remain unrun/out of scope. The real reviewed validator is covered; no fixtures establish SDK/library support or translation accuracy. No user app/server was restarted. No Protocol or Server HttpApi changed, so no SDK generation was required.

Candidate status: **DONE** for the assigned query and domain adapter scope; awaiting coordinator commit and independent review.
