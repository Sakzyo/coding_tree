# M3-04 dispatch brief — explicit continuation 2026-10-08

Role: implement M3-04 in M3; starting source `11b3fe90e` on existing feature branch `ftc-workspace`.
Read first: root AGENTS.md and supplied user guidelines, docs/prompt.md, docs/tasks/agent-and-context.md, docs/validation/M3-04-preflight.md, requirement AI-05/06 and high-level design M3/System Context/state ownership.

Prerequisites: M3-01 is independently reviewed and checked. Canonical M5 Java, M6 configuration/inspection and M11 knowledge value contracts exist. Consume supplied ports/records, never start siblings. M10 actual observations remain unavailable.

Allowed product write paths:
- packages/core/src/ftc/agent/context.ts
- packages/core/src/ftc/context-sanitizer.ts (approved reused pure infrastructure; explicit field roles, no sibling/host dependencies)
- packages/core/src/ftc/configuration/context.ts
- packages/core/src/ftc/knowledge/context.ts
- packages/core/src/ftc/diagnostics/context.ts
- packages/core/test/ftc/agent-and-context/m3-04.test.ts
- packages/schema/src/ftc-diagnostics.ts (unavailable-only)
- packages/schema/src/ftc-configuration.ts or ftc-knowledge.ts only for necessary public ContextSnapshot wrappers reusing nested canonical values. Report before expanding if unnecessary.
Evidence: docs/validation/M3-04-implementation.md and docs/validation/m3-04/* only.
No edits to root exports, manifests, lockfiles, composition, Session/runner/SystemContext registry/algebra, sibling runtime or shared ledger/checklists. Root serializes any needed Schema barrel and all Git/index/commits; return a tested candidate and SHA256 file manifest. Do not delegate or spawn a reviewer.

## Reconciled implementation decisions

- M10 may add a serializable ContextUnavailable record only: kind unavailable, reason observation_adapter_unavailable, freshness unknown, logs and deployedBuild unknown. No fabricated controller identity/generation/project measurement or positive telemetry schema. This satisfies honest unavailable context, never M10 decoding or physical acceptance.
- Treat a context sanitization port as a required trusted caller capability at the model-context projection boundary. It must sanitize/reject external text before source codecs, persisted snapshots, or rendering receive it. Explicitly project allowed canonical fields; do not pass credential Values or secret-store capabilities. Preserve safe language/identifiers and source revision provenance. If a sensitive identifier cannot be preserved, reject/omit with an explicit limit instead of silently rewriting it. A missing/failing sanitizer fails closed. It is injected for this isolated task; production ownership/binding belongs to M3-06, where the host must supply trusted sanitization. No fixture sanitizer may be claimed as general secret discovery.
- Bind one source set to its supplied authorized canonical project/root and Location; reject cross-project/placement records before registration. M3 does not confer filesystem authorization by recanonicalizing supplied records. Preserve explicit workspace identity.
- Use real scoped SystemContextRegistry entries and existing SessionContextEpoch initialize/prepare, with no new registry/epoch store or runner changes. Selected language/inference/query stays captured in independently scoped source sets; no last-writer-wins mutable Location selection. Real simultaneous Session selection remains M3-06 host wiring, not acceptance credited here.
- Sources refresh lazily through supplied observations. Explicit missing wheel-diameter remains unknown; offline missing references and online provider disclosure are preserved. Missing manifest is not installed hardware. Keep document buffer/disk/dirty revisions and non-atomic inspection states. External repo/log/reference text is labelled observed data and has no approval authority.
- Reuse existing M11 context producer, narrowing service to lookup where needed. Preserve existing lookup failure/unavailable behavior for legacy callers; new bound/safe path must not let raw secrets reach snapshots. Report compatibility choices in evidence.

## Verification and evidence

Read Superpowers test-driven-development before editing. Establish meaningful behavioral RED, then minimal GREEN. Use actual source constructors, codecs, registry and Session-owned epoch persistence with temporary SQLite and canonical fixtures; do not duplicate production decisions in tests. Cover refresh/reconciliation, baseline/update/snapshot redaction, hostile instructions as data, wrong binding, unknown/missing states, dirty/revisions, independent registry scopes, registration cleanup and actual ContextUpdated persistence without provider/server execution.
Run focused new test and affected SystemContext/registry/M11-context/M3-01/M3-02 tests from packages/core; bun typecheck in Core and changed Schema; scoped lint/format/diff checks. Existing unrelated package-wide baseline failures do not require exhaustive reruns. No Session/timeline path change, so retain existing performance evidence. No production host/provider/robot/model/download authorization.
Pinned Bun 1.3.14 is being restored by root into /private/tmp/ftc-bun-1.3.14; await root path confirmation before testing. Dependencies are already installed. Use isolated OPENCODE_TEST_HOME and XDG directories under /private/tmp/m3-04-home, never repurpose HOME/CODEX_HOME. Record tested source hashes, commands/cwd/counts/results, fixture classification, assumptions and unavailable integration/platform gates. Status DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT or BLOCKED; no completion credit before independent review.

## Exact task excerpt

### M3-04 — Assemble versioned FTC context from public sources

**Prerequisites:** [M3-01](agent-and-context.md#m3-01).

**Files:** `packages/core/src/ftc/agent/context.ts`, `packages/core/src/ftc/configuration/context.ts`, `packages/core/src/ftc/knowledge/context.ts`, `packages/core/src/ftc/diagnostics/context.ts`, `packages/core/test/ftc/agent-and-context/m3-04.test.ts`.

**Interfaces:** Consumes immutable project code/configuration/reference/diagnostic records through registered domain Context Sources. Produces context inputs for existing System Context and Session-owned Context Epoch persistence.

- [ ] **1. Write the focused test:** In `packages/core/test/ftc/agent-and-context/m3-04.test.ts`, add `context preserves project version freshness and missing facts`. Use the real module and supplied port fixtures; core assertions:

```ts
expect(context.projectID).toBe(requestProjectID); expect(context.missingFacts).toContain('wheel-diameter'); expect(context.text).not.toContain(secret)
```

- [ ] **2. Establish the baseline:** From `packages/core`, run `bun test ./test/ftc/agent-and-context/m3-04.test.ts`. Expected: FAIL for the missing behavior, not a broken harness.
- [ ] **3. Implement the smallest behavior:** Keep producers with their domains; adapt in host wiring without moving System Context algebra or history selection. Tag sources/versions/freshness, preserve unknown facts and language/identifiers, and include online disclosure/offline missing references. Treat external text as data, not action authority.
- [ ] **4. Verify:** Re-run `bun test ./test/ftc/agent-and-context/m3-04.test.ts` from `packages/core`; expected: PASS. Run `bun typecheck` in each changed package. Also verify scoped cleanup.
- [ ] **5. Review and record completion:** Save verification evidence, review the scoped diff, commit, then update this checklist and [progress](progress.md). Commit: `feat(ftc): assemble versioned ftc context from public sources`.

## Binding shared constraints (verbatim)


- Preserve the twelve-module design inside the existing Electron/Solid/OpenCode application. Do not add twelve packages, a new daemon, a universal service registry or a second agent loop.
- Java/FTC SDK, macOS and Windows, English and Simplified Chinese remain first-version scope. No Blocks, robot hardware-configuration synchronization, app-operated AI billing service or extra student-profile system.
- Canonical Schema contracts contain serializable values, not runtime services. Keep Schema → Core/Protocol → Server dependencies; Client runtime can depend on Schema/Protocol but never Core/Server. `sdk-next` composes Client/Core/Server. Import namespaces through their existing self-export pattern; do not alias/star-import new code.
- Each module consumes narrow ports/immutable records and owns its tables/files/maps. No sibling implementation imports, private-store access or bootstrap imports. Importing a module starts no I/O; scope construction/disposal owns processes and subscriptions.
- Reuse Effect layers in Core. Services stay Location-scoped except the explicitly process-global Session execution/project/controller coordinators. Tests create independent instances without resetting globals.
- Preserve Session durable admission before wake, exact retry/conflicting-ID behavior, steer/queue promotion, one stream per provider turn, current-history reload and separate Context Epoch ownership. No automatic provider-work replay after crash.
- Preserve existing project files, SDKs, dependencies and unsaved edits. Canonical project roots identify execution ownership; a copied manifest does not copy chats or controller identity. At most one active chat per project, while separate projects may run concurrently; drafts never auto-execute.
- Keep setup choice, layout, inference mode, code mode, robot mode and language independent. Plan/direct code permission never grants deployment, start or tuning.
- Project `ftc-project.json` stores shared hardware definitions and exclusive managed pathing choice only. Personal progress/chats/credentials/approvals/telemetry/machine paths remain local and outside it.
- PedroPathing, Road Runner or neither: at most one managed pathing library. Retain version-required Road Runner FTC Dashboard/tuning tools. Ask before resolving imported conflicts; do not silently remove team code.
- M5 builds identify saved source/configuration revisions and APK digest. Dirty or changed inputs cannot be passed off as a current successful build. M9 refreshes target/generation/state/artifact at execution time.
- M9 is the only app-issued robot mutation authority. Deliberate Deploy authorizes that exact deployment without redundant confirmation; it never authorizes a start. Agent observation mode blocks initialization/start/tuning. No command/build/extension/dashboard bypass; no replay after reconnect or restart.
- Disconnection does not prove a robot stopped. Keep confirmed success, failure, cancelled and unknown outcomes distinct. Preserve missing/stale/disconnected/valid-zero diagnostics and verified versus unknown deployed-build association.
- Offline inference is verified local-only, with no remote redirects/cloud proxy/fallback. Prepared offline use may still connect to the robot's local network. Missing cached models/tools/dependencies/content remain visible.
- Protect credentials with the OS facility and expose references only. Dashboard pages have no privileged preload bridge; repository instructions, dashboard text, logs and references are not approval authority.
- Monaco/JDT LS, llama.cpp, SQLite/JSON and exact versions are design recommendations pending their named evaluations. Pin tested versions and resource/platform support using evidence; do not select arbitrary latest releases or invent hardware minima.
- All UI/native copy uses existing typed i18n. Preserve English source wording when touching existing keys, placeholders and code/API/device names. Follow package terminology/source-review instructions for translations; stable domain errors/lesson IDs are language-independent.
- If Protocol or Server HttpApi changes, run `bun run generate` from `packages/client`; never hand-edit `src/generated` or `src/generated-effect`. If legacy JS SDK surfaces change, regenerate with `./packages/sdk/js/script/build.ts`.
- Run tests and `bun typecheck` from package directories, never repository root or raw `tsc`. Follow touched package instructions, including session/timeline benchmark baselines and no restarting the user's app/server.
- Keep scoped changes; no unrelated cleanup. Use short branch names without slashes (at most three hyphen-separated words) and conventional commit messages. The default comparison branch is `dev`/`origin/dev`.
