# M9-07 independent review — round 0

Reviewer: `/root/m9_07_review`; stable range `441ce9be5..fbea951a3`.
Specification: available subset needs cleanup repair; full task correctly BLOCKED.
Code quality: Needs fixes. No Critical findings.

Important: `packages/core/test/ftc-adapters/action-boundary-probe.test.ts:16–26` sends one signal only to the direct child, then awaits exit/output. The recorded Gradle execution forks a single-use daemon. On timeout, killing the launcher can leave descendants and inherited output handles alive. Own the process tree, terminate descendants, use bounded escalation, and await cleanup before deleting the directory. Add a focused timeout/descendant-cleanup regression.

Reviewer ran a focused file-free Bun process probe: `{"directChildExited":true,"descendantSurvivedTimeoutAndFinallyKill":true}`; killed the owned surviving sleep afterward. No suite rerun or checkout edits.

Minor: listener allocation precedes directory allocation outside cleanup at lines33–49. If directory allocation fails, listener leaks. Use nested resource cleanup.

Positive findings: restricted probes distinguish sandbox startup from protocol denial (lines71–76); unrestricted controls verify receipt (66–68), arithmetic verifies launch (87–92). Loopback-only traffic, ADB version-only, and generated Gradle project preserve test isolation (33–63,99–109). Frozen disabled policy enables no production path. Eight passes/four skips/24 assertions match raw logs. Mandatory Windows/USB/controller/broker/MCP/Electron/packaged evidence remains unrun and prevents task completion.

Coordinator action: fix round 1/5 sent to original implementer `/root/m9_07`; fix base `fbea951a3`; scoped re-review required.

## Fix round 1 independent re-review

Reviewer `/root/m9_07_review`, head `705d41839dc1e64e12343c62777ce500e022d3a1`, fix base `fbea951a370db94684350fdbee9f9a89ab0bb80f`. Read-only scoped review against [fix diff](M9-07-fix1-review.diff).

- Important process-tree cleanup finding: **ADDRESSED**. Owned POSIX group, shared cleanup on leader exit/cancellation, bounded TERM/KILL escalation and disappearance check (`action-boundary-probe.test.ts:18–69`); cleanup failure retains the directory (`:158–184`). Escaping descendants remain an explicit limitation.
- Minor listener acquisition finding: **ADDRESSED**. Directory acquired first and nested listener disposal precedes deletion (`:125–185`); failed listener allocation reaches directory cleanup.
- Reviewed real shell fixture retains pipes/ignores TERM. RED log contains three failures; GREEN three passes / 12 assertions; final host run 11 passes / four NOT RUN / 36 assertions. Direct OS-signal interruption explicitly untested.
- New breakage: none. Out-of-scope observations: none. No suites rerun; existing covering output was checked against code.
- **Fix round APPROVED; full task BLOCKED** by mandatory external platform/hardware gates. The feasible subset is reviewed, not release acceptance.
