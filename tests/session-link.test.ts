import assert from "node:assert/strict"
import { setImmediate } from "node:timers/promises"
import { test } from "node:test"
import server from "../plugins/session-link/index.ts"
import { sessionLinkDefinition } from "../plugins/session-link/rpc.ts"
import tui from "../plugins/session-link/tui.ts"

const blockID = "block:1a8bd662-a0ec-4199-81b1-a8111f9ba32b"
const otherBlockID = "block:da9bc4d6-03d4-4287-b1dd-e337c84caebf"
const sessionID = "ses_abc123"
const empty = { requestID: null, sessionID: null, acknowledged: false }
const location = { directory: "/checkout" }
const eventLocation = { directory: "/checkout/worktree" }

async function startServer() {
  let rpc
  const events = []
  const lookups = []
  await server.setup({
    session: { async get(input) { lookups.push(input) } },
    rpc: {
      async register(definition, methods) {
        assert.equal(definition.id, "opencode.session-link")
        rpc = Object.fromEntries(Object.entries(methods).map(([name, call]) => [
          name,
          (input) => call(input, { error(type, message) { throw new Error(`${type}: ${message}`) } }),
        ]))
        return { events: { async emit(name, data) { events.push({ name, data }) } } }
      },
    },
  })
  return { rpc, events, lookups }
}

test("pending retains whether the target block acknowledged the current request", async () => {
  const { rpc, events } = await startServer()
  const first = await rpc.request({ blockID, sessionID })
  const latest = await rpc.request({ blockID, sessionID })
  assert.notEqual(first.requestID, latest.requestID)
  assert.deepEqual(events.at(-1), { name: "requested", data: { blockID, sessionID, ...latest } })
  assert.deepEqual(await rpc.pending({ blockID: otherBlockID }), empty)

  await rpc.acknowledge({ blockID: otherBlockID, ...latest })
  await rpc.acknowledge({ blockID, ...first })
  assert.deepEqual(await rpc.pending({ blockID }), { sessionID, ...latest, acknowledged: false })
  await rpc.acknowledge({ blockID, ...latest })
  assert.deepEqual(await rpc.pending({ blockID }), { sessionID, ...latest, acknowledged: true })
})

test("invalid Rex, session, and request IDs are rejected", async () => {
  const { rpc, events, lookups } = await startServer()
  for (const badBlock of ["%12", "block:not-a-uuid", `${blockID}\n`, blockID.slice(6), [blockID]]) {
    await assert.rejects(rpc.request({ blockID: badBlock, sessionID }), /Invalid Rex block/)
    await assert.rejects(rpc.pending({ blockID: badBlock }), /Invalid Rex block/)
  }
  await assert.rejects(rpc.request({ blockID, sessionID: "ses_abc-123" }), /Invalid Rex block or session ID/)
  await assert.rejects(rpc.acknowledge({ blockID, requestID: "invalid" }), /Invalid Rex block or request ID/)
  assert.deepEqual(events, [])
  assert.deepEqual(lookups, [])
})

test("acknowledged records expire at the original 15-second deadline", async (t) => {
  const { rpc } = await startServer()
  let now = 0
  t.mock.method(Date, "now", () => now)
  const request = await rpc.request({ blockID, sessionID })
  now += 14_999
  await rpc.acknowledge({ blockID, ...request })
  assert.deepEqual(await rpc.pending({ blockID }), { ...request, sessionID, acknowledged: true })
  now++
  assert.deepEqual(await rpc.pending({ blockID }), empty)
})

test("TUI recovers pending navigation and routes only its own Rex block's events", async (t) => {
  const savedBlock = process.env.REX_BLOCK
  t.after(() => {
    if (savedBlock === undefined) delete process.env.REX_BLOCK
    else process.env.REX_BLOCK = savedBlock
  })
  delete process.env.REX_BLOCK
  assert.equal(tui.setup({}), undefined)
  process.env.REX_BLOCK = "%12"
  assert.equal(tui.setup({}), undefined)
  process.env.REX_BLOCK = blockID

  const { rpc } = await startServer()
  const first = await rpc.request({ blockID, sessionID })
  let listener
  let current = { type: "home" }
  let tabs = false
  const opened = []
  const calls = []
  const context = {
    location,
    client: {
      rpc(definition) {
        assert.equal(definition, sessionLinkDefinition)
        return {
          pending(input, options) {
            calls.push(["pending", options.location])
            return rpc.pending(input)
          },
          acknowledge(input, options) {
            calls.push(["acknowledge", options.location])
            return rpc.acknowledge(input)
          },
          events: {
            on(name, callback) {
              assert.equal(name, "requested")
              calls.push(["subscribe"])
              listener = callback
              return () => { listener = undefined }
            },
          },
        }
      },
    },
    ui: {
      router: {
        current: () => current,
        navigate: (route) => {
          current = route
          opened.push(["navigate", route.sessionID])
        },
      },
      tabs: { enabled: () => tabs, focus: (id) => opened.push(["focus", id]) },
    },
  }
  const stop = tui.setup(context)
  await setImmediate()
  assert.deepEqual(opened, [["navigate", sessionID]])
  assert.deepEqual(await rpc.pending({ blockID }), { ...first, sessionID, acknowledged: true })
  assert.deepEqual(calls, [["subscribe"], ["pending", location], ["acknowledge", location]])

  tabs = true
  const nextSessionID = "ses_def456"
  const next = await rpc.request({ blockID, sessionID: nextSessionID })
  listener({ location: eventLocation, data: { blockID: otherBlockID, sessionID: nextSessionID, ...next } })
  listener({ location: eventLocation, data: { blockID, sessionID: nextSessionID, requestID: "invalid" } })
  await setImmediate()
  assert.deepEqual(opened, [["navigate", sessionID]])
  assert.deepEqual(await rpc.pending({ blockID }), { sessionID: nextSessionID, ...next, acknowledged: false })
  assert.equal(calls.length, 3)

  await listener({ location: eventLocation, data: { blockID, sessionID, ...first } })
  assert.deepEqual(opened, [["navigate", sessionID], ["focus", nextSessionID]])
  assert.deepEqual(await rpc.pending({ blockID }), { sessionID: nextSessionID, ...next, acknowledged: true })
  assert.deepEqual(calls.slice(3), [["pending", eventLocation], ["acknowledge", eventLocation]])

  // Opening an already selected session must still acknowledge that request.
  const again = await rpc.request({ blockID, sessionID })
  await listener({ location: eventLocation, data: { blockID, sessionID, ...again } })
  assert.deepEqual(opened, [["navigate", sessionID], ["focus", nextSessionID]])
  assert.deepEqual(await rpc.pending({ blockID }), { ...again, sessionID, acknowledged: true })
  stop()
  assert.equal(listener, undefined)

  current = { type: "home" }
  calls.length = 0
  const stopReloaded = tui.setup(context)
  await setImmediate()
  assert.deepEqual(calls, [["subscribe"], ["pending", location]])
  assert.deepEqual(opened, [["navigate", sessionID], ["focus", nextSessionID]])
  stopReloaded()
})
