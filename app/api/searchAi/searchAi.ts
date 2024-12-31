// app/api/searchAi/searchAi.ts

import { NextRequest, NextResponse } from "next/server";
import { requestOpenai } from "../common";
import { news, general } from "./handleFunction";
import { tools } from "./searchAiConstant";

export async function searchAi(
  req: NextRequest,
): Promise<{ request: NextRequest } | { response: NextResponse }> {
  try {
    // 克隆请求并解析请求体
    const reqClone = req.clone();
    const cloneBody = await reqClone.json();
    const zoomModel = cloneBody?.zoomModel;
    const messages = cloneBody?.messages || [];
    const lastMessages = messages.slice(-1)[0];

    console.log("searchAi - zoomModel:", zoomModel);
    console.log("searchAi - lastMessages:", lastMessages);

    // 判断是否需要处理 zoomModel 且最后一条消息来自用户
    if (zoomModel && zoomModel !== "none" && lastMessages?.role === "user") {
      const searchBody = {
        model: cloneBody.model,
        messages: [lastMessages],
        max_tokens: 3000,
        tools: tools,
        tool_choice: "auto",
      };

      console.log(
        "searchAi - searchBody:",
        JSON.stringify(searchBody, null, 2),
      );

      // 创建新的请求对象
      const searchReq = new NextRequest(req.url, {
        method: req.method,
        headers: req.headers,
        body: JSON.stringify(searchBody),
      });

      // 调用 requestOpenai 函数
      const response = await requestOpenai(searchReq);

      if (!response || !response.body) {
        console.error("searchAi - Empty response from requestOpenai");
        return {
          response: NextResponse.json(
            { error: true, message: "empty response from server" },
            { status: 500 },
          ),
        };
      }

      const responseClone = response.clone(); // 克隆响应对象
      const searchData = await responseClone.json();

      console.log(
        "searchAi - searchData:",
        JSON.stringify(searchData, null, 2),
      );

      // 确保 searchData 结构正确
      if (
        !searchData ||
        !searchData.choices ||
        !Array.isArray(searchData.choices) ||
        searchData.choices.length === 0
      ) {
        console.error("searchAi - Invalid searchData structure");
        return {
          response: NextResponse.json(
            { error: true, message: "invalid response structure from server" },
            { status: 500 },
          ),
        };
      }

      delete cloneBody.zoomModel;
      const modifiedMessages = [
        ...cloneBody.messages,
        searchData.choices[0].message,
      ];
      let calledCustomFunction = false;

      // 检查是否存在函数调用
      if (searchData.choices[0].message.tool_calls) {
        const toolCalls = searchData.choices[0].message.tool_calls;
        const availableFunctions = {
          general: general,
          news: news,
        };

        console.log(
          "searchAi - toolCalls:",
          JSON.stringify(toolCalls, null, 2),
        );

        for (const toolCall of toolCalls) {
          const functionName = toolCall.function.name;
          const functionToCall =
            availableFunctions[functionName as keyof typeof availableFunctions];

          if (!functionToCall) {
            console.warn(`searchAi - Unknown function name: ${functionName}`);
            continue; // 跳过未知的函数调用
          }

          let functionArgs;
          try {
            functionArgs = JSON.parse(toolCall.function.arguments);
          } catch (e) {
            console.error("searchAi - Failed to parse function arguments:", e);
            continue; // 跳过无法解析的函数调用
          }

          let functionResponse: string;

          try {
            if (functionName === "general") {
              functionResponse = await functionToCall(functionArgs.query);
            } else if (functionName === "news") {
              functionResponse = await functionToCall(functionArgs.query);
            } else {
              console.warn(
                `searchAi - Unsupported function name: ${functionName}`,
              );
              continue; // 跳过不支持的函数调用
            }
          } catch (e) {
            console.error(
              `searchAi - Error executing function ${functionName}:`,
              e,
            );
            functionResponse = `Error executing function ${functionName}`;
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
        console.log("searchAi - No function calls found");
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
    console.error("searchAi - Unexpected Error:", error);
    return {
      response: NextResponse.json(
        { error: true, message: "Internal Server Error" },
        { status: 500 },
      ),
    };
  }
}
