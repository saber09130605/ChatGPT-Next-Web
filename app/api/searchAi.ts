import { NextRequest } from "next/server";
export async function searchAi(req: NextRequest) {
  const reqClone = req.clone();
  const cloneBody = await reqClone.json();
  const zoomModel = cloneBody?.zoomModel;
  const lastMessages = cloneBody?.messages.slice(-1)[0];
  console.log("zoomModel", zoomModel);
  console.log("lastMessages", lastMessages);
  if (zoomModel && zoomModel != "none" && lastMessages.role == "user") {
    const content = lastMessages.content;
    try {
      const searXNGResponse = await fetch(
        `${process.env.NEXT_SEARXNG_BASE_URL}/search?q=${encodeURIComponent(
          content,
        )}&category=${zoomModel}&format=json`,
      );
      const searXNGData = await searXNGResponse.json();
      const results = searXNGData.results.slice(0, 5).map((item: any) => ({
        title: item?.title || "",
        link: item?.url || "",
        snippet: item?.content || "",
      }));
      const messages = cloneBody.messages;
      const afterMessages = [
        ...messages,
        {
          role: "tool",
          name: zoomModel,
          content: JSON.stringify(results),
        },
      ];
      cloneBody.messages = afterMessages;
      delete cloneBody.zoomModel;
      console.log("messages ", cloneBody.messages);
      // 创建新的请求对象
      const modifiedReq = new NextRequest(req.url, {
        method: req.method,
        headers: req.headers,
        body: JSON.stringify(cloneBody),
      });

      req = modifiedReq;
      return req;
    } catch (error) {
      return undefined;
    }
  }
}
