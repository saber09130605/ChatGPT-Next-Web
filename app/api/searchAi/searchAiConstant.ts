export const tools = [
  {
    type: "function",
    function: {
      name: "general",
      description: "search for factors",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The query to search." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "news",
      description: "Search for news",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The query to search for news.",
          },
        },
        required: ["query"],
      },
    },
  },
];
