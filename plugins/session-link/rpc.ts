const request = {
  type: "object" as const,
  properties: {
    sessionID: { type: "string" as const },
    paneID: { type: "string" as const },
  },
  required: ["sessionID", "paneID"],
  additionalProperties: false,
}

export const sessionLinkDefinition = {
  id: "opencode.session-link",
  methods: {
    request: {
      input: request,
      output: {
        type: "object",
        properties: { requestID: { type: "string" } },
        required: ["requestID"],
      },
    },
    pending: {
      input: {
        type: "object",
        properties: { paneID: request.properties.paneID },
        required: ["paneID"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          requestID: { type: ["string", "null"] },
          sessionID: { type: ["string", "null"] },
        },
        required: ["requestID", "sessionID"],
      },
    },
    acknowledge: {
      input: {
        type: "object",
        properties: {
          paneID: request.properties.paneID,
          requestID: { type: "string" },
        },
        required: ["paneID", "requestID"],
        additionalProperties: false,
      },
      output: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  events: {
    requested: {
      schema: {
        type: "object",
        properties: {
          paneID: request.properties.paneID,
          requestID: { type: "string" },
          sessionID: request.properties.sessionID,
        },
        required: ["paneID", "requestID", "sessionID"],
        additionalProperties: false,
      },
    },
  },
} as const
