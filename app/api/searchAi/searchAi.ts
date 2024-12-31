import { NextRequest } from "next/server";
import { requestOpenai } from "../common";
import { news, general } from "./handleFunction";
import { tools } from "./searchAiConstant";

export async function searchAi(req: NextRequest) {
  const reqClone = req.clone();
  const cloneBody = await reqClone.json();
  const zoomModel = cloneBody?.zoomModel;
  const lastMessages = cloneBody?.messages.slice(-1)[0];
  if (zoomModel && zoomModel != "none" && lastMessages.role == "user") {
    try {
      const searchBody = {
        model: cloneBody.model,
        messages: [lastMessages],
        max_tokens: 3000,
        tools: tools,
        tool_choice: "auto",
      };
      // 创建新的请求对象
      const searchReq = new NextRequest(req.url, {
        method: req.method,
        headers: req.headers,
        body: JSON.stringify(searchBody),
      });
      const response = await requestOpenai(searchReq);

      const responseClone = response.clone(); // 克隆响应对象
      const searchData = await responseClone.json();
      delete cloneBody.zoomModel;
      const modifiedMessages = [
        ...cloneBody.messages,
        searchData.choices[0].message,
      ];
      let calledCustomFunction = false;
      if (searchData.choices[0].message.tool_calls) {
        const toolCalls = searchData.choices[0].message.tool_calls;
        const availableFunctions = {
          general: general,
          news: news,
        };
        for (const toolCall of toolCalls) {
          const functionName = toolCall.function.name;
          const functionToCall =
            availableFunctions[functionName as keyof typeof availableFunctions];
          const functionArgs = JSON.parse(toolCall.function.arguments);
          let functionResponse;
          if (functionName === "general") {
            functionResponse = await functionToCall(functionArgs.query);
          } else if (functionName === "news") {
            functionResponse = await functionToCall(functionArgs.query);
          }
          modifiedMessages.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name: functionName,
            content: functionResponse,
          });
          calledCustomFunction = true;
        }
      } else {
        console.log("没有发现函数调用");
      }
      if (calledCustomFunction) {
        cloneBody.messages = modifiedMessages;
        const modifiedReq = new NextRequest(req.url, {
          method: req.method,
          headers: req.headers,
          body: JSON.stringify(cloneBody),
        });
        return {
          request: modifiedReq,
        };
      }
      // 如果没有函数调用，返回流式响应
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          const decoder = new TextDecoder();
          const reader = response.body?.getReader();

          function push() {
            reader?.read().then(({ done, value }) => {
              if (done) {
                controller.close();
                return;
              }
              const chunk = decoder.decode(value, { stream: true });
              const formattedChunk = JSON.stringify({
                id: searchData.id,
                object: "chat.completion.chunk",
                created: searchData.created,
                model: searchData.model,
                system_fingerprint: searchData.system_fingerprint,
                choices: [
                  {
                    index: 0,
                    delta: { content: chunk },
                    finish_reason: null,
                  },
                ],
              });
              controller.enqueue(encoder.encode(`data: ${formattedChunk}\n\n`));
              push();
            });
          }

          push();
        },
      });

      const newHeaders = new Headers(response.headers);
      newHeaders.delete("www-authenticate");
      newHeaders.set("X-Accel-Buffering", "no");
      newHeaders.delete("content-encoding");
      newHeaders.set("content-type", "text/event-stream");

      const sseResponse = new Response(stream, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
      return { response: sseResponse };
    } catch (error) {
      console.error("Error in searchAi:", error);
      return {
        response: new Response("Internal Server Error", { status: 500 }),
      };
    }
  }
  delete cloneBody.zoomModel;
  const modifiedReq = new NextRequest(req.url, {
    method: req.method,
    headers: req.headers,
    body: JSON.stringify(cloneBody),
  });
  return {
    request: modifiedReq,
  };
}
