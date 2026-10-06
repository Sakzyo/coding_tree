# M7 read-only runtime and interface preflight

2026-10-06. Investigator `/root/m7_runtime_preflight`; no files/index/HEAD changed, no service start/stop or endpoint calls, no secrets/model contents read, no downloads or tests. This prepares M7 tasks; it does not complete M7-08 or establish a supported configuration.

## Existing interfaces

- Core provider/model facades reuse canonical Schema records (`packages/core/src/provider.ts:6`, `model.ts:15`). Provider configuration already supports URL, headers/body and model context/output limits.
- `SessionRunnerModel.fromCatalogModel` (`packages/core/src/session/runner/model.ts:131`) lowers catalog models into executable routes. Lines 156–160 select `OpenAICompatibleChat.route` for the explicit-URL OpenAI-compatible provider. `packages/llm/src/protocols/openai-compatible-chat.ts:17` reuses Chat protocol/SSE framing.
- `LLMClient.Interface` (`packages/llm/src/route/client.ts:141`) consumes canonical requests/events/errors and Effect streams. `packages/core/src/session/runner/llm.ts:241` preserves one `llm.stream(request)` per provider turn; runner retains tool execution/continuation ownership.
- Existing `Credential.Service` has all/list/get/create/update/remove and secret-bearing `Info.value` (`packages/core/src/credential.ts:23`); SQLite adapter stores JSON (`credential/sql.ts:5`). `Integration.connection.resolve` handles stored/environment credentials and OAuth refresh (`integration.ts:385`). This is not OS-protected storage.
- Desktop protected credential adapter is absent. M7-02 owns safeStorage access, narrow authenticated backend operations, encryption failure and explicitly selected migration. Plaintext may also come from model configuration `apiKey` (`session/runner/model.ts:83`); reconcile this boundary without bulk rewriting unrelated credentials.

## Observed assets, bounded inventory

No inference runtime or model was observed in the checked conventional locations:

| Runtime | Checks | Result |
| --- | --- | --- |
| llama.cpp | `llama-server`/`llama-cli` on tool PATH; `/opt/homebrew/bin`, `/usr/local/bin`; corresponding Homebrew Cellar directories | Absent |
| Ollama | CLI PATH/standard bins; system/user Applications bundles; `~/.ollama/models` | Absent |
| LM Studio | `lms` PATH and `~/.lmstudio/bin/lms`; system/user app bundles; `~/.lmstudio/models`, legacy `~/.cache/lm-studio/models` | Absent |

Primary explicit `stat` calls returned ENOENT. Custom installations/directories are not excluded. Default stores cross-checked against [Ollama FAQ](https://docs.ollama.com/faq#where-are-models-stored) and [LM Studio import documentation](https://lmstudio.ai/docs/app/advanced/import-model). No model manifests were read because checked stores were absent.

Worker observed macOS 26.5.2 (25F84); its sandboxed sysctl hardware read was denied. Coordinator's existing [baseline](baseline.md) independently records Apple M4 and 32 GiB, plus pinned Bun at `/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun`. Bun's absence from worker default PATH is not a missing dependency; future briefs must carry the pinned path. Installed repository dependencies and tsgo were observed.

## Available isolated-test resources and remaining gates

Reuse `packages/core/test/lib/effect.ts:44` TestClock/scoped helpers, `packages/llm/test/lib/http.ts:35` scripted/fixed/truncated provider transports, credential/integration tests and runner fixtures. They permit policy/stream/cancellation checks without keys/models. They cannot establish actual inference capability.

M7 Schema/facade/catalog, protected desktop credential adapter and M7-08 harness/report/matrix are not yet implemented. M7 is 0/8 complete. Key downstream constraints:

- Distinguish owned managed llama.cpp processes from external Ollama/LM Studio services; never dispose user-owned services.
- Installation and loopback addresses do not verify local-only behavior. [Ollama cloud configuration](https://docs.ollama.com/faq#how-do-i-disable-ollama-cloud-features) requires effective-service and model-identity validation; do not infer it from fixtures.
- M7-08 requires M7-06, M7-07 and composed M3 binding, then exact binary/model digest/license/quantization/template, both OS runtime/resource/context results, download/lifecycle evidence, structured bilingual tasks with internet unavailable, external-service local-only proof and safeStorage behavior on both OSes. These real checks are NOT RUN.

No model download/license acceptance is implied by this preflight. Missing physical/OS/model resources do not prevent independently testable M7 implementation work.
