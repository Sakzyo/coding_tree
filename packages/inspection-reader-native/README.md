# Protected inspection reader

Internal workspace infrastructure for FTC read-only inspection. No Core, Schema, or Effect runtime dependency; no subprocess read protocol, FFI, pathname content fallback, or import-time I/O.

`load()` lazily loads a fixed native artifact. Current verified combination: macOS 26.5.2 build 25F84 / Darwin 25.5.0, arm64, Bun 1.3.14. Other operating systems, architectures, runtime versions, and macOS builds fail `unsupported_reader`; absent/unloadable artifacts fail `reader_unavailable`. Windows remains required for the first release and is **unimplemented/unverified**, not removed from scope. The preflight's Node comparison is not product runtime certification.

Build locally with already installed, explicitly supplied Node 26.10.0 C headers:

```sh
PATH=/private/tmp/ftc-bun-1.3.14/bun-darwin-aarch64:$PATH bun run build /opt/homebrew/include/node
```

The script verifies hashes of all Node-API input headers and Node version header, the Apple clang 21.0.0 build, and macOS SDK 26.5 build 25F70. It records compiler, SDK, header/source dependency hashes, deployment target, artifact digest, host and command in ignored `dist/build.json`. Deployment target 26.5 is a compiler input, **not evidence of a supported minimum OS**. Homebrew is a verified local input source only: future CI needs an assigned, pinned header artifact and runner; the script never installs/downloads anything.

`dist/reader.node` is ignored build output. Source-mode loading uses that location; an isolated Bun compiled executable uses `inspection-reader.node` beside its executable. The task's compiled-driver test verifies only that arrangement. Actual OpenCode and desktop copy/signing/clean-machine distribution remain M1-14 gates; their scripts are unchanged.

The native boundary returns opaque tagged root/file/directory resources and cancellable jobs. It validates relative components before native access, resolves any initial root alias by metadata, retains the canonical directory descriptor and inode, and uses `openat(O_NOFOLLOW_ANY)` for all relative content acquisition. `verify` checks current alias/canonical inode identity through metadata only. It never redirects held content. This is directory-object authority, not an atomic snapshot or provenance proof for ordinary objects moved into that directory.

Each file read is at most 64 KiB; each directory listing is at most 128 entries, on Node-API asynchronous work. Nonregular objects and symlinks fail visibly. Files use nonblocking open before type checks and snapshot metadata checks around reads. A new directory open owns a fresh listing offset. File/directory handles allow one active operation; root opens/verifications may run concurrently. Closing marks the resource closed, cancels and joins active native work, then releases its descriptor once. Finalizers are backups; active-work references prevent collection and descriptor reuse. Raw descriptor numbers never leave C. `cancel()` stops pending work or requests retirement of active bounded work; its promise settles only after the completion callback. No product cancellation deadline is promised.

Core owns Effect Scope composition and the pure manifest decoder. See `docs/validation/M6-03-native-implementation.md` for exact tests, cancellation runtime workaround, and remaining gates.
