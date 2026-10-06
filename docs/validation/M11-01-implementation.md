# M11-01 implementation evidence

Date: 2026-10-06. Assigned checkpoint: `3d496b0c9837a8c359741244602aff699df78122`. Final checks ran with concurrent M2 committed at `577c7b3b83ae12a4ab004a235fc63ae4c23f8735`; M11 files are uncommitted for coordinator staging and independent review. No checklist, progress ledger, dependency, lockfile, host or sibling implementation was edited by this worker.

## Delivered behavior

`validatePack({ manifest, files })` is a synchronous pure validator. Its only runtime dependencies are canonical Schema contracts, Effect decoding, the already-installed `semver`, and the existing `Hash.sha256` utility. There is no import-time I/O, network fallback, bootstrap, project-selection state, service or acquired resource requiring disposal.

Canonical readonly serializable records live in `FtcKnowledge`: `ContentRecord`, `ContentDocument`, `ContentFile`, `Manifest`, `PackInput`, `PackError`, and `PackResult`. Core reexports the exact canonical `ContentRecord` and `PackResult` values. The coordinator added the single canonical root-barrel export in `packages/schema/src/index.ts`.

The validator decodes supplied byte arrays, checks SHA-256 against the bytes, rejects invalid UTF-8 and malformed JSON, then checks actual document ID/version/language against the manifest. Content versions are exact SemVer; SDK and paired optional library ranges must parse and admit at least one version. Translation pairs have the same stable ID/version, topic, applicability, provenance and protected code literals. Duplicate ID/version/language entries and duplicate file paths fail. Missing metadata, translation, file, corrupt digest, invalid ranges and changed identifiers carry separate `reason` values under stable `code: "invalid_content"`.

Ruling: the current producer uses JSON documents containing Markdown in `body`. `codeTokens` is the ordered exact literal content of backtick code spans and backtick/tilde fenced blocks. API/device/domain identifiers needing protection must appear in those literals. The validator compares declarations with decoded actual content and compares both translations; a matching digest alone is insufficient. Whitespace inside code is preserved. This is an explicit package syntax contract, not a complete CommonMark parser, Java parser, semantic translation review or discovery of unmarked identifiers in prose. Later content authors must mark all protected identifiers and source-review the content.

Ruling: records have explicit `provenance: "synthetic" | "source"`; manifest kinds are `synthetic` or `production`. Production manifests reject synthetic records. `source` provenance reports authored source origin only and does not certify review, compatibility or support. The production manifest contains zero published records. No real course content or supported versions were added.

## Behavioral RED to GREEN

Tests were written before the behavior. A minimal correctly typed, importable stub returned `invalid_input` for every request, permitting behavioral assertions to run rather than failing module resolution.

- Initial exact suite: exit 1, **1 pass / 29 fail / 61 assertions**. The required `translation pair preserves stable IDs and code tokens` failed with expected `valid`, received `invalid`. Evidence: [red.log](m11-01/red.log).
- Initial implementation: **30 pass / 0 fail / 147 assertions** (session output).
- Additional edge RED: **41 pass / 4 fail / 190 assertions**. Null/string record classification and empty library-range classification failed; the empty-array `test.each` row also exposed Bun treating it as a zero-argument/done callback case. Changed that row to an explicit object wrapper, and fixed metadata classification using decoded record values. Evidence: [red-edge.log](m11-01/red-edge.log). This harness issue is not claimed as behavioral evidence.
- Final exact suite: exit 0, **46 pass / 0 fail / 199 assertions**. Evidence: [green.log](m11-01/green.log).

An additional literal test initially used adjacent nested/closing backtick runs that were not valid code-span syntax; it was corrected to a separated inner literal. The final test covers nested backticks, tilde fences, indentation and ordered literal content.

## Commands and results

All Bun commands used `PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH`; Bun reports `1.3.14 (0d9b296a)`. Every focused Core test additionally used:

```sh
XDG_DATA_HOME=/private/tmp/m11-01/data
XDG_CONFIG_HOME=/private/tmp/m11-01/config
XDG_CACHE_HOME=/private/tmp/m11-01/cache
OPENCODE_TEST_HOME=/private/tmp/m11-01/home
```

| Cwd               | Exact command after environment prefix                                                                                                                                                                                                          | Result / evidence                                                                                                                                                                                                                                                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`   | `bun test ./test/ftc/ftc-knowledge/m11-01.test.ts`                                                                                                                                                                                              | RED and final GREEN counts above; final 46/46, 199 assertions                                                                                                                                                                                                                                                                                                  |
| `packages/core`   | `bun typecheck`                                                                                                                                                                                                                                 | Initial exit 2: unfinished concurrent M2 gate/test diagnostics only, [core-typecheck.log](m11-01/core-typecheck.log). Final exit 0, [core-typecheck-final.log](m11-01/core-typecheck-final.log). A final test-contract assertion briefly exposed widened fixture string literals; the fixture now preserves its synthetic literals and final typecheck passes. |
| `packages/schema` | `bun typecheck`                                                                                                                                                                                                                                 | Exit 0, [schema-typecheck.log](m11-01/schema-typecheck.log)                                                                                                                                                                                                                                                                                                    |
| `packages/schema` | `bun test ./test/contract-hygiene.test.ts ./test/v1-isolation.test.ts ./test/compatibility.test.ts`                                                                                                                                             | Exit 0: 8/8 tests, 17 assertions, [schema-contracts.log](m11-01/schema-contracts.log)                                                                                                                                                                                                                                                                          |
| Repository        | `bunx --no-install oxlint packages/schema/src/ftc-knowledge.ts packages/core/src/ftc/knowledge.ts packages/core/test/ftc/ftc-knowledge/m11-01.test.ts`                                                                                          | Exit 0: 0 errors, 0 warnings, 130 rules, [lint.log](m11-01/lint.log)                                                                                                                                                                                                                                                                                           |
| Repository        | `bunx --no-install prettier --write packages/schema/src/ftc-knowledge.ts packages/core/src/ftc/knowledge.ts packages/core/test/ftc/ftc-knowledge/m11-01.test.ts packages/core/resources/ftc/content/manifest.json`                              | Exit 0; scoped formatting only                                                                                                                                                                                                                                                                                                                                 |
| Repository        | `bunx --no-install prettier --check packages/schema/src/ftc-knowledge.ts packages/schema/src/index.ts packages/core/src/ftc/knowledge.ts packages/core/test/ftc/ftc-knowledge/m11-01.test.ts packages/core/resources/ftc/content/manifest.json` | Exit 0; all five files formatted, [format.log](m11-01/format.log)                                                                                                                                                                                                                                                                                              |
| Repository        | `git diff --check -- packages/schema/src/ftc-knowledge.ts packages/schema/src/index.ts packages/core/src/ftc/knowledge.ts packages/core/resources/ftc/content/manifest.json packages/core/test/ftc/ftc-knowledge/m11-01.test.ts`                | Exit 0                                                                                                                                                                                                                                                                                                                                                         |
| Repository        | `shasum -a 256 packages/schema/src/ftc-knowledge.ts packages/schema/src/index.ts packages/core/src/ftc/knowledge.ts packages/core/resources/ftc/content/manifest.json packages/core/test/ftc/ftc-knowledge/m11-01.test.ts`                      | [source-sha256.txt](m11-01/source-sha256.txt); exact values below                                                                                                                                                                                                                                                                                              |

No test ran at repository root. The known unrelated Schema event-manifest baseline failures were not part of the affected contract selection. No mocks, global resets, downloads, credentials, FTC toolchains, application restart or physical robot were required. The validator owns no scope resource, so a disposal test would invent I/O; independent calls and unchanged inputs are tested instead.

## Assertion map

All line references are in `packages/core/test/ftc/ftc-knowledge/m11-01.test.ts`.

| Requirement                                                 | Test evidence                                                                                                                                                        |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact requested bilingual test / missing-source domain code | Line 50: paired ID/version and code literals; `missingSource.code === "invalid_content"`                                                                             |
| Mandatory source/license; malformed URL                     | Lines 70, 334: absent/empty/whitespace source/license, invalid URL                                                                                                   |
| Missing files / duplicate file paths                        | Line 86: missing English file and duplicate bytes supplier                                                                                                           |
| Duplicate IDs / multiple stable content versions            | Line 92: duplicate triple rejected; two independently paired versions accepted                                                                                       |
| Missing translation / changed ID or version                 | Line 114: missing language, changed ID and changed version                                                                                                           |
| Actual bytes / digest validity                              | Lines 134, 152: corrupt bytes, wrong checksum, absent/empty/malformed digests                                                                                        |
| SDK/library ranges mandatory and satisfiable                | Lines 163, 177: absent/empty/malformed/reversed ranges, incomplete library pair, valid paired range                                                                  |
| Paired applicability and declared tokens                    | Line 209: changed SDK range and changed translated tokens                                                                                                            |
| Actual API/device/domain identifiers                        | Lines 233, 297: rehashed actual content mutations of `hardwareMap.get`, `DcMotor`, `fixture_motor`, `invalid_content`; false matching declarations in both languages |
| Actual document identity                                    | Line 255: rehashed ID, version and language mismatches                                                                                                               |
| Malformed records, inputs, content versions                 | Lines 274, 279, 286                                                                                                                                                  |
| Exact protected literal syntax                              | Line 311: order, nested backticks, tilde fence and leading indentation                                                                                               |
| Malformed JSON / forged valid flag / invalid UTF-8          | Lines 348, 362: non-JSON, `{}`, `{"valid":true}`, arrays, invalid UTF-8 byte and out-of-range byte                                                                   |
| Local package paths only                                    | Line 378: traversal, absolute, URL and Windows backslash path rejection                                                                                              |
| Fixture provenance / empty production                       | Lines 395, 400: synthetic cannot populate production; bundled production list empty                                                                                  |
| Independent unchanged inputs                                | Line 406: valid/invalid/valid sequence and original serialized input preserved                                                                                       |
| Canonical identities / serializability / optional encoding  | Line 415: root/direct/Core identity, request/result round trips, omitted undefined fields, seven unique domain-qualified identifiers                                 |

## Fixture classification and unresolved gates

All fixture versions (`1.0.0`, `2.0.0`), applicability values, API/device examples, translations, `https://fixtures.invalid/...` sources and `synthetic-fixture-license` are synthetic test data. Actual SHA-256 values are computed from the injected synthetic byte content. Fixtures remain inline in the test; they do not enter the production registry or compatibility catalog.

Task verification passes. Coordinator commit and independent review remain pending. Real bilingual content authoring, licensing/source review, SDK/library support evidence, complete lesson coverage, query/search, packaging and offline inventory belong to later M11 tasks. This validator does not establish PedroPathing or Road Runner integration support, physical robot correctness, or production course quality.

## SHA-256 inventory

```text
00746629c56b88a0baed6a1d9a30c5fa6d95d5f0e3da694115092b36b21152ac  packages/schema/src/ftc-knowledge.ts
c6b0e7a3736a4c97244dd12d4c46a34a2c17535b6e4b5623f4a915eeaa1e2517  packages/schema/src/index.ts
e2b6516ed555e20860fb57d074d10a9d56dcf8311ec9876e20257f50c36deb4f  packages/core/src/ftc/knowledge.ts
f033f18acfc08a6ee3e5b2fe17338e0c7bb4addb9c128095012d8b8cafe3790b  packages/core/resources/ftc/content/manifest.json
94b38e6d9e72cca98fb1abc0c1bc11ac112d4c2ca05b642fb58a4d53c7c90003  packages/core/test/ftc/ftc-knowledge/m11-01.test.ts
```

Author self-review checked the brief, canonical contract identities, import boundaries, actual-content checks, zero production records and exact owned paths. This is not the coordinator's independent review.

## Independent review fix, round 1 of 5

Reviewed finding: [M11-01-review.md](M11-01-review.md), Important: `packages/core/src/ftc/knowledge.ts:135` ignored tilde fences when the closing run was longer than the opening run. Original candidate: `446c00550`. Fix verification snapshot: `32dbfd69b317d8e4188674dcd5aab465160a5e0e`, plus the uncommitted task-owned source/test changes identified below. The earlier assertion map and source inventory describe the original candidate; this section supersedes its parser behavior and final hashes.

The old combined regex required equal opening/closing fence lengths. A `~~~java` opener with a `~~~~` closer therefore produced no protected literal, allowing translated API/device names and fresh matching digests to pass when both records declared `codeTokens: []`.

The smallest fix adds a private `protectedLiterals` extraction boundary. It recognizes a fence opener, locates the next same-character closing run at least as long as the opener, captures its exact content once, and advances past the whole block before scanning further literals. Unterminated, shorter-only, mixed-only and trailing-info closing fences fail as `malformed_content`; backtick-containing information strings on backtick openers fail too. A shorter/mixed delimiter occurring inside a subsequently closed block remains part of the protected literal rather than disappearing. Valid longer closers preserve protected content for both tilde and backtick fences. No contract, production catalog, dependency or public method changed.

Behavioral regression was added before implementation to the real-validator suite:

- RED: **47 pass / 11 fail / 218 assertions**, exit 1. The longer-tilde regression returned `valid` despite rehashed changed identifiers and empty declarations. Valid longer tilde/backtick closers and malformed-fence classifications also failed. Evidence: [fix-round1-red.log](m11-01/fix-round1-red.log).
- GREEN: **58 pass / 0 fail / 231 assertions**, exit 0. Evidence: [fix-round1-green.log](m11-01/fix-round1-green.log).

New assertion map, current `packages/core/test/ftc/ftc-knowledge/m11-01.test.ts`:

| Lines | Assertion                                                                                                                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 353   | Longer tilde/backtick closers with rehashed en/zh API/device drift and identical empty declarations fail `identifier_mismatch`                                                        |
| 366   | Valid longer same-character tilde/backtick closers accept correctly declared exact literals                                                                                           |
| 371   | Eight invalid/mixed/unterminated cases cannot evade extraction: short tilde/backtick closers, swapped delimiters, absent closers, closing trailing info, invalid backtick opener info |

Commands used the same pinned PATH and task-owned XDG/OPENCODE_TEST_HOME values documented above. Exact command/cwd/results:

| Cwd               | Command                                                                                                                                                                                                                                         | Result / evidence                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `packages/core`   | `bun test ./test/ftc/ftc-knowledge/m11-01.test.ts`                                                                                                                                                                                              | RED then GREEN above                                                              |
| `packages/core`   | `bun typecheck`                                                                                                                                                                                                                                 | Exit 0, [fix-round1-core-typecheck.log](m11-01/fix-round1-core-typecheck.log)     |
| `packages/schema` | `bun typecheck`                                                                                                                                                                                                                                 | Exit 0, [fix-round1-schema-typecheck.log](m11-01/fix-round1-schema-typecheck.log) |
| Repository        | `bunx --no-install oxlint packages/schema/src/ftc-knowledge.ts packages/core/src/ftc/knowledge.ts packages/core/test/ftc/ftc-knowledge/m11-01.test.ts`                                                                                          | Exit 0, 0 warnings/errors, [fix-round1-lint.log](m11-01/fix-round1-lint.log)      |
| Repository        | `bunx --no-install prettier --write packages/core/src/ftc/knowledge.ts packages/core/test/ftc/ftc-knowledge/m11-01.test.ts`                                                                                                                     | Exit 0                                                                            |
| Repository        | `bunx --no-install prettier --check packages/schema/src/ftc-knowledge.ts packages/schema/src/index.ts packages/core/src/ftc/knowledge.ts packages/core/test/ftc/ftc-knowledge/m11-01.test.ts packages/core/resources/ftc/content/manifest.json` | Exit 0, [fix-round1-format.log](m11-01/fix-round1-format.log)                     |
| Repository        | `git diff --check -- packages/core/src/ftc/knowledge.ts packages/core/test/ftc/ftc-knowledge/m11-01.test.ts docs/validation/M11-01-implementation.md`                                                                                           | Exit 0                                                                            |
| Repository        | `shasum -a 256 -c docs/validation/m11-01/fix-round1-source-sha256.txt`                                                                                                                                                                          | Five files verified                                                               |

All added content remains synthetic inline test material; no source, support or production content claims were added. No resources are acquired. No staging, commits, checklist edits or sibling changes were made by the worker. Coordinator commit and the same reviewer's scoped re-review remain pending; the later content/source/license/compatibility gates above remain unresolved by design.

Frozen tested SHA-256 inventory: [fix-round1-source-sha256.txt](m11-01/fix-round1-source-sha256.txt).

```text
00746629c56b88a0baed6a1d9a30c5fa6d95d5f0e3da694115092b36b21152ac  packages/schema/src/ftc-knowledge.ts
c6b0e7a3736a4c97244dd12d4c46a34a2c17535b6e4b5623f4a915eeaa1e2517  packages/schema/src/index.ts
257bcb3542d57d829e3469e02b673b578ae85e21d1918cc78c98c411d7712d62  packages/core/src/ftc/knowledge.ts
f033f18acfc08a6ee3e5b2fe17338e0c7bb4addb9c128095012d8b8cafe3790b  packages/core/resources/ftc/content/manifest.json
9f3c920fbc4975a5b7a9edfcf7d7b73a443c30190e1c2cf7c8295fee286bd90f  packages/core/test/ftc/ftc-knowledge/m11-01.test.ts
```
