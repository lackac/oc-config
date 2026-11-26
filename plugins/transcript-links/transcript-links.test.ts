import assert from "node:assert/strict"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { createOpener } from "./editor.ts"
import { linksIn, parseLink } from "./links.ts"
import { installFileClicks } from "./mouse.ts"
import tui, { transcriptOptions } from "./tui.ts"

const cwd = fileURLToPath(new URL("../..", import.meta.url)).replace(/\/$/, "")
const reference = { kind: "file" as const, file: `${cwd}/README.md`, line: 3, column: 2 }

test("resolves paths and line anchors without treating other schemes as local files", () => {
  assert.deepEqual(parseLink("README.md:3:2", cwd), reference)
  assert.deepEqual(parseLink("README.md#L3:2", cwd, true), reference)
  assert.deepEqual(parseLink("file:///a%20b.md#L3-L7", cwd), { kind: "file", file: "/a b.md", line: 3, column: undefined })
  assert.deepEqual(parseLink("./a%20b.md", cwd, true), { kind: "file", file: `${cwd}/a b.md`, line: undefined, column: undefined })
  for (const href of ["mailto:hi@example.com", "javascript:alert(1)", "//example.com/foo", "file://example.com/foo",
    "a.ts:0", "a.ts:1:0", "a.ts:999999999999999", "a%0Aother", "#L23"]) {
    assert.equal(parseLink(href, cwd, true), undefined, href)
  }
  const text = "[code](<a b.ts#L12>) and `README.md:3:2`, see https://example.com/foo(a)."
  const links = [...linksIn(text, cwd, true)]
  assert.deepEqual(links.map(({ label, value }) => [label, value]), [
    ["code", "a b.ts#L12"], [undefined, "README.md:3:2"], [undefined, "https://example.com/foo(a)"],
  ])
})

test("separates named fragments from paths, preserving numeric anchors and escaped hashes", () => {
  const expected = { kind: "file", file: `${cwd}/README.md`, line: undefined, column: undefined, fragment: "transcript-links" }
  assert.deepEqual(parseLink("README.md#transcript-links", cwd), expected)
  assert.deepEqual(parseLink("./README.md#transcript%2Dlinks", cwd, true), expected)
  assert.deepEqual(parseLink(new URL("../../README.md#transcript-links", import.meta.url).href, cwd), expected)
  assert.deepEqual(parseLink("https://example.com/#transcript-links", cwd), {
    kind: "web", url: "https://example.com/#transcript-links",
  })
  assert.equal(parseLink("README.md#bad%0Amarker", cwd), undefined)
  assert.equal(parseLink("./a%23b/README.md#heading", cwd, true)?.file, `${cwd}/a#b/README.md`)
  assert.equal(parseLink("./a#b/README.md", cwd)?.file, `${cwd}/a#b/README.md`)
})

test("picker lists only existing local files and web URLs, deduplicated by destination and position", async () => {
  const options = await transcriptOptions([
    { id: "new", type: "assistant", content: [
      { type: "text", text: "`README.md:3:2` [home](https://example.com) `.missing.ts`" },
      { type: "reasoning", text: "https://hidden.example" },
    ] },
    { id: "old", type: "user", text: "[readme](./README.md#L3:2) README.md:6 https://example.com/ [links](README.md#transcript-links) README.md#plugins" },
  ], cwd)
  assert.deepEqual(options.map(({ title, description }) => [title, description]), [
    ["readme", "./README.md#L3:2"], ["home", "https://example.com"], ["README.md:6", undefined],
    ["links", "README.md#transcript-links"], ["README.md#plugins", undefined],
  ])
})

test("plain clicks handle only transcript files and leave web, session links, and selection alone", () => {
  const text = "🔧 README.md:3:2 and more"
  const origin = { x: 2, y: 4 }
  const target = {
    ...origin, id: "text", parent: { ...origin, id: "session-part:msg_1:text:0" }, plainText: text,
    lineInfo: { lineSources: [0, 0], lineStartCols: [0, 9], lineWraps: [0, 1], lineWidthCols: [9, 17] },
  }
  const point = { x: 3, y: 5 }
  let href: string | null = null
  let focus = point
  const dispatched = []
  const opened = []
  const dispatch = (node, event) => { dispatched.push([node, event]) }
  const renderer = {
    sendMouseEvent: dispatch,
    getLinkAt: () => href,
    getSelection: () => ({ isStart: true, behavior: "cell", anchor: point, focus }),
  }
  const mouse = { ...point, type: "up", button: 0, isDragging: true, modifiers: { ctrl: false, alt: false, shift: false } }
  const stop = installFileClicks(renderer, () => cwd, (s) => [...s].length + Number(s.includes("🔧")),
    (link, directory, explicit) => { opened.push([link, directory, explicit]); return true })
  renderer.sendMouseEvent(target, mouse) // Inside the path on a wrapped visual line.
  href = "./README.md#L3:2"
  renderer.sendMouseEvent(target, mouse)
  href = "./README.md#transcript-links"
  renderer.sendMouseEvent(target, mouse)
  href = null
  renderer.sendMouseEvent({ ...target, plainText: "🔧 README.md#transcript-links and more" }, mouse)
  href = "https://example.com"
  renderer.sendMouseEvent(target, mouse)
  href = "#ses_other" // Native or unsupported links aren't files.
  renderer.sendMouseEvent(target, mouse)
  href = null
  focus = { ...point, x: 8 }
  renderer.sendMouseEvent(target, mouse)
  focus = point
  renderer.sendMouseEvent({ ...target, parent: { ...origin, id: "dialog" } }, mouse)
  const named = { ...reference, line: undefined, column: undefined, fragment: "transcript-links" }
  assert.deepEqual(opened, [[reference, cwd, false], [reference, cwd, true], [named, cwd, true], [named, cwd, false]])
  assert.equal(dispatched.length, 4)
  stop?.()
  assert.equal(renderer.sendMouseEvent, dispatch)
})

test("keyboard command merges streamed text and older pages", async () => {
  let layer
  const stop = tui.setup({
    renderer: {},
    keymap: { layer(make) { layer = make() } },
    data: { session: {
      get: () => ({ location: { directory: cwd } }),
      message: { list: () => [{ id: "new", type: "assistant", content: [{ type: "text", text: "README.md:3:2" }] }] },
    } },
    client: { message: { async list(input) {
      return input.cursor ? {
        data: [{ id: "old", type: "user", text: "https://example.com" }], cursor: { next: null },
      } : { data: [{ id: "new", type: "assistant", content: [] }], cursor: { next: "older" } }
    } } },
    ui: {
      router: { current: () => ({ type: "session", sessionID: "ses_demo" }) },
      toast: { show: () => assert.fail("Expected dialog instead of a toast") },
      dialog: { async select({ options }) {
        assert.deepEqual(options.map((option) => option.title), ["README.md:3:2", "https://example.com"])
        return undefined
      } },
    },
  })
  const { commands } = layer
  assert.equal(commands[0].title, "Open transcript link")
  assert.equal(commands[0].slash.name, "links")
  await commands[0].run()
  stop()
})

test("tmux reuses the marked pane in the origin window instead of opening a popup", async () => {
  const calls: string[][] = []
  const open = createOpener({ TMUX: "/private/socket,100,4", TMUX_PANE: "%2", REX_SESSION: "session:a" },
    async (cmd, args) => {
      calls.push([cmd, ...args])
      if (args.includes("display-message")) return "@1"
      if (args.includes("list-panes")) return "%1\t0\t/private/editor\n%2\t0\t\n%3\t1\t/private/dead"
      if (cmd === "nvim") return "1"
      return ""
    }, async (socket) => socket === "/private/editor")
  await open({ ...reference, file: "/tmp/a 'literal' | name.ts" }, cwd)
  assert.deepEqual(calls[1].slice(0, 6), ["tmux", "-S", "/private/socket", "list-panes", "-t", "@1"])
  assert.deepEqual(calls[2].slice(0, 4), ["nvim", "--server", "/private/editor", "--remote-expr"])
  assert.match(calls[2][4], /a ''literal'' \| name\.ts/)
  assert.deepEqual(calls.at(-1), ["tmux", "-S", "/private/socket", "select-pane", "-t", "%1"])
})

test("tmux floats in the client showing the originating pane's session and window", async () => {
  const calls: string[][] = []
  const open = createOpener({ TMUX: "/private/socket,100,4", TMUX_PANE: "%2" }, async (cmd, args) => {
    calls.push([cmd, ...args])
    if (args.includes("display-message")) return "@1"
    if (args.includes("list-panes")) return "%2\t0\t"
    if (args.includes("list-clients")) return "$5\t@1\t9\tother\n$4\t@0\t8\twrong\n$4\t@1\t1\tolder\n$4\t@1\t2\tactive"
    return ""
  })
  const file = `${cwd}/cli.json`
  await open({ ...reference, file }, "/work/#branch")
  assert.deepEqual(calls.at(-1), ["tmux", "-S", "/private/socket", "display-popup", "-c", "active", "-t", "%2",
    "-E", "-w", "80%", "-h", "80%", "-d", "/work/##branch", "env", "-u", "TMUX", "-u", "TMUX_PANE",
    "-u", "REX_SESSION", "-u", "REX_BLOCK", "nvim", "+call cursor(3,2)", "--", file])
})

test("tmux opens marked Markdown links in floating Leaf without looking for Neovim", async () => {
  const calls: string[][] = []
  const open = createOpener({ TMUX: "/private/socket,100,4", TMUX_PANE: "%2" }, async (cmd, args) => {
    calls.push([cmd, ...args])
    if (args.includes("display-message")) return "@1"
    if (args.includes("list-clients")) return "$4\t@1\t2\tactive"
    return ""
  })
  const link = parseLink("notes/Release.MARKDOWN#changes", cwd)
  assert.ok(link?.kind === "file")
  await open(link, cwd)
  assert.equal(calls.length, 3)
  assert.ok(calls[2].includes("display-popup"))
  assert.deepEqual(calls[2].slice(-3), ["leaf", "open", `${cwd}/notes/Release.MARKDOWN`])
})

test("Rex hands off to the local action, then edits and focuses its returned pane", async () => {
  const calls: string[][] = []
  const open = createOpener({ REX_SESSION: "session:a", REX_BLOCK: "block:a", REX_SERVER: "unix:///private/rex" },
    async (cmd, args) => {
      calls.push([cmd, ...args])
      if (args.includes("transcript_editor")) return '{"pane":"block:b","socket":"/private/editor.sock"}'
      return "1"
    })
  const file = `${cwd}/cli.json`
  await open({ ...reference, file }, cwd)
  assert.deepEqual(calls[0].slice(0, -1), ["rex", "--autostart=false", "-S", "unix:///private/rex", "do",
    "transcript_editor", "-s", "session:a", "-b", "block:a", "--json", "--args"])
  assert.deepEqual(JSON.parse(calls[0].at(-1)!), { directory: cwd, file, line: 3, column: 2 })
  assert.match(calls[1][4], /, 3, 2, 'block:b'\]/)
  assert.deepEqual(calls[2], ["rex", "--autostart=false", "-S", "unix:///private/rex", "focus", "-s", "session:a", "block:b"])
})

test("Rex opens Markdown in Leaf without sending a line or heading as part of the filename", async () => {
  const calls: string[][] = []
  const open = createOpener({ REX_BLOCK: "block:a", REX_SERVER: "unix:///private/rex" }, async (cmd, args) => {
    calls.push([cmd, ...args])
    return '{"floating":true}'
  })
  for (const value of ["README.md#transcript-links", "README.md#L3"]) {
    const link = parseLink(value, cwd)
    assert.ok(link?.kind === "file")
    await open(link, cwd)
  }
  assert.equal(calls.length, 2)
  for (const args of calls) {
    assert.deepEqual(args.slice(0, -1), ["rex", "--autostart=false", "-S", "unix:///private/rex", "do",
      "transcript_editor", "-s", "block:a", "-b", "block:a", "--json", "--args"])
    assert.deepEqual(JSON.parse(args.at(-1)!), { directory: cwd, file: reference.file, markdown: true })
  }
})

test("Rex focuses the returned editor within the originating block's session without REX_SESSION", async () => {
  const calls: string[][] = []
  const open = createOpener({ REX_BLOCK: "block:a" }, async (cmd, args) => {
    calls.push([cmd, ...args])
    return args.includes("transcript_editor") ? '{"pane":"block:b","socket":"/private/editor.sock"}' : "1"
  })
  await open({ ...reference, file: `${cwd}/cli.json` }, cwd)
  assert.deepEqual(calls[2], ["rex", "--autostart=false", "focus", "-s", "block:a", "block:b"])
})
