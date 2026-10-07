# M6-03 native reader independent task review

## Spec compliance

**Issues found.** The available macOS adapter implements the requested held-object authority and same-byte manifest binding, but public Inspection owner closure still hangs during an active native read. Full M6-03 also remains incomplete because the required Windows counterpart is unimplemented. These are separate findings; acknowledging the Windows gate is not a platform waiver.

Reviewed frozen range `85a83e997..78e1c576e` through `.superpowers/sdd/progress/review-85a83e997..78e1c576e.diff`. Read all product, test, dependency and build hunks once. Requirements: `M6-03-native-brief.md:13–31,37–40`; claims: `M6-03-native-implementation.md`. This is a task-scoped review, not a whole-branch or release review.

## Strengths

- Native authority stays with captured descriptors: `packages/inspection-reader-native/src/reader.c:110–164` resolves an initial alias, captures inode/device, derives file/directory opens through held-root `openat` with `O_NOFOLLOW_ANY`, reads with `pread`, and enumerates a compiler-defined `DIR`. Metadata verification never redirects content acquisition. Relative-path rejection is at `reader.c:62–71`; nonblocking regular-file validation is at `reader.c:127–136`. No FFI, subprocess reader, JavaScript ABI layout or pathname content fallback appears in the product hunks.
- Opaque resource validation and lifetime handling are explicit at `reader.c:79–109,166–248`: tagged wrapped objects, kind checks, closed state, active job references, cancel-and-retire close, idempotent descriptor release, backup finalizers, and separate ownership for escaped cancellation functions. Fixed read/list bounds are at `reader.c:18–19,140–161`. Core yields during accumulated chunk copying at `packages/core/src/ftc/configuration/inspection-filesystem.native.ts:58–81`.
- Loading is lazy and fixed-location at `packages/inspection-reader-native/index.ts:27–46`; unsupported OS/architecture/Bun/kernel combinations reject, and addon initialization checks build `25F84` at `reader.c:250–260`. The explicit header hashes, compiler/SDK pins, deployment input and build record appear at `script/build.ts:5–104`. The package has no Core/Schema/Effect runtime dependencies (`package.json:1–18`); Core adds only its workspace dependency, and the lock diff adds 11 lines without existing version changes.
- `packages/core/src/ftc/configuration/manifest-snapshot.ts:13–59` provides one synchronous public producer with copied bytes, original-byte hashing, strict schema/version checks and the explicitly preserved nonfatal UTF-8 decoder. `manifest.ts:105,120,127` reuses it; writer publication logic is unchanged. `inspection.ts:25,174–187` captures the producer and feeds the protected bytes, while unavailable/changed input cannot become a missing-file initialization proposal.
- Actual native tests cover held authority, alias/root replacement, forbidden paths, special entries, closed/forged handles, descriptor reuse, cancellation, batch boundaries and backup finalization (`packages/inspection-reader-native/test/reader.test.ts:6–191`). Actual public Inspection retarget tests and same-byte binding tests are at `packages/core/test/ftc/ftc-configuration-and-libraries/m6-native.test.ts:90–254`. Existing manifest writer tests remain green in `m6-03-native/core-green.log:3–27`.

## Issues

### Critical

None identified in the reviewed range.

### Important

1. **Public Inspection owner closure hangs after native resources retire.** `packages/core/src/ftc/configuration/inspection.ts:272–274` retains `Effect.forkIn(scope)` followed by synchronous `Fiber.join`. The new adapter works around the pinned Effect beta.83 observer-removal issue only inside its own `join` (`inspection-filesystem.native.ts:130–137`). Closing the enclosing Inspection owner therefore still loses a completion notification when the real asynchronous read retires. The native regression at `m6-native.test.ts:53–88` exercises the adapter owner directly and does not exercise this enclosing owner. One focused public-API probe reproduced the hang: active native file observed; owner closure requested; descriptors returned from active usage to baseline 5; `Scope.close` never completed in the 1-second diagnostic window. This violates brief `:17,29`, even though descriptor authority remains safe. Apply the local deferred-observer join at the Inspection lifecycle boundary without modifying Effect/global state, and add a regression that closes the actual Inspection owner during a real native read; retain caller-interruption and escaped-owner assertions. The diagnostic window is test evidence, not a product cancellation deadline.

2. **The full first-version task still lacks Windows native software.** `packages/inspection-reader-native/index.ts:29–34` rejects Windows and `src/reader.c:14–16` supports only the macOS arm64 implementation. Brief `:18,37` explicitly retains Windows; implementation report `:71` acknowledges that its counterpart and runner are unimplemented/unverified. This is a full-task requirement gap, not a defect in fail-closed platform handling or permission to broaden this stop-time patch. Keep overall M6-03 unchecked. Assign and implement a real handle/reparse-point-safe Windows counterpart and its validation before claiming full software completion; do not treat the existing macOS result as a waiver.

### Minor

None requiring a separate change in this scoped review.

## Evidence and focused check

- Read recorded final runs, without rerunning them: `m6-03-native/core-green.log:140–143` (75 tests / 267 assertions); `schema-green.log:22–25` (13 / 19); `native-green.log:11–14` (6 / 299). Package-local typecheck logs and scoped lint/format logs report the supplied successful checks. Final test logs show no unexpected warnings or failures; historical RED/debug failures are retained as chronological evidence, not final-run failures.
- Read `m6-03-native/compiled-driver.ts:1–22` and compiled import/missing/loaded logs: isolated compiled-driver import is lazy, acquisition without the sidecar reports `reader_unavailable`, and the installed sidecar returns `OWN`. This does not establish actual app distribution.
- Build record `m6-03-native/build.log` identifies C source SHA256 `6d4c172dc1b98b9a1be678fb6bf3828ca6c2e5ac7dfe376827bc3a2a32e6f71f` and artifact SHA256 `1a718b6b78547bdd56b61a9d568222131cd0ea445c617c096d21831b48fae803`. The coordinator supplied independent verification of all 16 source hashes and the actual ignored binary against this record; this review did not rebuild or replace that artifact.
- Named outside-hunk risk: the changed manifest port's enclosing Inspection ownership could retain the same synchronous join defect documented by the new adapter. The diff cuts off the enclosing function, so the focused additional read was `inspection.ts:25–278`, including copied-byte handling and the owner join. This yielded Important finding 1. No broader code crawl or Git command was used.
- One focused runtime probe, from `packages/core`, used `/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun run -`, with `OPENCODE_TEST_HOME=/private/tmp/m6-native-review-home` and all four XDG roots (`config`, `data`, `cache`, `state`) beneath it. The probe created one fresh `/private/tmp/m6-native-review-*` fixture, made `build.gradle` a 256 MiB sparse file, warmed the real reader once, then ran the body below. It removed only its fixture and exited 1. No app/server/provider/robot, installs or network operations ran.

```ts
const baseline = (await fs.readdir("/dev/fd")).length
const trace = []
const result = Effect.runPromise(Effect.gen(function* () {
  const scope = yield* Scope.make()
  const owner = yield* Inspection.make({
    reader: NativeInspectionFilesystem.make(),
    manifest: ManifestSnapshot,
  }).pipe(Scope.provide(scope))
  const reading = yield* Effect.forkChild(owner.inspectProject({ root: base }))
  yield* Effect.promise(async () => {
    const end = Date.now() + 500
    while ((await fs.readdir("/dev/fd")).length < baseline + 2) {
      if (Date.now() > end) throw new Error("active file not observed")
      await Bun.sleep(1)
    }
  })
  trace.push("active-native-file-observed", "close-requested")
  yield* Scope.close(scope, Exit.void)
  trace.push("scope-closed")
  const exit = yield* Fiber.await(reading)
  trace.push(exit._tag)
})).then(() => "completed", error => String(error))
const outcome = await Promise.race([
  result,
  Bun.sleep(1000).then(() => "not-completed-in-diagnostic-window"),
])
```

Observed stdout:

```json
{"runtime":"1.3.14","outcome":"not-completed-in-diagnostic-window","trace":["active-native-file-observed","close-requested"],"baseline":5,"finalDescriptors":5}
```

## Assessment

**Task quality: Needs fixes.** The available native authority, byte producer and resource retirement implementation have substantial relevant coverage, but the public owner lifecycle does not yet fulfill the cancellation contract. Fix finding 1 and verify that precise integration before accepting the available macOS follow-on.

**Full-task spec verdict: Incomplete.** Finding 2 keeps overall M6-03 open independently of the macOS repair. Actual OpenCode/desktop sidecar build/copy/signing/notarization/clean-machine tests (M1-14), pinned CI header sourcing, other platform/runtime qualification, downstream composition and robot acceptance remain unverified, as reported at `M6-03-native-implementation.md:71`; this review supplies no release or platform certification.

## Scoped re-review — fix round 1, `78e1c576e..92d24fa56`

**I1: ADDRESSED. Available macOS follow-on spec verdict: Compliant within the explicitly verified platform scope. Available macOS follow-on quality verdict: Approved.** This verdict supersedes the initial macOS lifecycle rejection above; the initial reproduction remains historical evidence.

- The repair moves the original adapter workaround unchanged into the single same-domain `InspectionLifecycle.join` (`packages/core/src/ftc/configuration/inspection-lifecycle.ts:1–12`). Both ownership boundaries now use it: `inspection-filesystem.native.ts:38` and `inspection.ts:274`. Observer delivery is deferred until notification iteration finishes; the existing resource acquisition/release chain is preserved. No runtime/global patch, alternate reader, new service or additional native resource owner is introduced.
- The new public regression (`packages/core/test/ftc/ftc-configuration-and-libraries/m6-native.test.ts:256–297`) exercises actual `Inspection.make` with the actual native adapter. It observes active native descriptors, tests caller interruption and subsequent owner reuse, closes the enclosing owner during another native read, checks interrupted exits and descriptor baseline, and rejects the escaped owner. `m6-03-native/fix1-red.log:3–23` reproduces the original lost notification before repair; `fix1-focused-green.log:3–10` verifies the repaired case.
- The additional public overlap regression (`m6-native.test.ts:299–334`) releases a `Deferred` gate to caller interruption and owner closure while the real native file is active. Both operations must join, descriptors must retire and the escaped owner must reject. The recorded focused result (`fix1-overlap-initial.log:3–10`) and final combined run (`fix1-core-green.log:139–145`) pass. The final run is 77 tests / 279 assertions, with zero failures; it supersedes the earlier 76-test freeze as explicitly recorded in the appended implementation report.
- Named focused outside-diff check: could retained `Fiber.interrupt` repeat the observer-removal defect during overlapping closure? Read only the relevant pinned runtime definitions in `packages/core/node_modules/effect/src/internal/effect.ts:723–775,814–837,1012–1070`. `fiberInterruptAs` awaits `fiberAwait`, which resumes a success containing the Exit; the interrupt-only `AsyncFinalizer` cleanup is therefore distinct from synchronous failure-forwarding `fiberJoin`. This supports retaining the release operation, and the real overlap regression covers the public composition. No additional probe was warranted.
- Read the repair's recorded package-local typecheck, zero-warning/zero-error scoped lint and successful formatting logs. `fix1-source-files.txt` and `fix1-source-sha256.log` identify the five-file final freeze. `fix1-native-identity.log:1–2` retains C source SHA256 `6d4c172dc1b98b9a1be678fb6bf3828ca6c2e5ac7dfe376827bc3a2a32e6f71f` and compiled-addon SHA256 `1a718b6b78547bdd56b61a9d568222131cd0ea445c617c096d21831b48fae803`; the coordinator independently verified those identities and the final repair hashes. Native C/build/loader/package and manifest producer behavior were not changed by this repair.

**New Critical/Important repair findings: None.** Read the scoped repair diff and appended report; no successful suites were rerun, and no product, Git/index or ledger mutation was performed by this reviewer.

**I2: OPEN. Full M6-03 spec verdict: Incomplete.** The Windows native counterpart remains missing software. Keep overall M6-03 unchecked. Actual host distribution/signing/clean-machine, broader platform/runtime and robot acceptance gates remain unverified; this scoped approval does not waive them or authorize starting that work under the user's stop instruction.
