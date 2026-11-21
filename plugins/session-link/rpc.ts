const uuid = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
const blockID = new RegExp(`^block:${uuid}$`)
const requestID = new RegExp(`^${uuid}$`)
const sessionID = /^ses_[A-Za-z0-9]+$/

export const isBlockID = (value: unknown): value is string => typeof value === "string" && blockID.test(value)
export const isRequestID = (value: unknown): value is string => typeof value === "string" && requestID.test(value)
export const isSessionID = (value: unknown): value is string => typeof value === "string" && sessionID.test(value)

// OpenCode V2's RPC JSON Schema validator rejects pattern keywords.
const ids = {
  blockID: { type: "string" },
  requestID: { type: "string" },
  sessionID: { type: "string" },
} as const
const empty = { type: "object", properties: {}, additionalProperties: false } as const
const errors = { invalid_id: empty }

const request = {
  type: "object" as const,
  properties: {
    sessionID: ids.sessionID,
    blockID: ids.blockID,
  },
  required: ["sessionID", "blockID"],
  additionalProperties: false,
}

export const sessionLinkDefinition = {
  id: "opencode.session-link",
  methods: {
    request: {
      input: request,
      errors,
      output: {
        type: "object",
        properties: { requestID: ids.requestID },
        required: ["requestID"],
      },
    },
    pending: {
      errors,
      input: {
        type: "object",
        properties: { blockID: ids.blockID },
        required: ["blockID"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          requestID: { type: ["string", "null"] },
          sessionID: { type: ["string", "null"] },
          acknowledged: { type: "boolean" },
        },
        required: ["requestID", "sessionID", "acknowledged"],
      },
    },
    acknowledge: {
      errors,
      input: {
        type: "object",
        properties: {
          blockID: ids.blockID,
          requestID: ids.requestID,
        },
        required: ["blockID", "requestID"],
        additionalProperties: false,
      },
      output: empty,
    },
  },
  events: {
    requested: {
      schema: {
        type: "object",
        properties: ids,
        required: ["blockID", "requestID", "sessionID"],
        additionalProperties: false,
      },
    },
  },
} as const
