# M11-04 implementation evidence

Date: 2026-10-07 Asia/Shanghai. Assigned starting base: `fcf89eb8d`. Candidate is uncommitted for coordinator-owned independent review and commit. Only the assigned content/manifest/test, explicitly conditionally assigned canonical Knowledge Schema/Core files, the coordinator-authorized single M11-01 prerequisite test case, and this report were changed by this worker. No ledger, checklist, root export, API, generated SDK, Session, course engine, learning progress, platform profile or host wiring changed.

## Delivered content and approved contract

Two source-reviewed local documents share `foundations` / `1.0.0`, applicability exactly `11.1.0`, and four ordered versioned lessons:

| Lesson ID / topic                                                    | Exercise ID                          | Teaching scope                                                                                                                   |
| -------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| foundation-java-fundamentals / java-fundamentals                     | exercise-java-fundamentals           | Primitive versus reference values, declaration/assignment/comparison, parameters, return, branch and loop, pure sign calculation |
| foundation-opmode-lifecycle / opmode-lifecycle                       | exercise-opmode-lifecycle            | Linear and iterative lifecycle, wait/start/stop boundary, stop-aware observation loop                                            |
| foundation-hardware-gamepads-telemetry / hardware-gamepads-telemetry | exercise-hardware-gamepads-telemetry | Type/name mapping during initialization, current gamepad fields, encoder counts, telemetry update and delivery limits            |
| foundation-code-organization / code-organization                     | exercise-code-organization           | Package/file/class relationships, lifecycle ownership, named reusable pure helper and actual call site                           |

Every lesson version is `1.0.0`. English and Simplified Chinese each contain the same four complete example code fences and **35 ordered protected code literals/fences**. Code/API/package/file identifiers and all source link destinations are identical. The hardware placeholder is explicitly `REPLACE_WITH_DS_MOTOR_NAME`; the student must replace it with the actual Driver Station configuration name and type. No team hardware names, motor measurements, encoder conversion constants, results, deployment success or achievements were invented. Examples observe software/input/encoder values and do not call motor setPower. Hardware mapping itself requires real configured hardware and may initialize the device; the lesson states that clearly.

Each exercise requires both an explanation and application in the student's existing project. Criteria require actual files/call sites, predicted versus observed results, configuration evidence where needed, and an explicit unrun status when a supervised observation has not happened. Compilation is separate evidence and cannot satisfy robot-observation criteria.

The coordinator approved the smallest optional serializable payload before dependent implementation: `ContentDocument.lessons?`, each lesson `{ id, version, topic, title, body, exercises }`; exercise `{ id, prompt, requiresExplanation: true, requiresProjectApplication: true, explanationCriteria, projectApplicationCriteria }`. Nonempty trimmed text/arrays and true literal flags are decoded by the canonical Schema. Core checks concrete lesson versions, unique lesson/exercise IDs within a document, exact paired lesson IDs/versions/topics/order and exercise IDs/order. Existing documents without lessons retain previous behavior. Markdown spans/fences are protected across document body, lesson title/body, and exercise prompt/both criteria. Queries already return the decoded document; no query implementation or search engine was added. The supplied search port demonstrates access to nested lesson text.

## RED, repair and GREEN

The required test was written before the content/contract change. The real validator accepted the existing empty production pack; the real lookup returned missing; the required-topic assertion failed with all four topics absent: **0 pass / 1 fail / 2 assertions**, reported failure (`/private/tmp/m11-04/red.log`). This was missing behavior, not a broken import or fixture.

Initial authored content made the required test pass: **1 pass / 0 fail / 53 assertions**. Expanded cases exercise 18 actual-byte mutations with freshly recomputed digests: empty lessons, duplicate lesson IDs, nonconcrete version, reordered lessons, changed lesson ID/version/topic, false required flags, blank criteria, changed/duplicate exercise IDs, and code drift in lesson body/title and each exercise text field. A first mutation test appended text on a fence closing line and correctly produced malformed_content; the fixture was corrected to append after a newline so it tests identifier_mismatch. Production validation was not weakened.

Core typecheck initially found only fixture typing issues (Uint8Array passed to the existing Buffer/string hash helper and an assertion literal-union type); those were fixed with Buffer and a readable widened assertion. Source review also found that a translation script had replaced an English word inside the Chinese sources.jar URL. It was fixed to translate Markdown labels only, both documents/manifest regenerated, and a final explicit source-destination pairing regression added. Final authored pack digests were verified after regeneration.

The first covering M11 run was **87 pass / 1 fail / 387 assertions**: the M11-01 test `empty production manifest makes no course or support claim` hardcoded the evolving shipped manifest to records:[], which conflicts with this task's assigned real content registry. The coordinator explicitly assigned only that test case for migration. It now creates an explicit empty production fixture and retains both original empty-manifest assertions; all other M11-01 tests are untouched. M11-04 separately tests the real authored pack through validatePack and the injected query service. This is prerequisite fixture migration, not a validation exemption.

Final focused suite: **4 pass / 0 fail / 108 assertions**, exit 0. Final covering validator/query/content suite: **89 pass / 0 fail / 398 assertions**, exit 0. Schema contracts: **6 pass / 0 fail / 12 assertions**, exit 0. Core and Schema typechecks, scoped lint/format and diff whitespace all pass.

## Reproducible commands and assertion map

All Bun commands used Bun **1.3.14 (0d9b296a)** with `PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH`. Tests used task-owned isolation:

```sh
OPENCODE_TEST_HOME=/private/tmp/m11-04/home
XDG_DATA_HOME=/private/tmp/m11-04/data
XDG_CONFIG_HOME=/private/tmp/m11-04/config
XDG_CACHE_HOME=/private/tmp/m11-04/cache
```

| Cwd             | Command (after environment prefix)                                                                                                                                                                       | Result / retained temporary log                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| packages/core   | bun test ./test/ftc/ftc-knowledge/m11-04.test.ts                                                                                                                                                         | RED 0/1/2, then final GREEN 4/0/108; red.log, green-focused-final.log |
| packages/core   | bun test ./test/ftc/ftc-knowledge                                                                                                                                                                        | Final 89/0/398; green-covering-final.log                              |
| packages/core   | bun typecheck                                                                                                                                                                                            | Exit 0; core-typecheck-final.log                                      |
| packages/schema | bun typecheck                                                                                                                                                                                            | Exit 0; schema-typecheck.log                                          |
| packages/schema | bun test ./test/contract-hygiene.test.ts ./test/compatibility.test.ts                                                                                                                                    | 6/0/12; schema-tests.log                                              |
| repository      | bunx --no-install oxlint packages/schema/src/ftc-knowledge.ts packages/core/src/ftc/knowledge.ts packages/core/test/ftc/ftc-knowledge/m11-04.test.ts packages/core/test/ftc/ftc-knowledge/m11-01.test.ts | 0 warnings/errors; lint-final.log                                     |
| repository      | bunx --no-install prettier --write [the seven paths in the hash table below]                                                                                                                             | Scoped formatting; JSON bytes unchanged                               |
| repository      | bunx --no-install prettier --check [the seven paths in the hash table below]                                                                                                                             | Exit 0; format-final.log                                              |
| repository      | git diff --check -- [the seven paths in the hash table below]                                                                                                                                            | Exit 0                                                                |

Logs above live under `/private/tmp/m11-04`; this report records their outcomes durably. The initial RED/covering display wrappers ended with cat, so their shell status was 0; their test output contains the failures above. Final redirected checks returned actual command exit 0. Tests/typechecks never ran from repository root. No Java/Android toolchain or robot execution occurred. A Python source/content audit independently checked both actual SHA-256 digests, IDs/versions/topics/order, exercises and paired code tokens. It printed a stale human label “38” in one audit output; the actual computed token count is **35**, confirmed from both final manifest records. No assertion used that stale label.

| m11-04.test.ts line | Enforced behavior                                                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 20                  | Actual pack validation and real query retrieval in each language; all four topics, substantial lesson text, exercises and both substantive criteria required                       |
| 77                  | 18 rehashed mutation rows; schema, duplicate, version, pairing and protected literal boundaries reject actual bytes                                                                |
| 164                 | Exact SDK/language/local selection, source/license metadata and complete nested content retained; nested Chinese search access; unavailable local content stays missing            |
| 200                 | All bilingual reference destinations identical; exact RobotCore source JAR URL, hardware placeholder/current-position API, absence of motor command, preserved Driver Station name |
| m11-01.test.ts 450  | Explicit empty production fixture remains valid; authored manifest no longer mistaken for an empty fixture                                                                         |

## Primary source verification and applicability

At implementation time, immutable FTC controller sources were fetched at **203c2d373765f0c66d121e3ec1cc3a18835f6534** (v11.1 pin from reviewed preflight). The exact retained RobotCore **11.1.0** source JAR was independently rehashed to **e8a594c7b9ded2bc73cf2f5abeca03b436fb4e7109e73938df64fa21f0d01ea2**, extracted and inspected. This is actual API review, not reliance on a preflight summary. Pinned build.common.gradle specifies JavaVersion.VERSION_1_8 for both sourceCompatibility and targetCompatibility. The Android build JDK/editor runtime remain different settings; no installed language/toolchain support was selected here.

Java language explanations were checked against the Java SE 8 Language Specification: chapter 4 types/variables, chapter 7 packages/top-level compilation units, chapter 8 methods/classes, chapter 14 blocks/if/while, chapter 15 operators/assignment. These are edition-specific primary documents; retrieved snapshot hashes below fix the actual reviewed bytes even though Oracle URLs have no Git revision.

FTC API/sample anchors checked: BasicOpMode_Linear (wait/active-loop pattern), BasicOpMode_Iterative (callback order), RobotHardware (separate class/layout; its sample constants/names are not adopted), LinearOpMode (wait return on interruption, started/stop/idle checks), OpMode (init/init_loop/start/loop/stop scheduling), HardwareMap (typed named get, initialization note and failure), Gamepad (left_stick_y and a fields), DcMotor (getCurrentPosition reports encoder-specific counts) and Telemetry (explicit linear update, iterative automatic update, transmission throttling/default clear). The examples are newly authored minimal observations/calculations, reviewed against those APIs; they are not claimed as compiled or robot-tested.

Fresh source retrieval initially failed sandbox DNS; authorized read-only escalated retrieval succeeded for FTC/Oracle/localization sources. No content import, layer construction or query fetches sources. Snapshots and machine-readable fetch metadata are retained temporarily at `/private/tmp/m11-04/sources`.

## Chinese terminology provenance and limits

Two independent maintained primary localization corpora were pinned/fetched and inspected in context:

- Microsoft **vscode-loc**, commit **0f157dee0cdcbf58cdf51a221ee94751c7f35e75**, committed 2026-09-04; Simplified Chinese language pack main.i18n.json: developer class/method/variable terminology (`Class`, `Method`, `Variable`, suggest kinds) and expression/configuration usage.
- Mozilla **firefox-l10n**, commit **9c44ae5ddf2cd6870a1cec1929fbf6d7f431b98b**, committed 2026-10-06; zh-CN devtools/client/debugger.properties: variables, watch expressions, functions and scope in actual debugger phrases (`expressions.placeholder2`, `watchExpressions.header`, `symbolSearch.search.variablesPlaceholder`, `copyFunction.label`, source/scopes phrases).

Recurring concepts use 变量, 表达式, 类, 方法, 参数, 返回值, 作用域, 配置, 源代码 in their developer context; a method is described as 方法 while generic functions in corpora use 函数. Whole teaching sentences were translated, not assembled from glossary hits. Every retained English term was audited: FTC/Java/SDK/JDK/MIT are names/acronyms, OpMode/TeamCode are SDK/project identifiers, Driver Station is the device/app name, INIT/START/STOP are controls, and code/package/file/API tokens and URLs remain exact. No App dictionary was edited.

FTC-specific Chinese phrases 生命周期, 迭代式回调, 硬件映射, 遥测数据, 编码器计数, 执行器 and 手柄 require native/domain review; the two developer corpora do not establish official FTC translations. An official-language-authority attempt at https://www.cnterm.cn/ failed certificate verification (self-signed certificate reported); two web-search attempts failed tool connection. No unverifiable dictionary result or official FTC glossary approval is claimed. That missing authority check and native translation acceptance remain explicit review gates, not endless retries or fabricated corpus evidence.

## License/reference notices

Original lesson explanations, examples and translations follow this repository's MIT LICENSE, copyright (c) 2025 opencode. The manifest explicitly distinguishes original content from upstream reference notices. No upstream documentation prose or complete sample program is reproduced in the shipped lesson files; Java language tokens/imports/API names are preserved as teaching code. Reference snapshots retain their original source notices; this report does not infer legal redistribution permissions, endorse the material or certify platform/robot compatibility.

| Reference                      | Observed notice, retained source and limitation                                                                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FTC controller LICENSE         | Copyright (c) 2014–2022 FIRST; BSD-style conditions/disclaimer including no implied patent license. Exact license hash/source URL below.                                               |
| BasicOpMode_Linear / Iterative | Copyright (c) 2017 FIRST; file header BSD-style notice.                                                                                                                                |
| RobotHardware                  | Copyright (c) 2022 FIRST; file header BSD-style notice.                                                                                                                                |
| OpMode / HardwareMap / Gamepad | Qualcomm Technologies Inc copyright notices (2014; 2014/2015); file header BSD-style terms/disclaimer, no implied patent rights.                                                       |
| DcMotor / Telemetry            | Copyright (c) 2016 Robert Atkinson; file header redistribution conditions and disclaimer remain in retained extracted members.                                                         |
| LinearOpMode                   | Selected source member has no initial license header; archive/POM/repository notices must be considered, not silently replaced with a fabricated file notice.                          |
| Oracle JLS SE 8                | Official Java SE 8 specification; legal-notice link in each selected chapter points to jls-0-front.html. No separate documentation redistribution permission assessed; no text copied. |
| Mozilla locale                 | File header MPL 2.0 notice, and pinned repository LICENSE retained. Terminology consultation only; source translations not redistributed.                                              |
| Microsoft locale               | Primary localized corpus consulted, not copied. Pinned root LICENSE and LICENSE.txt retrieval returned 404; no documentation/license permission inferred.                              |

## Exact final changed-file hashes

These hashes identify the frozen candidate's tested content and implementation, before coordinator review/commit:

| Path                                                      | SHA-256                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| `packages/schema/src/ftc-knowledge.ts`                    | `0ea40a96a1adcddf68c657d39af0bec6732ce5ca242437cb6c7bbdd68f5de8be` |
| `packages/core/src/ftc/knowledge.ts`                      | `756860e6432659fe4a0e728f2df72d64051de54814989a1fc2c31640bff8cf48` |
| `packages/core/test/ftc/ftc-knowledge/m11-04.test.ts`     | `ed147ffe3a0280969c94594f58cac9060ff09b27fc613bc40c67ab940e39b071` |
| `packages/core/test/ftc/ftc-knowledge/m11-01.test.ts`     | `000e9098f661a34ac5504b9d41d3529d1421be29189ddecd70f34f125a6da9ff` |
| `packages/core/resources/ftc/content/en/foundations.json` | `a1079eadf87ff171bbfdc9af8e10188f8f0e4731c747f18ca06d4723da22bf19` |
| `packages/core/resources/ftc/content/zh/foundations.json` | `9b2921178e539073af258d73388549199677df959e193b2e5c796ece785f9a19` |
| `packages/core/resources/ftc/content/manifest.json`       | `bac616f42bae873d5b3167a91cfd76d6c47920d0e32c48d05c24e081c7be4be8` |

## Exact reviewed source snapshot metadata

For freshly fetched sources, UTC retrieval dates were 2026-10-06 (2026-10-07 local). Requested URLs resolved unchanged where listed. Hashes identify reviewed bytes; failed lookups have no hash and are listed explicitly below. Extracted member sources are pinned by the above source-JAR hash and their own hashes.

| Source                       | Requested URL or retained member path                                                                                                                                                                                                          | Bytes   | SHA-256                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------ |
| BasicOpMode_Linear.java      | https://raw.githubusercontent.com/FIRST-Tech-Challenge/FtcRobotController/203c2d373765f0c66d121e3ec1cc3a18835f6534/FtcRobotController/src/main/java/org/firstinspires/ftc/robotcontroller/external/samples/BasicOpMode_Linear.java             | 5707    | `cf1f6fadbc4333e670378337ca98246dd81a0ae4450b053ff029c24a63e5a9d2` |
| BasicOpMode_Iterative.java   | https://raw.githubusercontent.com/FIRST-Tech-Challenge/FtcRobotController/203c2d373765f0c66d121e3ec1cc3a18835f6534/FtcRobotController/src/main/java/org/firstinspires/ftc/robotcontroller/external/samples/BasicOpMode_Iterative.java          | 6069    | `c7318e6f209343cf3c222ce51b5f2e29c9b30e785792452db2320251e25e9cf7` |
| RobotHardware.java           | https://raw.githubusercontent.com/FIRST-Tech-Challenge/FtcRobotController/203c2d373765f0c66d121e3ec1cc3a18835f6534/FtcRobotController/src/main/java/org/firstinspires/ftc/robotcontroller/external/samples/externalhardware/RobotHardware.java | 7669    | `587ba00ba3d91444c5539772565f8c18a149ef0e368e08df0955d11a48d47313` |
| build.common.gradle          | https://raw.githubusercontent.com/FIRST-Tech-Challenge/FtcRobotController/203c2d373765f0c66d121e3ec1cc3a18835f6534/build.common.gradle                                                                                                         | 4004    | `44a3973a955c2267e0cebeadb531d794960f1315893d99f366cdb247c799f565` |
| FTC-LICENSE                  | https://raw.githubusercontent.com/FIRST-Tech-Challenge/FtcRobotController/203c2d373765f0c66d121e3ec1cc3a18835f6534/LICENSE                                                                                                                     | 1600    | `43fdbddb26a1b89f49c94a52181d7c1f99f5d389cffd00371d5618f8f84cfc6d` |
| jls-4.html                   | https://docs.oracle.com/javase/specs/jls/se8/html/jls-4.html                                                                                                                                                                                   | 351514  | `f99deeffe02e7c2920072a7302529fd290d3f0401a50848e67404b221e80aba1` |
| jls-7.html                   | https://docs.oracle.com/javase/specs/jls/se8/html/jls-7.html                                                                                                                                                                                   | 85243   | `7f074945527cc0e1d9c9050f6b0afe1ee74b2d34b5e100d3ef7ec5215d2e6caf` |
| jls-8.html                   | https://docs.oracle.com/javase/specs/jls/se8/html/jls-8.html                                                                                                                                                                                   | 464670  | `c6e0e2d7f323bc4c0619397ae0ed17f39fb3adc557eaba59dd1607a5545d2b5f` |
| jls-14.html                  | https://docs.oracle.com/javase/specs/jls/se8/html/jls-14.html                                                                                                                                                                                  | 334366  | `c0cdc5d86be6e3ad209ce985218bc014d845850c53009960094b3e857f15d8c9` |
| jls-15.html                  | https://docs.oracle.com/javase/specs/jls/se8/html/jls-15.html                                                                                                                                                                                  | 923982  | `ec0eff2205f42c5b0cfac7c9c773d9952668fc2802b7793d3ef1059f49c5fc72` |
| vscode-ref.json              | https://api.github.com/repos/microsoft/vscode-loc/commits/main                                                                                                                                                                                 | 357260  | `0a6c13fdc16024d81b94391b27a6e2773cfe632b6c40098e09286d62fdcd4c93` |
| firefox-ref.json             | https://api.github.com/repos/mozilla-l10n/firefox-l10n/commits/main                                                                                                                                                                            | 120519  | `196a72d33bc914c6524782759f2a0bc806ceff5035c5d05e55ee18087f04356c` |
| vscode-zh.txt                | https://raw.githubusercontent.com/microsoft/vscode-loc/0f157dee0cdcbf58cdf51a221ee94751c7f35e75/i18n/vscode-language-pack-zh-hans/translations/main.i18n.json                                                                                  | 2046035 | `fddc7f462766e4dc2ca13e06ff8c7200a9ee1d224f0584750a9d877a89b0c303` |
| firefox-zh.txt               | https://raw.githubusercontent.com/mozilla-l10n/firefox-l10n/9c44ae5ddf2cd6870a1cec1929fbf6d7f431b98b/zh-CN/devtools/client/debugger.properties                                                                                                 | 55445   | `9f91c3df07706d59a1daa9c169281c33997acbdf3fcbcfcd309eb9de861b940b` |
| firefox-license              | https://raw.githubusercontent.com/mozilla-l10n/firefox-l10n/9c44ae5ddf2cd6870a1cec1929fbf6d7f431b98b/LICENSE                                                                                                                                   | 16725   | `1f256ecad192880510e84ad60474eab7589218784b9a50bc7ceee34c2b91f1d5` |
| RobotCore-11.1.0-sources.jar | https://repo.maven.apache.org/maven2/org/firstinspires/ftc/RobotCore/11.1.0/RobotCore-11.1.0-sources.jar                                                                                                                                       | 1434014 | `e8a594c7b9ded2bc73cf2f5abeca03b436fb4e7109e73938df64fa21f0d01ea2` |
| LinearOpMode.java            | /private/tmp/m11-04/sources/LinearOpMode.java                                                                                                                                                                                                  | 9698    | `e153a778a5e3dd664e87995a0314ed7777f678bd25af4f349e6bd18495250063` |
| OpMode.java                  | /private/tmp/m11-04/sources/OpMode.java                                                                                                                                                                                                        | 9444    | `16eda3e2587d5af78ef2cbf8a477ef6e669871ddb6a017492012120f29c38ee3` |
| HardwareMap.java             | /private/tmp/m11-04/sources/HardwareMap.java                                                                                                                                                                                                   | 37693   | `042359626a2cae7ec858ab6594dd53347da48216bf54c182c158e595c21a818a` |
| Gamepad.java                 | /private/tmp/m11-04/sources/Gamepad.java                                                                                                                                                                                                       | 44686   | `37bb24d18c34020eb23346aa2cc8ed7dc0299ad03e32c491e80ee2f675294578` |
| DcMotor.java                 | /private/tmp/m11-04/sources/DcMotor.java                                                                                                                                                                                                       | 11876   | `73635efe788badabfe5207335b6ac024b21143fcccb3971245a37f7cdf19a367` |
| Telemetry.java               | /private/tmp/m11-04/sources/Telemetry.java                                                                                                                                                                                                     | 28173   | `e5f18638077821f138ae38b0ae8ec534215e342bff7949878d2081513d8d156d` |

Failed lookup metadata:

- https://raw.githubusercontent.com/microsoft/vscode-loc/0f157dee0cdcbf58cdf51a221ee94751c7f35e75/LICENSE: HTTP Error 404: Not Found.
- https://www.cnterm.cn/: <urlopen error [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: self-signed certificate (\_ssl.c:1032)>.
- https://raw.githubusercontent.com/microsoft/vscode-loc/0f157dee0cdcbf58cdf51a221ee94751c7f35e75/LICENSE.txt: HTTP Error 404: Not Found.

## Remaining real acceptance gates

Not run: compilation of the authored examples in a student's actual FTC project; actual SDK/toolchain/editor support on macOS and Windows; deployed build association; supervised configured-hardware INIT/START/STOP and input/encoder/telemetry observations; physical direction or performance measurements; native Chinese/official-term review; course comprehension, exercise submissions and explanation/application assessment. No learning-progress persistence or course track completion exists in this task. Offline query fixtures are local and have no network port; this does not establish the later prepared-offline content pack or whole-platform inference support.

This candidate is frozen for independent review. The coordinator owns review repairs, staging, commit and completion ledger updates, then stops at the user's requested boundary without starting another task.
