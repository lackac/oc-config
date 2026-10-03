import { createHash } from "node:crypto"
import { meterCache, QuotaFailure } from "./cache.ts"
import { openaiWindows, goWindows } from "./meters.ts"
import { quotaDefinition } from "./rpc.ts"

async function usage(url: string, headers: Record<string, string>, signal: AbortSignal) {
  const response = await fetch(url, {
    headers: { ...headers, Accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
  })
  if (!response.ok) {
    const retry = response.headers.get("retry-after")
    const delay = retry ? (/^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - Date.now()) : 60_000
    await response.body?.cancel()
    throw new QuotaFailure(response.status === 401 || response.status === 403
      ? "Sign-in required" : `Quota HTTP ${response.status}`, Number.isFinite(delay) ? delay : 60_000)
  }
  return response.json()
}

export default {
  id: "local.quota",
  async setup(context) {
    const abort = new AbortController()
    const caches = { openai: meterCache("OpenAI"), "opencode-go": meterCache("Go") }
    const read = async (id: keyof typeof caches, refresh: boolean) => {
      try {
        const connection = await context.integration.connection.active(id)
        const credential = connection ? await context.integration.connection.resolve(connection) : undefined
        const valid = id === "openai" ? credential?.type === "oauth" : credential?.type === "key"
        const token = valid ? (credential.type === "oauth" ? credential.access : credential.key) : ""
        const account = credential?.metadata?.accountID ?? credential?.metadata?.accountId
        const identity = createHash("sha256").update(JSON.stringify([connection, token, account])).digest("hex")
        return caches[id].read(identity, refresh, async () => {
          if (!valid || !token) throw new QuotaFailure(id === "openai" ? "Connect ChatGPT" : "Connect Go API key")
          const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
          if (id === "openai") {
            if (typeof account === "string") headers["ChatGPT-Account-Id"] = account
            return openaiWindows(await usage("https://chatgpt.com/backend-api/wham/usage", headers, abort.signal))
          }
          return goWindows(await usage("https://opencode.ai/zen/go/v1/usage", headers, abort.signal))
        })
      } catch {
        // Do not retain another account's readings when credential resolution fails.
        return caches[id].read("unresolved", refresh, async () => { throw new QuotaFailure("Sign-in unavailable") })
      }
    }
    const registration = await context.rpc.register(quotaDefinition, {
      read: async (input) => ({ meters: await Promise.all([
        read("openai", input?.refresh === true),
        read("opencode-go", input?.refresh === true),
      ]) }),
    })
    return () => { abort.abort(); return registration.dispose() }
  },
}
