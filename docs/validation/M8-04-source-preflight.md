# M8 protocol source preflight — completed source audit

Date: 2026-10-06. Investigator: `/root/m8_protocol_preflight`, independent read-only preparation for M8-04. No repository/index/HEAD changes, ADB execution, device access, robot code or runtime tests occurred. This is source evidence only: **M8-04 is not complete and no supported runtime combination is established.**

## Provenance

Panels revision [11d69a98e39c43a7d9edc5932275897c034f7a30](https://github.com/ftcontrol/ftcontrol-panels/tree/11d69a98e39c43a7d9edc5932275897c034f7a30). Archive SHA-256 `a619a2fe534de7b241b69d6fb2abc9935e129b23219a2ff9acabdaa631bdad56`. Captured assets: `/private/tmp/m8-panels-preflight-11d69a98`.

Pinned `ftc-panels@1.1.44` comes from `library/Panels/web/package.json:24–30`. [Exact npm metadata](https://registry.npmjs.org/ftc-panels/1.1.44) identifies frontend gitHead `2c82e93df34e558f3a278c265ab4951599141e4f`; investigator checked tarball SHA-1 and SHA-512 integrity against registry values. Source and registry metadata remain in the owned temporary directory. Browser GitHub fetch initially failed with cache miss; sandbox curl initially failed DNS. Authorized elevated downloads obtained the pinned archives and exact npm dependency.

File references below are relative to those exact pinned repositories, not floating main.

## HTTP and dashboard resources

| Endpoint/resource | Observed source behavior |
| --- | --- |
| HTTP `:8001` | Android assets rooted at `web`; creation/start conditional on Panels lifecycle/preferences |
| `/`, `/index.html` | Root index; extensionless path maps to `web/<path>/index.html`; missing assets can fall back to root HTML with 200 |
| `/api/plugins` | `{messageID:"pluginsDetails",pluginID:"core",data:{plugins,skippedPlugins}}`, content type `text/html`; loaded entry has `details,config` |
| `/api/sha256` | Hash of plugin-details response; initially string `"null"` |
| `/api/shas` | Loaded plugin ID to Svelte asset hash or null |
| `/api/svelte/<pluginID>` | Plugin `svelte.js`, JavaScript with `Content-Encoding: gzip` |
| `/api/svelte/<pluginID>/sha256` | Hash text or 404 |
| `/api/configs/<pluginID>` | Plugin `config.json` asset |
| `/api/performance` | Envelope core/performanceReadings with `TaskTiming[]`: id/startNanos/endNanos/durationMillis |
| `:8002/health` | 200 OK before `Panels.wasStarted` readiness check; not proof of data/socket readiness |

Sources: [Panels.kt:67–95](https://github.com/ftcontrol/ftcontrol-panels/blob/11d69a98e39c43a7d9edc5932275897c034f7a30/library/Panels/src/main/java/com/bylazar/panels/Panels.kt#L67-L95), [StaticServer.kt:106–250](https://github.com/ftcontrol/ftcontrol-panels/blob/11d69a98e39c43a7d9edc5932275897c034f7a30/library/Panels/src/main/java/com/bylazar/panels/server/StaticServer.kt#L106-L250) and 264–294, [Socket.kt:17–38](https://github.com/ftcontrol/ftcontrol-panels/blob/11d69a98e39c43a7d9edc5932275897c034f7a30/library/Panels/src/main/java/com/bylazar/panels/server/Socket.kt#L17-L38). HTTP handlers special-case OPTIONS but don't otherwise enforce GET; CORS advertises broad methods. No core HTTP mutation handler was observed in this file.

Dashboard fetches same-origin plugin hashes/bundles, caches IndexedDB data and imports fetched JavaScript through blob URLs (`library/Panels/web/src/lib/state.svelte.ts:293–344`). Compiled asset filenames and actual APK contents were not built/inspected. Asset generation anchors: `library/Panels/web/svelte.config.js:14–17`; `library/plugin-svelte-assets/src/main/kotlin/com/bylazar/SvelteAssetsPlugin.kt:76–125`.

[Frontend GlobalSocket.initSocket:58–65](https://github.com/ftcontrol/panels-js-core/blob/2c82e93df34e558f3a278c265ab4951599141e4f/ftc-panels/src/lib/core/socket/global.ts#L58-L65) constructs `ws(s)://window.location.hostname:8002`, ignoring page port. Server delegates handshakes to NanoWSD without explicit path restriction; frontend uses root path. HTTPS selects wss, while no TLS setup is visible in inspected robot-side constructors.

## Read-message shape and limitations

Common envelope `{pluginID,messageID,data}` contains no controller identity, connection generation, sample timestamp, sequence or protocol version. Gson permits special floating-point values. Sources: `library/Panels/src/main/java/com/bylazar/panels/json/Socket.kt:7–24`, `plugins/Plugin.kt:50–59`, `server/Socket.kt:133–158`.

| Plugin/message | Data / availability |
| --- | --- |
| core/time | `{time:string}` in HH:mm:ss every second; display clock, not telemetry sample timestamp |
| com.bylazar.telemetry/telemetryPacket | `string[]`; addData formats key:value; 75 ms default, requires producer updates, omits empty/throttled packets |
| com.bylazar.opmodecontrol/opModesList | `{opModes:OpModeDetails[]}`; name/group/flavour/source/defaultGroup/autoTransition |
| com.bylazar.opmodecontrol/activeOpMode | `{opMode,status:INIT|RUNNING|STOPPED,startTimestamp:number|null}`; new-client/lifecycle events |
| com.bylazar.opmodecontrol/deltaMs | Numeric elapsed ms; 250 ms ticker while start timestamp exists |
| com.bylazar.battery/battery | Numeric voltage; 5 s sampling, change-only emission; -1.0 unavailable sentinel; no new-client snapshot |
| com.bylazar.configurables/initialConfigurables or configurables | Class-name map to `{id,className,fieldName,type,value,possibleValues?,customValues?}[]` |
| com.bylazar.configurables/newConfigurables | `{id,newValueString}[]` after updates |
| com.bylazar.camerastream/camStream | Base64 JPEG string; optional empty string on stop; main WS, no extra core camera port |

Sources: `library/Panels/.../server/tasks/TimeTask.kt:37–51`; [TelemetryPlugin.kt:12–29](https://github.com/ftcontrol/ftcontrol-panels/blob/11d69a98e39c43a7d9edc5932275897c034f7a30/library/Telemetry/src/main/java/com/bylazar/telemetry/TelemetryPlugin.kt#L12-L29), `TelemetryManager.kt:16–57`; [OpModeControlPlugin.kt:77–119](https://github.com/ftcontrol/ftcontrol-panels/blob/11d69a98e39c43a7d9edc5932275897c034f7a30/library/OpModeControl/src/main/java/com/bylazar/opmodecontrol/OpModeControlPlugin.kt#L77-L119) and 140–179, `Json.kt:6–30`; `library/Battery/.../BatteryPlugin.kt:28–55`, `BatteryProvider.kt:8–25`; `library/Configurables/.../ConfigurablesPlugin.kt:27–59`, `Json.kt:5–18`; `library/CameraStream/.../CameraStream.kt:44–115`.

Telemetry is separate from page rendering, but textual rather than typed sensor records. `TelemetryManager.kt:49–56` assigns lastLines=lines then clears lines; don't assume reliable retained last-packet snapshot.

No robot-log HTTP/socket message was found in examined official handlers. `library/Panels/.../Logger.kt:25–35` writes FTC RobotLog; normal logging defaults off (`PanelsConfig.kt:3–6`). Frontend GlobalSocket.log is bounded frame history, not robot logs; `TelemetryManager.kt:156` returns null for FTC telemetry log(). ADB/logcat is a candidate separate adapter, not evaluated.

## Mutation and replay boundaries

- OpModeControl initOpMode takes string name; startActiveOpMode and stopActiveOpMode call OpModeManager. Timer widget can automatically send stop (`library/OpModeControl/web/src/control/TimerWidget.svelte:10–43`).
- Configurables updatedConfigurable accepts `{id,newValueString}[]` and sets reflected fields directly ([handler:39–58](https://github.com/ftcontrol/ftcontrol-panels/blob/11d69a98e39c43a7d9edc5932275897c034f7a30/library/Configurables/src/main/java/com/bylazar/configurables/ConfigurablesPlugin.kt#L39-L58)).
- Gamepad gamepad0/gamepad1 update virtual state consumable/mergeable with FTC gamepads (`library/Gamepad/.../GamepadPlugin.kt:29–71`, `GamepadManager.kt:81–125`).
- Custom plugin IDs select handlers dynamically: default-deny unknown frames. core/pluginReloaded invokes onNewClient and cannot be assumed authorization-safe for arbitrary plugins.
- Outgoing frames queue and drain at socket open; close() doesn't clear queue. The page reconnect path invokes reload after prior success. These observations don't prove replay occurs, but no-replay must be explicitly enforced/tested by the app. [Queue/close source:116–179](https://github.com/ftcontrol/panels-js-core/blob/2c82e93df34e558f3a278c265ab4951599141e4f/ftc-panels/src/lib/core/socket/global.ts#L116-L179); page `state.svelte.ts:266–268,368–370`.

LimelightProxy creates HTTP 5801→172.29.0.1:5801, HTTP 5800→:5800, HTTP API 5807→:5807 and raw socket 5805→:5805. Widgets use page hostname with fixed 5801/5800/5807/status. HTTP forwards methods/bodies; raw sockets pipe both directions. These are not inherently read-only. [Plugin:53–75](https://github.com/ftcontrol/ftcontrol-panels/blob/11d69a98e39c43a7d9edc5932275897c034f7a30/library/LimelightProxy/src/main/java/com/bylazar/limelightproxy/LimelightProxyPlugin.kt#L53-L75), `proxies/GenericProxy.kt:33–99`, `GenericSocketProxy.kt:59–88`, `web/src/widgets/Dashboard.svelte:30–48`, `Stats.svelte:58–63`, `CameraStream.svelte:14–35`. Complete downstream Limelight resources/control semantics remain unknown.

## Identity, routing inference and version declarations

Plugin IDs/hashes identify software/content; configurable/field-image UUIDs identify objects. Documented Hub/phone IPs are aliases. Scoped searches of core/plugins/frontend state found no exposed controller serial, Android ID or stable physical-controller ID. This does not establish that FTC/Android/ADB cannot supply trustworthy identity elsewhere. Matching hashes or OpModes never establishes alias convergence.

Inference for USB: HTTP and WS require separate reachability. Unmodified forwarded page still targets fixed 8002, so arbitrary local ports require validated rewriting/interception or another routing approach. Concurrent targets require explicit isolation of fixed routes; enabled Limelight resources add routing and mediation needs. TCP forwarding is bidirectional and doesn't enforce M8 read capability boundaries. Ownership, collisions, disconnect cleanup, generations and real reachability remain unrun.

Source version declarations: Panels 1.0.7, Telemetry 1.0.7, OpModeControl 1.0.5, Configurables 1.0.7, Battery 1.0.5, FullPanels 1.0.17, Docs 1.0.8, frontend core 1.1.44. These are not verified release tags/deployed versions. `PluginsManager.kt:121–129` compares pluginsCoreVersion with 1.1.44 and permits link: development values. Pinned setup guide mentions SDK 12; no compatible binary matrix was evaluated.

License source records: root [FTControl License v1.0](https://github.com/ftcontrol/ftcontrol-panels/blob/11d69a98e39c43a7d9edc5932275897c034f7a30/LICENSE.md#L1-L20) and [frontend license](https://github.com/ftcontrol/panels-js-core/blob/2c82e93df34e558f3a278c265ab4951599141e4f/LICENSE.md) contain attribution, non-commercial-use and modified-redistribution retention terms; Panels `library/LICENSE:1–28` also includes FIRST terms. Preserve these source records when evaluating packaging; this audit does not authorize redistribution or accept terms.

## Minimal next fixture coverage

1. Source-derived plugin/config/version/hash/null/gzip responses; fallback HTML 200, socket 503 and misleading health 200 readiness.
2. Exact envelope/read payloads, malformed/unknown/version failures; valid-zero versus missing/unavailable/stale cases.
3. Fixed 8002 routing plus optional extra resources; multi-target collision and owned-forward cleanup.
4. Every mutation family, custom frames, proxy writes and queued frames across generation changes rejected/mediated.
5. Identical software observations on distinct synthetic devices remain insufficient identity evidence.

Label these fixtures **source-derived, non-live**. Physical Hub/phone USB/Wi-Fi, Windows, actual log access, deployed-build association, Electron isolation, freshness, reconnection and mediation are **NOT RUN**. No source fact is a passing physical/platform gate.
