import { expect, test } from "bun:test"
import { MarkdownRenderable, Selection, SyntaxStyle, type MarkdownOptions } from "@opentui/core"
import { createTestRenderer, setRendererCapabilities } from "@opentui/core/testing"
import { copySelection } from "./selection.ts"

type App = Awaited<ReturnType<typeof createTestRenderer>>

// These tests intentionally inspect OpenTUI 0.8.0's real render tree and native
// cell buffers. A fabricated Selection would miss layout and range-unit bugs.
function descendants(node: any): any[] {
  return [node, ...node.getChildren().flatMap(descendants)]
}

function textNode(markdown: MarkdownRenderable, text: string, occurrence = 0): any {
  const nodes = descendants(markdown).filter((node) => node.plainText === text)
  expect(nodes.length).toBeGreaterThan(occurrence)
  return nodes[occurrence]
}

function tableNode(markdown: MarkdownRenderable): any {
  const table = descendants(markdown).find((node) => node.constructor.name === "TextTableRenderable")
  expect(table).toBeDefined()
  return table
}

function cellPosition(table: any, row: number, column: number, offset = 0) {
  expect(table._cells[row]?.[column]).toBeDefined()
  return {
    x: table.x + table._layout.columnOffsets[column] + 1 + table._cellPaddingX + offset,
    y: table.y + table._layout.rowOffsets[row] + 1 + table._cellPaddingY,
  }
}

async function fixture(
  content: string | string[],
  run: (app: App, markdown: MarkdownRenderable[]) => Promise<void>,
  options: {
    width?: number
    hyperlinks?: boolean
    renderNode?: (app: App, style: SyntaxStyle) => MarkdownOptions["renderNode"]
  } = {},
) {
  const width = options.width ?? 90
  const app = await createTestRenderer({ width, height: 60 })
  const style = SyntaxStyle.fromStyles({
    default: { fg: "#ffffff" },
    "markup.strong": { bold: true },
    "markup.italic": { italic: true },
  }, app.renderer.nativeScene)
  try {
    setRendererCapabilities(app.renderer, { hyperlinks: options.hyperlinks ?? true })
    const markdown = (Array.isArray(content) ? content : [content]).map((source, index) => {
      const node = new MarkdownRenderable(app.renderer, {
        id: `markdown-${index}`,
        width,
        internalBlockMode: "top-level",
        syntaxStyle: style,
        content: source,
        renderNode: options.renderNode?.(app, style),
        tableOptions: { style: "grid", cellPaddingX: 1 },
      })
      app.renderer.root.add(node)
      return node
    })
    await app.renderOnce()
    await Promise.all(markdown.flatMap(descendants).map((node) => node.highlightingDone))
    await app.renderOnce()
    await run(app, markdown)
  } finally {
    await app.dispose()
    style.destroy()
  }
}

async function drag(app: App, start: { x: number; y: number }, end: { x: number; y: number }) {
  await app.mockMouse.drag(start.x, start.y, end.x, end.y)
  await app.renderOnce()
}

// Offsets are terminal cells, not UTF-16 indices. Mouse endpoints are inclusive.
async function selectText(app: App, node: any, start: number, end: number) {
  await drag(app, { x: node.x + start, y: node.y }, { x: node.x + end - 1, y: node.y })
}

function copied(app: App) {
  const selection = app.renderer.getSelection()
  expect(selection).not.toBeNull()
  const result = copySelection(selection!)
  expect(result).toBeDefined()
  expect(result!.text).toBe(selection!.getSelectedText())
  expect(result!.warnings).toEqual([])
  return result!
}

function body(html: string) {
  return html.replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, "")
}

function visible(html: string) {
  return body(html).replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, "&")
}

test("returns undefined for an actual empty Selection", async () => {
  await fixture("nothing selected", async (app, [markdown]) => {
    const node = textNode(markdown!, "nothing selected")
    const empty = new Selection(node, { x: node.x, y: node.y }, { x: node.x, y: node.y })
    expect(empty.getSelectedText()).toBe("")
    expect(copySelection(empty)).toBeUndefined()
    await app.mockMouse.click(node.x + 2, node.y)
    const selection = app.renderer.getSelection()
    if (selection) expect(copySelection(selection)).toBeUndefined()
  })
})

test("clips a heading and its bold run, rather than copying the whole block", async () => {
  await fixture("## Hidden **selected words** omitted", async (app, [markdown]) => {
    const node = textNode(markdown!, "Hidden selected words omitted")
    await selectText(app, node, 9, 17)
    const result = copied(app)
    expect(result.text).toBe("lected w")
    expect(result.html).toMatch(/<h2\b[^>]*>[\s\S]*<strong>lected w<\/strong>[\s\S]*<\/h2>/)
    expect(visible(result.html).trim()).toBe(result.text)
  })
})

test("keeps an ordered-list subset's numbering and clips its first and last items", async () => {
  await fixture("7. excluded before\n8. alpha **bravo**\n9. charlie *delta*\n10. excluded after", async (app, [markdown]) => {
    const first = textNode(markdown!, "alpha bravo")
    const last = textNode(markdown!, "charlie delta")
    await drag(app, { x: first.x + 3, y: first.y }, { x: last.x + 9, y: last.y })
    const result = copied(app)
    expect(result.html).toMatch(/<ol\b[^>]*\bstart="8"/)
    expect(result.html).toMatch(/<li\b[^>]*\bvalue="8"[^>]*>[\s\S]*ha <strong>bravo<\/strong>/)
    expect(result.html).toMatch(/<li\b[^>]*\bvalue="9"[^>]*>[\s\S]*charlie <em>de<\/em>/)
    expect(result.html.match(/<li\b/g)).toHaveLength(2)
    expect(visible(result.html)).not.toContain("excluded")
    expect(visible(result.html)).not.toContain("alpha")
    expect(visible(result.html)).not.toContain("delta")
  })
})

test("preserves a zero-based ordered list", async () => {
  await fixture("0. zero\n1. one", async (app, [markdown]) => {
    const first = textNode(markdown!, "zero")
    const last = textNode(markdown!, "one")
    await drag(app, { x: first.x, y: first.y }, { x: last.x + 2, y: last.y })
    const result = copied(app)
    expect(result.html).toContain('<ol start="0">')
    expect(result.html).toMatch(/<li value="0">[\s\S]*zero[\s\S]*<li value="1">[\s\S]*one/)
  })
})

test("copies nested custom Markdown once when its ancestor is also selected", async () => {
  await fixture("outer text\n\n```nested\ninner word\n```", async (app, [markdown]) => {
    const first = textNode(markdown!, "outer text")
    const last = textNode(markdown!, "inner word")
    await drag(app, { x: first.x, y: first.y }, { x: last.x + 9, y: last.y })
    const result = copySelection(app.renderer.getSelection()!)!
    expect(result.text).toBe("outer text\ninner word")
    expect(visible(result.html).match(/outer text/g)).toHaveLength(1)
    expect(visible(result.html).match(/inner word/g)).toHaveLength(1)
  }, {
    renderNode: (app, style) => (token) => token.type === "code"
      ? new MarkdownRenderable(app.renderer, {
        id: "nested-markdown", content: "inner **word**", width: 90,
        syntaxStyle: style, internalBlockMode: "top-level",
      }) : undefined,
  })
})

test("a layout mismatch preserves text from already-visited items in its fallback", async () => {
  await fixture("1. first words\n2. second words", async (app, [markdown]) => {
    const first = textNode(markdown!, "first words")
    const last = textNode(markdown!, "second words")
    await drag(app, { x: first.x, y: first.y }, { x: last.x + 11, y: last.y })
    const token: any = markdown!._blockStates[0]!.token
    // Emulate a changed renderer/token layout after the first item was visited.
    token.items[1].tokens.push({ type: "text", raw: "missing renderable", text: "missing renderable" })
    const result = copySelection(app.renderer.getSelection()!)!
    expect(result.warnings).toContain("List content layout changed")
    expect(visible(result.html).match(/first words/g)).toHaveLength(1)
    expect(visible(result.html).match(/second words/g)).toHaveLength(1)
    expect(visible(result.html)).not.toContain("missing renderable")
  })
})

test("preserves nested bullets without importing unselected siblings", async () => {
  await fixture("- parent **bold**\n  - child *one*\n  - child two\n- excluded sibling", async (app, [markdown]) => {
    const first = textNode(markdown!, "parent bold")
    const last = textNode(markdown!, "child one")
    await drag(app, { x: first.x, y: first.y }, { x: last.x + 8, y: last.y })
    const result = copied(app)
    expect(result.html).toMatch(/<ul\b[^>]*>\s*<li\b[^>]*>[\s\S]*parent <strong>bold<\/strong>[\s\S]*<ul\b[^>]*>\s*<li\b[^>]*>[\s\S]*child <em>one<\/em>/)
    expect(result.html.match(/<ul\b/g)).toHaveLength(2)
    expect(visible(result.html)).not.toContain("child two")
    expect(visible(result.html)).not.toContain("excluded sibling")
  })
})

test("uses the selected repeated occurrence, not the first matching source text", async () => {
  await fixture("same\n\n**same**\n\n*same*", async (app, [markdown]) => {
    const node = textNode(markdown!, "same", 2)
    await selectText(app, node, 0, 4)
    const result = copied(app)
    expect(result.html).toContain("<em>same</em>")
    expect(result.html).not.toContain("<strong>")
    expect(visible(result.html).trim()).toBe("same")
  })
})

test("clips a native table cell and preserves only the selected inline styles", async () => {
  await fixture("| Header | Other |\n| --- | --- |\n| alpha **bravo** *charlie* | excluded |", async (app, [markdown]) => {
    const table = tableNode(markdown!)
    await drag(app, cellPosition(table, 1, 0, 8), cellPosition(table, 1, 0, 14))
    const result = copied(app)
    expect(result.text).toBe("avo cha")
    expect(result.html).toMatch(/<table\b[\s\S]*<tbody>[\s\S]*<tr>[\s\S]*<td\b[^>]*><strong>avo<\/strong> <em>cha<\/em><\/td>/)
    expect(result.html.match(/<td\b/g)).toHaveLength(1)
    expect(result.html).not.toMatch(/<th\b/)
    expect(visible(result.html).trim()).toBe(result.text)
  })
})

const grid = "| Head A | Head B | Head C |\n| --- | --- | --- |\n| left one | **middle one** | right one |\n| left two | *middle two* | right two |\n| left three | middle three | right three |"

test("a table column subset does not copy other columns or an unselected header", async () => {
  await fixture(grid, async (app, [markdown]) => {
    const table = tableNode(markdown!)
    await drag(app, cellPosition(table, 1, 1), cellPosition(table, 2, 1, 9))
    const result = copied(app)
    expect(result.html.match(/<tr\b/g)).toHaveLength(2)
    expect(result.html.match(/<td\b/g)).toHaveLength(2)
    expect(result.html).toContain("<strong>middle one</strong>")
    expect(result.html).toContain("<em>middle two</em>")
    expect(result.html).not.toMatch(/<th\b/)
    for (const excluded of ["Head", "left", "right", "three"]) {
      expect(visible(result.html)).not.toContain(excluded)
    }
  })
})

test("a table row subset keeps just the selected row and columns", async () => {
  await fixture(grid, async (app, [markdown]) => {
    const table = tableNode(markdown!)
    await drag(app, cellPosition(table, 2, 0), cellPosition(table, 2, 1, 9))
    const result = copied(app)
    expect(result.html.match(/<tr\b/g)).toHaveLength(1)
    expect(result.html.match(/<td\b/g)).toHaveLength(2)
    expect(visible(result.html)).toContain("left two")
    expect(result.html).toContain("<em>middle two</em>")
    for (const excluded of ["Head", "one", "three", "right"]) {
      expect(visible(result.html)).not.toContain(excluded)
    }
  })
})

test("a selected header remains a th and does not pull in data rows", async () => {
  await fixture(grid, async (app, [markdown]) => {
    const table = tableNode(markdown!)
    await drag(app, cellPosition(table, 0, 1), cellPosition(table, 0, 1, 5))
    const result = copied(app)
    expect(result.text).toBe("Head B")
    expect(result.html).toMatch(/<th\b[^>]*>Head B<\/th>/)
    expect(result.html).not.toMatch(/<td\b/)
    expect(visible(result.html).trim()).toBe("Head B")
  })
})

test("maps wrapped visual rows back to one clipped paragraph", async () => {
  await fixture("prefix **bold words continue across several wrapped rows** suffix excluded", async (app, [markdown]) => {
    const node = textNode(markdown!, "prefix bold words continue across several wrapped rows suffix excluded")
    expect(node.height).toBeGreaterThan(1)
    const lines = app.captureCharFrame().split("\n")
    const endRow = lines.findIndex((line, index) => index >= node.y && line.includes("rows"))
    expect(endRow).toBeGreaterThan(node.y)
    const endColumn = lines[endRow]!.indexOf("rows") + 3
    await drag(app, { x: node.x + 9, y: node.y }, { x: endColumn, y: endRow })
    const result = copied(app)
    expect(result.html.match(/<p\b/g)).toHaveLength(1)
    expect(result.html).toContain("<strong>ld words continue across several wrapped rows</strong>")
    expect(visible(result.html).trim()).toBe("ld words continue across several wrapped rows")
  }, { width: 25 })
})

for (const prefix of ["雪山 ", "🐈😀 ", "e\u0301 "]) {
  test(`converts native range offsets after ${JSON.stringify(prefix)} to JS offsets`, async () => {
    await fixture(`${prefix}**target** tail`, async (app, [markdown]) => {
      const node = textNode(markdown!, `${prefix}target tail`)
      const start = Bun.stringWidth(prefix)
      await selectText(app, node, start + 1, start + 5)
      const result = copied(app)
      expect(result.text).toBe("arge")
      expect(result.html).toContain("<strong>arge</strong>")
      expect(visible(result.html).trim()).toBe("arge")
    })
  })
}

test("converts native table cell ranges after CJK, emoji and combining text", async () => {
  const prefix = "雪 🐈 e\u0301 "
  await fixture(`| Header |\n| --- |\n| ${prefix}**target** tail |`, async (app, [markdown]) => {
    const table = tableNode(markdown!)
    const start = Bun.stringWidth(prefix)
    await drag(app, cellPosition(table, 1, 0, start + 1), cellPosition(table, 1, 0, start + 4))
    const result = copied(app)
    expect(result.text).toBe("arge")
    expect(result.html).toContain("<strong>arge</strong>")
    expect(visible(result.html).trim()).toBe("arge")
  })
})

test("preserves selected CJK, emoji and combining graphemes in styled text", async () => {
  const selected = "雪 🐈 e\u0301"
  await fixture(`before **${selected}** after`, async (app, [markdown]) => {
    const node = textNode(markdown!, `before ${selected} after`)
    await selectText(app, node, 7, 7 + Bun.stringWidth(selected))
    const result = copied(app)
    expect(result.text).toBe(selected)
    expect(result.html).toContain(`<strong>${selected}</strong>`)
    expect(visible(result.html).trim()).toBe(selected)
  })
})

test("preserves block order when selecting from a paragraph through a table", async () => {
  await fixture("excluded **before start**\n\n| Head | Other |\n| --- | --- |\n| *selected cell* | excluded cell |\n\nexcluded after", async (app, [markdown]) => {
    const node = textNode(markdown!, "excluded before start")
    const table = tableNode(markdown!)
    await drag(app, { x: node.x + 9, y: node.y }, cellPosition(table, 1, 0, 7))
    const result = copied(app)
    expect(result.html).toMatch(/<p\b[^>]*><strong>before start<\/strong><\/p>[\s\S]*<table\b/)
    expect(result.html).toContain("<em>selected</em>")
    expect(visible(result.html)).not.toContain("excluded after")
    expect(visible(result.html)).not.toContain("excluded cell")
  })
})

test("maps a selection across separate Markdown renderables independently", async () => {
  await fixture(["first **same**", "second *same* tail"], async (app, markdown) => {
    const first = textNode(markdown[0]!, "first same")
    const second = textNode(markdown[1]!, "second same tail")
    await drag(app, { x: first.x + 6, y: first.y }, { x: second.x + 10, y: second.y })
    const result = copied(app)
    expect(result.html).toMatch(/<strong>same<\/strong>[\s\S]*second <em>same<\/em>/)
    expect(visible(result.html)).not.toContain("first")
    expect(visible(result.html)).not.toContain("tail")
  })
})

test("keeps a clipped fenced code block as pre/code and escapes its source", async () => {
  await fixture('```text\nexcluded <tag> & "quoted" tail\n```', async (app, [markdown]) => {
    const node = textNode(markdown!, 'excluded <tag> & "quoted" tail')
    await selectText(app, node, 9, 23)
    const result = copied(app)
    expect(result.text).toBe('<tag> & "quote')
    expect(result.html).toMatch(/<pre\b[^>]*><code\b[^>]*>[\s\S]*&lt;tag&gt; &amp; /)
    expect(result.html).not.toContain("<tag>")
    expect(visible(result.html).trim()).toBe(result.text)
  })
})

for (const hyperlinks of [true, false]) {
  test(`clips link labels with terminal hyperlinks ${hyperlinks ? "enabled" : "disabled"}`, async () => {
    await fixture("before [visible label](https://example.org/path?a=1&b=2) after", async (app, [markdown]) => {
      const node = descendants(markdown!).find((node) => node.plainText?.startsWith("before visible label"))
      expect(node).toBeDefined()
      await selectText(app, node, 10, 18)
      const result = copied(app)
      expect(result.text).toBe("ible lab")
      expect(result.html).toMatch(/<a\b[^>]*href="https:\/\/example\.org\/path\?a=1&amp;b=2"[^>]*>ible lab<\/a>/)
      expect(visible(result.html).trim()).toBe("ible lab")
    }, { hyperlinks })
  })
}

test("escapes quotes and ampersands in a safe link href", async () => {
  await fixture('[label](<https://example.org/"quoted"?a=1&b=2>)', async (app, [markdown]) => {
    const node = descendants(markdown!).find((node) => node.plainText?.startsWith("label"))
    expect(node).toBeDefined()
    await selectText(app, node, 0, 5)
    const result = copied(app)
    expect(result.text).toBe("label")
    expect(result.html).toMatch(/<a\b[^>]*href="https:\/\/example\.org\/&quot;quoted&quot;\?a=1&amp;b=2"[^>]*>label<\/a>/)
    expect(visible(result.html).trim()).toBe("label")
  })
})

test("escapes raw HTML and never emits an executable link target", async () => {
  await fixture('prefix <img src=x onerror="alert(1)"> [unsafe](javascript:alert%281%29) suffix', async (app, [markdown]) => {
    const node = descendants(markdown!).find((node) => node.plainText?.startsWith("prefix "))
    expect(node).toBeDefined()
    await selectText(app, node, 0, Bun.stringWidth(node.plainText))
    const result = copied(app)
    expect(body(result.html)).not.toMatch(/<img\b|<script\b|<[^>]+\bonerror\s*=/i)
    expect(body(result.html)).not.toMatch(/\bhref\s*=\s*["']?\s*javascript:/i)
    expect(visible(result.html)).toContain("unsafe")
    expect(visible(result.html)).toContain('<img src=x onerror="alert(1)">')
  })
})

for (const gesture of ["drag", "word", "line"] as const) {
  test(`selection completion can be read in a microtask after ${gesture} mouse release`, async () => {
    await fixture("alpha **selected** omega", async (app, [markdown]) => {
      const node = textNode(markdown!, "alpha selected omega")
      const completed: ReturnType<typeof copySelection>[] = []
      const listener = () => {
        queueMicrotask(() => {
          const selection = app.renderer.getSelection()
          if (selection && !selection.isDragging) completed.push(copySelection(selection))
        })
      }
      app.renderer.on("selection", listener)
      try {
        if (gesture === "drag") {
          await app.mockMouse.pressDown(node.x + 6, node.y)
          await app.mockMouse.moveTo(node.x + 13, node.y)
          await Promise.resolve()
          expect(completed.filter(Boolean)).toHaveLength(0)
          await app.mockMouse.release(node.x + 13, node.y)
        } else {
          await app.mockMouse.doubleClick(node.x + 8, node.y)
          if (gesture === "line") await app.mockMouse.click(node.x + 8, node.y)
        }
        await Promise.resolve()
        const result = copied(app)
        expect(result.text).toBe(gesture === "line" ? "alpha selected omega" : "selected")
        expect(completed.at(-1)).toEqual(result)
        expect(result.html).toContain("<strong>selected</strong>")
      } finally {
        app.renderer.off("selection", listener)
      }
    })
  })
}
