import { NextResponse } from "next/server";

export function middleware(request) {
  console.log("Request URL:", request.url);
  console.log("Request Method:", request.method);
  // 可以添加更多日志信息

  return NextResponse.next();
}

// 匹配所有 API 请求
export const config = {
  matcher: "/api/:path*",
};
