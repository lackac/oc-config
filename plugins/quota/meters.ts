export type Window = { label: string; remaining: number; reset: number | null }
export type Meter = { provider: string; windows: Window[]; updated: number; error: string | null }

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid quota response")
  return value as Record<string, unknown>
}

function percent(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error("Invalid quota percentage")
  }
  return value
}

export function openaiWindows(payload: unknown, now = Date.now()): Window[] {
  const root = record(payload)
  if (!("rate_limit" in root)) throw new Error("Missing quota data")
  if (root.rate_limit === null) return []
  const limits = record(root.rate_limit)
  const windows: Window[] = []
  for (const key of ["primary_window", "secondary_window"]) {
    if (limits[key] == null) continue
    const window = record(limits[key])
    const duration = window.limit_window_seconds
    const label = duration === 18000 ? "5h" : duration === 604800 ? "W" : duration === 2628000 ? "M" : null
    if (!label) continue
    const reset = typeof window.reset_at === "number" ? window.reset_at * 1000
      : typeof window.reset_after_seconds === "number" ? now + window.reset_after_seconds * 1000 : null
    if (reset !== null && (!Number.isFinite(reset) || reset <= 0)) throw new Error("Invalid quota reset")
    if (windows.some((item) => item.label === label)) throw new Error("Duplicate quota window")
    windows.push({ label, remaining: 100 - percent(window.used_percent), reset })
  }
  return windows.sort((a, b) => ["5h", "W", "M"].indexOf(a.label) - ["5h", "W", "M"].indexOf(b.label))
}

export function goWindows(payload: unknown): Window[] {
  const usage = record(record(payload).usage)
  const windows: Window[] = []
  for (const [key, label] of [["rolling", "5h"], ["weekly", "W"], ["monthly", "M"]]) {
    if (usage[key] == null) continue
    const window = record(usage[key])
    if (window.status !== "ok" && window.status !== "rate-limited") throw new Error("Invalid quota status")
    const used = percent(window.percent)
    const reset = typeof window.resetsAt === "string" ? Date.parse(window.resetsAt) : NaN
    if (!Number.isFinite(reset)) throw new Error("Invalid quota reset")
    windows.push({ label, remaining: window.status === "rate-limited" ? 0 : 100 - used, reset })
  }
  if (!windows.length) throw new Error("Missing quota data")
  return windows
}

export function bar(remaining: number): string {
  const eighths = Math.round(Math.max(0, Math.min(100, remaining)) * 24 / 100)
  const full = Math.floor(eighths / 8)
  const partial = eighths % 8
  return "▕" + "█".repeat(full) + (partial ? "▏▎▍▌▋▊▉"[partial - 1] : "") + " ".repeat(3 - full - (partial ? 1 : 0)) + "▏"
}

export function quotaBar(remaining: number): string {
  if (remaining === 100) return "▕███100%"
  return bar(remaining) + `${Math.min(99, Math.round(remaining))}%`.padStart(3)
}

export function resetLabel(reset: number | null, now: number): string {
  if (reset === null) return "reset unknown"
  if (reset <= now) return "reset due"
  const minutes = Math.ceil((reset - now) / 60000)
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
  return `${Math.floor(minutes / 1440)}d ${Math.floor(minutes % 1440 / 60)}h`
}
