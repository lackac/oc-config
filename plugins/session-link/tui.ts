import { isBlockID, isRequestID, isSessionID, sessionLinkDefinition } from "./rpc.ts"

export default {
  id: "opencode.session-link.cli",
  setup(context) {
    const blockID = process.env.REX_BLOCK
    if (!isBlockID(blockID)) return

    const rpc = context.client.rpc(sessionLinkDefinition)
    let generation = 0
    const openPending = async (location: { directory: string }) => {
      const currentGeneration = ++generation
      const { requestID, sessionID, acknowledged } = await rpc.pending({ blockID }, { location })
      if (currentGeneration !== generation || acknowledged !== false || !isRequestID(requestID) || !isSessionID(sessionID)) return

      const current = context.ui.router.current()
      if (current.type !== "session" || current.sessionID !== sessionID) {
        if (context.ui.tabs.enabled()) context.ui.tabs.focus(sessionID)
        else context.ui.router.navigate({ type: "session", sessionID })
      }
      await rpc.acknowledge({ blockID, requestID }, { location })
    }

    const stop = rpc.events.on("requested", (event) => {
      const { blockID: target, requestID, sessionID } = event.data
      if (target !== blockID || !isRequestID(requestID) || !isSessionID(sessionID)) return
      // A queued event may have been superseded by a newer request.
      return openPending(event.location).catch(console.error)
    })
    void openPending(context.location ?? context.data.location.default()).catch(console.error)

    return () => {
      generation++
      stop()
    }
  },
}
