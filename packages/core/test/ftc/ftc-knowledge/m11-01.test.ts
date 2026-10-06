import { expect, test } from "bun:test"
import { FtcKnowledge } from "@opencode-ai/schema"
import { ContentRecord } from "@opencode-ai/schema/ftc-knowledge"
import { Schema } from "effect"
import { validatePack } from "../../../src/ftc/knowledge"
import { Hash } from "../../../src/util/hash"

// Entirely synthetic: these ranges, sources and snippets establish no SDK/library support.
const codeTokens = ['hardwareMap.get(DcMotor.class, "fixture_motor")', "invalid_content"]
const fixture = (language: "en" | "zh") => {
  const content = JSON.stringify({
    id: "synthetic-lesson",
    version: "1.0.0",
    language,
    body: `${language === "en" ? "Synthetic example" : "合成示例"}:\n\`\`\`java\n${codeTokens[0]}\n\`\`\`\n\`${codeTokens[1]}\``,
  })
  return {
    record: {
      id: "synthetic-lesson",
      version: "1.0.0",
      language,
      topic: "synthetic-topic",
      sdkRange: ">=1.0.0 <2.0.0",
      source: "https://fixtures.invalid/synthetic-lesson",
      license: "synthetic-fixture-license",
      localPath: `${language}/synthetic-lesson.json`,
      digest: Hash.sha256(content),
      provenance: "synthetic" as const,
      codeTokens,
    },
    file: { localPath: `${language}/synthetic-lesson.json`, bytes: Array.from(new TextEncoder().encode(content)) },
  }
}
const pack = () => {
  const en = fixture("en")
  const zh = fixture("zh")
  return { manifest: { kind: "synthetic" as const, records: [en.record, zh.record] }, files: [en.file, zh.file] }
}
const error = (input: unknown, reason: FtcKnowledge.PackError["reason"]) => {
  const result = validatePack(input)
  expect(result.kind).toBe("invalid")
  if (result.kind !== "invalid") throw new Error("Expected invalid synthetic content")
  const found = result.errors.find((entry) => entry.reason === reason)
  expect(found).toBeDefined()
  if (!found) throw new Error(`Missing reason: ${reason}`)
  expect(found.code).toBe("invalid_content")
  return found
}

test("translation pair preserves stable IDs and code tokens", () => {
  const result = validatePack(pack())
  expect(result.kind).toBe("valid")
  if (result.kind !== "valid") throw new Error("Expected a valid synthetic pack")
  const en = result.records[0]
  const zh = result.records[1]
  expect(en.id).toBe(zh.id)
  expect(en.version).toBe(zh.version)
  expect(en.codeTokens).toEqual(zh.codeTokens)
  const input = pack()
  const missingSource = error(
    {
      ...input,
      manifest: { ...input.manifest, records: input.manifest.records.map((record) => ({ ...record, source: "" })) },
    },
    "missing_source",
  )
  expect(missingSource.code).toBe("invalid_content")
})

test.each(["source", "license"] as const)("rejects missing or whitespace %s", (field) => {
  for (const value of [undefined, "", " "]) {
    const input = pack()
    error(
      {
        ...input,
        manifest: {
          ...input.manifest,
          records: [{ ...input.manifest.records[0], [field]: value }, input.manifest.records[1]],
        },
      },
      field === "source" ? "missing_source" : "missing_license",
    )
  }
})

test("requires each declared file and rejects duplicate file paths", () => {
  const input = pack()
  expect(error({ ...input, files: input.files.slice(1) }, "missing_file").language).toBe("en")
  error({ ...input, files: [...input.files, input.files[0]] }, "duplicate_file")
})

test("rejects duplicate id/version/language but permits separate paired versions", () => {
  const input = pack()
  error(
    { ...input, manifest: { ...input.manifest, records: [...input.manifest.records, input.manifest.records[0]] } },
    "duplicate_id",
  )
  const next = input.manifest.records.map((record, index) => {
    const document = JSON.parse(new TextDecoder().decode(Uint8Array.from(input.files[index].bytes)))
    const content = JSON.stringify({ ...document, version: "2.0.0" })
    return {
      record: { ...record, version: "2.0.0", localPath: `${record.language}/v2.json`, digest: Hash.sha256(content) },
      file: { localPath: `${record.language}/v2.json`, bytes: Array.from(new TextEncoder().encode(content)) },
    }
  })
  expect(
    validatePack({
      manifest: { kind: "synthetic", records: [...input.manifest.records, ...next.map((value) => value.record)] },
      files: [...input.files, ...next.map((value) => value.file)],
    }).kind,
  ).toBe("valid")
})

test("requires the translation with the same stable id and version", () => {
  const input = pack()
  error(
    { ...input, manifest: { ...input.manifest, records: input.manifest.records.slice(0, 1) } },
    "missing_translation",
  )
  for (const change of [{ id: "changed-id" }, { version: "2.0.0" }]) {
    error(
      {
        ...input,
        manifest: {
          ...input.manifest,
          records: [input.manifest.records[0], { ...input.manifest.records[1], ...change }],
        },
      },
      "missing_translation",
    )
  }
})

test("digest is checked against actual injected bytes", () => {
  const input = pack()
  error(
    { ...input, files: [{ ...input.files[0], bytes: [...input.files[0].bytes, 32] }, input.files[1]] },
    "digest_mismatch",
  )
  error(
    {
      ...input,
      manifest: {
        ...input.manifest,
        records: [{ ...input.manifest.records[0], digest: "0".repeat(64) }, input.manifest.records[1]],
      },
    },
    "digest_mismatch",
  )
})

test.each([undefined, "", "bogus"])("rejects malformed digest %j", (digest) => {
  const input = pack()
  error(
    {
      ...input,
      manifest: { ...input.manifest, records: [{ ...input.manifest.records[0], digest }, input.manifest.records[1]] },
    },
    "invalid_record",
  )
})

test.each([undefined, "", "not-a-range", ">=2.0.0 <1.0.0"])(
  "rejects invalid or empty SDK applicability %j",
  (sdkRange) => {
    const input = pack()
    error(
      {
        ...input,
        manifest: { ...input.manifest, records: input.manifest.records.map((record) => ({ ...record, sdkRange })) },
      },
      "invalid_range",
    )
  },
)

test("library applicability requires both library and satisfiable library range", () => {
  for (const fields of [
    { library: "synthetic-library" },
    { libraryRange: "^1.0.0" },
    { library: "synthetic-library", libraryRange: ">2.0.0 <1.0.0" },
    { library: "synthetic-library", libraryRange: "" },
  ]) {
    const input = pack()
    error(
      {
        ...input,
        manifest: { ...input.manifest, records: input.manifest.records.map((record) => ({ ...record, ...fields })) },
      },
      "invalid_range",
    )
  }
  const input = pack()
  expect(
    validatePack({
      ...input,
      manifest: {
        ...input.manifest,
        records: input.manifest.records.map((record) => ({
          ...record,
          library: "synthetic-library",
          libraryRange: "^1.0.0",
        })),
      },
    }).kind,
  ).toBe("valid")
})

test("translation pairs preserve applicability and declared code tokens", () => {
  const input = pack()
  error(
    {
      ...input,
      manifest: {
        ...input.manifest,
        records: [input.manifest.records[0], { ...input.manifest.records[1], sdkRange: "^2.0.0" }],
      },
    },
    "translation_mismatch",
  )
  error(
    {
      ...input,
      manifest: {
        ...input.manifest,
        records: [input.manifest.records[0], { ...input.manifest.records[1], codeTokens: ["translated_API"] }],
      },
    },
    "translation_mismatch",
  )
})

test("actual content identifier drift fails even with a freshly matching digest", () => {
  for (const [from, to] of [
    ["hardwareMap.get", "硬件映射.get"],
    ["fixture_motor", "合成电机"],
    ["invalid_content", "内容无效"],
    ["DcMotor", "电机类"],
  ]) {
    const input = pack()
    const content = new TextDecoder().decode(Uint8Array.from(input.files[1].bytes)).replace(from, to)
    error(
      {
        manifest: {
          ...input.manifest,
          records: [input.manifest.records[0], { ...input.manifest.records[1], digest: Hash.sha256(content) }],
        },
        files: [input.files[0], { ...input.files[1], bytes: Array.from(new TextEncoder().encode(content)) }],
      },
      "identifier_mismatch",
    )
  }
})

test.each([
  ['"id":"synthetic-lesson"', '"id":"changed-id"'],
  ['"version":"1.0.0"', '"version":"2.0.0"'],
  ['"language":"zh"', '"language":"en"'],
])("actual document identity is checked instead of trusting manifest declarations %s", (from, to) => {
  const input = pack()
  const content = new TextDecoder().decode(Uint8Array.from(input.files[1].bytes)).replace(from, to)
  error(
    {
      manifest: {
        ...input.manifest,
        records: [input.manifest.records[0], { ...input.manifest.records[1], digest: Hash.sha256(content) }],
      },
      files: [input.files[0], { ...input.files[1], bytes: Array.from(new TextEncoder().encode(content)) }],
    },
    "identity_mismatch",
  )
})

test.each([{ record: null }, { record: [] }, { record: "record" }])("rejects malformed record %j", (entry) => {
  const input = pack()
  error({ ...input, manifest: { ...input.manifest, records: [entry.record] } }, "invalid_record")
})

test.each([undefined, null, {}, { manifest: { kind: "unsupported", records: [] }, files: [] }])(
  "rejects malformed pack %j",
  (input) => {
    error(input, "invalid_input")
  },
)

test.each(["latest", "1", "not-a-version"])("rejects invalid content version %j", (version) => {
  const input = pack()
  error(
    {
      ...input,
      manifest: { ...input.manifest, records: input.manifest.records.map((record) => ({ ...record, version })) },
    },
    "invalid_record",
  )
})

test("actual code is checked when both manifests declare the same incorrect tokens", () => {
  const input = pack()
  error(
    {
      ...input,
      manifest: {
        ...input.manifest,
        records: input.manifest.records.map((record) => ({ ...record, codeTokens: ["invented_API"] })),
      },
    },
    "identifier_mismatch",
  )
})

test("protected code literals retain order, indentation and nested backticks", () => {
  const input = pack()
  const tokens = ["API `literal` end", '  device.get("fixture_motor");']
  const files = input.manifest.records.map((record) => {
    const content = JSON.stringify({
      id: record.id,
      version: record.version,
      language: record.language,
      body: `\`\`${tokens[0]}\`\`\n~~~java\n${tokens[1]}\n~~~`,
    })
    return {
      record: { ...record, digest: Hash.sha256(content), codeTokens: tokens },
      file: { localPath: record.localPath, bytes: Array.from(new TextEncoder().encode(content)) },
    }
  })
  expect(
    validatePack({
      manifest: { kind: "synthetic", records: files.map((entry) => entry.record) },
      files: files.map((entry) => entry.file),
    }).kind,
  ).toBe("valid")
})

test("malformed source URL is rejected", () => {
  const input = pack()
  error(
    {
      ...input,
      manifest: {
        ...input.manifest,
        records: input.manifest.records.map((record) => ({ ...record, source: "not-a-url" })),
      },
    },
    "invalid_record",
  )
})

test.each(["not JSON", "{}", '{"valid":true}', "[]"])("rejects malformed content bytes %j", (content) => {
  const input = pack()
  error(
    {
      manifest: {
        ...input.manifest,
        records: [{ ...input.manifest.records[0], digest: Hash.sha256(content) }, input.manifest.records[1]],
      },
      files: [{ ...input.files[0], bytes: Array.from(new TextEncoder().encode(content)) }, input.files[1]],
    },
    "malformed_content",
  )
})

test("rejects invalid UTF-8 and non-byte values", () => {
  const input = pack()
  const bytes = [255]
  error(
    {
      manifest: {
        ...input.manifest,
        records: [{ ...input.manifest.records[0], digest: Hash.sha256(Buffer.from(bytes)) }, input.manifest.records[1]],
      },
      files: [{ ...input.files[0], bytes }, input.files[1]],
    },
    "malformed_content",
  )
  error({ ...input, files: [{ ...input.files[0], bytes: [256] }, input.files[1]] }, "invalid_input")
})

test.each(["../escape.json", "/absolute.json", "https://fixtures.invalid/file", "en\\file.json"])(
  "rejects nonlocal content path %j",
  (localPath) => {
    const input = pack()
    error(
      {
        ...input,
        manifest: {
          ...input.manifest,
          records: [{ ...input.manifest.records[0], localPath }, input.manifest.records[1]],
        },
      },
      "invalid_record",
    )
  },
)

test("synthetic provenance cannot populate a production pack", () => {
  const input = pack()
  error({ ...input, manifest: { ...input.manifest, kind: "production" } }, "synthetic_content")
})

test("empty production manifest makes no course or support claim", async () => {
  const manifest = await Bun.file(new URL("../../../resources/ftc/content/manifest.json", import.meta.url)).json()
  expect(manifest).toEqual({ kind: "production", records: [] })
  expect(validatePack({ manifest, files: [] })).toEqual({ kind: "valid", records: [] })
})

test("independent inputs remain unchanged and cannot leak prior validation state", () => {
  const input = pack()
  const before = JSON.stringify(input)
  expect(validatePack(input).kind).toBe("valid")
  error({ ...input, files: [] }, "missing_file")
  expect(validatePack(input).kind).toBe("valid")
  expect(JSON.stringify(input)).toBe(before)
})

test("canonical contracts serialize and optional fields omit undefined", async () => {
  const result = validatePack(pack())
  expect(Schema.decodeUnknownSync(FtcKnowledge.PackResult)(JSON.parse(JSON.stringify(result)))).toEqual(result)
  expect(FtcKnowledge.ContentRecord).toBe(ContentRecord)
  const implementation = await import("../../../src/ftc/knowledge")
  expect(implementation.ContentRecord).toBe(FtcKnowledge.ContentRecord)
  expect(implementation.PackResult).toBe(FtcKnowledge.PackResult)
  expect(Schema.decodeUnknownSync(FtcKnowledge.PackInput)(JSON.parse(JSON.stringify(pack())))).toEqual(pack())
  expect(
    Schema.encodeSync(FtcKnowledge.PackError)({
      code: "invalid_content",
      reason: "invalid_input",
      id: undefined,
      language: undefined,
      localPath: undefined,
    }),
  ).toEqual({ code: "invalid_content", reason: "invalid_input" })
  const identifiers = [
    FtcKnowledge.ContentRecord,
    FtcKnowledge.ContentDocument,
    FtcKnowledge.ContentFile,
    FtcKnowledge.Manifest,
    FtcKnowledge.PackInput,
    FtcKnowledge.PackError,
    FtcKnowledge.PackResult,
  ].map((schema) => schema.ast.annotations?.identifier)
  expect(
    identifiers.every((identifier) => typeof identifier === "string" && identifier.startsWith("FtcKnowledge.")),
  ).toBe(true)
  expect(new Set(identifiers).size).toBe(7)
})
