import { linksIn, parseLink, type FileLink } from "./links.ts"

type Point = { x: number; y: number }
type Target = Point & {
  id?: string
  parent?: Target
  plainText?: string
  lineInfo?: { lineSources: number[]; lineStartCols: number[]; lineWraps: number[]; lineWidthCols: number[] }
}
type Mouse = Point & {
  type: string
  button: number
  modifiers: { ctrl: boolean; alt: boolean; shift: boolean }
  isDragging: boolean
}
type Renderer = {
  sendMouseEvent?: (target: Target, event: Mouse) => void
  getLinkAt?: (x: number, y: number) => string | null
  getSelection: () => { anchor: Point; focus: Point; isStart: boolean; behavior: string } | null
}

function isTranscript(target: Target) {
  for (let node: Target | undefined = target; node; node = node.parent) {
    if (node.id?.startsWith("session-part:") || node.id?.startsWith("msg_")) return true
  }
  return false
}

function atCell(target: Target, event: Point, directory: string, width: (text: string) => number) {
  const info = target.lineInfo
  if (!info || typeof target.plainText !== "string") return
  const row = event.y - target.y
  const x = event.x - target.x
  const source = info.lineSources?.[row]
  const first = row - info.lineWraps?.[row]
  const offset = info.lineStartCols?.[row] - info.lineStartCols?.[first]
  if (source === undefined || !Number.isFinite(offset) || !(x >= 0 && x < info.lineWidthCols?.[row])) return
  const line = target.plainText.split("\n")[source]
  if (line === undefined) return
  const column = offset + x
  for (const match of linksIn(line, directory)) {
    if (column >= width(line.slice(0, match.start)) && column < width(line.slice(0, match.end))) return match.link
  }
}

// OpenCode 2.3.2 opens links on a bubbling mouse-up before root handlers run.
// Intercept just file clicks at OpenTUI's dispatch boundary; never replace the URL opener.
export function installFileClicks(
  renderer: Renderer,
  directory: () => string | undefined,
  width: (text: string) => number,
  open: (link: FileLink, directory: string, explicit: boolean) => boolean,
) {
  const dispatch = renderer.sendMouseEvent
  if (typeof dispatch !== "function" || typeof renderer.getLinkAt !== "function" ||
      typeof renderer.getSelection !== "function") return
  function handle(this: Renderer, target: Target, event: Mouse) {
    if (event.type === "up" && event.button === 0 && event.isDragging && !Object.values(event.modifiers).some(Boolean)) {
      try {
        const selection = renderer.getSelection()
        if (selection?.isStart && selection.behavior === "cell" && [selection.anchor, selection.focus]
          .every((point) => point.x === event.x && point.y === event.y) && isTranscript(target)) {
          const cwd = directory()
          if (cwd) {
            const href = renderer.getLinkAt?.(event.x, event.y)
            const link = href ? parseLink(href, cwd, true) : atCell(target, event, cwd, width)
            if (link?.kind === "file" && open(link, cwd, Boolean(href))) return
          }
        }
      } catch {
        // An incompatible renderer should keep its own mouse behavior.
      }
    }
    return dispatch?.call(this, target, event)
  }
  try {
    renderer.sendMouseEvent = handle
  } catch {
    return
  }
  return () => {
    if (renderer.sendMouseEvent === handle) renderer.sendMouseEvent = dispatch
  }
}
