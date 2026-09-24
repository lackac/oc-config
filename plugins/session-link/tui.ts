import { spawnSync } from "node:child_process"
import { sessionLinkDefinition } from "./rpc"

const SessionLink = sessionLinkDefinition

export default {
  id: "opencode.session-link.cli",
  setup(context) {
    const paneID = process.env.TMUX_PANE
    if (!paneID || !/^%[0-9]+$/.test(paneID)) return

    const tmux = (...args: string[]) => spawnSync("tmux", args, { stdio: "ignore" })
    tmux("set-option", "-p", "-t", paneID, "@opencode-tui", "1")

    const rpc = context.client.rpc(SessionLink)
    const open = async (request: { paneID: string; requestID: string; sessionID: string }) => {
      if (request.paneID !== paneID) return
      const current = context.ui.router.current()
      if (current.type !== "session" || current.sessionID !== request.sessionID) {
        if (context.ui.tabs.enabled()) context.ui.tabs.focus(request.sessionID)
        else context.ui.router.navigate({ type: "session", sessionID: request.sessionID })
      }
      await rpc.acknowledge({ paneID, requestID: request.requestID })
    }

    const stop = rpc.events.on("requested", (event) => {
      void open(event.data).catch(console.error)
    })
    void rpc.pending({ paneID }).then((request) => {
      if (request.sessionID && request.requestID) {
        return open({ paneID, sessionID: request.sessionID, requestID: request.requestID })
      }
    }).catch(console.error)

    return () => {
      stop()
      tmux("set-option", "-p", "-u", "-t", paneID, "@opencode-tui")
    }
  },
}
