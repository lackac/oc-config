export const quotaDefinition = {
  id: "local.quota",
  events: {},
  methods: {
    read: {
      input: {
        type: "object",
        properties: { refresh: { type: "boolean" } },
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          meters: {
            type: "array",
            items: {
              type: "object",
              properties: {
                provider: { type: "string" },
                updated: { type: "number" },
                error: { type: ["string", "null"] },
                windows: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string" },
                      remaining: { type: "number" },
                      reset: { type: ["number", "null"] },
                    },
                    required: ["label", "remaining", "reset"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["provider", "updated", "error", "windows"],
              additionalProperties: false,
            },
          },
        },
        required: ["meters"],
        additionalProperties: false,
      },
    },
  },
} as const
