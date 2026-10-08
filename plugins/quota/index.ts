import { createHash } from "node:crypto"
import { meterCache, QuotaFailure } from "./cache.ts"
import { openaiWindows } from "./meters.ts"
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
    const cache = meterCache("OpenAI")
    const read = async (refresh: boolean) => {
      try {
        const connection = await context.integration.connection.active("openai")
        const credential = connection ? await context.integration.connection.resolve(connection) : undefined
        const token = credential?.type === "oauth" ? credential.access : ""
        const account = credential?.metadata?.accountID ?? credential?.metadata?.accountId
        const identity = createHash("sha256").update(JSON.stringify([connection, token, account])).digest("hex")
        return cache.read(identity, refresh, async () => {
          if (!token) throw new QuotaFailure("Connect ChatGPT")
          const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
          if (typeof account === "string") headers["ChatGPT-Account-Id"] = account
          return openaiWindows(await usage("https://chatgpt.com/backend-api/wham/usage", headers, abort.signal))
        })
      } catch {
        // Do not retain another account's readings when credential resolution fails.
        return cache.read("unresolved", refresh, async () => { throw new QuotaFailure("Sign-in unavailable") })
      }
    }
    const registration = await context.rpc.register(quotaDefinition, {
      read: async (input) => ({ meters: [await read(input?.refresh === true)] }),
    })
    return () => { abort.abort(); return registration.dispose() }
  },
}
