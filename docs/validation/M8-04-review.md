# M8-04 independent review

Reviewer `/root/m8_04_review`, 2026-10-06. Base `4a915eacb41f15bd54cb4617df08b4c181222f6a` through evidence head `3e9a64ca554408608ef6078c2e154123f3f687ad`. [Full stable package](M8-04-review.diff).

Initial review: **Issues found in available-host subset; needs fixes.** Final fix-1 review below approves the available subset. Full task remains BLOCKED.

## Strengths

Scoped forwarding uses explicit targets, ephemeral ports/no rebinding, registered finalizers, invalid/duplicate-port rejection and visible cleanup failures (`controllers/adb.ts:86–131`). Actual loopback HTTP/gzip/WebSocket/TCP tests cover handshake failure and isolated targets (`m8-04.test.ts:18–92`). Documentation separates incoming-frame rejection from outbound authority and rejects raw-forward read-only security claims (`controller-protocol.md:45–55`). M8-01 remains unchanged and its regressions are retained (`regressions-29be4123a.log:59–91`).

## Important: reject plugin strings that violate the canonical evidence contract

`packages/core/src/ftc/controllers/panels.ts:182–185` validates plugin IDs and versions with Schema.NonEmptyString, while `packages/schema/src/ftc-controller.ts:6,69–71` requires trimmed text. Matching manifest/config versions of `" "` pass validation and return successfully at panels.ts:98–103, but the returned value fails FtcController.ProtocolEvidence. Unknown plugin IDs containing whitespace can similarly enter blockedPlugins.

Malformed remote metadata must not become an invalid canonical success value. Apply canonical text constraints at the decoding boundary; add regressions for whitespace-only and surrounding-whitespace IDs/versions. Reject malformed declarations rather than normalizing them.

Focused in-memory reproduction from packages/core used pinned Bun `-e`, changed fixture manifest/config version to `" "`, called Panels.readEndpoints and checked Schema.is(FtcController.ProtocolEvidence). Exit 0, result: `{"acceptedVersion":" ","canonicalValid":false}`.

## Minor, deferred: acquisition-interruption coverage

`packages/core/test/ftc-adapters/controller-endpoints.test.ts:83–108` interrupts after both forwards have been acquired. It covers disposal, not interruption while acquisition is pending. Add a bounded delayed-acquisition case when validating the host transport contract. `adb.ts:118–121` uses Effect.acquireRelease, whose acquisition is uninterruptible, so host completion must be bounded. Carry this to final review and real host-transport validation.

## Review checks and limits

No Critical findings. Reviewer read the full package, no Git operations/mutations/subagents/suite reruns. Outside-diff inspection of pinned socket/new-client source found immediate synthetic core/time covers only a selected subset; actual plugin connection-time traffic is correctly unevaluated. Recorded final output: evaluation 3 pass/5 skip, regressions 85 pass/14 skip, clean Core/Schema types, lint 0 warnings/errors and formatting clean. Prior sandbox failures/resolved warnings remain recorded.

Available subset needs the canonical-validation fix before approval. Full M8-04 stays BLOCKED by real-controller/Windows/production ADB ownership and cleanup, actual resource graph, identity, logs, freshness and dashboard mediation (`controller-protocol.md:57–69`).

## Fix round 1 — approved

Same reviewer `/root/m8_04_review` inspected fix `3e9a64ca554408608ef6078c2e154123f3f687ad`..`7c11931c2a5af1f711dd2d584d15727259141398`, using [fix-only package](M8-04-fix1-review.diff). Canonical plugin-declaration validation **ADDRESSED**: `panels.ts:182–187` enforces nonempty/trimmed IDs, versions and frontend versions without normalization. Eight regressions cover whitespace-only/surrounding whitespace and unknown IDs (`controller-endpoints.test.ts:389–409`).

Specification and quality: **Approved for fix and available-host subset.** No new Critical/Important/Minor breakage or out-of-scope findings. Reviewed RED eight failures, GREEN eight passes/16 assertions, covering 87 pass/5 skip/0 fail, clean Core types/lint/format. No reruns, Git operations or mutations. Prior Minor pending-acquisition coverage remains deferred; full task remains BLOCKED on the listed real-system gates.
