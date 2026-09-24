import { sessionLinkDefinition } from "./rpc"

const SessionLink = sessionLinkDefinition

type Request = { paneID: string; sessionID: string; requestID: string; created: number }

export default {
  id: "opencode.session-link",
  async setup(context) {
    const pending = new Map<string, Request>()
    const registration = await context.rpc.register(SessionLink, {
      request: async (input) => {
        const { paneID, sessionID } = input as { paneID: string; sessionID: string }
        if (!/^%[0-9]+$/.test(paneID) || !/^ses_[A-Za-z0-9]+$/.test(sessionID)) {
          throw new Error("Invalid session or pane ID")
        }
        await context.session.get({ sessionID })
        const requestID = crypto.randomUUID()
        pending.set(paneID, { paneID, sessionID, requestID, created: Date.now() })
        await registration.events.emit("requested", { paneID, sessionID, requestID })
        return { requestID }
      },
      pending: async (input) => {
        const { paneID } = input as { paneID: string }
        if (!/^%[0-9]+$/.test(paneID)) throw new Error("Invalid pane ID")
        const request = pending.get(paneID)
        if (!request || Date.now() - request.created > 120_000) {
          pending.delete(paneID)
          return { requestID: null, sessionID: null }
        }
        return { requestID: request.requestID, sessionID: request.sessionID }
      },
      acknowledge: async (input) => {
        const { paneID, requestID } = input as { paneID: string; requestID: string }
        if (!/^%[0-9]+$/.test(paneID)) throw new Error("Invalid pane ID")
        if (pending.get(paneID)?.requestID === requestID) pending.delete(paneID)
        return {}
      },
    })
    return () => registration.dispose()
  },
}
