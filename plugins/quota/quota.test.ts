import { test } from "node:test"
import assert from "node:assert/strict"
import { openaiWindows, goWindows, bar, quotaBar } from "./meters.ts"
import { meterCache, QuotaFailure, COOLDOWN_MS } from "./cache.ts"

test("OpenAI windows use duration, omit missing windows, and preserve zero", () => {
  assert.deepEqual(openaiWindows({ rate_limit: { primary_window: {
    limit_window_seconds: 604800, used_percent: 100, reset_at: 1800000000,
  } } }), [{ label: "W", remaining: 0, reset: 1800000000000 }])
  assert.deepEqual(openaiWindows({ rate_limit: null }), [])
  assert.throws(() => openaiWindows({ error: "unauthorized" }))
  assert.throws(() => openaiWindows({ rate_limit: { primary_window: {
    limit_window_seconds: 604800, used_percent: NaN,
  } } }))
})

test("Go respects rate-limited status and rejects malformed readings", () => {
  const window = { status: "rate-limited", percent: 40, resetsAt: "2026-10-08T00:00:00Z" }
  assert.equal(goWindows({ usage: { monthly: window } })[0].remaining, 0)
  assert.throws(() => goWindows({ usage: { monthly: { ...window, percent: "40" } } }))
  assert.throws(() => goWindows({ usage: {} }))
  assert.equal(bar(0), "▕   ▏")
  assert.equal(bar(30), "▕▉  ▏")
  assert.equal(bar(50), "▕█▌ ▏")
  assert.equal(bar(100), "▕███▏")
})

test("full quota replaces the closing boundary without changing meter width", () => {
  assert.equal(quotaBar(100), "▕███100%")
  assert.equal(quotaBar(99.9), "▕███▏99%")
  assert.equal(quotaBar(30), "▕▉  ▏30%")
  assert.equal(quotaBar(9), "▕▎  ▏ 9%")
  assert.equal(quotaBar(0), "▕   ▏ 0%")
  for (let percent = 0; percent <= 100; percent++) assert.equal(quotaBar(percent).length, 8)
})

test("cache coalesces reads, throttles refresh, and marks previous data stale", async () => {
  let now = 1000
  let calls = 0
  const cache = meterCache("test", () => now)
  const load = async () => { calls++; return [{ label: "W", remaining: 42, reset: null }] }
  const [a, b] = await Promise.all([cache.read("a", false, load), cache.read("a", true, load)])
  assert.deepEqual(a, b)
  assert.equal(calls, 1)
  await cache.read("a", true, load)
  assert.equal(calls, 1)
  now += COOLDOWN_MS
  const stale = await cache.read("a", true, async () => { throw new QuotaFailure("Quota HTTP 429", 120000) })
  assert.equal(stale.windows[0].remaining, 42)
  assert.equal(stale.error, "Quota HTTP 429")
  now += 60000
  await cache.read("a", true, load)
  assert.equal(calls, 1)
  const switched = await cache.read("b", false, async () => { throw new Error("secret token") })
  assert.deepEqual(switched.windows, [])
  assert.equal(switched.error, "Quota unavailable")
})

test("late response from an old account cannot overwrite the new account", async () => {
  const cache = meterCache("test")
  let complete!: (value: []) => void
  const old = cache.read("old", true, () => new Promise((resolve) => { complete = resolve }))
  await cache.read("new", true, async () => [{ label: "W", remaining: 20, reset: null }])
  complete([])
  await old
  const current = await cache.read("new", false, async () => [])
  assert.equal(current.windows[0].remaining, 20)
})

test("a refresh during cooldown is retained for the next normal read", async () => {
  let now = 1000
  let calls = 0
  const cache = meterCache("test", () => now)
  const load = async () => { calls++; return [] }
  await cache.read("a", false, load)
  await cache.read("a", true, load)
  assert.equal(calls, 1)
  now += COOLDOWN_MS
  await cache.read("a", false, load)
  assert.equal(calls, 2)
})

test("switching away and back discards the first account generation", async () => {
  const cache = meterCache("test")
  let complete!: (value: []) => void
  const old = cache.read("a", true, () => new Promise((resolve) => { complete = resolve }))
  await cache.read("b", true, async () => [])
  await cache.read("a", true, async () => [{ label: "W", remaining: 25, reset: null }])
  complete([])
  await old
  assert.equal((await cache.read("a", false, async () => [])).windows[0].remaining, 25)
})

test("old account failures cannot expose another account's windows", async () => {
  const cache = meterCache("test")
  let fail!: (reason: Error) => void
  const old = cache.read("a", true, () => new Promise((_, reject) => { fail = reject }))
  await cache.read("b", true, async () => [{ label: "W", remaining: 25, reset: null }])
  fail(new Error("failed"))
  assert.deepEqual((await old).windows, [])
})
