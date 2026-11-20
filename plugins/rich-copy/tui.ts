import { copySelection } from "./selection.ts"
import { writeClipboard } from "./clipboard.ts"

export default {
  id: "local.rich-copy.cli",
  setup(context) {
    if (process.platform !== "darwin") return
    const renderer = context.renderer
    const automatic = context.options.automatic === true
    let disposed = false
    let generation = 0
    let abort: AbortController | undefined
    let pending = Promise.resolve()
    let last = `Waiting for a selection. Automatic rich copying is ${automatic ? "on" : "off"}.`

    const copy = () => {
      const selection = renderer.getSelection()
      if (!selection || selection.isDragging) return
      const version = ++generation
      abort?.abort()
      // OpenTUI emits before refreshing selectedRenderables. Read after that update.
      queueMicrotask(() => {
        if (disposed || version !== generation || renderer.getSelection() !== selection || selection.isDragging) return
        try {
          const payload = copySelection(selection)
          if (!payload) return
          pending = pending.then(async () => {
            if (disposed || version !== generation) return
            abort = new AbortController()
            const started = performance.now()
            try {
              await writeClipboard(payload, { signal: abort.signal, name: context.options.pasteboard })
              if (disposed || version !== generation) return
              last = `${payload.text.length} text characters; ${payload.html.length} HTML characters; ${Math.round(performance.now() - started)} ms to write.\n\n${payload.warnings.join("\n") || "All selected Markdown mapped successfully."}`
              context.ui.toast.show({
                message: payload.warnings.length ? "Copied rich text with plain-text fallback · /rich-copy-info" : "Copied rich text",
                variant: payload.warnings.length ? "warning" : "success",
              })
            } catch (error) {
              if (disposed || version !== generation || abort.signal.aborted) return
              last = String(error)
              context.ui.toast.show({ message: `Rich copy failed: ${last}`, variant: "error" })
            }
          })
        } catch (error) {
          last = String(error)
          context.ui.toast.show({ message: `Rich selection failed: ${last}`, variant: "error" })
        }
      })
    }
    if (automatic) renderer.on("selection", copy)
    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "local.rich-copy.info", title: "Show rich-copy result", group: "Rich copy", palette: true,
          slash: { name: "rich-copy-info" },
          run: () => context.ui.dialog.alert({ title: "Rich copy", message: last }),
        },
      ],
    }))
    return async () => {
      disposed = true
      generation++
      abort?.abort()
      renderer.off("selection", copy)
      await pending
    }
  },
}
