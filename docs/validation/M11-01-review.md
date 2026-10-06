### Spec Compliance

- ❌ Issues found: protected identifiers can evade validation inside tilde fenced blocks at `packages/core/src/ftc/knowledge.ts:135`. The focused reproduction below accepts different English/Chinese API and device identifiers with matching digests. This misses the brief's actual-content preservation requirement.
- ✅ Remaining task scope matches the brief: all four named product/test files and the authorized canonical Schema root export appear in the complete `258054ca9..446c00550` diff. No additional product services, content downloads, supported-version defaults or authored course catalog were introduced.
- ⚠️ Cannot verify from diff: no additional task requirement needs a coordinator check beyond fixing the finding and recording its regression evidence. Production source/licensing review, semantic translation quality, compatibility support, course coverage and platform/robot completion are deliberately outside this task.

### Strengths

- `packages/schema/src/ftc-knowledge.ts:13` and `:57` define serializable canonical records and stable domain errors; `packages/core/test/ftc/ftc-knowledge/m11-01.test.ts:415` checks canonical identity, serialization and optional-field encoding.
- `packages/core/src/ftc/knowledge.ts:118` hashes the injected bytes, checks UTF-8 round-trip validity, decodes JSON and checks document ID/version/language before accepting content. Rehashed identity and identifier mutations are tested at `packages/core/test/ftc/ftc-knowledge/m11-01.test.ts:233` and `:255`.
- `packages/core/src/ftc/knowledge.ts:30`, `:59`, `:68` and `:77` distinguish missing metadata, duplicate identities, invalid applicability and missing translations. The implementation is synchronous, stateless and acquires no disposal resource.
- `packages/core/src/ftc/knowledge.ts:74` excludes declared synthetic records from production. `packages/core/resources/ftc/content/manifest.json:2` contains an empty production catalog, tested at `packages/core/test/ftc/ftc-knowledge/m11-01.test.ts:395` and `:400`.

### Issues

#### Critical (Must Fix)

- None.

#### Important (Should Fix)

- **Protected tilde fences can silently disappear from validation — `packages/core/src/ftc/knowledge.ts:135`.** The closing fence must equal the opening delimiter exactly. With a `~~~java` opener and `~~~~` closer, the fenced branch does not match; the fallback recognizes only backticks, so it extracts zero protected literals. Both records may then declare `codeTokens: []` and pass even when the Chinese body changes `hardwareMap.get`, `DcMotor` and `fixture_motor`. A longer closing run is ordinary fenced-code syntax, but even a deliberately restricted package syntax must reject an unsupported fence instead of treating its code as unprotected prose. Recognize closing runs of the same character with at least the opening length, or explicitly reject fence constructs the package parser cannot consume. Add a regression covering longer tilde closers, including fresh digests and identical empty declarations; the result must be `invalid`. The existing literal test at `packages/core/test/ftc/ftc-knowledge/m11-01.test.ts:311` uses only equal-length tilde delimiters.

#### Minor (Nice to Have)

- None.

### Checks and Evidence

- Reviewed the complete stable task diff and task brief/report. Large captured RED logs were inspected at their relevant failure/count sections; no product source was reread outside the diff.
- Named dependency risk checked: whether the existing hash utility hashes raw bytes or triggers initialization. `packages/core/src/util/hash.ts:9` directly uses SHA-256 `update(input)` with no I/O; `packages/core/package.json:123` already supplies semver. No dependency change is needed.
- Existing task evidence: `docs/validation/m11-01/red.log:7` shows the required behavioral assertion failing; `docs/validation/m11-01/red.log:424` records 1 pass / 29 fail / 61 assertions. `docs/validation/m11-01/green.log:51` records 46 pass / 0 fail / 199 assertions. The scoped lint/format and affected Schema contract logs are clean. The coordinator additionally matched all five product/test hashes and verified the combined snapshot; `docs/validation/parallel-2026-10-06/core-tests.log:211` records 196 pass / 0 fail / 595 assertions, with Core/Schema typechecks exit 0 reported by the coordinator.
- One focused reproduction ran from `packages/core` using `PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH bun run -` and the real `validatePack`/`Hash.sha256`. Two otherwise matching synthetic records used freshly hashed JSON bodies `~~~java\nhardwareMap.get(DcMotor.class, "fixture_motor")\n~~~~` and `~~~java\n硬件映射.get(电机类.class, "合成电机")\n~~~~`, respectively, and both declared `codeTokens: []`. Observed exit 0 and `kind: "valid"` with both records. This is new evidence for the named parser doubt, not a rerun of a suite. No product, Git, index or ledger changes were made.

### Assessment

**Task quality:** Needs fixes.

**Reasoning:** Canonical contracts, byte integrity, identity checks, domain outcomes and fixture separation are well implemented and supported by meaningful behavioral evidence. The parser's silent omission lets changed identifiers pass the central validation boundary, so M11-01 should remain unapproved until that case is rejected and covered by a focused regression.

### Scoped Re-review — Round 1

- **Spec compliance: ✅ Spec compliant at `9b71593fb`.** Reviewed only the stable fix diff `32dbfd69b..9b71593fb`. The original Important finding is addressed: `packages/core/src/ftc/knowledge.ts:148` accepts same-character closing runs at least as long as the opening fence; `:151` rejects a recognized fence without a valid closer; `:154` consumes the complete block before scanning further literals. `:135` still compares the extracted actual code with declarations. These changes prevent the reported longer-tilde-fence omission without changing the public contracts or production catalog.
- **Task quality: Approved.** The private extraction helper names a real parsing boundary and retains the existing inline-literal path. Real-validator regressions at `packages/core/test/ftc/ftc-knowledge/m11-01.test.ts:353`, `:366` and `:371` cover rehashed identifier drift with empty declarations, correctly declared longer tilde/backtick fences, and malformed or unterminated fences. No new Critical, Important or Minor finding was identified in this fix.
- **Evidence:** `docs/validation/m11-01/fix-round1-red.log:50` reproduces the original acceptance defect and `:224` records 11 failures. `docs/validation/m11-01/fix-round1-green.log:63` records 58 pass / 0 fail / 231 assertions. The fix-only diff includes clean Core/Schema typecheck, lint and format logs; the coordinator matched all five recorded source hashes. No suite was rerun, no new concrete doubt required a reproduction, and no additional task verification gap remains. Later content, source/license review, compatibility and platform/robot gates remain outside this task. This scoped verdict supersedes the earlier Needs fixes assessment.
