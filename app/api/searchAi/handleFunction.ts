import { NextRequest } from "next/server";
import { requestOpenai } from "../common";
import { tools } from "./searchAiConstant";
export async function news(query: any) {
  console.log(`正在使用查询进行新闻搜索: ${JSON.stringify(query)}`);
  try {
    const searXNGResponse = await fetch(
      `${process.env.NEXT_SEARXNG_BASE_URL}/search?q=${encodeURIComponent(
        query,
      )}&category=news&format=json`,
    );
    const searXNGData = await searXNGResponse.json();
    const results = searXNGData.results.slice(0, 5).map((item: any) => ({
      title: item?.title || "",
      link: item?.url || "",
      snippet: item?.content || "",
    }));
    const data = {
      results: results,
    };

    console.log("新闻搜索服务调用完成");
    return JSON.stringify(data);
  } catch (error) {
    console.error(`在 news 函数中捕获到错误: ${error}`);
    return `在 news 函数中捕获到错误: ${error}`;
  }
}
export async function general(query: any) {
  console.log(`正在使用查询进行社群搜索: ${JSON.stringify(query)}`);
  try {
    const searXNGResponse = await fetch(
      `${process.env.NEXT_SEARXNG_BASE_URL}/search?q=${encodeURIComponent(
        query,
      )}&category=general&format=json`,
    );
    const searXNGData = await searXNGResponse.json();
    const results = searXNGData.results.slice(0, 5).map((item: any) => ({
      title: item?.title || "",
      link: item?.url || "",
      snippet: item?.content || "",
    }));
    const data = {
      results: results,
    };

    console.log("新闻搜索服务调用完成");
    return JSON.stringify(data);
  } catch (error) {
    console.error(`在 general 函数中捕获到错误: ${error}`);
    return `在 general 函数中捕获到错误: ${error}`;
  }
}
export async function searchOpenAi(req: NextRequest) {
  const reqClone = req.clone();
  const cloneBody = await reqClone.json();
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
      if (calledCustomFunction) {
        cloneBody.messages = modifiedMessages;
        const modifiedReq = new NextRequest(req.url, {
          method: req.method,
          headers: req.headers,
          body: JSON.stringify(cloneBody),
        });
        return modifiedReq;
      }
    } else {
      console.log("没有发现函数调用");
    }
  } catch (error) {
    console.error(`在 searchOpenAi 函数中捕获到错误: ${error}`);
  }
}
