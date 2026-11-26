import { statSync } from "node:fs"
import { stat } from "node:fs/promises"
import { createOpener, openBrowser } from "./editor.ts"
import { linksIn, type Link } from "./links.ts"
import { installFileClicks } from "./mouse.ts"

type Message = {
  id: string
  type: string
  text?: string
  content?: { type: string; text?: string }[]
}

export async function transcriptOptions(messages: Message[], directory: string) {
  const found = new Map<string, { title: string; description?: string; value: string; link: Link }>()
  const existing = new Map<string, Promise<boolean>>()
  for (const message of messages) {
    const texts = message.type === "user" ? [message.text] :
      message.type === "assistant" ? message.content?.filter((part) => part.type === "text").map((part) => part.text) : []
    for (const text of texts ?? []) {
      if (!text) continue
      for (const { link, value, label } of linksIn(text, directory, true)) {
        if (link.kind === "file" && !existing.has(link.file)) {
          existing.set(link.file, stat(link.file).then((info) => info.isFile(), () => false))
        }
        const key = JSON.stringify(link)
        const previous = found.get(key)
        if (!previous || label && !previous.description) {
          found.set(key, { title: label ?? value, description: label && label !== value ? value : undefined, value: key, link })
        }
      }
    }
  }
  const options = await Promise.all([...found.values()].map(async ({ link, ...item }) =>
    link.kind === "web" || await existing.get(link.file) ? item : undefined))
  return options.filter((option) => option !== undefined)
}

export default {
  id: "local.transcript-links.cli",
  setup(context) {
    const openFile = createOpener()
    let disposed = false
    const active = () => {
      const route = context.ui.router.current()
      return route.type === "session" ? route.sessionID : undefined
    }
    const directory = (sessionID: string) => context.data.session.get(sessionID)?.location?.directory ??
      context.location?.directory ?? context.data.location.default()?.directory
    const notify = (message: string, variant: "info" | "error") => {
      if (!disposed) context.ui.toast.show({ title: "Transcript links", message, variant })
    }
    const open = async (link: Link, cwd: string) => {
      try {
        if (link.kind === "web") await openBrowser(link.url)
        else {
          if (!(await stat(link.file).catch(() => undefined))?.isFile()) throw new Error(`File not found: ${link.file}`)
          await openFile(link, cwd)
        }
      } catch (error) {
        notify(error instanceof Error ? error.message : String(error), "error")
      }
    }
    const stop = installFileClicks(context.renderer, () => {
      const sessionID = active()
      return sessionID ? directory(sessionID) : undefined
    }, (text) => Bun.stringWidth(text), (link, cwd, explicit) => {
      // Ignore path-shaped prose. Explicit Markdown file links can report a missing target.
      if (!explicit && !statSync(link.file, { throwIfNoEntry: false })?.isFile()) return false
      void open(link, cwd)
      return true
    })
    context.keymap.layer(() => ({
      mode: "global",
      commands: [{
        id: "local.transcript-links.open",
        title: "Open transcript link",
        group: "Session",
        palette: true,
        slash: { name: "links" },
        enabled: () => Boolean(active()),
        async run() {
          const sessionID = active()
          if (!sessionID) return
          const cwd = directory(sessionID)
          if (!cwd) return notify("Could not find the session directory", "error")
          try {
            // Use the current cache for streaming text, then page through older messages.
            const messages = new Map<string, Message>()
            const cached = context.data.session.message.list(sessionID) ?? []
            for (const message of [...cached].reverse()) messages.set(message.id, message)
            const signal = AbortSignal.timeout(10_000)
            let page = await context.client.message.list({ sessionID, order: "desc" }, { signal })
            while (!disposed && active() === sessionID) {
              for (const message of page.data) if (!messages.has(message.id)) messages.set(message.id, message)
              if (!page.cursor.next) break
              page = await context.client.message.list({ sessionID, cursor: page.cursor.next }, { signal })
            }
            if (disposed || active() !== sessionID) return
            const options = await transcriptOptions([...messages.values()], cwd)
            if (disposed || active() !== sessionID) return
            if (!options.length) return notify("No links or local files found in this conversation", "info")
            const result = await context.ui.dialog.select({
              title: "Open transcript link",
              options,
              search: (query, items) => {
                const words = query.toLowerCase().trim().split(/\s+/)
                return items.filter(({ title, description }) => {
                  const text = `${title} ${description ?? ""}`.toLowerCase()
                  return words.every((word) => text.includes(word))
                })
              },
            })
            if (result && !disposed && active() === sessionID) await open(JSON.parse(result), cwd)
          } catch (error) {
            notify(error instanceof Error ? error.message : String(error), "error")
          }
        },
      }],
    }))
    return () => {
      disposed = true
      stop?.()
    }
  },
}
