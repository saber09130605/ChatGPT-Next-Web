import { type OpenAIListModelResponse } from "@/app/client/platforms/openai";
import { getServerSideConfig } from "@/app/config/server";
import { ModelProvider, OpenaiPath } from "@/app/constant";
import { prettyObject } from "@/app/utils/format";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "./auth";
import { requestOpenai } from "./common";
import { searchAi } from "./searchAi/searchAi";
import { verifyInput } from "./verifyinput";

const ALLOWED_PATH = new Set(Object.values(OpenaiPath));

function getModels(remoteModelRes: OpenAIListModelResponse) {
  const config = getServerSideConfig();

  if (config.disableGPT4) {
    remoteModelRes.data = remoteModelRes.data.filter(
      (m) =>
        !(
          m.id.startsWith("gpt-4") ||
          m.id.startsWith("chatgpt-4o") ||
          m.id.startsWith("o1")
        ) || m.id.startsWith("gpt-4o-mini"),
    );
  }

  return remoteModelRes;
}
function _isDalle3(model: string) {
  return "dall-e-3" === model;
}
export async function handle(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  console.log("[OpenAI Route] params ", params);
  // 克隆请求对象
  const zoomModelClonedReq = req.clone();
  const zoomModelBody = await zoomModelClonedReq.json();
  console.log("[OpenAI Route] zoomModelBody ", zoomModelBody);
  const isDalle3 = _isDalle3(zoomModelBody.model);
  const clonedReqBody = req.clone();
  const clonedReq = new NextRequest(req.url, {
    method: req.method,
    headers: req.headers,
    body: clonedReqBody.body,
  });

  if (req.method === "OPTIONS") {
    return NextResponse.json({ body: "OK" }, { status: 200 });
  }

  const subpath = params.path.join("/");

  if (!ALLOWED_PATH.has(subpath)) {
    // console.log("[OpenAI Route] forbidden path ", subpath);
    return NextResponse.json(
      {
        error: true,
        msg: "you are not allowed to request " + subpath,
      },
      {
        status: 403,
      },
    );
  }

  const authResult = auth(req, ModelProvider.GPT);

  if (authResult.error) {
    return NextResponse.json(authResult, {
      status: 401,
    });
  }

  try {
    let response: Response;
    if (isDalle3) {
      console.log("[OpenAI Route] isDalle3 strat", isDalle3);
      response = await requestOpenai(req);
      console.log("[OpenAI Route] isDalle3 end", isDalle3);
    } else {
      const searchReq = await searchAi(req);
      if (searchReq.response) {
        response = searchReq.response;
      } else {
        response = await requestOpenai(searchReq.request);
      }
    }

    // 在接口调用成功时调用 verifyInput
    await verifyInput(clonedReq);
    console.log("[OpenAI Route] verifyInput end");

    // list models
    if (subpath === OpenaiPath.ListModelPath && response.status === 200) {
      console.log("[OpenAI Route] response 200 strat");
      const resJson = (await response.json()) as OpenAIListModelResponse;
      console.log("[OpenAI Route] response json end");
      const availableModels = getModels(resJson);
      return NextResponse.json(availableModels, {
        status: response.status,
      });
    }

    return response;
  } catch (e) {
    console.error("[OpenAI] ", e);
    return NextResponse.json(prettyObject(e));
  }
}
