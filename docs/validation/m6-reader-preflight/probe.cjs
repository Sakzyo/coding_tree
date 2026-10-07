// Probe only. All writes affect a freshly created /private/tmp fixture.
const assert = require("node:assert/strict")
const fs = require("node:fs")
const { createHash } = require("node:crypto")
const native = require("/private/tmp/m6-reader-preflight/reader.node")
const base = fs.mkdtempSync("/private/tmp/m6-reader-preflight/run-")
const root = `${base}/project`,
  foreign = `${base}/foreign`
const descriptors = new Set()
const acquire = (fd) => {
  descriptors.add(fd)
  return fd
}
const close = (fd) => {
  native.close(fd)
  descriptors.delete(fd)
}
const open = (fd, name, directory = false) => acquire(native.relative(fd, name, directory))
const file = (fd, name) => {
  const next = open(fd, name)
  try {
    return native.read(next)
  } finally {
    close(next)
  }
}
const list = (fd, name) => {
  const next = open(fd, name, true)
  try {
    return native.list(next)
  } finally {
    close(next)
  }
}
let checks = 0
const check = (name, body) => {
  body()
  checks++
  console.log(`PASS ${name}`)
}
try {
  fs.mkdirSync(`${root}/TeamCode`, { recursive: true })
  fs.mkdirSync(foreign)
  fs.writeFileSync(`${root}/build.gradle`, "OWN_BYTES")
  fs.writeFileSync(`${root}/TeamCode/Own.java`, "OWN_JAVA")
  fs.writeFileSync(`${foreign}/build.gradle`, "FOREIGN_BYTES")
  fs.writeFileSync(`${foreign}/Foreign.java`, "FOREIGN_JAVA")
  fs.writeFileSync(`${root}/ftc-project.json`, '{"schemaVersion":1,"hardware":[],"managedPathing":"neither"}\n')
  const fd = acquire(native.root(root))
  const identity = fs.fstatSync(fd, { bigint: true })
  check("ordinary protected read and actual repeatable list", () => {
    assert.equal(file(fd, "build.gradle").toString(), "OWN_BYTES")
    assert.deepEqual(list(fd, "TeamCode"), [{ name: "Own.java", type: "file" }])
    assert.deepEqual(list(fd, "TeamCode"), [{ name: "Own.java", type: "file" }])
  })
  check("leaf retarget before open consumes no bytes", () => {
    fs.renameSync(`${root}/build.gradle`, `${root}/build.saved`)
    fs.symlinkSync(`${foreign}/build.gradle`, `${root}/build.gradle`)
    const before = native.counters()
    assert.throws(() => file(fd, "build.gradle"), /openat/)
    assert.deepEqual(native.counters(), before)
  })
  check("leaf retarget after open reads original held object", () => {
    fs.unlinkSync(`${root}/build.gradle`)
    fs.renameSync(`${root}/build.saved`, `${root}/build.gradle`)
    const leaf = open(fd, "build.gradle")
    fs.renameSync(`${root}/build.gradle`, `${root}/build.saved`)
    fs.symlinkSync(`${foreign}/build.gradle`, `${root}/build.gradle`)
    assert.equal(native.read(leaf).toString(), "OWN_BYTES")
    close(leaf)
  })
  check("ancestor retarget before file open or directory listing consumes neither", () => {
    fs.renameSync(`${root}/TeamCode`, `${root}/TeamCode.saved`)
    fs.symlinkSync(foreign, `${root}/TeamCode`)
    const before = native.counters()
    assert.throws(() => file(fd, "TeamCode/Foreign.java"), /openat/)
    assert.throws(() => list(fd, "TeamCode"), /openat/)
    assert.deepEqual(native.counters(), before)
  })
  check("ancestor retarget after directory open lists only held own names", () => {
    fs.unlinkSync(`${root}/TeamCode`)
    fs.renameSync(`${root}/TeamCode.saved`, `${root}/TeamCode`)
    const directory = open(fd, "TeamCode", true)
    fs.renameSync(`${root}/TeamCode`, `${root}/TeamCode.saved`)
    fs.symlinkSync(foreign, `${root}/TeamCode`)
    assert.deepEqual(native.list(directory), [{ name: "Own.java", type: "file" }])
    assert.equal(file(directory, "Own.java").toString(), "OWN_JAVA")
    close(directory)
  })
  check("manifest is a copied held-root buffer, decoder and revision use same bytes", () => {
    const bytes = file(fd, "ftc-project.json")
    fs.renameSync(`${root}/ftc-project.json`, `${root}/manifest.saved`)
    fs.symlinkSync(`${foreign}/build.gradle`, `${root}/ftc-project.json`)
    const result = {
      revision: createHash("sha256").update(bytes).digest("hex"),
      manifest: JSON.parse(bytes.toString()),
    }
    assert.equal(result.manifest.managedPathing, "neither")
    assert.equal(
      result.revision,
      createHash("sha256")
        .update(fs.readFileSync(`${root}/manifest.saved`))
        .digest("hex"),
    )
    const before = native.counters()
    assert.throws(() => file(fd, "ftc-project.json"), /openat/)
    assert.deepEqual(native.counters(), before)
  })
  check("parent, absolute, and NUL relative paths fail before consumption", () => {
    const before = native.counters()
    for (const relative of ["../foreign/build.gradle", "/etc/passwd", "build.saved\0ignored"]) {
      assert.throws(() => file(fd, relative), /input|component/)
    }
    assert.deepEqual(native.counters(), before)
  })
  check("nonregular file is rejected before reading", () => {
    const before = native.counters()
    assert.throws(() => file(fd, "TeamCode.saved"), /type/)
    assert.deepEqual(native.counters(), before)
  })
  check("missing input opens no resource and consumes no bytes", () => {
    const before = native.counters()
    assert.throws(() => file(fd, "absent"), /errno=2 /)
    assert.deepEqual(native.counters(), before)
  })
  check("root replacement cannot redirect held-root reads or names", () => {
    fs.renameSync(root, `${base}/held-project`)
    fs.symlinkSync(foreign, root)
    assert.equal(file(fd, "build.saved").toString(), "OWN_BYTES")
    assert.deepEqual(list(fd, "TeamCode.saved"), [{ name: "Own.java", type: "file" }])
    assert.equal(fs.fstatSync(fd, { bigint: true }).ino, identity.ino)
    assert.notEqual(fs.statSync(root, { bigint: true }).ino, identity.ino)
    const before = native.counters()
    assert.throws(() => native.root(root), /root open/)
    assert.deepEqual(native.counters(), before)
  })
  check("root absolute ancestor symlink is rejected before acquisition", () => {
    fs.symlinkSync(`${base}/held-project`, `${base}/alias`)
    const before = native.counters()
    assert.throws(() => native.root(`${base}/alias/TeamCode.saved`), /root open/)
    assert.deepEqual(native.counters(), before)
  })
  check("exception cleanup releases temporary descriptors", () => {
    const before = native.counters().held
    const leaf = open(fd, "build.saved")
    try {
      throw new Error("controlled interruption boundary")
    } catch {
    } finally {
      close(leaf)
    }
    assert.equal(native.counters().held, before)
  })
  check("repeated directory acquisition and listing do not leak OS descriptors", () => {
    list(fd, "TeamCode.saved")
    const before = fs.readdirSync("/dev/fd").length
    for (let i = 0; i < 250; i++) list(fd, "TeamCode.saved")
    assert.equal(fs.readdirSync("/dev/fd").length, before)
    assert.equal(native.counters().held, 1)
  })
  close(fd)
  check("closed root rejects and final owned descriptor count is zero", () => {
    assert.throws(() => file(fd, "build.saved"), /errno=9 /)
    assert.equal(native.counters().held, 0)
  })
  console.log(
    JSON.stringify({
      runtime: process.versions.bun ? `Bun ${process.versions.bun}` : `Node ${process.version}`,
      platform: process.platform,
      arch: process.arch,
      checks,
      counters: native.counters(),
    }),
  )
} finally {
  for (const fd of descriptors) native.close(fd)
  fs.rmSync(base, { recursive: true, force: true })
}
