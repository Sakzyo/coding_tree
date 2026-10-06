# Controller protocol evaluation — M8-04

Date: 2026-10-06. Decision: **evaluation adapters and available-host fixture checks pass; no supported controller combination is promoted. M8-04, AC-09/10 and Panels acceptance remain open.**

Implementation tested: `29be4123ad812e66d26d225b899a46fa9b5d233d`; review base `4a915eacb41f15bd54cb4617df08b4c181222f6a`. Exact commands, output and assertion mapping: [implementation report](M8-04-implementation.md). Primary-source audit: [source preflight](M8-04-source-preflight.md). Fixtures and preserved license records: [provenance](../../packages/core/test/ftc-adapters/fixtures/controller-endpoints/provenance.md).

## Pinned source and environment

- Panels source: `11d69a98e39c43a7d9edc5932275897c034f7a30`; retained archive SHA-256 `a619a2fe534de7b241b69d6fb2abc9935e129b23219a2ff9acabdaa631bdad56`, rechecked locally during this task. Source directory: `/private/tmp/m8-panels-preflight-11d69a98`.
- Frontend package: `ftc-panels@1.1.44`; source gitHead `2c82e93df34e558f3a278c265ab4951599141e4f`. This is source evidence, not an APK/deployed version assertion.
- Source declarations: Panels 1.0.7, Telemetry 1.0.7, OpModeControl 1.0.5, Configurables 1.0.7, Battery 1.0.5, FullPanels 1.0.17, Docs 1.0.8. Pinned setup guide requires SDK 12. No combination with M5's FTC 11.1 baseline is asserted.
- Available host: macOS 26.5.2 / build 25F84 / arm64; Bun 1.3.14 (`0d9b296a`), workspace Effect 4.0.0-beta.83. Owned Bun HTTP/WebSocket and Node TCP listeners are the only runtime endpoints exercised.
- ADB file: `/Users/dylanxu/Library/Android/sdk/platform-tools/adb`, SHA-256 `92105d0c0f006a6fbdd8a91e82b791d23e4746491062b62d5ecc34abecf9086b`. The prior audit recorded ADB 1.0.41 / 35.0.1. M8-04 read the file hash but did **not** run ADB, start its daemon, enumerate devices, install, start, tune, or probe any robot.

## Observed protocol and implemented read boundary

The source profile selects robot HTTP port 8001 and WebSocket port 8002 only for that exact pinned revision. Unknown profile revisions fail before I/O; these ports are not universal defaults. Source HTTP is plaintext and the adapter currently rejects HTTPS/WSS profiles rather than imply validated TLS behavior.

`Panels.readEndpoints(input, ReadTransport)` accepts explicit HTTP/data origins and the evidence classification. It validates source-shaped responses through GET and one receive-only socket read. Transport ports have no send, queue, reconnect, arbitrary-method or subprocess capability. Their host implementation must enforce bounded response size/time, GET-only/no redirects, cancellation and scoped socket cleanup; no production host is registered here. The injected fixture host enforces GET/no redirects and receives one frame with a bounded socket wait. Fixture transport conformance is not proof of a secure live host.

The returned canonical `FtcController.ProtocolEvidence` records the selected **profile** revision, observed plugin declarations and hashes, resource observations, optional received sample and `readEndpoints`. `deployment: unverified`, `identity: unknown`, `freshness: unknown`, dashboard blocked and logs unknown remain explicit. The caller-provided fixture/controller classification does not authenticate a controller or prove its source revision. These are observations, not a compatibility or mutation authorization token.

| Resource / feature            | Source fact and evaluation result                                                                                                                                                                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`, `/index.html`            | Source serves web assets, including fallback root HTML. Fixture checks status and HTML shape only. Compiled asset graph, dynamic imports, IndexedDB, blob imports and actual dashboard rendering remain NOT RUN.                                                              |
| `/api/plugins`                | Validated `core/pluginsDetails` envelope, loaded `details,config`, and skipped list shape. Source uses `text/html`; validation therefore checks data, not a JSON MIME assumption. Malformed/HTML fallback fails. Skipped-plugin detail is not yet a persisted evidence field. |
| `/api/sha256`, `/api/shas`    | Validated hash format/null; plugin hashes are software observations, never hardware identity. Initial `"null"` metadata hash and null plugin hashes do not prove readiness. No bundle-byte cryptographic authenticity is claimed.                                             |
| `/api/configs/<id>`           | Validated matching ID/version/frontend declaration for recognized plugin IDs. Unknown/custom plugins are recorded as blocked and no resource route is built from their IDs.                                                                                                   |
| `/api/svelte/<id>`, `/sha256` | Recognized, non-null hash entries require JavaScript/gzip resource metadata and matching reported hashes; null entries record missing bundle evidence. Loopback serves actual gzip bytes and fetch decodes them. Synthetic JS is never executed.                              |
| `/api/performance`            | Envelope and timing-array shape checked, including valid zero values. No runtime performance claim follows.                                                                                                                                                                   |
| socket `/health`              | Only advisory; a 200 is followed by a real receive attempt. Loopback health 200 plus handshake 503 fails as disconnected and cleans up.                                                                                                                                       |
| socket root                   | Pinned frontend uses root and fixed port 8002. Adapter uses an explicit independent data origin, does not depend on displaying the page, and never sends an application frame.                                                                                                |
| Data subset                   | `core/time`, Telemetry `telemetryPacket` strings and Battery `battery` finite numbers validated. Textual zero, numeric zero, empty array, null/no sample and battery -1 sentinel stay distinct; values are not relabeled fresh or tied to a robot/project.                    |
| Other data                    | OpMode list/status/timer, Configurables read updates, camera frames and plugin-specific protocols are documented by preflight but not decoded by this minimal receive subset; unknown frames fail closed. M10 owns richer decoding and freshness/association.                 |
| Robot logs                    | No robot-log route found in inspected Panels handlers. Browser frame history is not robot logs. ADB/logcat remains a separate unevaluated adapter. Returned log availability is unknown.                                                                                      |

Recognized resource metadata IDs are Telemetry, Battery, OpModeControl, Configurables and CameraStream. Their existence does not authorize their controls or validate their binaries. Other plugins, including LimelightProxy, are blocked from automatic resource probing. Missing assets never silently become a successful dashboard capability.

## USB forwarding and routing decision

`Adb.forwardPanels(candidate, revision, ForwardTransport)` consumes the canonical M8-01 candidate and preserves discovery contracts. Only available/authorized candidates enter forwarding. For the selected source profile, it requests two target-explicit, ephemeral-local, no-rebind leases to remote 8001/8002. The injected transport is responsible for atomic acquisition, compensating partial/failed acquisition, bounded completion, and ownership-aware lease closure; a production ADB CLI implementation remains unregistered and unverified.

Effect scope owns both leases. Success/disposal, second-acquisition conflict, invalid/duplicate local ports, cancellation and cleanup failures are exercised. No remove-all operation exists. Cleanup failure makes the scope exit fail rather than report success. Consumers must retain the enclosing scope while using routes; returned evidence can outlive the sockets but does not keep them reachable.

**Raw TCP forwarding is bidirectional.** An OS listener/ADB forward does not enforce a read-only robot boundary. The owned fixture forwards both directions; absence of application writes from the read adapter does not prevent another process from connecting or writing.

The unmodified page chooses `window.location.hostname:8002` regardless of its HTTP port. Arbitrary local forward ports therefore cannot be promoted to working dashboard URLs. Concurrent targets need proven isolation/rewriting/mediation. Dashboard capability remains `blocked_unmediated_routes` even when all fixture reads pass. No composition, registration, Electron navigation or fallback-launch behavior was enabled.

## Identity, mutation, replay and downstream gates

Distinct synthetic devices with identical plugin/version/hash observations remain unknown identities. IP/port, ADB address, plugin hash, OpMode name and configuration UUID are not stable-controller identity proof. M8-02/03 retain identity and connection-generation ownership; this change adds neither lifecycle schema nor guessed controller ID.

The read subset rejects source mutation message families: OpMode init/start/stop, Configurables updates, both gamepads, core/pluginReloaded, unknown/custom frames and Limelight proxy frames. It exposes no outgoing queue or reconnect operation. This is input rejection in an injected reader, **not proof that embedded dashboard writes are mediated**, and not a protected M9 action adapter.

Source frontend outgoing frames may queue until open and reconnect may reload. Limelight proxies forward methods/bodies or raw bidirectional sockets and add ports 5800/5801/5805/5807. Complete routes, custom plugin onNewClient behavior, automatic timer stops, and no-replay across real generations require later evaluation. Keep M9-07/M9-08 and dashboard controls disabled. A disconnect never proves an OpMode stopped.

## Required real evidence still unavailable

| Gate                                                                                | Result / prerequisite                                                                                                                                                                       |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Actual Control Hub and compatible phone, USB and Wi-Fi, macOS and Windows           | **NOT RUN** — no authorized controller; Windows host unavailable. Need explicit tested hardware/OS/SDK/Panels/frontend/deployed plugin matrix.                                              |
| Real ADB forwarding ownership, daemon conflicts, disconnect/cancel cleanup          | **NOT RUN** — no device/daemon contact authorized. Owned loopback and injected conflict tests are not ADB conformance.                                                                      |
| Full HTTP/resource graph, actual APK, WS handshake/events and extra plugins         | **NOT RUN** — need deployed binary/assets and live runtime captures. Source-shaped fixture subset only.                                                                                     |
| Stable physical identity/alias convergence and build association                    | **NOT RUN** — no trusted stable identity endpoint observed. M8-02 and M5/M9 association gates remain separate.                                                                              |
| Real telemetry source/project, freshness, retained snapshot and disconnect behavior | **NOT RUN** — clock strings are display time, battery is change-only, telemetry snapshots are uncertain. M10 must attach trusted receipt/connection context without inventing sample times. |
| Robot logs                                                                          | **NOT RUN** — no verified Panels route; separate log adapter required.                                                                                                                      |
| Electron embedding/external fallback, action mediation, replay and optional proxies | **NOT RUN** — raw forwarding cannot satisfy the boundary; real host/platform tests and M9 protection remain required.                                                                       |

No source or fixture result closes PAN-01/02/03, ROB-01/05, FTC-05 or AC-09/10. The implementation supplies a repeatable evaluation boundary and evidence for those owners.
