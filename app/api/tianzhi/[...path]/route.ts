import { NextRequest, NextResponse } from "next/server";
// import { auth } from "../../auth";

async function handleRequest(req: NextRequest) {
  if (req.method === "OPTIONS") {
    return new Response("OK", { status: 200 });
  }
  const authValue = req.headers.get("Authorization") ?? "";

  const { searchParams } = new URL(req.url);
  const host = searchParams.get("host") || "skycity.hiseven.cc";
  console.log(`https://${host}/admin/siteUsage/ping`);
  try {
    const response = await fetch(`https://${host}/admin/siteUsage/ping`, {
      method: "get",
      headers: {
        Authorization: authValue,
      },
    });
    const data = await response.json();
    return NextResponse.json(data, {
      status: 200,
    });
  } catch (error) {
    return NextResponse.json(error, {
      status: 200,
    });
  }
}

export const GET = handleRequest;
export const POST = handleRequest;
