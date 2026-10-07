# M6-03 independent task review

**Spec compliance: Issues found.** Two Important defects violate the brief's literal-evidence and project-read boundaries. **Task quality: Needs fixes.**

Reviewed task package `3812faff8..4013bc15f`, the dispatch brief and implementation report. Product files, index, Git state and ledger remained read-only. The full supplied diff was reviewed in chunks; a tool-truncated evidence section was reread. No changed source file was separately opened, no broader source crawl occurred, and no successful test suite was repeated.

## Strengths

- `packages/core/src/ftc/configuration/inspection.ts:8`, `:10`, `:298`: the manifest dependency is type-only, runtime inputs are narrow read-only ports, and inspection fibers belong to the owning Scope. There is no new manifest owner, process execution, network operation or source-write capability in the diff.
- `packages/schema/src/ftc-configuration.ts:137`, `:181`: producer-owned canonical records preserve serializable unknown reasons, observed dependencies, managed selection, conflicts and source revisions.
- `packages/core/test/ftc/ftc-configuration-and-libraries/m6-03.test.ts:59`, `:236`, `:266`: real inspection tests verify byte preservation, ambiguous pathing, cancellation/escaped-owner rejection and several unsupported-syntax cases. The final recorded M6 checks are 61 tests / 196 assertions; Schema records 13 tests / 19 assertions.

## Important findings

### 1. Groovy slashy-string examples become dependency evidence

**Location:** `packages/core/src/ftc/configuration/inspection.ts:311`, `:320`, `:335`, `:343`.

The lexical masking recognizes ordinary quoted strings and rejects triple-quoted strings, but does not recognize Groovy slashy strings. Their contents are subsequently scanned as ordinary Gradle code. This supported-language source contains no dependency declaration:

```groovy
def example = /
dependencies {
 implementation 'com.pedropathing:core:2.1.2'
}
/
```

One focused invocation of the real public Inspection API, with actual temporary files and the infrastructure FS adapter, returned `detectedPathing: "pedro"` and a `com.pedropathing:core` dependency with `version: "2.1.2"`. It also returned `unsupported_gradle`, but that does not retract the false positive. The aggregation at `inspection.ts:263` promotes this fabricated evidence to detected pathing; with a managed selection it can produce a false conflict.

This violates the explicit requirement not to infer versions from arbitrary string content and to retain unsupported syntax as unknown. Conservatively reject or correctly mask unsupported literal forms before collecting coordinates. Add a regression requiring no dependency evidence from slashy/dollar-slashy example text and unknown inspection when unsupported syntax remains. Extending general Gradle evaluation is unnecessary.

### 2. Symlink retargeting permits a foreign read before rejection

**Location:** `packages/core/src/ftc/configuration/inspection.ts:95`, `:100`, `:104` (the same path-based check/open pattern also appears in directory traversal at `:155`–`:175`).

`target` checks a canonical pathname, then `readFile(canonical)` reopens that pathname. A source path replaced with an external symlink after the successful realpath check is followed by the file read. The subsequent check rejects the result, but the prohibited read has already happened.

One focused real-Inspection probe used the actual FS adapter, wrapped only to deterministically replace an in-project `build.gradle` after its successful `realPath` observation and before its open. A read observer confirmed bytes from a sentinel file outside the project were consumed. The exact outcome was:

```json
{"code":"path_outside_project","readForeignBytes":true}
```

The initial-symlink test at `packages/core/test/ftc/ftc-configuration-and-libraries/m6-03.test.ts:163` does not cover this boundary. The report acknowledges residual check/open races, but the binding brief prohibits inspection reads escaping the project root; rejecting after reading is insufficient for that promise. Resolve the read authority through an appropriate public scoped/no-follow filesystem primitive that also protects ancestor traversal, or obtain an explicit revised boundary decision from the coordinator before claiming compliance. Add a deterministic retarget regression that asserts no foreign read, rather than checking only the returned error.

## Checks and limitations

- Both probes ran once from `packages/core` with pinned Bun 1.3.14, using `bun run -` and real `Inspection.make`, `FSUtil.node` and `LayerNode.compile`. Each exited 0 while printing the incorrect observed behavior above. No arbitrary project Gradle, wrapper, Java or build code was run.
- Both used `OPENCODE_TEST_HOME=/private/tmp/m6-03-review/home` and task-owned `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XDG_CACHE_HOME`, `XDG_STATE_HOME` below `/private/tmp/m6-03-review`. Temporary project/sentinel directories were removed in `finally` blocks. The probes changed no product file or dependency.
- Named risk checks were limited to the two probes above. The only additional evidence check was `docs/validation/m3-03/fix1-core-types-settled.log:1`, which contains the coordinator's later `tsgo --noEmit` run without diagnostics; its exit 0 and frozen-source association are coordinator-supplied facts. The earlier M6 Core typecheck contains foreign M2 diagnostics, not an unresolved M6 diagnostic. No typecheck was rerun.
- `docs/validation/m6-03/core-green.log:115`, `docs/validation/m6-03/schema-green.log:22`, `docs/validation/m6-03/lint.log:1`, and `docs/validation/m6-03/format-check.log:2` record passing focused checks without unexplained warnings. Historical RED logs are expected failure evidence, not current failures.
- Cannot verify from this task diff: Windows behavior, host composition/barrel integration, actual dependency resolution, build compatibility or physical robot operation. The implementation report explicitly leaves these open; fixture passes provide no acceptance credit for them.
- No Critical or additional Minor findings. Approval remains blocked on the two concrete Important defects above, rather than on optional coverage expansion.
