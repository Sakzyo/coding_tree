// Evaluation-only process owner; Windows requires a separately verified Job Object boundary.
export async function run(
  command: string[],
  options: {
    cwd?: string
    env?: Record<string, string>
    timeout?: number
    signal?: AbortSignal
  },
) {
  if (process.platform === "win32") throw new Error("windows_process_tree_not_evaluated")
  const child = Bun.spawn(command, {
    cwd: options.cwd,
    env: options.env,
    detached: true,
    stdout: "pipe",
    stderr: "pipe",
  })
  const cleanup: { pending?: Promise<void> } = {}
  const stop = () => (cleanup.pending ??= stopGroup(child.pid))
  const cancelled = Promise.withResolvers<never>()
  const cancel = () => {
    void stop().then(() => cancelled.reject(new Error("evaluation_cancelled")), cancelled.reject)
  }
  const timeout = setTimeout(cancel, options.timeout ?? 15000)
  options.signal?.addEventListener("abort", cancel, { once: true })
  process.once("SIGINT", cancel)
  process.once("SIGTERM", cancel)
  if (options.signal?.aborted) cancel()
  try {
    const result = await Promise.race([
      Promise.all([
        child.exited.then(async (code) => {
          await stop()
          return code
        }),
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]),
      cancelled.promise,
    ])
    return { exit: result[0], stdout: result[1], stderr: result[2] }
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener("abort", cancel)
    process.removeListener("SIGINT", cancel)
    process.removeListener("SIGTERM", cancel)
    await stop()
  }
}

async function stopGroup(pid: number) {
  if (!signal(-pid, "SIGTERM")) return
  await Bun.sleep(100)
  signal(-pid, "SIGKILL")
  const deadline = Date.now() + 1000
  while (signal(-pid, 0)) {
    if (Date.now() >= deadline) throw new Error("evaluation_cleanup_unconfirmed")
    await Bun.sleep(10)
  }
}

function signal(pid: number, value: 0 | "SIGTERM" | "SIGKILL") {
  try {
    process.kill(pid, value)
    return true
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ESRCH") return false
    throw error
  }
}
