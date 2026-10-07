# M6 protected reader native preflight

2026-10-07. Read-only product investigation against the coordinator-supplied `2c2bfc627` baseline and current public reader/inspection/manifest sources. **Local macOS primitives are viable; full M6-03 remains BLOCKED.** This is neither a production adapter nor an implementation review. No product, package, lockfile, Git/index, ledger, host, provider, robot, or user-project files were changed. Probe source/logs are under `docs/validation/m6-reader-preflight/`; the compiled addon is only `/private/tmp/m6-reader-preflight/reader.node`.

## Result and sources

The smallest credible stable integration is a small **Node-API addon**, compiled against native headers, plus an Effect-owned reader wrapper and a public pure manifest-byte decoder. The probe successfully loads the same locally compiled addon in pinned Bun 1.3.14 and installed Node v26.10.0. This establishes that the required native calls can be reached on this machine; it does not establish a shippable addon or support across runtime/OS versions.

- Installed macOS SDK `usr/include/sys/fcntl.h:158,602` supplies `O_NOFOLLOW_ANY` and `openat`. Its `usr/share/man/man2/open.2:103–118,251–258` specifies descriptor-relative resolution and rejection of a symlink in any supplied path component. A single `openat(rootfd, relative, O_NOFOLLOW_ANY | ...)` protects both the leaf and ancestors. Reject absolute paths, NUL, `.` and `..` components first. Ordinary `O_NOFOLLOW` alone protects only the leaf.
- SDK `usr/include/dirent.h:113,134` supplies compiler-selected inode64 `readdir` and `fdopendir`; `usr/share/man/man3/opendir.3:98–125` specifies descriptor ownership transfer to the stream and closure by `closedir`. C compilation avoids hand-written `dirent` offsets and incorrectly bound ABI symbols.
- [Bun FFI documentation](https://bun.sh/docs/runtime/ffi) explicitly calls `bun:ffi` experimental and unsuitable for production, recommending Node-API instead. FFI was not used. [Bun Node-API documentation](https://bun.sh/docs/runtime/node-api) documents loading `.node` files through `require` or `process.dlopen`; this was verified with the pinned runtime, not inferred from current documentation.
- [Node-API documentation](https://nodejs.org/api/n-api.html) describes a stable Node ABI and native asynchronous-work facilities. That stability does not guarantee Bun compatibility or replace platform binaries and tests. [Node filesystem documentation](https://nodejs.org/api/fs.html#fsopendirpath-options-callback) exposes pathname directory opening; it does not provide the needed public `openat`/`fdopendir` combination. Numeric native flags on an absolute Node open do not solve held-root directory listing.

The SDK root used was `/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk`. The local man page also mentions `O_RESOLVE_BENEATH`, but the installed public fcntl header does not define it; this preflight does not rely on it. The previous failed macOS `/dev/fd/<dirfd>/child` experiment remains a rejected alternative. No pathname fallback is proposed.

## Actual probe and evidence

`probe.c` is a deliberately bounded synchronous Node-API v8 probe. `probe.cjs` writes only a fresh fixture beneath `/private/tmp/m6-reader-preflight/`, removes it in `finally`, and drives native calls with deterministic mutations around descriptor acquisition. Only controlled own/foreign sentinel files are read. The probe captures native read/entry counters before rejected calls, asserts unchanged counters, and asserts exact own bytes/names for held-descriptor calls. It does not merely assert an error after possible consumption.

Compilation, from repository root, with already installed Apple clang 21.0.0 and `/opt/homebrew/include/node` headers:

```sh
clang -Wall -Wextra -Werror -DNAPI_VERSION=8 -bundle -undefined dynamic_lookup -I/opt/homebrew/include/node docs/validation/m6-reader-preflight/probe.c -o /private/tmp/m6-reader-preflight/reader.node
```

Compilation exited 0. Each runtime invocation ran from `packages/core`, with `OPENCODE_TEST_HOME` and all four XDG roots explicitly under the task-owned temp directory:

```sh
/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64/bun ../../docs/validation/m6-reader-preflight/probe.cjs
node ../../docs/validation/m6-reader-preflight/probe.cjs
```

Both runs completed **14 checks**, on macOS 26.5.2 (25F84), arm64. Logs: `m6-reader-preflight/bun-probe.log`, `m6-reader-preflight/node-probe.log`. Both final counters: `held: 0, reads: 5, entries: 255`.

| Exercised boundary                                             | Observed behavior                                                                                                                 |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Ordinary read and repeat listing                               | Exact own file bytes and `{ name, type }` entries; repeated listing starts at beginning                                           |
| Leaf becomes external symlink before open                      | Native open rejects; no native read/entry counter change                                                                          |
| Leaf becomes external symlink after open                       | `pread` returns only the original held file bytes                                                                                 |
| Ancestor becomes external symlink before open/list             | Both file and directory open reject; no bytes or names consumed                                                                   |
| Ancestor changes after directory open                          | `fdopendir`/`readdir` list only held own names; relative child read remains own                                                   |
| Manifest path changes after protected read                     | Copied bytes still decode/hash consistently; reopening changed path rejects before reading                                        |
| Absolute, parent, NUL relative input; missing/nonregular input | Reject without content consumption or owned-descriptor growth                                                                     |
| Root renamed and replaced by external symlink                  | Held root inode remains original; own reads/listing remain original; pathname inode differs; new symlink root acquisition rejects |
| Absolute root has a symlink ancestor                           | Acquisition rejects before creating a reader                                                                                      |
| Exception/normal closure and 250 listing cycles                | Temporary descriptors close; OS `/dev/fd` count unchanged; final owned descriptors zero; immediate use after close reports EBADF  |

Enumeration opens `openat(directoryfd, ".", ...)` to obtain a fresh directory offset, then gives that descriptor exclusively to `fdopendir`. A plain `dup` shares the directory offset and is insufficient for independent repeatable enumerations. `closedir` owns stream-fd cleanup. Entry classification uses `fstatat(..., AT_SYMLINK_NOFOLLOW)`; no classification follows an entry outside the held directory.

## Algorithm and ownership needed for production

Acquire the project root once; obtain its device/inode from `fstat` before content operations. Resolve any permitted user alias using metadata only, open its canonical target with all-component no-follow protection, and compare the captured identity before admitting the capability. Later alias/canonical checks may reject root movement/replacement, but never confer authority to reopen content by pathname. All content reads/listings originate at the retained root descriptor. The authority is the directory object held at admission. These primitives do not provide an atomic project snapshot or establish provenance of a normal file/directory moved into the root, and the existing reread/change checks remain relevant.

After protected file open, reject nonregular types using `fstat` before reading. Use `O_NONBLOCK` during acquisition to avoid a FIFO blocking before type rejection. Read in bounded chunks and account for interrupted/short reads and mutation; do not copy the probe's single 64 KiB read into production. Directory enumeration must distinguish missing inputs, unsafe symlinks/special entries, mutation, and I/O failure. The probe skips nonregular listing entries to keep its native surface small; production must expose a conservative unavailable/unsupported result rather than imply absence from silently omitted evidence.

Production ownership must use an opaque native object with closed state, deterministic idempotent release, and an environment finalizer as a backup. Raw numeric descriptors exposed by this probe are not a safe public capability: an old number can be reused for another resource. Keep operation references alive until native work completes; cancellation must stop future work and join or safely retire active work before releasing its descriptors. Effect Scope must acquire/release the root and each operation resource. The controlled JavaScript exception test is **not** real Effect interruption or concurrent native cancellation evidence. Avoid blocking the event loop with an unbounded synchronous scan; use Node-API asynchronous work or another explicitly reviewed scheduling boundary. Test those exact Node-API functions in pinned Bun before adoption.

Missing binary, unverified OS/version/architecture, unsupported flag behavior, or load failure must produce `unsupported_reader`/`reader_unavailable` before content access. Compile-time flag presence alone is insufficient to establish the oldest supported OS; deployment target and runtime behavior require verification. No Windows implementation or support claim follows from POSIX success. Linux component-by-component `openat(O_NOFOLLOW | O_DIRECTORY)` is a possible separate implementation, not a verified artifact of this preflight.

## Protected manifest binding

Current `Inspection` reads `ftc-project.json` through `Project.readFile` but then calls a separate injected `ManifestRepository.readManifest({ root })`. Current `ManifestRepository.current` still uses pathname `realPath`/`readFile` checks; composing that owner with the safe reader would reintroduce prohibited consumption. Matching hashes after the fact is insufficient.

Recommend a narrow public, pure `ManifestSnapshot.decodeRead(bytes: Uint8Array | undefined)` producer, extracted from the manifest owner's existing strict decoder, revision hashing, and missing-file proposal logic. The manifest owner should reuse it to preserve one definition. Inspection must pass the **same copied protected bytes already acquired for its manifest source revision** to this producer; the producer has no filesystem port and starts no owner. Its revision and managed selection derive from that single buffer. True missing input can use `undefined`; unavailable/unsafe input must retain its error/unknown state and cannot masquerade as a missing-manifest initialization proposal.

This requires an explicitly assigned public same-domain contract change to `Inspection.Ports` and the manifest producer, rather than secretly replacing a live owner. Existing `ManifestRepository.Interface.readManifest` can remain for its other consumers. The probe demonstrates same-buffer decode/hash mechanics only with JSON; strict `FtcConfiguration.Manifest` validation, schema-version errors, malformed UTF-8 behavior, consumer mutation capture, and initialization semantics must be tested through the real extracted producer. No protected product manifest binding is delivered here.

## Concrete next assignment and remaining gates

The coordinator should assign ownership of the following before product work; these are proposed files, not changes made here:

1. A native package, for example `packages/inspection-reader-native/{package.json,src/reader.c,script/build.ts,index.ts}`, plus a reproducible native-header source/version policy and platform binary output rules. A direct clang build avoids an extra `node-addon-api` C++ dependency; shipping still needs build tooling, Node-API headers and SDK provenance. Local Homebrew headers are probe inputs, not an acceptable implicit CI dependency. No source generator is intrinsically required.
2. `packages/core/src/ftc/configuration/inspection-filesystem.native.ts` and the required dependency declaration/lock update, with a lazy fail-closed loader and Effect lifecycle/error mapping. Keep Schema dependency direction unchanged. No Protocol/HttpApi change is inherent, so client/legacy SDK generators are not triggered by this proposed adapter alone.
3. A pure public `packages/core/src/ftc/configuration/manifest-snapshot.ts`; surgical edits to existing `manifest.ts` and `inspection.ts`; assigned real-API tests alongside M6-02/M6-03 and native adapter tests. Preserve the independent manifest writer's semantics; this task does not silently certify its pathname writes.
4. Packaging ownership: `packages/opencode/script/build.ts` currently invokes `Bun.build({ compile: ... })` across OS/architectures. Decide and verify addon embedding versus sidecar placement per target. `packages/desktop/scripts/utils.ts` currently copies the CLI executable to resources; an external addon needs additional resource distribution. An embedded addon still needs an actual packaged load test, minimum-OS matrix, signing/notarization checks where applicable, and clean-machine launch validation. These are later assigned gates; no product build or app was run here.
5. Real native integration tests must reproduce the sentinel attacks through public `Inspection`, cover aliases/root replacement and mutable entries, closed-owner/fd reuse, successful/error/interrupted cleanup, repeated concurrent calls and actual same-byte manifest validation. Then run package-local focused M6 checks, typechecks and lint. Platform CI must exercise each claimed OS/architecture/runtime and packaged artifact; Windows remains explicitly unsupported until its own handle/reparse-point-safe implementation and runner evidence exist.

Alternative: retain the required injected capability and keep M6-03 blocked until native package/build ownership is available. A native subprocess could also implement descriptor authority, but would add process/protocol/lifetime packaging and contradict the current no-process inspection boundary without a new ruling; it is not the smallest authorized route. Bun FFI, absolute-path rereads, and unsafe existing manifest-owner composition are not production alternatives.

This preflight resolves primitive availability on the actual local macOS/Bun combination. It does not resolve production ownership, cancellation, public manifest binding, distribution, platform support, or full M6-03 acceptance.
