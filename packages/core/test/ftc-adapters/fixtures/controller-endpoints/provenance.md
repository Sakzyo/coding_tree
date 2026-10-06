# M8-04 source-derived fixtures — non-live

Created 2026-10-06. These are independently constructed protocol examples, **not captures from a robot, Android process, built APK or upstream dashboard**. `fixture.ts` uses invented asset bytes, hashes, clocks, device addresses and measurements. `loopback.ts` serves them on owned macOS loopback listeners and forwards bytes through owned Node TCP listeners. No ADB process, daemon or attached device is involved. No JavaScript bundle is evaluated.

Source inspection consumed the already retained files at `/private/tmp/m8-panels-preflight-11d69a98`; no new download occurred. Primary source provenance and detailed line references are in [M8-04 source preflight](../../../../../../docs/validation/M8-04-source-preflight.md).

- Panels source commit: `11d69a98e39c43a7d9edc5932275897c034f7a30`, archive SHA-256 `a619a2fe534de7b241b69d6fb2abc9935e129b23219a2ff9acabdaa631bdad56`.
- Frontend dependency: `ftc-panels@1.1.44`, gitHead `2c82e93df34e558f3a278c265ab4951599141e4f`; archive integrity was checked during source preflight.
- Shapes: `library/Panels/src/main/java/com/bylazar/panels/json/{Plugins,Socket}.kt`; `server/StaticServer.kt`; `library/Telemetry/.../TelemetryPlugin.kt` and `web/config.ts`; Battery plugin source. The plugin-details fixture includes every PluginDetails field, with synthetic content. The config resource represents the built plugin `config.ts` metadata, while the plugins envelope's config is the runtime plugin configuration.
- HTTP bodies include the actual `/api/plugins` envelope with its observed `text/html` MIME, nullable `/api/shas`, text hashes, config metadata, performance timing records, gzip JavaScript resource metadata and health response. Hash strings are synthetic and do not establish asset integrity or hardware identity.
- The frontend's fixed WebSocket port comes from `ftc-panels/src/lib/core/socket/global.ts` at the frontend commit above. Arbitrary local forward ports do not make that dashboard work.

Preserved verbatim license records: `Panels-LICENSE.md` (root FTControl License v1.0), `FIRST-LICENSE` (Panels library FIRST terms), and `Frontend-LICENSE.md` (frontend FTControl License). These are source attribution/retention records, not a redistribution approval. No upstream executable frontend or APK is copied into this fixture.
