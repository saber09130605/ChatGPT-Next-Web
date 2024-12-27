import { NextRequest } from "next/server";
const tools = [
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
export async function searchAi(req: NextRequest) {
  const reqClone = req.clone();
  const cloneBody = await reqClone.json();
  const zoomModel = cloneBody?.zoomModel;
  const lastMessages = cloneBody?.messages.slice(-1)[0];
  console.log("zoomModel", zoomModel);
  console.log("lastMessages", lastMessages);
  if (zoomModel && zoomModel != "none" && lastMessages.role == "user") {
    // const content = lastMessages.content;
    try {
      // const results = searXNGData.results.slice(0, 5).map((item: any) => ({
      //   title: item?.title || "",
      //   link: item?.url || "",
      //   snippet: item?.content || "",
      // }));
      // const messages = cloneBody.messages;
      // const afterMessages = [
      //   ...messages,
      //   {
      //     role: "tool",
      //     name: zoomModel,
      //     content: JSON.stringify(results),
      //   },
      // ];
      // cloneBody.messages = afterMessages;
      delete cloneBody.zoomModel;
      cloneBody.tools = tools;
      cloneBody.tool_choice = "auto";
      const userMessages = cloneBody.messages.filter(
        (message: any) => message.role === "user",
      );
      cloneBody.messages = userMessages;
      console.log("search ai request", cloneBody);
      // 创建新的请求对象
      const modifiedReq = new NextRequest(req.url, {
        method: req.method,
        headers: req.headers,
        body: JSON.stringify(cloneBody),
      });

      // req = modifiedReq;
      // const response = await requestOpenai(req);
      // let data = await response.json();
      // console.log("确认解析后的 data 对象:", data);
      // console.log("search ai response", response);
      return modifiedReq;
    } catch (error) {
      return undefined;
    }
  }
}
