# M4-02 implementation evidence

Date: 2026-10-06. Status: **DONE_WITH_CONCERNS**, pending coordinator commit and independent review. Assignment checkpoint: `3d496b0c9`. M4-01 prerequisite: `f7d2a93eabae724f29875a29840b000cee8749fb`. Observed shared HEAD during final verification: `577c7b3b83ae12a4ab004a235fc63ae4c23f8735`; other lanes may advance HEAD independently. No files were staged or committed by this worker, as explicitly instructed by the coordinator.

## Implemented behavior

- `Environment.Service` and its Effect layer expose inspection through injected, read-only dependency and tool-probe ports. The module has no import-time process, filesystem, registry, installation, or network work. Constructing a layer starts no probe. Each invocation owns an Effect scope and rereads observations without caching or process-global state.
- The request, project root, dependency snapshot and successful probe outputs are decoded with canonical Schema contracts and reject excess properties. Malformed input performs no reads/probes. Malformed dependency/probe responses cannot produce a candidate.
- Inspection calls separate build Java, editor Java, Android SDK, ADB and project Gradle wrapper probes. The port receives host/project context and the selected profile's exact component pin. A discovered global Gradle binary cannot replace the project wrapper.
- Existing M4-01 resolution determines coherent compatibility. Tool versions must equal the selected profile's pins. Known incompatible imported project constraints produce `incompatible` while tool observations still run. No imported file, SDK, dependency or machine-wide Java configuration is written.
- Missing binary, probe failure, permission denial and manual prerequisites produce distinct step causes/recovery codes. Only missing-binary steps add entries to `missingAssets`. Known incompatibility takes precedence over failed probes in the aggregate state; individual failure steps remain visible.
- Incomplete imported constraints produce a manual `requirements_unknown` step and no descriptor, even if M4-01 can provisionally select a profile. Absence of a constraint does not prove compatibility.
- All known requirements and matching observed tools produce a canonical optional `candidateToolchain` with separate build/editor Java paths and pins. Inspection alone returns `missing`, empty `missingAssets`, and a pending `build_unverified` step. This means setup still requires build verification, not that an inspected binary is absent. M4-03/M4-06 own subsequent build-verified readiness.
- The host port owns process execution, bounded probes, cancellation and resource finalizers. This task adds no production host adapter, command runner, setup API, download or installer. A host finalizer defect remains an Effect scope failure rather than falsely returning successful inspection.

Coordinator approved the pending-build/unknown-requirement contract interpretation before completion. No future setup service was added. Java language-server inspection is outside the five tool probes required by this task.

## RED → GREEN

The required `inspection preserves incompatible imported files` test was written first against a minimal `Effect.succeed` placeholder. It uses the actual module, injected ports and three temporary imported files. The initial focused run failed on behavior: expected `incompatible`, received `missing`; file equality already passed. It did not fail on an import or broken fixture. See [red.log](m4-02/red.log).

After implementing inspection the same test passed, including the exact required assertions `expect(afterFiles).toEqual(beforeFiles)`, `expect(result.state).toBe("incompatible")`, and `expect(probes).toContain("adb")`. Subsequent cases cover distinct outcomes, pins and lifecycle behavior; the final focused run passes 38 cases/130 assertions. See [green.log](m4-02/green.log).

One initial evidence-command attempt used a package-relative directory incorrectly and failed before the test ran. Its empty accidental directories were immediately removed; the corrected command produced the behavioral RED evidence above. No source or imported fixture was altered by that setup mistake.

## Commands, working directories and results

All commands used Bun 1.3.14 (`0d9b296a`) by prepending `/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64` to `PATH`. Core commands additionally set:

```sh
OPENCODE_TEST_HOME=/private/tmp/ftc-m4-02-state/home
XDG_DATA_HOME=/private/tmp/ftc-m4-02-state/data
XDG_CONFIG_HOME=/private/tmp/ftc-m4-02-state/config
XDG_CACHE_HOME=/private/tmp/ftc-m4-02-state/cache
XDG_STATE_HOME=/private/tmp/ftc-m4-02-state/state
```

The existing Core test preload disables model fetching and uses an in-memory database. The inspection module imports no production bootstrap/database/provider code. No user app/server was restarted.

| Working directory | Command | Result | Evidence |
| --- | --- | --- | --- |
| `/Users/dylanxu/coding_tree/packages/core` | `bun test ./test/ftc/environment-and-compatibility/m4-02.test.ts` | Initial behavioral RED: 0 pass, 1 fail, 2 assertions | [RED](m4-02/red.log) |
| `/Users/dylanxu/coding_tree/packages/core` | `bun test ./test/ftc/environment-and-compatibility/m4-02.test.ts` | Final GREEN: 38 pass, 0 fail, 130 assertions | [Focused](m4-02/green.log) |
| `/Users/dylanxu/coding_tree/packages/core` | `bun test ./test/ftc/environment-and-compatibility` | 100 pass, 0 fail, 227 assertions; includes 62 M4-01 cases | [Regression](m4-02/regression.log) |
| `/Users/dylanxu/coding_tree/packages/core` | `bun typecheck` | Exit 0 | [Core types](m4-02/core-typecheck.log) |
| `/Users/dylanxu/coding_tree/packages/schema` | `bun typecheck` | Exit 0 | [Schema types](m4-02/schema-typecheck.log) |
| `/Users/dylanxu/coding_tree/packages/schema` | `bun test ./test/contract-hygiene.test.ts` | 5 pass, 0 fail, 10 assertions | [Affected contracts](m4-02/schema-contracts.log) |
| `/Users/dylanxu/coding_tree/packages/schema` | `bun test` | 13 pass, 2 known baseline failures, 42 assertions | [Schema excerpt](m4-02/schema-suite.log) |
| `/Users/dylanxu/coding_tree` | `bun node_modules/.bin/oxlint packages/core/src/ftc/environment.ts packages/core/src/ftc/environment/adapters.ts packages/schema/src/ftc-environment.ts packages/core/test/ftc/environment-and-compatibility/m4-02.test.ts` | 0 warnings, 0 errors | [Lint](m4-02/lint.log) |
| `/Users/dylanxu/coding_tree` | `bun node_modules/.bin/prettier --check packages/core/src/ftc/environment.ts packages/core/src/ftc/environment/adapters.ts packages/schema/src/ftc-environment.ts packages/core/test/ftc/environment-and-compatibility/m4-02.test.ts` | Exit 0 | [Formatting](m4-02/format-check.log) |
| `/Users/dylanxu/coding_tree` | `git diff --check -- packages/schema/src/ftc-environment.ts` | Exit 0 | Manual scoped diff check |

Schema baseline failures, both in untouched `packages/schema/test/event-manifest.test.ts`:

- `public event manifest > owns the complete public event surface`
- `public event manifest > uses canonical definitions for current public events`

The brief and coordinator identify these as pre-existing. The full Schema run was performed once; no event manifest or test was edited, and no repeated run was used to rediscover them. The committed evidence is a marked excerpt omitting a 2.5 MB schema-object diff; full transient output is `/private/tmp/ftc-m4-02-state/schema-suite-full.log`.

No full Core suite was run: the coordinator and project execution rules prescribe relevant tests, the M4 regression, and touched-package typechecks for this isolated task. Other lanes' files were excluded from edits and scoped lint/format.

## Assertion map

All cases call the real inspection implementation. Test line anchors refer to `packages/core/test/ftc/environment-and-compatibility/m4-02.test.ts`.

| Cases | Assertion coverage |
| --- | --- |
| Imported-project preservation (line 66) | Three temporary file contents before/after are equal; aggregate incompatibility; ADB observed |
| Candidate and pending build (line 93) | Exact five paths, seven version pins, independent Java pins/requests, no missing binaries, non-ready pending build, canonical JSON roundtrip |
| Missing components (line 123; 5 cases) | Correct missing asset, install recovery, no candidate |
| Failed/denied/manual outputs (line 139; 3 cases) | Distinct aggregate/step state, cause/recovery, retained detail, missing-assets exclusion |
| Typed probe failures (line 157; 4 cases) | Each failure cause retained, later wrapper probe executes, no candidate |
| Version mismatches (line 179; 5 cases) | Each tool independently produces incompatibility and no replacement descriptor |
| Unknown constraints (line 200; 2 cases) | Manual requirement review and no candidate |
| Malformed dependency snapshots (line 220; 3 cases) | Missing/malformed/dynamic/excess dependency data fails with no candidate |
| Dependency permission denial (line 235) | Manual grant-permission recovery, all five probes still run, no candidate |
| Malformed probes (line 249; 4 cases) | Missing output, dynamic pin, relative path and injected fields fail |
| Project wrapper identity (line 270) | Global binary cannot stand in for the project wrapper |
| Request validation (line 287) | Relative project root rejected before any dependency/probe call |
| Empty production catalog (line 315) | No evaluated support or candidate inferred from fixture tools |
| Windows values (line 324) | Separate supplied Java paths and project `gradlew.bat`, no ready claim |
| Success cleanup/fresh observations (line 354) | Constructing layer/effect starts no probe; all five leases close; recheck reopens and closes all five |
| Cancellation (line 386) | In-flight lease closes on interrupt; no successful readiness is fabricated; fresh scope produces candidate |
| Failed reads cleanup (line 416) | Dependency lease and all five probe leases close after typed ADB failure |
| Independent layers (line 459) | Concurrent layers retain independent missing/available observations |
| Contract hygiene (line 473) | Exact canonical facade identity, optional fields omitted, ten stable/unique identifiers |

## Fixture classification and unrun gates

Catalog versions, checksums, resource thresholds, evidence references and tool paths are synthetic. Only the three temporary imported file reads/writes and cleanup are actual filesystem operations; their contents are fixtures, not an actual FTC project. Scoped leases are deterministic injected resources; no real process was launched by an inspection probe. The Windows case validates supplied contract values on macOS and is not a Windows runtime evaluation.

**Not run / not claimed:** real Java/Android/ADB/wrapper discovery on macOS or Windows; any wrapper/build/download/installation; JDT LS execution; an FTC build or edit/build integration; Electron/server/API/UI integration; offline asset preparation; process isolation gates M9-07/M9-08; robot discovery, connection, deployment or operation; physical hardware validation; clean-host acceptance or production catalog support promotion. M5-03 available-host evidence remains unchanged and grants no supported profile. M4-03/M4-06 build verification and M4-07 platform evaluation remain separate gates.

## Owned file hashes

SHA-256 of final implementation files, prior to coordinator commit:

```text
cf97b6b2ac4dd97de8979209cd3c7f4fe12bc1ca572a178f1fc6f33ac35b6fc4  packages/core/src/ftc/environment.ts
e746b10d82ff405f3c8b2942cec24094f13f188e80501a089db61c6d47549a03  packages/core/src/ftc/environment/adapters.ts
9beba0bf806b512b9051ad942ce981bae0617c9124798137874e15d938ca19f2  packages/schema/src/ftc-environment.ts
03b1b17f331620881c44b9500861e9da8ed4b640b374fceb1ebd40cccb0d7c31  packages/core/test/ftc/environment-and-compatibility/m4-02.test.ts
```

The only task deliverables are those four files, this report, and `docs/validation/m4-02/` logs. No Schema barrel, migration, manifest, lockfile, production catalog, host binding or task checklist was changed by this worker. Independent review and the stable task commit are coordinator-owned.
