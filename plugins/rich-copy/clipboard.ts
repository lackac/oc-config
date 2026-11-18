import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

export async function writeClipboard(
  payload: { text: string; html?: string },
  options: { signal?: AbortSignal; name?: string } = {},
): Promise<void> {
  if (!payload || typeof payload.text !== "string" || (payload.html !== undefined && typeof payload.html !== "string")) {
    throw new TypeError("Clipboard requires text and optional HTML strings")
  }
  if (options.name !== undefined && (typeof options.name !== "string" || !options.name)) {
    throw new TypeError("Pasteboard name must be a non-empty string")
  }
  options.signal?.throwIfAborted()

  const script = fileURLToPath(new URL("./pasteboard.js", import.meta.url))
  const child = spawn("/usr/bin/osascript", ["-l", "JavaScript", script], {
    signal: options.signal, timeout: 5_000, stdio: ["pipe", "ignore", "pipe"],
  })
  let stderr = ""
  child.stderr.setEncoding("utf8")
  child.stderr.on("data", (chunk: string) => { stderr += chunk })

  await new Promise<void>((resolve, reject) => {
    let processError: Error | undefined
    let inputError: Error | undefined
    child.on("error", (error) => { processError = error })
    child.stdin.on("error", (error) => { inputError = error })
    child.on("close", (code) => {
      if (processError) reject(processError)
      else if (code !== 0) reject(new Error(`Clipboard writer failed (${code}): ${stderr.trim()}`))
      else if (inputError) reject(inputError)
      else resolve()
    })
    child.stdin.end(JSON.stringify({ text: payload.text, html: payload.html, name: options.name }))
  })
}
