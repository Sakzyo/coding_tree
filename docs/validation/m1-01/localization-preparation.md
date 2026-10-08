# M1-01 localization preparation

Date: 2026-10-08. Proposed phrases only; dictionaries are unchanged. No bilingual release or native-speaker acceptance is claimed.

## Existing typed contract and reuse

Use `Pick<ReturnType<typeof useLanguage>, "t">` through a type-only import as the narrow supplied language port. It preserves the actual host key/parameter contract without runtime-importing context persistence or inspecting the locale. English remains the semantic source. Translation switching must be reactive in the host/supplied port, independent of drafts and selection.

Reuse unchanged English keys where semantically correct:

| Purpose                              | Existing key                      | English / Chinese                            |
| ------------------------------------ | --------------------------------- | -------------------------------------------- |
| Open prepared folder association     | `command.project.open`            | Open project / 打开项目                      |
| Associate a prepared new folder      | `session.new.project.new`         | New project / 新建项目                       |
| Create member chat                   | `command.session.new`             | New session / 新建会话                       |
| Explicit submission                  | `prompt.action.send`              | Send / 发送                                  |
| Stop exact displayed owner           | `prompt.action.stop`              | Stop / 停止                                  |
| Selection navigation                 | `sidebar.nav.projectsAndSessions` | Projects and sessions / 项目和会话           |
| Query pending                        | `common.loading`                  | Loading / 加载中                             |
| Generic failed request               | `common.requestFailed`            | Request failed / 请求失败                    |
| Host composer placeholder, if needed | `prompt.placeholder.simple`       | Ask anything... / Existing Chinese unchanged |

No single adjective such as `prompt.context.active` should be combined with a chat ID to manufacture a sentence. Do not reuse `app.server.retrying` because the component never retries automatically. Canonical paths and chat IDs are supplied data, not translated copy.

## Minimum proposed new keys

This is a candidate surface, to be reduced to keys actually required by implementation. Labels are complete contextual phrases; no plural phrases or locale-grammar branching is needed.

| Proposed key                     | English semantic source                                                                                     | Simplified Chinese candidate                                   | Context/source rationale                                                                                                                                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ftc.workspace.activeChat`       | Active session: {{chatID}}                                                                                  | 正在运行的会话：{{chatID}}                                     | Existing app 会话; VS Code session/debug corpus uses 会话 and 正在运行. Runtime ownership, not focused-tab activity.                                                                                              |
| `ftc.workspace.busyDraft`        | Wait for the active session to finish or stop it before sending. Your draft will not be sent automatically. | 请等待正在运行的会话结束或将其停止后再发送。草稿不会自动发送。 | Apple unsent-draft workflow establishes 草稿; Microsoft/Firefox execution/action corpora establish 等待/停止/发送 terminology. Two complete sentences preserve both wait and no automatic submission constraints. |
| `ftc.workspace.queryFailed`      | Could not load project status or sessions. Retry to check again.                                            | 无法加载项目状态或会话。请重试。                               | Firefox failure recovery uses 无法… / 请重试; VS Code uses 状态 and 会话. Failure stays distinct from idle.                                                                                                       |
| `ftc.workspace.retry`            | Retry                                                                                                       | 重试                                                           | Exact command/accessibility role agrees across VS Code and Firefox.                                                                                                                                               |
| `ftc.workspace.reopen`           | Reopen project                                                                                              | 重新打开项目                                                   | VS Code reopen-window command plus unchanged app 项目 term. Explicit recovery, not auto-opening.                                                                                                                  |
| `ftc.workspace.membershipFailed` | The project or session changed. Reopen the project; your draft is still here.                               | 项目或会话已更改。请重新打开项目；草稿仍保留在此处。           | Structured membership mismatch recovery; retain draft only in current component scope, no persistence claim.                                                                                                      |
| `ftc.workspace.sendFailed`       | Could not send. Your draft is still here.                                                                   | 无法发送。草稿仍保留在此处。                                   | Failure retains local unsent input; avoid “saved” because no durable draft store exists.                                                                                                                          |

Generic create/open/new-session/stop failures can reuse `common.requestFailed` and an appropriate explicit recovery key. Do not display arbitrary backend detail strings. If an empty selection needs a new accessible complete phrase, add only that phrase after inspecting existing suitable keys and record its sources.

## Primary sources inspected on 2026-10-08

1. [Unicode CLDR 48 language plural rules](https://www.unicode.org/cldr/charts/48/supplemental/language_plural_rules.html), Chinese row: cardinal and ordinal use `other`. The proposed messages have no counts; feature code must still use shared language APIs rather than inspecting locale rules.
2. [Microsoft Localization Style Guides index](https://learn.microsoft.com/zh-cn/globalization/reference/microsoft-style-guides) identifies the Simplified Chinese guide. Its [official guide link](https://aka.ms/chinese-simplified-styleguide) failed with unsupported `application/octet-stream` in the browsing tool; [the indexed official PDF](https://download.microsoft.com/download/1/5/9/159cb91c-b61b-4385-97ca-80ccc7ff1fa0/zho-chn-StyleGuide.pdf) could not be parsed. A temporary `curl` retrieval also failed DNS resolution. The full PDF grammar guidance has **not** been verified; index inspection is not full-guide application.
3. [Microsoft VS Code Simplified Chinese corpus](https://raw.githubusercontent.com/microsoft/vscode-loc/main/i18n/vscode-language-pack-zh-hans/translations/main.i18n.json): `vs/workbench/contrib/debug/browser/callStackView` supplies `session` → 会话 and `running` → 正在运行; `vs/workbench/browser/browser` supplies a retry action; `vs/platform/windows/electron-main/windowImpl` supplies a reopen action. These are developer command/status roles, not dictionary literal translations. Corpus also contains English leftovers; only inspected Chinese entries are evidence.
4. [Mozilla zh-CN localization guide](https://mozilla-l10n.github.io/styleguides/zh-CN/index.html) and its [SUMO guidance](https://mozilla-l10n.github.io/styleguides/zh-CN/sumo.html) require clear, accurate translation and retaining known domain names. This guides complete contextual phrases rather than token-by-token assembly.
5. [Mozilla Firefox zh-CN downloads corpus](https://raw.githubusercontent.com/mozilla-l10n/firefox-l10n/main/zh-CN/browser/browser/downloads.ftl): `downloads-cmd-retry` and `downloads-cmd-retry-panel` both use 重试 in tooltip/accessibility roles; `downloads-error-generic` uses failure followed by explicit retry. Microsoft and Mozilla are independent maintained developer/UI corpora.
6. [Mozilla Pontoon Firefox zh-CN](https://pontoon.mozilla.org/zh-CN/firefox/) confirms the maintained locale/project and links its source repository; the actual phrase evidence above comes from the Firefox corpus, not the locale dashboard.
7. [Apple localization guidance](https://developer.apple.com/localization/), “Translate in-app content” and “Test your localization,” supports providing context for translations and checking clipping/layout/native feedback. The [writing HIG page](https://developer.apple.com/design/human-interface-guidelines/writing) was JavaScript-only in the browsing tool; its detailed text was not extracted.
8. [Apple China Feedback Assistant draft workflow](https://support.apple.com/zh-cn/guide/feedback-assistant/fbae731feac1/mac) uses 草稿 for content editable before submission and distinguishes submitting from retaining unfinished content. This is the appropriate unsent-input role. [Apple iPhone Mail draft workflow](https://support.apple.com/zh-hans/guide/iphone/iph37c056e7/ios) independently confirms the same platform usage.
9. [Taiwan Ministry of Education concise dictionary 草稿](https://dict.concised.moe.edu.tw/dictView.jsp?ID=38075&la=0&powerMode=0) defines unfinished text. This is authoritative lexical corroboration only; its regional traditional-character style does not select mainland UI wording. Apple China and zh-CN developer corpora determine the Simplified Chinese form.

## Remaining review and scope constraint

The phrases are contextual adaptations grounded in official sources, not exact phrase matches copied from another product. Native-speaker editorial review, full Microsoft PDF grammar review, and rendered bilingual clipping/host audits remain unrun. Simplified Chinese for mainland users is intended; avoid transferring Taiwan-specific platform vocabulary from the lexical source.

`packages/app/src/i18n/parity.test.ts` currently requires every English key in all locales, with an exact exception for six earlier FTC setup keys in non-zh locales. New en/zh-only keys would fail that existing suite. Ask the coordinator to assign only a matching exact-key exception for the final M1 keys and an en/zh nonempty/placeholder-parity test. Do not exempt the `ftc.workspace.*` prefix or future keys, weaken pre-existing coverage, or add unassigned all-locale translations.
