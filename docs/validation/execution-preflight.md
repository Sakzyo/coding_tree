# Execution preflight — 2026-10-06

Baseline: `d7aca195c0a47fadb0fc3788eefbe96f99ec68be`; 94 unique tasks across 12 module plans. Dependency scan: no missing IDs or cycles. All Task checklist entries unchecked. No prior implementation evidence.

Sources were read before dispatch. Repeated standard verification steps were inspected once and applied to every task; exact task excerpts remain in task-index.json and dispatch briefs.

## Scheduling and ownership rulings

- Ruling: Work in the existing checkout on local `ftc-workspace` with one implementer at a time — no attached worktree exists and the authoritative task plans are untracked here — isolation is by serialized writes; the current folder will contain implementation changes.
- Ruling: `docs/tasks/progress.md` is the only authoritative ledger, and validation artifacts remain durable — the execution prompt overrides Superpowers scratch-ledger/deletion defaults — duplicate accounting would risk redispatch after compaction.
- Ruling: Schema contracts are introduced once by their listed owning task before consumer implementation uses them; supplied fixtures may replace external behavior, not duplicate canonical types — avoids divergent contracts without adding sibling runtime dependencies — this can reorder otherwise fixture-ready tasks.
- Ruling: Evaluation-dependent production adapters remain disabled until their required platform evidence passes — a fixture result cannot establish OS/controller/model compatibility — some integration work will remain blocked.

## Task self-consistency scan

| Task | Prerequisites | Result |
| --- | --- | --- |
| M3-01 | None | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M3-02 | M3-01 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M3-03 | M3-01 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M3-04 | M3-01 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. Domain Context Source files overlap later domain owners; coordinator assigns one writer and preserves domain ownership. |
| M3-05 | M3-03, M3-04 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M3-06 | M3-02, M3-05, M2-03, M5-06, M6-05, M7-07, M9-08, M10-05, M11-02 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M3-07 | M3-06, M1-03, M1-07, M1-11, M1-04, M1-05 | Evaluation requires both automated subset and separately recorded actual observations; missing resources keep task open. |
| M7-01 | None | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M7-02 | None | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M7-03 | M7-01, M7-02 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M7-04 | M7-03 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M7-05 | M7-01 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M7-06 | M7-04, M7-05 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M7-07 | M7-03, M7-04, M7-06, M3-02 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M7-08 | M7-06, M7-07 | Evaluation requires both automated subset and separately recorded actual observations; missing resources keep task open. |
| M8-01 | None | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M8-02 | M8-01, M8-04 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M8-03 | M8-01, M8-02 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M8-04 | M8-01 | Evaluation requires both automated subset and separately recorded actual observations; missing resources keep task open. |
| M8-05 | M8-02, M8-03, M8-04 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M8-06 | M8-05 | Evaluation requires both automated subset and separately recorded actual observations; missing resources keep task open. |
| M1-01 | None | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M1-02 | M1-01 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M1-03 | M1-01 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M1-04 | M1-01 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M1-05 | M1-01 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M1-06 | M1-01 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M1-07 | M1-02, M5-07 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M1-08 | M1-01 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M1-09 | M9-07, M10-04 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M1-10 | M1-01 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M1-11 | M1-03, M1-06, M1-07, M1-08, M1-10, M2-06, M4-06, M6-06, M7-07, M8-05, M10-05, M12-06, M5-08, M9-08, M11-10, M1-04, M1-05 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M1-12 | M1-11, M3-06, M4-06 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M1-13 | M1-11, M11-10 | Evaluation requires both automated subset and separately recorded actual observations; missing resources keep task open. |
| M1-14 | M1-09, M1-12, M1-13, M3-07, M4-07, M7-08, M9-09, M10-06, M12-07 | Evaluation requires both automated subset and separately recorded actual observations; missing resources keep task open. |
| M10-01 | M8-04 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M10-02 | M10-01 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M10-03 | M10-02 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M10-04 | M10-02 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M10-05 | M10-03, M10-04, M8-05 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M10-06 | M10-05, M8-06 | Evaluation requires both automated subset and separately recorded actual observations; missing resources keep task open. |
| M4-01 | None | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M4-02 | M4-01 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M4-03 | M4-02 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M4-04 | M4-02 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M4-05 | M4-01, M4-02 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M4-06 | M4-03, M4-04, M4-05, M5-05 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M4-07 | M4-06, M5-08, M7-08, M8-06, M11-09 | Evaluation requires both automated subset and separately recorded actual observations; missing resources keep task open. |
| M6-01 | None | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M6-02 | M6-01 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M6-03 | M6-01 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M6-04 | M6-01, M6-03, M4-01, M11-03 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M6-05 | M6-02, M6-03 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M6-06 | M6-04, M6-05, M3-03, M5-02 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M11-01 | None | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M11-02 | M11-01 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M11-03 | M11-01 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. Public pathingComparison method needs owning knowledge.ts change in addition to listed content files; assign explicitly when dispatching. |
| M11-04 | M11-01 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M11-05 | M11-04 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M11-06 | M11-04 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M11-07 | M11-03, M11-04, M11-05, M11-06 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M11-08 | M11-03, M11-04, M11-05, M11-06 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M11-09 | M11-02, M11-03, M11-04, M11-07, M11-05, M11-06, M11-08 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M11-10 | M11-02, M11-09, M11-07, M11-08 | Evaluation requires both automated subset and separately recorded actual observations; missing resources keep task open. |
| M5-01 | None | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M5-02 | M5-01 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M5-03 | M4-01 | Evaluation requires both automated subset and separately recorded actual observations; missing resources keep task open. |
| M5-04 | M5-01, M5-03 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M5-05 | M5-01 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M5-06 | M5-05 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M5-07 | M5-01, M5-02, M5-04 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M5-08 | M5-04, M5-05, M5-06, M5-07 | Evaluation requires both automated subset and separately recorded actual observations; missing resources keep task open. |
| M12-01 | None | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M12-02 | M12-01 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M12-03 | M12-02 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M12-04 | M12-01, M12-03 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M12-05 | M12-04, M11-07, M11-08 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M12-06 | M12-03, M12-04, M12-05, M11-02, M5-06, M9-05, M10-05 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M12-07 | M12-06, M11-10, M1-10, M1-11 | Evaluation requires both automated subset and separately recorded actual observations; missing resources keep task open. |
| M2-01 | None | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M2-02 | M2-01 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M2-03 | M2-01, M2-02 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M2-04 | M2-02, M2-03 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M2-05 | M2-03, M2-04 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M2-06 | M2-01, M2-02, M2-03, M2-04, M2-05, M3-02 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M9-01 | None | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M9-02 | M9-01 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M9-03 | M9-01 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M9-04 | M9-02, M9-03 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M9-05 | M9-04 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M9-06 | M9-04, M9-05, M8-04 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M9-07 | None | Evaluation requires both automated subset and separately recorded actual observations; missing resources keep task open. |
| M9-08 | M9-06, M9-07, M8-05, M5-06, M3-05, M1-09 | Assertions and stated behavior align; verify planned paths and consumed contracts at dispatch. |
| M9-09 | M9-08, M8-06, M10-06 | Evaluation requires both automated subset and separately recorded actual observations; missing resources keep task open. |

## Shared file and interface scan

One row per task pair sharing a declared file or dependency interface. Shared-file writes are serialized. Each module owns its schema and implementation; integration tasks own only their assigned wiring. The coordinator reserves package manifests, lockfiles, generated registries and compatibility-matrix edits per dispatch.

| Tasks | Shared files / consumed interface | Owner and disposition |
| --- | --- | --- |
| M3-01 / M3-02 | M3-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M3-01 / M3-03 | M3-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M3-01 / M3-04 | M3-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M3-02 / M3-06 | M3-02 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M3-02 / M7-07 | M3-02 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M3-02 / M2-06 | M3-02 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M3-03 / M3-05 | M3-03 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M3-03 / M6-06 | M3-03 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M3-04 / M3-05 | M3-04 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M3-04 / M10-03 | `packages/core/src/ftc/diagnostics/context.ts` | Sequential assigned task writer; no parallel modification. |
| M3-05 / M3-06 | M3-05 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M3-05 / M9-08 | `packages/core/src/tool/application-tools.ts`; M3-05 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M3-06 / M3-07 | M3-06 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M3-06 / M7-07 | `packages/core/src/ftc/composition.ts`; M7-07 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M3-06 / M8-05 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M3-06 / M1-12 | M3-06 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M3-06 / M10-05 | `packages/core/src/ftc/composition.ts`; M10-05 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M3-06 / M4-06 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M3-06 / M6-05 | M6-05 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M3-06 / M6-06 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M3-06 / M11-02 | M11-02 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M3-06 / M11-10 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M3-06 / M5-06 | M5-06 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M3-06 / M5-08 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M3-06 / M12-06 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M3-06 / M2-03 | M2-03 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M3-06 / M2-06 | `packages/core/src/ftc/composition.ts`, `packages/opencode/src/effect/app-runtime.ts` | Sequential assigned task writer; no parallel modification. |
| M3-06 / M9-08 | `packages/core/src/ftc/composition.ts`; M9-08 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M3-07 / M1-03 | M1-03 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M3-07 / M1-04 | M1-04 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M3-07 / M1-05 | M1-05 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M3-07 / M1-07 | M1-07 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M3-07 / M1-11 | M1-11 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M3-07 / M1-14 | M3-07 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M7-01 / M7-03 | M7-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M7-01 / M7-05 | M7-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M7-01 / M7-08 | `packages/core/resources/ftc/models.json` | Sequential assigned task writer; no parallel modification. |
| M7-02 / M7-03 | M7-02 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M7-02 / M1-09 | `packages/desktop/src/main/ipc.ts`, `packages/desktop/src/preload/index.ts`, `packages/desktop/src/preload/types.ts` | Sequential assigned task writer; no parallel modification. |
| M7-03 / M7-04 | `packages/core/src/ftc/inference.ts`; M7-03 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M7-03 / M7-05 | `packages/core/src/ftc/inference.ts` | Sequential assigned task writer; no parallel modification. |
| M7-03 / M7-06 | `packages/core/src/ftc/inference.ts` | Sequential assigned task writer; no parallel modification. |
| M7-03 / M7-07 | M7-03 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M7-04 / M7-05 | `packages/core/src/ftc/inference.ts` | Sequential assigned task writer; no parallel modification. |
| M7-04 / M7-06 | `packages/core/src/ftc/inference.ts`; M7-04 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M7-04 / M7-07 | M7-04 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M7-05 / M7-06 | `packages/core/src/ftc/inference.ts`; M7-05 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M7-06 / M7-07 | M7-06 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M7-06 / M7-08 | M7-06 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M7-07 / M7-08 | M7-07 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M7-07 / M8-05 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M7-07 / M1-11 | M7-07 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M7-07 / M10-05 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M7-07 / M4-06 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M7-07 / M6-06 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M7-07 / M11-10 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M7-07 / M5-08 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M7-07 / M12-06 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M7-07 / M2-06 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M7-07 / M9-08 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M7-08 / M8-06 | `docs/compatibility-matrix.md` | Sequential assigned task writer; no parallel modification. |
| M7-08 / M1-14 | `docs/compatibility-matrix.md`; M7-08 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M7-08 / M10-06 | `docs/compatibility-matrix.md` | Sequential assigned task writer; no parallel modification. |
| M7-08 / M4-07 | `docs/compatibility-matrix.md`; M7-08 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M7-08 / M9-09 | `docs/compatibility-matrix.md` | Sequential assigned task writer; no parallel modification. |
| M8-01 / M8-02 | M8-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M8-01 / M8-03 | `packages/core/src/ftc/controllers.ts`; M8-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M8-01 / M8-04 | `packages/core/src/ftc/controllers/adb.ts`; M8-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M8-01 / M8-05 | `packages/core/src/ftc/controllers.ts` | Sequential assigned task writer; no parallel modification. |
| M8-02 / M8-03 | M8-02 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M8-02 / M8-04 | M8-04 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M8-02 / M8-05 | M8-02 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M8-03 / M8-05 | `packages/core/src/ftc/controllers.ts`; M8-03 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M8-04 / M8-05 | M8-04 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M8-04 / M10-01 | M8-04 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M8-04 / M9-06 | M8-04 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M8-05 / M8-06 | M8-05 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M8-05 / M1-11 | M8-05 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M8-05 / M10-05 | `packages/core/src/ftc/composition.ts`; M8-05 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M8-05 / M4-06 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M8-05 / M6-06 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M8-05 / M11-10 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M8-05 / M5-08 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M8-05 / M12-06 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M8-05 / M2-06 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M8-05 / M9-08 | `packages/core/src/ftc/composition.ts`; M8-05 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M8-06 / M1-14 | `docs/compatibility-matrix.md` | Sequential assigned task writer; no parallel modification. |
| M8-06 / M10-06 | `docs/compatibility-matrix.md`; M8-06 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M8-06 / M4-07 | `docs/compatibility-matrix.md`; M8-06 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M8-06 / M9-09 | `docs/compatibility-matrix.md`; M8-06 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-01 / M1-02 | `packages/app/src/ftc/workspace.tsx`; M1-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-01 / M1-03 | `packages/app/src/ftc/facades.ts`; M1-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-01 / M1-04 | M1-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-01 / M1-05 | M1-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-01 / M1-06 | M1-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-01 / M1-07 | `packages/app/src/ftc/workspace.tsx` | Sequential assigned task writer; no parallel modification. |
| M1-01 / M1-08 | M1-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-01 / M1-10 | M1-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-02 / M1-07 | `packages/app/src/ftc/workspace.tsx`; M1-02 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-03 / M1-04 | `packages/app/src/i18n/en.ts`, `packages/app/src/i18n/zh.ts` | Sequential assigned task writer; no parallel modification. |
| M1-03 / M1-05 | `packages/app/src/i18n/en.ts`, `packages/app/src/i18n/zh.ts` | Sequential assigned task writer; no parallel modification. |
| M1-03 / M1-06 | `packages/app/src/ftc/setup.tsx` | Sequential assigned task writer; no parallel modification. |
| M1-03 / M1-11 | M1-03 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-03 / M1-13 | `packages/app/src/i18n/en.ts`, `packages/app/src/i18n/zh.ts` | Sequential assigned task writer; no parallel modification. |
| M1-04 / M1-05 | `packages/app/src/i18n/en.ts`, `packages/app/src/i18n/zh.ts` | Sequential assigned task writer; no parallel modification. |
| M1-04 / M1-11 | M1-04 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-04 / M1-13 | `packages/app/src/i18n/en.ts`, `packages/app/src/i18n/zh.ts` | Sequential assigned task writer; no parallel modification. |
| M1-05 / M1-11 | M1-05 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-05 / M1-13 | `packages/app/src/i18n/en.ts`, `packages/app/src/i18n/zh.ts` | Sequential assigned task writer; no parallel modification. |
| M1-06 / M1-11 | M1-06 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-07 / M1-11 | M1-07 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-07 / M5-07 | M5-07 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-08 / M1-11 | M1-08 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-09 / M1-14 | M1-09 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-09 / M10-04 | M10-04 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-09 / M9-07 | `packages/desktop/src/main/panels-policy.ts`; M9-07 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-09 / M9-08 | `packages/desktop/src/main/panels-policy.ts`; M1-09 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-10 / M1-11 | M1-10 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-10 / M12-07 | M1-10 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-11 / M1-12 | M1-11 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-11 / M1-13 | M1-11 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-11 / M10-05 | M10-05 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-11 / M4-06 | M4-06 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-11 / M6-06 | M6-06 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-11 / M11-10 | M11-10 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-11 / M5-07 | `packages/app/package.json` | Sequential assigned task writer; no parallel modification. |
| M1-11 / M5-08 | M5-08 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-11 / M12-06 | M12-06 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-11 / M12-07 | M1-11 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-11 / M2-06 | M2-06 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-11 / M9-08 | M9-08 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-12 / M1-14 | M1-12 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-12 / M4-06 | M4-06 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-13 / M1-14 | M1-13 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-13 / M11-10 | M11-10 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-14 / M10-06 | `docs/compatibility-matrix.md`; M10-06 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-14 / M4-07 | `docs/compatibility-matrix.md`, `packages/desktop/electron-builder.config.ts`; M4-07 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-14 / M11-09 | `packages/desktop/electron-builder.config.ts` | Sequential assigned task writer; no parallel modification. |
| M1-14 / M12-07 | M12-07 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M1-14 / M9-09 | `docs/compatibility-matrix.md`; M9-09 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M10-01 / M10-02 | M10-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M10-01 / M10-04 | `packages/schema/src/ftc-diagnostics.ts` | Sequential assigned task writer; no parallel modification. |
| M10-02 / M10-03 | `packages/core/src/ftc/diagnostics.ts`; M10-02 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M10-02 / M10-04 | `packages/core/src/ftc/diagnostics.ts`; M10-02 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M10-03 / M10-04 | `packages/core/src/ftc/diagnostics.ts` | Sequential assigned task writer; no parallel modification. |
| M10-03 / M10-05 | M10-03 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M10-04 / M10-05 | M10-04 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M10-05 / M10-06 | M10-05 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M10-05 / M4-06 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M10-05 / M6-06 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M10-05 / M11-10 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M10-05 / M5-08 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M10-05 / M12-06 | `packages/core/src/ftc/composition.ts`; M10-05 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M10-05 / M2-06 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M10-05 / M9-08 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M10-06 / M4-07 | `docs/compatibility-matrix.md` | Sequential assigned task writer; no parallel modification. |
| M10-06 / M9-09 | `docs/compatibility-matrix.md`; M10-06 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M4-01 / M4-02 | M4-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M4-01 / M4-05 | `packages/schema/src/ftc-environment.ts`; M4-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M4-01 / M4-06 | `packages/schema/src/ftc-environment.ts` | Sequential assigned task writer; no parallel modification. |
| M4-01 / M4-07 | `packages/core/resources/ftc/compatibility.json` | Sequential assigned task writer; no parallel modification. |
| M4-01 / M6-04 | M4-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M4-01 / M5-03 | M4-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M4-02 / M4-03 | `packages/core/src/ftc/environment.ts`; M4-02 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M4-02 / M4-04 | `packages/core/src/ftc/environment.ts`, `packages/core/src/ftc/environment/adapters.ts`; M4-02 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M4-02 / M4-05 | `packages/core/src/ftc/environment.ts`; M4-02 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M4-03 / M4-04 | `packages/core/src/ftc/environment.ts` | Sequential assigned task writer; no parallel modification. |
| M4-03 / M4-05 | `packages/core/src/ftc/environment.ts` | Sequential assigned task writer; no parallel modification. |
| M4-03 / M4-06 | M4-03 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M4-04 / M4-05 | `packages/core/src/ftc/environment.ts` | Sequential assigned task writer; no parallel modification. |
| M4-04 / M4-06 | M4-04 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M4-05 / M4-06 | `packages/schema/src/ftc-environment.ts`; M4-05 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M4-06 / M4-07 | M4-06 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M4-06 / M6-06 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M4-06 / M11-10 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M4-06 / M5-05 | M5-05 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M4-06 / M5-08 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M4-06 / M12-06 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M4-06 / M2-06 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M4-06 / M9-08 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M4-07 / M11-09 | `packages/desktop/electron-builder.config.ts`; M11-09 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M4-07 / M5-08 | M5-08 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M4-07 / M9-09 | `docs/compatibility-matrix.md` | Sequential assigned task writer; no parallel modification. |
| M6-01 / M6-02 | `packages/core/src/ftc/configuration.ts`, `packages/schema/src/ftc-configuration.ts`; M6-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M6-01 / M6-03 | M6-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M6-01 / M6-04 | M6-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M6-01 / M6-05 | `packages/core/src/ftc/configuration.ts` | Sequential assigned task writer; no parallel modification. |
| M6-02 / M6-05 | `packages/core/src/ftc/configuration.ts`; M6-02 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M6-03 / M6-04 | M6-03 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M6-03 / M6-05 | M6-03 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M6-04 / M6-05 | `packages/core/src/ftc/configuration/proposals.ts` | Sequential assigned task writer; no parallel modification. |
| M6-04 / M6-06 | M6-04 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M6-04 / M11-03 | M11-03 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M6-05 / M6-06 | M6-05 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M6-06 / M11-10 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M6-06 / M5-02 | M5-02 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M6-06 / M5-08 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M6-06 / M12-06 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M6-06 / M2-06 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M6-06 / M9-08 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M11-01 / M11-02 | `packages/core/src/ftc/knowledge.ts`; M11-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-01 / M11-03 | `packages/core/resources/ftc/content/manifest.json`; M11-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-01 / M11-04 | `packages/core/resources/ftc/content/manifest.json`; M11-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-01 / M11-05 | `packages/core/resources/ftc/content/manifest.json` | Sequential assigned task writer; no parallel modification. |
| M11-01 / M11-06 | `packages/core/resources/ftc/content/manifest.json` | Sequential assigned task writer; no parallel modification. |
| M11-01 / M11-07 | `packages/core/resources/ftc/content/manifest.json` | Sequential assigned task writer; no parallel modification. |
| M11-01 / M11-08 | `packages/core/resources/ftc/content/manifest.json` | Sequential assigned task writer; no parallel modification. |
| M11-01 / M11-09 | `packages/core/src/ftc/knowledge.ts` | Sequential assigned task writer; no parallel modification. |
| M11-02 / M11-09 | `packages/core/src/ftc/knowledge.ts`; M11-02 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-02 / M11-10 | M11-02 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-02 / M12-06 | M11-02 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-03 / M11-04 | `packages/core/resources/ftc/content/manifest.json` | Sequential assigned task writer; no parallel modification. |
| M11-03 / M11-05 | `packages/core/resources/ftc/content/manifest.json` | Sequential assigned task writer; no parallel modification. |
| M11-03 / M11-06 | `packages/core/resources/ftc/content/manifest.json` | Sequential assigned task writer; no parallel modification. |
| M11-03 / M11-07 | `packages/core/resources/ftc/content/manifest.json`; M11-03 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-03 / M11-08 | `packages/core/resources/ftc/content/manifest.json`; M11-03 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-03 / M11-09 | M11-03 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-04 / M11-05 | `packages/core/resources/ftc/content/manifest.json`; M11-04 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-04 / M11-06 | `packages/core/resources/ftc/content/manifest.json`; M11-04 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-04 / M11-07 | `packages/core/resources/ftc/content/manifest.json`; M11-04 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-04 / M11-08 | `packages/core/resources/ftc/content/manifest.json`; M11-04 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-04 / M11-09 | M11-04 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-05 / M11-06 | `packages/core/resources/ftc/content/manifest.json` | Sequential assigned task writer; no parallel modification. |
| M11-05 / M11-07 | `packages/core/resources/ftc/content/manifest.json`; M11-05 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-05 / M11-08 | `packages/core/resources/ftc/content/manifest.json`; M11-05 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-05 / M11-09 | M11-05 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-06 / M11-07 | `packages/core/resources/ftc/content/manifest.json`; M11-06 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-06 / M11-08 | `packages/core/resources/ftc/content/manifest.json`; M11-06 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-06 / M11-09 | M11-06 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-07 / M11-08 | `packages/core/resources/ftc/content/manifest.json` | Sequential assigned task writer; no parallel modification. |
| M11-07 / M11-09 | M11-07 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-07 / M11-10 | M11-07 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-07 / M12-05 | M11-07 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-08 / M11-09 | M11-08 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-08 / M11-10 | M11-08 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-08 / M12-05 | M11-08 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-09 / M11-10 | M11-09 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-10 / M5-08 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M11-10 / M12-06 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M11-10 / M12-07 | M11-10 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M11-10 / M2-06 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M11-10 / M9-08 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M5-01 / M5-02 | `packages/core/src/ftc/java.ts`, `packages/core/src/ftc/java/documents.ts`; M5-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M5-01 / M5-04 | `packages/core/src/ftc/java.ts`; M5-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M5-01 / M5-05 | `packages/core/src/ftc/java.ts`; M5-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M5-01 / M5-06 | `packages/schema/src/ftc-java.ts` | Sequential assigned task writer; no parallel modification. |
| M5-01 / M5-07 | M5-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M5-02 / M5-04 | `packages/core/src/ftc/java.ts` | Sequential assigned task writer; no parallel modification. |
| M5-02 / M5-05 | `packages/core/src/ftc/java.ts` | Sequential assigned task writer; no parallel modification. |
| M5-02 / M5-07 | M5-02 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M5-03 / M5-04 | `packages/core/src/ftc/java/language-service.ts`; M5-03 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M5-04 / M5-05 | `packages/core/src/ftc/java.ts` | Sequential assigned task writer; no parallel modification. |
| M5-04 / M5-07 | M5-04 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M5-04 / M5-08 | M5-04 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M5-05 / M5-06 | `packages/core/src/ftc/java/build.ts`; M5-05 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M5-05 / M5-08 | M5-05 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M5-06 / M5-08 | M5-06 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M5-06 / M12-06 | M5-06 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M5-06 / M9-08 | M5-06 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M5-07 / M5-08 | M5-07 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M5-08 / M12-06 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M5-08 / M2-06 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M5-08 / M9-08 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M12-01 / M12-02 | `packages/core/src/ftc/learning.ts`; M12-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M12-01 / M12-03 | `packages/core/src/ftc/learning.ts` | Sequential assigned task writer; no parallel modification. |
| M12-01 / M12-04 | `packages/core/src/ftc/learning.ts`; M12-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M12-01 / M12-05 | `packages/core/src/ftc/learning.ts` | Sequential assigned task writer; no parallel modification. |
| M12-02 / M12-03 | `packages/core/src/ftc/learning.ts`; M12-02 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M12-02 / M12-04 | `packages/core/src/ftc/learning.ts` | Sequential assigned task writer; no parallel modification. |
| M12-02 / M12-05 | `packages/core/src/ftc/learning.ts` | Sequential assigned task writer; no parallel modification. |
| M12-03 / M12-04 | `packages/core/src/ftc/learning.ts`; M12-03 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M12-03 / M12-05 | `packages/core/src/ftc/learning.ts` | Sequential assigned task writer; no parallel modification. |
| M12-03 / M12-06 | M12-03 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M12-04 / M12-05 | `packages/core/src/ftc/learning.ts`; M12-04 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M12-04 / M12-06 | M12-04 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M12-05 / M12-06 | M12-05 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M12-06 / M12-07 | M12-06 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M12-06 / M2-06 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M12-06 / M9-05 | M9-05 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M12-06 / M9-08 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M2-01 / M2-02 | `packages/core/src/ftc/projects.ts`, `packages/core/src/ftc/projects/sql.ts`; M2-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M2-01 / M2-03 | M2-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M2-01 / M2-04 | `packages/core/src/ftc/projects.ts` | Sequential assigned task writer; no parallel modification. |
| M2-01 / M2-05 | `packages/core/src/ftc/projects.ts` | Sequential assigned task writer; no parallel modification. |
| M2-01 / M2-06 | M2-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M2-02 / M2-03 | M2-02 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M2-02 / M2-04 | `packages/core/src/ftc/projects.ts`; M2-02 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M2-02 / M2-05 | `packages/core/src/ftc/projects.ts` | Sequential assigned task writer; no parallel modification. |
| M2-02 / M2-06 | M2-02 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M2-03 / M2-04 | M2-03 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M2-03 / M2-05 | `packages/core/src/ftc/projects/gate.ts`; M2-03 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M2-03 / M2-06 | M2-03 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M2-04 / M2-05 | `packages/core/src/ftc/projects.ts`; M2-04 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M2-04 / M2-06 | M2-04 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M2-05 / M2-06 | M2-05 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M2-06 / M9-08 | `packages/core/src/ftc/composition.ts` | Sequential assigned task writer; no parallel modification. |
| M9-01 / M9-02 | `packages/core/src/ftc/operations.ts`; M9-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M9-01 / M9-03 | M9-01 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M9-01 / M9-04 | `packages/core/src/ftc/operations.ts` | Sequential assigned task writer; no parallel modification. |
| M9-01 / M9-05 | `packages/core/src/ftc/operations.ts` | Sequential assigned task writer; no parallel modification. |
| M9-02 / M9-04 | `packages/core/src/ftc/operations.ts`; M9-02 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M9-02 / M9-05 | `packages/core/src/ftc/operations.ts` | Sequential assigned task writer; no parallel modification. |
| M9-03 / M9-04 | M9-03 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M9-04 / M9-05 | `packages/core/src/ftc/operations.ts`; M9-04 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M9-04 / M9-06 | M9-04 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M9-05 / M9-06 | M9-05 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M9-06 / M9-08 | M9-06 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M9-07 / M9-08 | `packages/desktop/src/main/panels-policy.ts`; M9-07 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
| M9-08 / M9-09 | M9-08 public contract/evidence consumed by prerequisite edge | Domain owner supplies contract once; sequential consumer. |
