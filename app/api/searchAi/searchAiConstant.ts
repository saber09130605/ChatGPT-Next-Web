export const tools = [
  {
    type: "function",
    function: {
      name: "general",
      description: "搜索因素",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "要搜索的查询。" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "news",
      description: "搜索新闻",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "搜索新闻的查询。",
          },
        },
        required: ["query"],
      },
    },
  },
];
