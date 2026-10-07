import { NativeInspectionReader } from "../../../packages/inspection-reader-native/index"
if (process.argv[2] === "--import-only") console.log("lazy import succeeded")
else {
  try {
    const native = NativeInspectionReader.load()
    const root = await native.root(process.argv[2]).promise
    try {
      const file = await native.open(root, "own.txt", "file").promise
      if (!file) throw new Error("missing fixture")
      try {
        console.log(new TextDecoder().decode(await native.read(file).promise))
      } finally {
        await native.close(file)
      }
    } finally {
      await native.close(root)
    }
  } catch (error) {
    console.log(error instanceof Error && "code" in error ? error.code : error)
    process.exitCode = 1
  }
}
