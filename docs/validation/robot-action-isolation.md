# M9-07 robot action isolation evaluation

Status: **BLOCKED — no production combination approved.** Date: 2026-10-06.

Requirement coverage: ROB-07 directly; AI-04/PAN-01 boundary implications; ROB-02–ROB-06 and AC-10/AC-11 remain dependent on M9-08/M9-09 and physical observations. This evaluation does not complete any acceptance scenario.

Source revision: `441ce9be5b914aa12ed918629663195f32e97d03` (documentation checkpoint; product baseline `d7aca195c0a47fadb0fc3788eefbe96f99ec68be`) plus the assigned M9-07 diff. See [implementation record](M9-07-implementation.md). No existing command, build, extension, transport or window path is changed or enabled.

## Decision

Do not expose agent-controlled FTC command/build/extension routes or embedded Panels controls until M9-08 can enforce a proven boundary. The new immutable `panelsPolicy` records `embedded: false`, `controls: false`, `reason: isolation_unverified`. It is **not wired into Electron** and is not evidence that an existing view is blocked. M1-09/M9-08 must consume/enforce the decision before creating any dashboard view. Existing OpenCode Bash retains its host-user authority; it is not approved for the FTC execution boundary by this evaluation.

A macOS experimental profile denies the tested loopback HTTP/WebSocket operations while permitting a simple Bun subprocess. It is not selected as a supported production mechanism. Its default-allow filesystem/process policy, untested broker capability transport, USB access, descendants and development compatibility leave important authority channels unresolved. Windows has no evidence. PATH filtering is rejected as isolation: actual absolute executables and an actual offline Gradle task reached the owned loopback fixtures.

## Environment and prerequisites

[Environment output](m9-07/environment.log): macOS 26.5.2 build 25F84, arm64; Bun 1.3.14 (`0d9b296a`); Android Debug Bridge 1.0.41 / platform tools 35.0.1-11580240; Amazon Corretto OpenJDK 17.0.15. Actual cached Gradle 8.9 was executed. `sandbox-exec` is the `/usr/bin` binary on this host; its profile is recorded below. Electron 42.3.3 is declared by the package, **not executed or validated here**. No FTC SDK, Panels revision, controller, controller transport or APK is claimed tested.

Required assets for full evaluation: supported macOS and Windows hosts; pinned executable isolation mechanism and packaged launchers; real ADB and USB API probe with an authorized target; FTC/Android Gradle project and offline caches; production extension/MCP hosts and descendants; protected M9 broker with real IPC/capability transport; Electron embedded Panels view and versioned protocol; permitted physical Control Hub/phone and USB/Wi-Fi connections. Missing prerequisites below are NOT RUN, never passed by substitution.

The evaluation uses Bun's built-in test runner and owned ephemeral `127.0.0.1` HTTP/WebSocket servers. Each subprocess receives a deliberately minimal environment and `PATH=/usr/bin:/bin`. It never executes ADB install/start/connect or contacts a real controller. The Gradle task writes only a temporary local project/cache and performs one fixture HTTP POST, then cleanup removes that directory. Gradle reports a single-use daemon even with `--no-daemon`; no repository/team Gradle code is run.

## Reproduce

From `packages/core`, with the following existing assets (adjust absolute asset paths to the evaluated installation and record new versions):

```sh
export PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH
export M9_SANDBOX_EXEC=1
export M9_ADB=/Users/dylanxu/Library/Android/sdk/platform-tools/adb
export M9_GRADLE=/Users/dylanxu/.gradle/wrapper/dists/gradle-8.9-bin/90cnw93cvbtalezasaz0blq0a/gradle-8.9/bin/gradle
export M9_JAVA_HOME=/Users/dylanxu/Library/Java/JavaVirtualMachines/corretto-17.0.15/Contents/Home
bun test ./test/ftc-evaluation/m9-07.test.ts
```

Run outside the agent harness sandbox with authorization for local fixture listeners and child processes. The harness sandbox is not product isolation. Initial harness-contained execution could not bind the fixture listener ([output](m9-07/default.log)); an initial standalone `sandbox-exec ... /usr/bin/true` also returned `sandbox_apply: Operation not permitted`. The identical harmless sandbox startup probe outside the harness exited 0. Neither initial failure is counted as a product deny result.

Candidate profile passed to each restricted child:

```scheme
(version 1)(allow default)(deny network*)(deny iokit*)
```

The unrestricted control must reach the owned server. Restricted HTTP/WebSocket probes must show `probe_ready`, a protocol-specific failure, nonzero exit and **zero received messages**; a `sandbox_apply` failure cannot pass. A separate restricted arithmetic subprocess must start successfully. No endpoint denial is inferred solely from a nonzero exit.

With optional environment variables absent, asset-dependent tests skip visibly; only local loopback controls and the disabled-policy assertion run. An unqualified green test run cannot establish supported isolation. The `action-boundary-probe.test.ts` adapter is also imported by the required evaluation entry point; the real process/socket assertions are not replaced with mocks.

## Recorded results

[Final host output](m9-07/macos.log): exit 0, **8 pass, 4 explicit NOT RUN skips, 0 fail, 24 assertions**, 12 tests in 1 entry point. Child processes and sockets are actual OS operations; controller/broker endpoints and the Gradle project are fixtures.

| Probe                                         | Actual observation                                                              | Evidence class / conclusion                                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Absolute Bun path, filtered PATH, HTTP POST   | Child exit 0; owned broker fixture received exactly `POST /broker`              | Actual process/network; fixture broker. PATH is insufficient.                                                                   |
| Dashboard-style WebSocket write, unrestricted | Child exit 0; owned socket received `probe` and acknowledged                    | Actual process/network; fixture message, not real Panels.                                                                       |
| Restricted Bun arithmetic startup             | Exit 0; stdout `42`                                                             | Actual macOS profile launch. Only this simple development subprocess is shown compatible.                                       |
| Restricted HTTP POST                          | Child reached `probe_ready`, `FailedToOpenSocket`, exit 1; zero server requests | Actual macOS restriction against local fixture only.                                                                            |
| Restricted WebSocket write                    | Child reached `probe_ready`, `websocket_denied`, exit 1; zero server messages   | Actual macOS restriction against local fixture only.                                                                            |
| Absolute real ADB binary with filtered PATH   | `adb version` exit 0, version 35.0.1-11580240                                   | Actual binary execution only; NOT a test of controller or ADB-server isolation.                                                 |
| Real Gradle 8.9 offline task, unrestricted    | Build succeeded; fixture broker received `POST /broker`                         | Actual JVM/build execution, generated fixture project. Offline dependency mode does not isolate robot/broker network authority. |
| Disabled immutable dashboard policy           | Four assertions pass                                                            | Static decision only; not Electron enforcement.                                                                                 |

## Unresolved mandatory gates

| Gate                                                                                         | Status and missing evidence                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows processes / ADB / USB / network / broker / Gradle / extensions / dashboard           | **NOT RUN** — no configured Windows execution host.                                                                                                                                                                                                               |
| macOS direct USB APIs and real ADB server / physical controller                              | **NOT RUN** — no authorized physical control fixture. `deny iokit*` is unproven; ADB version does not test USB. No controller actions were authorized or executed.                                                                                                |
| Real controller HTTP/WebSockets and port forwarding                                          | **NOT RUN** — loopback protocol fixtures are not controller/transport validation.                                                                                                                                                                                 |
| Isolated Gradle/Android/FTC development compatibility                                        | **NOT RUN** — unrestricted fixture task ran; candidate-restricted real FTC build and JDK/Gradle daemon/cache behavior remain unverified.                                                                                                                          |
| Production extension/MCP hosts, inherited handles, descendants and escape attempts           | **NOT RUN** — no production adapters were composed. Generic subprocess evidence is not extension/MCP coverage.                                                                                                                                                    |
| Broker capability isolation                                                                  | **NOT RUN** — fixture HTTP listener has no real authentication/capability adapter. File-readable capabilities, Unix sockets, named pipes, Mach IPC, inherited handles and in-process privileges are not evaluated.                                                |
| Embedded controls and privileged bridge                                                      | **NOT RUN** — no Electron view was constructed. Real HTTP/WS write mediation, preload/IPC absence, navigation, redirects, frames, permissions, WebUSB and lifecycle still need proof. A view sandbox or disabled UI does not itself prevent robot-network writes. |
| Required packaged macOS/Windows support                                                      | **NOT RUN** — packaging, signing, platform stability and mechanism availability not established.                                                                                                                                                                  |
| Physical AC-10/AC-11 target/generation/build binding, contention, lost replies and no replay | **NOT RUN** — belongs to composed/physical M9-08/M9-09 work; no source/fixture test promotes these gates.                                                                                                                                                         |

M9-07 remains open. No production platform or controller combination is promoted. Full module behavior for M9-01–M9-06 is outside this evaluation; none is implicitly implemented by the fixture broker.

## Review fix 1: subprocess lifetime

The reviewed runner now owns a POSIX process group and confirms its termination before normal completion/cancellation and temporary-directory deletion. TERM-resistant descendants holding output pipes are covered for leader exit, timeout and AbortSignal cancellation; a cleanup failure retains the temporary directory and fails visibly. This is fixture lifecycle cleanup, not proof against a hostile process that escapes the group. Windows remains unimplemented/unverified.

Latest [host output](m9-07/fix-1-macos.log): **11 pass, 4 NOT RUN skips, 0 fail, 36 assertions**. Three new cleanup regressions first failed and then passed; exact commands, separate logs and qualifications are in [the fix report](M9-07-implementation.md#independent-review-fix-round-1--owned-probe-cleanup). Every production/platform/physical gate above remains open.
