// app/api/searchAi/searchAi.ts

import { NextRequest, NextResponse } from "next/server";
import { requestOpenai } from "../common";
import { news, general } from "./handleFunction";
import { tools } from "./searchAiConstant";

export async function searchAi(
  req: NextRequest,
): Promise<{ request: NextRequest } | { response: NextResponse }> {
  try {
    const reqClone = req.clone();
    const cloneBody = await reqClone.json();
    const zoomModel = cloneBody?.zoomModel;
    const lastMessages = cloneBody?.messages.slice(-1)[0];

    if (zoomModel && zoomModel !== "none" && lastMessages.role === "user") {
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
          let functionResponse: string;

          if (functionName === "general") {
            functionResponse = await functionToCall(functionArgs.query);
          } else if (functionName === "news") {
            functionResponse = await functionToCall(functionArgs.query);
          } else {
            console.warn(`未知的函数名称: ${functionName}`);
            continue; // 跳过未知的函数调用
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
        return { request: modifiedReq };
      }

      // 如果没有函数调用，返回流式响应
      const newHeaders = new Headers(response.headers);
      newHeaders.delete("www-authenticate");
      newHeaders.set("X-Accel-Buffering", "no");
      newHeaders.delete("content-encoding");
      newHeaders.set("content-type", "text/event-stream");

      // 使用 NextResponse 来确保兼容性，并包裹在 { response: ... } 对象中
      const sseResponse = new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });

      return { response: sseResponse };
    }

    // 如果不需要处理 zoomModel，移除相关字段并返回修改后的请求
    delete cloneBody.zoomModel;
    const modifiedReq = new NextRequest(req.url, {
      method: req.method,
      headers: req.headers,
      body: JSON.stringify(cloneBody),
    });
    return { request: modifiedReq };
  } catch (error) {
    console.error("Error in searchAi:", error);
    return {
      response: new NextResponse("Internal Server Error", { status: 500 }),
    };
  }
}
