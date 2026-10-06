# M2-03 implementation candidate

Status: DONE_WITH_CONCERNS, ready for coordinator reconciliation/review and task commit. Implementer `/root/m2_03`, 2026-10-06. Start checkpoint: `3d496b0c9837a8c359741244602aff699df78122`. Final tests ran against the shared working tree with HEAD `577c7b3b83ae12a4ab004a235fc63ae4c23f8735`; the exact four tested product/test file SHA256 values are in [tested-sha256.txt](m2-03/tested-sha256.txt). Concurrent M4/M11 files are outside this task's ownership. No files were staged/committed and no ledger/checklist was edited by this implementer.

## Scope and approved decisions

Owned: `packages/core/src/ftc/projects/gate.ts`, `packages/schema/src/ftc-project.ts`, `packages/core/test/ftc/projects-and-chats/m2-03.test.ts`, this report and `docs/validation/m2-03/`. Coordinator explicitly added `packages/core/src/ftc/projects.ts` solely for the public `getProject(ProjectRequest)` lookup, reusing its existing internal lookup and adding association/placement validation. No repository tables, migrations, Session/host behavior, Protocol/HttpApi, Client generation or manifest/lock changes.

Ruling: expose the smallest public project lookup because the reviewed public facade previously exposed validated chat listing but no ProjectContext resolution. The gate consumes only `getProject` and `listChats` through a narrow `Pick` of the public interface. It never imports the repository implementation or Session stores. The validated membership listing remains responsible for Session existence, exact identity, host Project ID and Location matching. Project lookup checks association identity, absolute canonical/host roots, canonical-root/Location agreement and implicit-local placement. Cost if wrong: a future placement model will need an explicit contract revision.

Ruling: each successful same-chat acquisition receives a fresh opaque claim token; all claims occupy one canonical-root owner. Release validates the lease and removes only a matching token/root/chat/Session claim; ownership frees only after the last claim. Repeated, mismatched, invented, other-instance and old-owner release attempts do nothing. Different association labels and host IDs cannot split a root; different roots sharing the host global ID remain independent. This model was proposed before implementation and explicitly approved by the coordinator. Cost if wrong: M2-04/05 must revise the handoff contract; it cannot silently treat every acquired result as a new execution owner.

Ruling: explicit acquire/release is a transferable resource contract, not a fiber-lifetime lease. Callers bracket unused reservations with `Effect.acquireUseRelease`, or transfer successfully acquired claims to the future execution owner. No admission/resume/stop integration was added. Automatic release when an acquiring caller finishes would prematurely free transferred execution ownership. Cost if wrong: a caller that neither brackets nor transfers/releases its claim holds the root until scope disposal. This caller responsibility is documented on `make`.

## Implementation and lifecycle

`ProjectGate.make` constructs the map inside an Effect Scope; `layer` provides that scoped service. Importing the module starts no I/O, acquisition, subscription or global ownership. Finalization clears all claims and marks the instance closed. Closed acquire/active lookup fails with `gate_closed`; release remains harmless for cleanup.

Acquire snapshots and freezes the supplied ChatRef before lookup. It validates the record, resolves immutable ProjectContext through the public port and verifies an exact project/chat/Session tuple in the public validated listing. Only after successful lookup does one uninterruptible synchronous check-and-allocation step examine the canonical-root map and allocate its token. No I/O or yield divides the ownership check and write. Scope disposal is rechecked after validation, so a pending lookup cannot resurrect a closed gate.

Cancellation before allocation, port failure and membership failure leave no ownership. Successful raw acquisitions deliberately remain until explicit release or scope cleanup; bracketed failed/cancelled callers release only their own claims. The test suite demonstrates the keeper claim surviving another caller's failure/cancellation.

Schema owns serializable `GateToken`, `GateLease`, acquired/busy `GateResult`, and `GateError`, with exact Core facade re-exports. Lease roots validate POSIX/Windows absolute syntax without Node imports. Tokens are process-local ownership identities, never persisted approvals. Windows syntax acceptance does not prove Windows physical canonicalization.

## RED to GREEN

Focused test written first: `same project contends while another runs`. A typed no-ownership scaffold let the harness run against the real gate module. Baseline [red.log](m2-03/red.log) is a behavioral failure, not an import/harness error: expected initial `acquired`, observed `busy` (0 pass, 1 fail). Implementation produces the exact required assertions: same project `busy`, other root `acquired`, active chat equals the first chat.

Public lookup regression was separately RED before identity validation: [lookup-red.log](m2-03/lookup-red.log) expected `project_changed` for a mismatched association and observed success. It now passes. Final [green.log](m2-03/green.log): 18 pass, 0 fail, 56 assertions.

During implementation, the test initially assumed `AbsolutePath` enforced absolute syntax; inspection showed it is only branded. GateLease now applies its own browser-safe absolute-path filter and the runtime lookup validates paths. The identifier test initially inspected top-level AST annotations for a checked scalar; Effect stores those annotations on its check. It now uses `SchemaAST.resolveIdentifier` and preserves the intended stable-identifier assertion. Both observations were corrected before the final run.

## Verification commands

All Bun commands used the pinned runtime and task-owned test roots. Shared prefix:

```sh
PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH
OPENCODE_TEST_HOME=/private/tmp/ftc-m2-03-test-home
XDG_DATA_HOME=/private/tmp/ftc-m2-03-test-home/data
XDG_CONFIG_HOME=/private/tmp/ftc-m2-03-test-home/config
XDG_CACHE_HOME=/private/tmp/ftc-m2-03-test-home/cache
XDG_STATE_HOME=/private/tmp/ftc-m2-03-test-home/state
```

| Cwd | Command | Actual result/evidence |
| --- | --- | --- |
| `packages/core` | `bun test ./test/ftc/projects-and-chats/m2-03.test.ts` | RED 0/1, then final GREEN 18/18; 56 assertions; [red](m2-03/red.log), [green](m2-03/green.log) |
| `packages/core` | `bun test ./test/ftc/projects-and-chats/m2-03.test.ts --test-name-pattern 'public project lookup'` | Behavioral RED 0/1; lookup-green is included in final 18/18; [lookup-red](m2-03/lookup-red.log) |
| `packages/core` | `bun test ./test/ftc/projects-and-chats/` | Final 50/50 across M2-01/02/03, 169 assertions, exit 0; [covering](m2-03/covering.log) |
| `packages/core` | `bun typecheck` | Earlier full run exit 0; latest concurrent snapshot exit 2 solely in foreign `test/ftc/ftc-knowledge/m11-01.test.ts:422` (`manifest.kind` string inference). No M2 diagnostics; [Core typecheck](m2-03/core-typecheck.log) |
| `packages/schema` | `bun typecheck` | Exit 0; [Schema typecheck](m2-03/schema-typecheck.log) |
| `packages/schema` | `bun test ./test/contract-hygiene.test.ts ./test/compatibility.test.ts ./test/event-manifest.test.ts` | Hygiene/compatibility 6 pass; existing manifest 2 fail; [condensed evidence](m2-03/schema-tests.log) |
| Checkpoint archive at `/private/tmp/ftc-m2-03-schema-baseline/packages/schema` | `bun test ./test/event-manifest.test.ts` | Reproduces both unchanged baseline failures, 0 pass/2 fail; [baseline](m2-03/schema-manifest-baseline.log) |
| Repository root | `bun x oxlint packages/core/src/ftc/projects/gate.ts packages/core/src/ftc/projects.ts packages/schema/src/ftc-project.ts packages/core/test/ftc/projects-and-chats/m2-03.test.ts` | Exit 0, 0 warnings, 0 errors; [lint](m2-03/lint.log) |
| Repository root | `bun x prettier --check packages/core/src/ftc/projects/gate.ts packages/core/src/ftc/projects.ts packages/schema/src/ftc-project.ts packages/core/test/ftc/projects-and-chats/m2-03.test.ts` | Exit 0, all matched files formatted; [format](m2-03/format-check.log) |
| Repository root | `git diff --check` | Exit 0 |

The checkpoint archive was extracted with `git archive 3d496b0c9837a8c359741244602aff699df78122 packages/schema`, using the installed Schema node_modules via a temporary symlink. Baseline failures: `public event manifest > owns the complete public event surface` expects 55 ServerDefinitions but receives 58; `public event manifest > uses canonical definitions for current public events` has an existing slice order mismatch at line 45. Neither `packages/schema/src/event-manifest.ts` nor `packages/schema/test/event-manifest.test.ts` differs from the checkpoint. Large AST diffs are omitted from the condensed committed evidence; full raw logs remain at the task-owned `/private/tmp/ftc-m2-03-schema-tests.log` and `/private/tmp/ftc-m2-03-schema-manifest-baseline.log`. The latest Core snapshot has one foreign diagnostic at `test/ftc/ftc-knowledge/m11-01.test.ts:422`, introduced while the M11 writer was still active; M2 has no diagnostics. Schema typecheck is green. Coordinator must rerun Core after M11 stabilization.

## Assertion map

| Test | Behavior caught |
| --- | --- |
| `same project contends while another runs` | Root exclusion, separate-root concurrency despite common host ID, active-chat identity |
| `concurrent different chats and duplicate project views have one canonical owner` | Yielding lookups race real acquisitions; one winner/one busy result; different association/host IDs still share the prepared canonical root and active view |
| `concurrent same-chat claims survive one release and stale or mismatched releases` | Eight yielding concurrent same-chat acquisitions receive eight unique tokens; duplicate/invented/root/chat/Session mismatch releases cannot free keeper claims; old token cannot free successor |
| `rejects chat/session/project/invalid membership without acquiring` | Caller ChatRef is not authority; exact tuple and schema validation precede allocation |
| `rejects identity/directory/workspace ProjectContext mapping` | Association identity and explicit Location mapping validation |
| `interrupted membership lookup allocates no ownership` | Deferred lookup interruption leaves root idle |
| `failure/cancel releases only bracketed caller's claim` | Actual resource finalization releases only unused caller reservation while keeper holds ownership |
| `independent scopes cannot release each other's claims and disposed gate rejects reuse` | Independent instances, cross-instance stale tokens, closed instance rejection, unaffected live scope |
| `public project lookup validates association identity and preserves host identity` | Narrow public lookup, association/host distinction, unknown/mismatched association rejection without Session creation/history access |
| `gate records validate serializable contracts and exact facade identities` | JSON round-trip, busy/acquired variants, token/path rejection, optional property omission, canonical facade identity, stable unique identifiers |
| `scope disposal during validation rejects later acquisition` | A delayed membership lookup cannot resurrect disposed ownership |
| `Session placement failure from validated membership port acquires nothing` | Existing Session placement error propagates before any owner allocation |

Self-review covered each public operation, synchronous ownership atomicity, absence of shared import state, input/result snapshots, narrow port boundary, exact tuple checks, matching-token release and scope closure. Author self-review is not independent review; coordinator owns that review and commit.

## Remaining gates and concerns

- M2-04/05 and M3-02 must compose reservation transfer and terminal release across the full Session coordinator ownership chain, including successor wakes, interruption cleanup, same-chat concurrency and admit-only behavior. Per-drain finalizers or blindly releasing another caller's token would still be wrong. No claim of production execution gating is made here.
- Production host composition must share one gate across relevant windows/Locations. These tests demonstrate task-local independent scopes and prepared canonical records, not that future singleton composition exists.
- Prepared canonical aliases/duplicate views are controlled port fixtures. Actual alias resolution was established by M2-01's covering tests on this host; Windows physical-filesystem/case alias evidence remains a separate platform gate.
- Existing Schema event-manifest baseline failures remain unresolved and out of scope. Latest Core snapshot has the single foreign M11 test diagnostic above; coordinator owns reconciliation after that lane stabilizes.
- Existing Session files were untouched, so blanket Session/provider/external suites and runtime benchmarks were not rerun, as the dispatch brief directs.
- Coordinator must reconcile the exact hashes, independently review and commit the complete owned diff with `feat(ftc): acquire one atomic project execution lease`; only then update shared checklists/progress.

## Coordinator combined-snapshot verification

After all three parallel writers froze their candidates, the coordinator matched all four M2 tested source hashes and reran Core and Schema `bun typecheck`: both exit 0. The transient foreign M11 fixture error is resolved. Combined M2/M4/M11 isolated suites passed at the same snapshot; see [Core tests](parallel-2026-10-06/core-tests.log), [Core types](parallel-2026-10-06/core-typecheck.log) and [Schema types](parallel-2026-10-06/schema-typecheck.log). No M2 implementation changed during this reconciliation.
