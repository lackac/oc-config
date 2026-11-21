import { isBlockID, isRequestID, isSessionID, sessionLinkDefinition } from "./rpc.ts"

const requestTTL = 15_000
type Request = { sessionID: string; requestID: string; expiresAt: number; acknowledged: boolean }

export default {
  id: sessionLinkDefinition.id,
  async setup(context) {
    const pending = new Map<string, Request>()
    const registration = await context.rpc.register(sessionLinkDefinition, {
      request: async (input, rpc) => {
        const { blockID, sessionID } = input as { blockID: unknown; sessionID: unknown }
        if (!isBlockID(blockID) || !isSessionID(sessionID)) return rpc.error("invalid_id", "Invalid Rex block or session ID", {})
        await context.session.get({ sessionID })
        const requestID = crypto.randomUUID()
        const now = Date.now()
        for (const [target, request] of pending) {
          if (request.expiresAt <= now) pending.delete(target)
        }
        pending.set(blockID, { sessionID, requestID, expiresAt: now + requestTTL, acknowledged: false })
        await registration.events.emit("requested", { blockID, sessionID, requestID })
        return { requestID }
      },
      pending: async (input, rpc) => {
        const { blockID } = input as { blockID: unknown }
        if (!isBlockID(blockID)) return rpc.error("invalid_id", "Invalid Rex block ID", {})
        const request = pending.get(blockID)
        if (!request || request.expiresAt <= Date.now()) {
          pending.delete(blockID)
          return { requestID: null, sessionID: null, acknowledged: false }
        }
        const { requestID, sessionID, acknowledged } = request
        return { requestID, sessionID, acknowledged }
      },
      acknowledge: async (input, rpc) => {
        const { blockID, requestID } = input as { blockID: unknown; requestID: unknown }
        if (!isBlockID(blockID) || !isRequestID(requestID)) return rpc.error("invalid_id", "Invalid Rex block or request ID", {})
        const request = pending.get(blockID)
        if (request?.requestID === requestID && request.expiresAt > Date.now()) request.acknowledged = true
        return {}
      },
    })
    return () => registration.dispose()
  },
}
