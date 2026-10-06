# Implementation baseline — 2026-10-06

Revision: `d7aca195c0a47fadb0fc3788eefbe96f99ec68be`; branch `ftc-workspace`; no pre-existing product changes. Untracked prompt/task plans preserved. No FTC tests or validation records existed.

Environment: macOS 26.5.2 (25F84), arm64; Node v26.10.0. Bun 1.3.14 downloaded from its exact official release into `/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun`; prefix this directory to PATH for commands below. No Windows runner configured. Java home inventory includes Corretto 17.0.15; editor Java 21 not present in java_home inventory. Android ADB exists outside PATH at `/Users/dylanxu/Library/Android/sdk/platform-tools/adb` (worker verified 1.0.41, 35.0.1-11580240). No robot mutations authorized; no controller availability asserted. No model runtime on PATH. No provider credentials inspected.

| Check | Working directory | Result | Evidence |
| --- | --- | --- | --- |
| `bun test ./src/main/external-url.test.ts ./src/main/window-registry.test.ts` | packages/desktop | Exit 0; 11 pass, 0 fail, 26 assertions | [log](baseline-desktop.log) |
| `bun test ./test/session-prompt.test.ts ./test/session-runner.test.ts ./test/session-run-coordinator.test.ts` | packages/core | Exit 1; 0 pass, 3 import failures/errors because Effect and workspace dependencies not installed; no Session behavior validated | [log](baseline-session.log) |
| `bun install --frozen-lockfile` | repository root | IN_PROGRESS; repository scripts and pinned manifest inspected | [log](dependency-install.log) |

Required production session/timeline benchmark has not been run. Do not modify existing session/timeline UI until its applicable benchmark baseline exists. M9-07 evaluation does not modify that code. Baseline package typechecks and Session tests will follow dependency provisioning.
