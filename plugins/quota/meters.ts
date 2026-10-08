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

export const BAR_WIDTH = 12

export function bar(remaining: number): string {
  const eighths = Math.round(Math.max(0, Math.min(100, remaining)) * BAR_WIDTH * 8 / 100)
  const full = Math.floor(eighths / 8)
  const partial = eighths % 8
  return "▕" + "█".repeat(full) + (partial ? "▏▎▍▌▋▊▉"[partial - 1] : "") + " ".repeat(BAR_WIDTH - full - (partial ? 1 : 0)) + "▏"
}

export function quotaBar(remaining: number): string {
  if (remaining === 100) return "▕" + "█".repeat(BAR_WIDTH) + "100%"
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
