import { NextRequest } from "next/server";
import { parse } from "cookie";
import { ACCESS_CODE_PREFIX } from "../constant";
export async function verifyInput(req: NextRequest) {
  const reqClone = req.clone();
  const isAzure = req.nextUrl.pathname.includes("azure/deployments");
  const controller = new AbortController();
  let authValue,
    authHeaderName = "";
  if (isAzure) {
    authValue =
      req.headers
        .get("Authorization")
        ?.trim()
        .replaceAll("Bearer ", "")
        .trim() ?? "";

    authHeaderName = "api-key";
  } else {
    authValue = req.headers.get("Authorization") ?? "";
    authHeaderName = "Authorization";
  }
  const cookiesHeader = req.headers.get("cookie");
  const cookies = cookiesHeader ? parse(cookiesHeader) : {};
  const cacheCode = cookies.cachecode;
  let code = req.headers.get("code");
  console.log("verifyInput authValue", authValue);
  if (authValue.startsWith("Bearer ")) {
    authValue = authValue.replace("Bearer ", "");
  }
  if (authValue.startsWith(ACCESS_CODE_PREFIX)) {
    authValue = authValue.replace(ACCESS_CODE_PREFIX, "");
  }
  if (!code) {
    code = authValue;
  }
  const apifetchOptions: RequestInit = {
    // @ts-ignore
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      [authHeaderName]: authValue,
      CacheCode: cacheCode,
      Code: code,
      // ...(serverConfig.openaiOrgId && {
      //   "OpenAI-Organization": serverConfig.openaiOrgId,
      // }),
    },
    method: req.method,
    body: reqClone.body,
    // to fix #2485: https://stackoverflow.com/questions/55920957/cloudflare-worker-typeerror-one-time-use-body
    redirect: "manual",
    // @ts-ignore
    duplex: "half",
    signal: controller.signal,
  };
  try {
    await fetch("http://localhost:56521/api/verifyinput", apifetchOptions);
  } catch (error) {
    console.error("verifyinput error", error);
  }
}
