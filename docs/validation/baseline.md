# Implementation baseline — 2026-10-06

Revision: `d7aca195c0a47fadb0fc3788eefbe96f99ec68be`; branch `ftc-workspace`; no pre-existing product changes. Untracked prompt/task plans preserved. No FTC tests or validation records existed.

Environment: macOS 26.5.2 (25F84), arm64; Node v26.10.0. Bun 1.3.14 downloaded from its exact official release into `/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun`; prefix this directory to PATH for commands below. No Windows runner configured. Java home inventory includes Corretto 17.0.15; editor Java 21 not present in java_home inventory. Android ADB exists outside PATH at `/Users/dylanxu/Library/Android/sdk/platform-tools/adb` (worker verified 1.0.41, 35.0.1-11580240). No robot mutations authorized; no controller availability asserted. No model runtime on PATH. No provider credentials inspected.

| Check | Working directory | Result | Evidence |
| --- | --- | --- | --- |
| `bun test ./src/main/external-url.test.ts ./src/main/window-registry.test.ts` | packages/desktop | Exit 0; 11 pass, 0 fail, 26 assertions | [log](baseline-desktop.log) |
| `bun test ./test/session-prompt.test.ts ./test/session-runner.test.ts ./test/session-run-coordinator.test.ts` | packages/core | Exit 1; 0 pass, 3 import failures/errors because Effect and workspace dependencies not installed; no Session behavior validated | [log](baseline-session.log) |
| `bun install --frozen-lockfile` | repository root | Exit 0; 4663 packages installed in 365.09 seconds; frozen lockfile unchanged | [log](dependency-install.log) |

At initial preflight the production session/timeline benchmark had not run. The completed package and production benchmark results below supersede that initial state; retain them for applicable comparisons before changing Session/timeline UI. M9-07 evaluation did not modify that code.

## Checks after dependency installation

- Schema `bun test` from packages/schema: exit 1, 13 pass / 2 fail. Pre-existing `public event manifest > owns the complete public event surface` expects 55 but gets 58; `uses canonical definitions for current public events` expects an outdated fixed slice. Raw [log](baseline-schema.log) retained. Schema files were unchanged.
- `bun typecheck`: packages/schema exit 0 ([log](baseline-schema-types.log)); packages/app exit 0 ([log](baseline-app-types.log)).
- Initial installed Session run: 16 pass / 2 import errors due sandbox denying creation of the default user data directory, [log](baseline-session-installed.log). This was a test-isolation problem, not a Session failure.
- Rerun with `OPENCODE_TEST_HOME=/private/tmp/ftc-baseline/home`, and `XDG_DATA_HOME`, `XDG_CONFIG_HOME`, `XDG_CACHE_HOME`, `XDG_STATE_HOME` set to corresponding `/private/tmp/ftc-baseline/{data,config,cache,state}` directories: **exit 0, 127 pass, 0 fail, 342 assertions**, [log](baseline-session-isolated.log). Same command/cwd as above. Use isolated test data for subsequent Core suites.

- App `bun run test:unit` from packages/app with isolated test data: exit 1, **723 pass, 1 fail, 3017 assertions**. Existing `desktop native locale detection > uses Unicode likely subtags for script-sensitive bundles` at src/i18n/desktop-native.test.ts:123 returns `en`; [raw log](baseline-app-unit.log). App sources unchanged.
- App `bun run test:browser` from packages/app: exit 0, **41 pass, 0 fail, 100 assertions**, [raw log](baseline-app-browser.log).
- Core and Desktop `bun typecheck` passed with only the M9 evaluation/static-disabled-policy additions; [Core](m9-07/core-typecheck.log), [Desktop](m9-07/desktop-typecheck.log).

## Benchmark tooling investigation

The initial Playwright 1.59.1 browser installer running under system Node 26.10.0 stalled after downloading Chromium revision 1217. Its owned child PID 13990 remained in extraction for over seven minutes with an output Localizable.strings file open and only 452 KiB extracted. Saved the downloaded archive to `/private/tmp/ftc-chromium-1217.zip`, then terminated only the two verified installer processes (13980/13990). The same installed zip extractor and same archive completed under bundled Node 24.21.0 at `/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node`, producing 349 MiB under `/private/tmp/ftc-node24-extract`. This is a controlled runtime comparison, not a product fix. The retry used pinned headless-browser installation with Node 24 and `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/ftc-playwright`; [original log](browser-install.log), [retry log](browser-install-node24.log). No user app/server was restarted.

Pinned headless-browser and FFmpeg installation completed under Node 24 (exit 0). First benchmark launch failed before test collection because that bundled signed Node cannot load Rollup's native addon: different Team IDs (`ERR_DLOPEN_FAILED`), despite the dependency being installed. [Launch log](baseline-performance.log). The subsequent successful benchmark used system Node 26 and the already installed browser; no dependency/source changes or user app restart.

## Production renderer performance baseline

Run `ftc-baseline-705d41839` completed with **7 passed, 0 failed**, exit 0, 13.1 minutes. App source was unchanged from the initial baseline. Apple M4, 32 GiB memory, macOS 26.5.2 arm64, system Node 26.10.0, Bun 1.3.14, Playwright 1.59.1, Chrome Headless Shell 147.0.7727.15/revision 1217. Test-owned preview used port 44573; after completion no listener remained on that port. No user app/server was restarted.

Cwd `packages/app`, command:

```sh
PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:/opt/homebrew/bin:$PATH PLAYWRIGHT_BROWSERS_PATH=/private/tmp/ftc-playwright PLAYWRIGHT_PORT=44573 OPENCODE_PERFORMANCE=1 OPENCODE_PERFORMANCE_RUN_ID=ftc-baseline-705d41839 bunx --no-install playwright test --config e2e/performance/playwright.config.ts timeline/session-tab-switch-benchmark.spec.ts timeline/session-timeline-benchmark.spec.ts
```

[Raw build/test output](baseline-performance-node26.log); [all seven original status-bearing metric records](baseline-performance-records.json). These cover legacy/v2 tab switching, four streaming variants and review-pane load/file switching. Each streaming variant delivered 160 deltas with 0 pending and no row/Markdown replacement. Observed completion durations: 172701.8 ms legacy, 169045.4 ms v2 closed, 178210.1 ms v2 closed with diffs, 192395.8 ms v2 open.

These are the existing 30x CPU-throttle stress scenarios, not simulated end-user performance, compositor frames or a packaged Electron benchmark. CPU/visual profiling remained at defaults. Other M4 task activity occurred during the run; timings are an initial comparison baseline with that limitation. No machine-dependent speed budget is asserted. Retain exact context/sample distributions in JSON when comparing changed timeline behavior later.

## Database baseline before M2 persistence

At `75f1038c48f7b5c9afbbba91fef837d2a7794506`, before any FTC SQL changes: from packages/core `bun test ./test/database-migration.test.ts` passed 18 tests / 39 assertions, exit 0, using the existing isolated XDG data directories and pinned Bun. `bun script/migration.ts --check` exit 0; snapshot/registry/full schema are current. Its generated SQL was temporary and cleaned by the script. [Tests](baseline-database-migration.log), [generation check](baseline-migration-check.log).
