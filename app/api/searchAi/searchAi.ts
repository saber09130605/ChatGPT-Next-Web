import { NextRequest } from "next/server";

import { searchOpenAi } from "./handleFunction";

import { SHOW_ZOOM_MODELS } from "@/app/constant";

export async function searchAi(req: NextRequest) {
  const reqClone = req.clone();
  const cloneBody = await reqClone.json();
  const model = cloneBody?.model;

  const zoomModel = cloneBody?.zoomModel;
  const lastMessages = cloneBody?.messages.slice(-1)[0];
  if (
    zoomModel &&
    zoomModel != "none" &&
    lastMessages.role == "user" &&
    SHOW_ZOOM_MODELS.includes(model)
  ) {
    try {
      const request: NextRequest | undefined = await searchOpenAi(req);
      if (request) {
        return { request };
      }
      // 如果没有函数调用，返回逐字流式响应
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
