import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { execFileSync } from "node:child_process"
import { writeClipboard } from "./clipboard.ts"

const name = `rich-copy-2026-11-18-175310-${randomUUID()}`

after(() => {
  execFileSync("/usr/bin/osascript", ["-l", "JavaScript", "-e", "ObjC.import('AppKit'); function run(argv) { $.NSPasteboard.pasteboardWithName($(argv[0])).releaseGlobally }", name])
})

function readBoard(): { text: string | null; html: string | null; count: number } {
  const script = `
    ObjC.import('AppKit');
    function run(argv) {
      const board = $.NSPasteboard.pasteboardWithName($(argv[0]));
      const items = board.pasteboardItems;
      const item = items.objectAtIndex(0);
      function read(type) {
        const value = item.stringForType($(type));
        return value.isNil() ? null : ObjC.unwrap(value);
      }
      return JSON.stringify({text: read('public.utf8-plain-text'), html: read('public.html'), count: Number(items.count)});
    }`
  return JSON.parse(execFileSync("/usr/bin/osascript", ["-l", "JavaScript", "-e", script, name], { encoding: "utf8" }))
}

test("writes one named pasteboard item with Unicode text and HTML", async () => {
  const text = `雪 🐈 "quotes" \\ slash\n'); throw new Error('executed'); //`
  const html = `<p title="\\quoted">${text}</p>`
  await writeClipboard({ text, html }, { name })
  assert.deepEqual(readBoard(), { text, html, count: 1 })

  await writeClipboard({ text: "plain only" }, { name })
  assert.deepEqual(readBoard(), { text: "plain only", html: null, count: 1 })
})

test("rejects invalid input and cancellation", async () => {
  await assert.rejects(writeClipboard({ text: 1 } as never, { name }), TypeError)
  await assert.rejects(writeClipboard({ text: "x", html: null } as never, { name }), TypeError)
  await assert.rejects(writeClipboard({ text: "x" }, { name: "" }), TypeError)
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(writeClipboard({ text: "x" }, { name, signal: controller.signal }), { name: "AbortError" })
  const inFlight = new AbortController()
  const pending = writeClipboard({ text: "x" }, { name, signal: inFlight.signal })
  inFlight.abort()
  await assert.rejects(pending, { name: "AbortError" })
})
