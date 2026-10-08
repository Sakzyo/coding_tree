# Resume preflight — 2026-10-08

Inspected checkpoint: `11b3fe90e`, clean `ftc-workspace`. Current checklists: 24/94, 0/12 modules. Dependency scan: 94 unique task IDs, no missing prerequisites or cycles. The existing feature checkout is retained for this explicit continuation. Product writes remain serialized; read-only preflight is parallel.

| Task | Text consistency / contract | Ownership |
| --- | --- | --- |
| M3-04 | Exact task IDs/prerequisites retained; source-approved public ports and producer ownership reconciled before dispatch. | packages/core/src/ftc/agent/context.ts, packages/core/src/ftc/configuration/context.ts, packages/core/src/ftc/knowledge/context.ts, packages/core/src/ftc/diagnostics/context.ts, packages/core/test/ftc/agent-and-context/m3-04.test.ts |
| M2-06 | Exact task IDs/prerequisites retained; source-approved public ports and producer ownership reconciled before dispatch. | packages/protocol/src/groups/ftc-project.ts, packages/server/src/handlers/ftc-project.ts, packages/core/src/ftc/composition.ts, packages/opencode/src/effect/app-runtime.ts, packages/core/test/ftc-integration/m2-06.test.ts |

| Shared contract | Producer / consumer | Decision |
| --- | --- | --- |
| Java snapshots | M5-01/02 → M3-04 | Consume canonical immutable public records; no M5 runtime changes. |
| Knowledge lookup and context | M11-02 → M3-04 | Narrow lookup port; retain existing source behavior; sanitize before snapshot/render. |
| Diagnostics | M10 future → M3-04 | Add unavailable-only M10-owned Schema; no fabricated positive observation. |
| Context registry/epochs | System Context and Session → M3-04 | Existing algebra/registry/epoch functions, independently scoped selected source sets. |
| Legacy activation | Legacy runtime + M2-06 | Read-only preflight first; no concurrent product writer or activation changes. |

These selected task rows reconcile execution starting points; they are not whole-release or platform acceptance. All other existing gates remain unchanged.
