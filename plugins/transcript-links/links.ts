import { homedir } from "node:os"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

export type FileLink = { kind: "file"; file: string; line?: number; column?: number }
type WebLink = { kind: "web"; url: string }
export type Link = FileLink | WebLink

const control = /[\x00-\x1f\x7f]/

export function parseLink(value: string, directory: string, explicit = false): Link | undefined {
  if (!value || control.test(value)) return
  if (/^https?:\/\//i.test(value)) {
    const url = URL.parse(value)
    return url ? { kind: "web", url: url.href } : undefined
  }
  if (value.startsWith("#") || value.startsWith("//")) return

  const anchor = /#L?(\d+)(?::(\d+)|(?:-L?\d+))?$/.exec(value)
  const position = anchor ?? /:(\d+)(?::(\d+)|(?:-\d+))?$/.exec(value)
  let file = position ? value.slice(0, position.index) : value
  if (!file || /^[a-z][a-z0-9+.-]*:/i.test(file) && !/^file:\/\//i.test(file)) return
  if (!explicit && !position && !file.includes("/") && !file.includes(".") &&
      !/^(?:[A-Z][A-Z0-9_-]+|[A-Z][a-z]+file)$/.test(file)) return

  try {
    if (/^file:\/\//i.test(file)) {
      const url = new URL(file)
      if (url.hash || url.search) return
      file = fileURLToPath(url)
    } else if (explicit) {
      file = decodeURIComponent(file)
    }
  } catch {
    return
  }
  if (!file || control.test(file) || file.startsWith("//")) return
  if (file.startsWith("~/")) file = resolve(homedir(), file.slice(2))

  const line = position ? Number(position[1]) : undefined
  const column = position?.[2] ? Number(position[2]) : undefined
  if ([line, column].some((n) => n !== undefined && (!Number.isInteger(n) || n < 1 || n > 0x7fffffff))) return
  return { kind: "file", file: resolve(directory, file), line, column }
}

const web = String.raw`(?:https?|file):\/\/[^\s<>"'\x60]+`
// Consume full tokens so URL fragments and unsupported schemes don't become partial path matches.
const word = String.raw`[\p{L}\p{M}\p{N}_.~@+%/\\:?#=&-]+`
const markdown = String.raw`(?<![!\\])\[([^\]\r\n]+)\]\((?:<([^>\r\n]+)>|((?:\\[()]|\([^()\r\n]*\)|[^\s()])+))(?:[ \t]+(?:"[^"\r\n]*"|'[^'\r\n]*'))?\)`

function trimToken(value: string): string {
  let text = value.replace(/[.,;:!?]+$/u, "")
  if (text.endsWith(")")) {
    let surplus = text.split(")").length - text.split("(").length
    while (surplus-- > 0 && text.endsWith(")")) text = text.slice(0, -1)
  }
  return text.replace(/[.,;:!?]+$/u, "")
}

export function* linksIn(text: string, directory: string, source = false) {
  const pattern = new RegExp((source ? `${markdown}|` : "") + `${web}|${word}`, "giu")
  for (const match of text.matchAll(pattern)) {
    const [raw, label, bracketed, href] = match
    const explicit = label !== undefined
    const value = explicit ? (bracketed ?? href).replace(/\\([()])/g, "$1") : trimToken(raw)
    if (!explicit && (raw === "." || raw === ".." || !value)) continue
    const link = parseLink(value, directory, explicit)
    if (link) yield { link, label, value, start: match.index, end: match.index + (explicit ? raw.length : value.length) }
  }
}
