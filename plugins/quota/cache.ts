import type { Meter, Window } from "./meters.ts"

export const POLL_MS = 15 * 60_000
export const COOLDOWN_MS = 30_000

export class QuotaFailure extends Error {
  readonly retryMs: number
  constructor(message: string, retryMs = 60_000) { super(message); this.retryMs = retryMs }
}

// One cache per provider; credentials never leave the server.
export function meterCache(provider: string, now = Date.now) {
  let identity: string | undefined
  let generation = 0
  let meter: Meter = { provider, windows: [], updated: 0, error: null }
  let next = 0
  let dirty = false
  let pending: Promise<Meter> | undefined
  return {
    async read(key: string, refresh: boolean, load: () => Promise<Window[]>): Promise<Meter> {
      if (identity !== key) {
        generation++
        identity = key
        meter = { provider, windows: [], updated: 0, error: null }
        next = 0
        dirty = false
        pending = undefined
      }
      if (refresh) dirty = true
      if (pending) return pending
      if (now() < next || (!dirty && meter.updated && !meter.error && now() - meter.updated < POLL_MS)) return meter
      dirty = false
      const version = generation
      const previous = meter
      const request = (async () => {
        let result: Meter
        let delay = COOLDOWN_MS
        try {
          result = { provider, windows: await load(), updated: now(), error: null }
        } catch (error) {
          result = { ...previous, error: error instanceof QuotaFailure ? error.message : "Quota unavailable" }
          delay = error instanceof QuotaFailure ? Math.max(60_000, error.retryMs) : 60_000
        }
        if (generation === version) {
          meter = result
          next = now() + delay
        }
        return result
      })()
      pending = request
      try { return await request } finally { if (pending === request) pending = undefined }
    },
  }
}
