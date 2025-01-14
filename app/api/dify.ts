import { getServerSideConfig } from "@/app/config/server";
import { ModelProvider, DIFY_BASE_URL } from "@/app/constant";
import { prettyObject } from "@/app/utils/format";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth";
import { verifyInput } from "./verifyinput";
import { models } from "../components/sd";

const serverConfig = getServerSideConfig();
export async function handle(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  console.log("[Dify Route] params ", params);

  if (req.method === "OPTIONS") {
    return NextResponse.json({ body: "OK" }, { status: 200 });
  }

  const authResult = auth(req, ModelProvider.Dify);
  if (authResult.error) {
    return NextResponse.json(authResult, {
      status: 401,
    });
  }
  try {
    const response = await request(req);
    return response;
  } catch (e) {
    console.error("[Dify] error", e);
    return NextResponse.json(prettyObject(e));
  }
}

async function request(req: NextRequest) {
  const reqClone = req.clone();
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => {
      controller.abort();
    },
    10 * 60 * 1000,
  );

  // 克隆请求对象
  // const clonedReqBody = req.clone();
  // const clonedReq = new NextRequest(req.url, {
  //   method: req.method,
  //   headers: req.headers,
  //   body: clonedReqBody.body,
  // });

  const data = await reqClone.text();
  const cloneData = JSON.parse(data);
  const lastMessages = cloneData?.messages?.slice(-1)[0];
  console.log({ lastMessages });
  const body = {
    inputs: {},
    query: lastMessages.content,
    response_mode: "blocking",
    user: lastMessages.role,
    conversation_id: cloneData.conversation_id,
  };

  const bodyVerify = {
    messages: [
      {
        role: "user", 
        content:lastMessages.content
      }
    ],
    model: cloneData.model
  };

  const clonedReq = new NextRequest(req.url, {
      method: req.method,
      headers: req.headers,
      body: JSON.stringify(bodyVerify),
    });

  const fetchOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      Authorization: req.headers.get("Authorization") ?? "",
    },
    method: req.method,
    body: JSON.stringify(body),
    redirect: "manual",
    // @ts-ignore
    duplex: "half",
    signal: controller.signal,
  };

  try {
    const response = await fetch(
      `${DIFY_BASE_URL}/v1/chat-messages`,
      fetchOptions,
    );

    await verifyInput(clonedReq);

    const responseClone = response.clone();
    const resData = await responseClone.json();
    console.log({ resData });

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const content = resData.answer;
        let charIndex = 0;

        function sendNextChar() {
          if (charIndex < content.length) {
            const char = content[charIndex];
            const formattedChunk = JSON.stringify({
              id: resData.id,
              object: "dify",
              created: resData.created_at,
              model: "dify",
              choices: [
                {
                  index: 0,
                  delta: { content: char },
                  finish_reason: null,
                },
              ],
              conversation_id: resData.conversation_id,
            });

            if (!controller.desiredSize) {
              console.warn("Stream controller is closed");
              return;
            }

            controller.enqueue(encoder.encode(`data: ${formattedChunk}\n\n`));
            charIndex++;
            setTimeout(sendNextChar, 2);
          } else {
            // Send the final [DONE] message and close the stream
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            controller.close();
          }
        }

        sendNextChar();
      },
    });

    const newHeaders = new Headers(response.headers);
    newHeaders.delete("www-authenticate");
    newHeaders.set("X-Accel-Buffering", "no");
    newHeaders.delete("content-encoding");
    newHeaders.set("content-type", "text/event-stream");

    return new Response(stream, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
