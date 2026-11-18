// Compatibility adapter for OpenCode 2.2.5 / OpenTUI 0.8.0. The block states,
// list child layout, text buffers, and table cells below are renderer internals.
type Range = { start: number; end: number }
type Buffer = { getPlainText(): string; getTextRange(start: number, end: number): string }
type Token = {
  type?: string
  text?: string
  raw?: string
  tokens?: Token[]
  items?: Token[]
  header?: Token[]
  rows?: Token[][]
  ordered?: boolean
  start?: number | string
  depth?: number
  href?: string
}
type Node = {
  id: string
  x: number
  y: number
  parent?: Node | null
  isDestroyed?: boolean
  plainText?: string
  textBuffer?: Buffer
  getChildren(): Node[]
  getSelectedText(): string
  getSelection?(): Range | null
  _blockStates?: { token: Token; renderable: Node }[]
  _cells?: { textBuffer: Buffer; textBufferView: { getSelection(): Range | null; getSelectedText(): string } }[][]
}
type SelectionInput = {
  getSelectedText(): string
  selectedRenderables: unknown[]
  isStart?: boolean
  behavior?: string
}
type Slice = { full: string; text: string; start: number; end: number }
type Run = { text: string; open: string; close: string }

export const escapeHTML = (text: string) => text.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]!)

function safeLink(value: string | undefined): string | undefined {
  if (!value || /[\u0000-\u0020\u007f]/.test(value)) return
  try {
    if (["https:", "http:", "mailto:"].includes(new URL(value, "https://opencode.invalid/").protocol)) return value
  } catch {}
}

function inlineRuns(tokens: Token[], expandedLinks: boolean, open = "", close = ""): Run[] {
  return tokens.flatMap((token): Run[] => {
    const tags: Record<string, string> = { strong: "strong", em: "em", del: "s", codespan: "code" }
    const tag = token.type ? tags[token.type] : undefined
    const href = token.type === "link" ? safeLink(token.href) : undefined
    const before = tag ? `<${tag}>` : href ? `<a href="${escapeHTML(href)}">` : ""
    const after = tag ? `</${tag}>` : href ? "</a>" : ""
    const content = token.tokens
      ? inlineRuns(token.tokens, expandedLinks, open + before, after + close)
      : [{ text: token.type === "br" ? "\n" : token.text ?? token.raw ?? "", open: open + before, close: after + close }]
    if (expandedLinks && token.type === "link" && token.href && token.text !== token.href &&
        token.raw !== token.text && token.raw !== `<${token.text}>`) {
      content.push({ text: ` (${token.href})`, open, close })
    }
    return content
  })
}

function readSlice(buffer: Buffer, range: Range, text: string): Slice | undefined {
  // Native offsets count terminal cells, not JS UTF-16 units. Ask the native
  // buffer for the prefix rather than guessing how wide emoji/CJK/graphemes are.
  const full = buffer.getPlainText()
  const prefix = buffer.getTextRange(0, Math.min(range.start, range.end))
  const start = prefix.length
  if (full.slice(start, start + text.length) !== text) return
  return { full, text, start, end: start + text.length }
}

export function copySelection(selection: SelectionInput): { text: string; html: string; warnings: string[] } | undefined {
  if (selection.isStart && selection.behavior === "cell") return
  const text = selection.getSelectedText()
  if (!text) return
  const selected = new Set((selection.selectedRenderables as Node[]).filter((node) => !node.isDestroyed))
  const warnings = new Set<string>()
  const handled = new Set<Node>()
  const order = (a: Node, b: Node) => a.y - b.y || a.x - b.x
  const children = (node: Node) => node.getChildren()
  const hasSelected = (node: Node): boolean => (selected.has(node) && !handled.has(node)) || children(node).some(hasSelected)
  const warn = (message: string) => warnings.add(message)

  function plain(node: Node): string {
    if (!selected.has(node) || handled.has(node)) return children(node).map(plain).filter(Boolean).join("\n")
    handled.add(node)
    const value = node.getSelectedText()
    return value ? `<pre style="white-space:pre-wrap">${escapeHTML(value)}</pre>` : ""
  }

  function inline(tokens: Token[], slice: Slice | undefined, value: string): string {
    if (slice) {
      for (const expanded of [false, true]) {
        const runs = inlineRuns(tokens, expanded)
        const projected = runs.map((run) => run.text).join("")
        if (projected !== slice.full && projected.replace(/\n+$/, "") !== slice.full) continue
        let offset = 0
        return runs.map((run) => {
          const start = Math.max(0, slice.start - offset)
          const end = Math.min(run.text.length, slice.end - offset)
          offset += run.text.length
          return end > start ? run.open + escapeHTML(run.text.slice(start, end)) + run.close : ""
        }).join("")
      }
    }
    warn("Inline formatting could not be mapped; selected text was preserved")
    return escapeHTML(value)
  }

  function leaf(token: Token, node: Node): string {
    if (!selected.has(node) || handled.has(node)) return ""
    handled.add(node)
    const value = node.getSelectedText()
    if (!value) return ""
    if (token.type === "code") return `<pre><code>${escapeHTML(value)}</code></pre>`
    const range = node.getSelection?.()
    const slice = range && node.textBuffer ? readSlice(node.textBuffer, range, value) : undefined
    const content = inline(token.tokens ?? [token], slice, value)
    const tag = token.type === "heading" && token.depth && token.depth >= 1 && token.depth <= 6 ? `h${token.depth}` : "p"
    return `<${tag} style="white-space:pre-wrap">${content}</${tag}>`
  }

  function list(token: Token, node: Node): string {
    const rows = children(node)
    if (!token.items || rows.length !== token.items.length) throw new Error("List layout changed")
    const parsedStart = token.start === "" || token.start === undefined ? 1 : Number(token.start)
    const start = Number.isFinite(parsedStart) ? parsedStart : 1
    const items: { index: number; html: string }[] = []
    token.items.forEach((item, index) => {
      const row = rows[index]
      if (!hasSelected(row)) return
      const [marker, body] = children(row)
      if (!marker || !body) throw new Error("List item layout changed")
      const tokens = (item.tokens ?? []).filter((child) => child.type !== "space" && child.type !== "checkbox")
      const nodes = children(body)
      if (nodes.length !== tokens.length) throw new Error("List content layout changed")
      if (selected.has(marker)) handled.add(marker)
      const content = tokens.map((child, childIndex) => block(child, nodes[childIndex])).join("")
      if (!content && !selected.has(marker)) return
      items.push({ index, html: `<li${token.ordered ? ` value="${start + index}"` : ""}>${content}</li>` })
    })
    if (!items.length) return ""
    const tag = token.ordered ? "ol" : "ul"
    return `<${tag}${token.ordered ? ` start="${start + items[0].index}"` : ""}>${items.map((item) => item.html).join("")}</${tag}>`
  }

  function table(token: Token, node: Node): string {
    if (!selected.has(node) || handled.has(node)) return ""
    const rows = [token.header ?? [], ...(token.rows ?? [])]
    const cells = node._cells
    if (!cells || cells.length !== rows.length) throw new Error("Table layout changed")
    const content: { row: number; column: number; html: string }[] = []
    cells.forEach((row, rowIndex) => row.forEach((cell, column) => {
      const range = cell.textBufferView.getSelection()
      if (!range) return
      const value = cell.textBufferView.getSelectedText()
      const source = rows[rowIndex]?.[column]
      if (!source) throw new Error("Table cell token missing")
      const slice = readSlice(cell.textBuffer, range, value)
      content.push({ row: rowIndex, column, html: inline(source.tokens ?? [source], slice, value) })
    }))
    if (!content.length) return ""
    handled.add(node)
    const first = Math.min(...content.map((cell) => cell.column))
    const last = Math.max(...content.map((cell) => cell.column))
    const html = [...new Set(content.map((cell) => cell.row))].map((row) => {
      const tag = row === 0 ? "th" : "td"
      return "<tr>" + Array.from({ length: last - first + 1 }, (_, index) => {
        const cell = content.find((cell) => cell.row === row && cell.column === first + index)
        return `<${tag} style="border:1px solid #aaa;padding:4px 8px;text-align:left;vertical-align:top;white-space:pre-wrap">${cell?.html ?? ""}</${tag}>`
      }).join("") + "</tr>"
    }).join("")
    return `<table style="border-collapse:collapse"><tbody>${html}</tbody></table>`
  }

  function block(token: Token, node: Node): string {
    if (!hasSelected(node)) return ""
    if (token.type === "list") return list(token, node)
    if (token.type === "table") return table(token, node)
    if (token.type === "blockquote") {
      warn("Blockquote content copied without nested formatting")
      return `<blockquote>${plain(node)}</blockquote>`
    }
    return leaf(token, node)
  }

  const roots = new Set<Node>()
  for (const node of selected) {
    let current: Node | null | undefined = node
    while (current && !Array.isArray(current._blockStates)) current = current.parent
    roots.add(current ?? node)
  }
  const fragments = [...roots].sort(order).map((root) => {
    if (!root._blockStates) return plain(root)
    return root._blockStates.map(({ token, renderable }) => {
      const before = new Set(handled)
      try {
        const html = block(token, renderable)
        // Unknown/custom renderers still copy their exact selected text.
        const remaining = (node: Node): string => selected.has(node) && !handled.has(node)
          ? plain(node) : children(node).map(remaining).filter(Boolean).join("\n")
        const fallback = remaining(renderable)
        if (fallback) warn("Custom Markdown content copied as plain text")
        return html + fallback
      } catch (error) {
        // A failed block discards its partial HTML, so its text must be eligible
        // for fallback again. Keep nodes consumed by earlier overlapping roots.
        for (const node of handled) if (!before.has(node)) handled.delete(node)
        warn(error instanceof Error ? error.message : "Renderer layout changed")
        return plain(renderable)
      }
    }).filter(Boolean).join("\n")
  })
  return { text, html: `<div>${fragments.join("\n")}</div>`, warnings: [...warnings] }
}
