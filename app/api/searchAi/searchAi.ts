import { NextRequest } from "next/server";
import { requestOpenai } from "../common";
import { news, general } from "./handleFunction";
import { tools } from "./searchAiConstant";
import { getServerSideConfig } from "../../config/server";

const serverConfig = getServerSideConfig();

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
      const searchData = await response.clone().json();
      // console.log("searchData", searchData);
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
      const newHeaders = new Headers(response.headers);
      newHeaders.delete("www-authenticate");
      // to disable nginx buffering
      newHeaders.set("X-Accel-Buffering", "no");
      if (!serverConfig.openaiOrgId || serverConfig.openaiOrgId.trim() === "") {
        newHeaders.delete("OpenAI-Organization");
      }

      // The latest version of the OpenAI API forced the content-encoding to be "br" in json response
      // So if the streaming is disabled, we need to remove the content-encoding header
      // Because Vercel uses gzip to compress the response, if we don't remove the content-encoding header
      // The browser will try to decode the response with brotli and fail
      newHeaders.delete("content-encoding");
      // console.log("没有调用自定义函数", response);
      return {
        response: new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        }),
      };
    } catch (error) {}
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
