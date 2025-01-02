import { getServerSideConfig } from "@/app/config/server";
import {
  MOONSHOT_BASE_URL,
  ApiPath,
  ModelProvider,
  ServiceProvider,
} from "@/app/constant";
import { prettyObject } from "@/app/utils/format";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth";
import { isModelAvailableInServer } from "@/app/utils/model";
import { verifyInput } from "./verifyinput";

const serverConfig = getServerSideConfig();

const tools = [
  {
    type: "builtin_function",
    function: {
      name: "$web_search",
    },
  },
];
export async function handle(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  console.log("[Moonshot Route] params ", params);
  if (req.method === "OPTIONS") {
    return NextResponse.json({ body: "OK" }, { status: 200 });
  }

  const authResult = auth(req, ModelProvider.Moonshot);
  if (authResult.error) {
    return NextResponse.json(authResult, {
      status: 401,
    });
  }

  try {
    const response = await request(req);
    return response;
  } catch (e) {
    console.error("[Moonshot handle] ", e);
    return NextResponse.json(prettyObject(e));
  }
}

async function request(req: NextRequest) {
  const reqClone = req.clone();
  const cloneBody = await reqClone.json();
  const lastMessages = cloneBody?.messages.slice(-1)[0];
  const controller = new AbortController();

  // alibaba use base url or just remove the path
  const pathname = req.nextUrl.pathname;
  let path = `${pathname}`.replaceAll(ApiPath.Moonshot, "");
  let baseUrl = serverConfig.moonshotUrl || MOONSHOT_BASE_URL;

  if (!baseUrl.startsWith("http")) {
    baseUrl = `https://${baseUrl}`;
  }

  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }

  console.log("[Proxy] ", path);
  console.log("[Base Url]", baseUrl);

  const timeoutId = setTimeout(
    () => {
      controller.abort();
    },
    10 * 60 * 1000,
  );

  // 克隆请求对象
  const clonedReqBody = req.clone();
  const clonedReq = new NextRequest(req.url, {
    method: req.method,
    headers: req.headers,
    body: clonedReqBody.body,
  });

  const fetchUrl = `${baseUrl}${path}`;
  const fetchOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      Authorization: req.headers.get("Authorization") ?? "",
    },
    method: req.method,
    body: req.body,
    redirect: "manual",
    // @ts-ignore
    duplex: "half",
    signal: controller.signal,
  };

  // #1815 try to refuse some request to some models
  if (serverConfig.customModels && req.body) {
    try {
      const clonedBody = await req.text();
      fetchOptions.body = clonedBody;

      const jsonBody = JSON.parse(clonedBody) as { model?: string };

      // not undefined and is false
      if (
        isModelAvailableInServer(
          serverConfig.customModels,
          jsonBody?.model as string,
          ServiceProvider.Moonshot as string,
        )
      ) {
        return NextResponse.json(
          {
            error: true,
            message: `you are not allowed to use ${jsonBody?.model} model`,
          },
          {
            status: 403,
          },
        );
      }
    } catch (e) {
      console.error(`[Moonshot] filter`, e);
    }
  }

  try {
    await verifyInput(clonedReq);
    if (
      cloneBody.zoomModel &&
      cloneBody.zoomModel != "none" &&
      lastMessages.role == "user"
    ) {
      const baseMessages = cloneBody.messages;
      const searchBody = {
        model: cloneBody.model,
        messages: [lastMessages],
        tools,
        temperature: 0.3,
      };
      const searchOptions: RequestInit = {
        ...fetchOptions,
        body: JSON.stringify(searchBody),
      };

      const response = await fetch(fetchUrl, searchOptions);
      const responseClone = response.clone(); // 克隆响应对象
      const searchData = await responseClone.json();
      console.log("searchData", searchData);
      const choice = searchData.choices[0];
      const finishReason = choice.finish_reason;
      let calledCustomFunction = false;
      if (finishReason === "tool_calls") {
        baseMessages.push(choice.message);
        for (const toolCall of choice.message.tool_calls) {
          if (toolCall.function.name === "$web_search") {
            const tool_call_name = toolCall.function.name;
            let tool_result: string;
            if (tool_call_name == "$web_search") {
              tool_result = toolCall.function.arguments;
            } else {
              tool_result = JSON.stringify("no tool found");
            }
            baseMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name: tool_call_name,
              content: tool_result, // <-- 我们约定使用字符串格式向 Kimi 大模型提交工具调用结果，因此在这里使用 JSON.stringify 将执行结果序列化成字符串
            });
            calledCustomFunction = true;
          }
        }
      }
      if (calledCustomFunction) {
        cloneBody.messages = baseMessages;
        console.log("baseMessages", baseMessages);
        fetchOptions.body = JSON.stringify(cloneBody);
        const res = await fetch(fetchUrl, fetchOptions);
        // to prevent browser prompt for credentials
        const newHeaders = new Headers(res.headers);
        newHeaders.delete("www-authenticate");
        // to disable nginx buffering
        newHeaders.set("X-Accel-Buffering", "no");
        console.log("联网二次查询");
        return new Response(res.body, {
          status: res.status,
          statusText: res.statusText,
          headers: newHeaders,
        });
      }
      // 没有调用自定义函数的情况下，直接返回 Kimi 大模型的响应
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
              console.log("chunk", chunk);
              const content = searchData.choices[0].message.content;
              let charIndex = 0;

              function sendNextChar() {
                if (charIndex < content.length) {
                  const char = content[charIndex];
                  const formattedChunk = JSON.stringify({
                    id: searchData.id,
                    object: "chat.completion.chunk",
                    created: searchData.created,
                    model: searchData.model,
                    system_fingerprint: searchData.system_fingerprint,
                    choices: [
                      {
                        index: 0,
                        delta: { content: char },
                        finish_reason: null,
                      },
                    ],
                  });
                  controller.enqueue(
                    encoder.encode(`data: ${formattedChunk}\n\n`),
                  );
                  charIndex++;
                  setTimeout(sendNextChar, 10); // 控制字符发送速度
                } else {
                  push();
                }
              }

              sendNextChar();
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
      console.log("联网第一次查询成功流式返回");
      const sseResponse = new Response(stream, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
      return sseResponse;
    }
    console.log("不联网查询");
    const res = await fetch(fetchUrl, fetchOptions);

    // to prevent browser prompt for credentials
    const newHeaders = new Headers(res.headers);
    newHeaders.delete("www-authenticate");
    // to disable nginx buffering
    newHeaders.set("X-Accel-Buffering", "no");

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: newHeaders,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
