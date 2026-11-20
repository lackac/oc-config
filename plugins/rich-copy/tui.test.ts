import { expect, spyOn, test } from "bun:test"
import { TextareaRenderable } from "@opentui/core"
import { createTestRenderer } from "@opentui/core/testing"
import * as clipboard from "./clipboard.ts"
import plugin from "./tui.ts"

test("automatically copies a completed selection in the focused prompt", async () => {
  const app = await createTestRenderer({ width: 60, height: 10 })
  const write = spyOn(clipboard, "writeClipboard").mockResolvedValue()
  const cleanup = plugin.setup({
    renderer: app.renderer,
    options: { automatic: true },
    keymap: { layer() {} },
    ui: { toast: { show() {} } },
  })
  try {
    const prompt = new TextareaRenderable(app.renderer, {
      id: "prompt",
      initialValue: "before **selected** after",
      width: 60,
      height: 3,
    })
    app.renderer.root.add(prompt)
    prompt.focus()
    await app.renderOnce()
    expect(app.renderer.currentFocusedEditor).toBe(prompt)

    await app.mockMouse.pressDown(prompt.x + 7, prompt.y)
    await app.mockMouse.moveTo(prompt.x + 18, prompt.y)
    expect(write).not.toHaveBeenCalled()
    await app.mockMouse.release(prompt.x + 18, prompt.y)
    await app.renderOnce()

    expect(prompt.getSelectedText()).toBe("**selected**")
    expect(write).toHaveBeenCalledTimes(1)
    const payload = write.mock.calls[0]![0]
    expect(payload.text).toBe("**selected**")
    expect(payload.html).toContain("**selected**")
    expect(payload.html).not.toContain("<strong>")
    expect(prompt.plainText).toBe("before **selected** after")
  } finally {
    await cleanup?.()
    write.mockRestore()
    await app.dispose()
  }
})
