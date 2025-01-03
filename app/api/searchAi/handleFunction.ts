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

export async function crawler(url: string) {
  console.log(`正在使用 URL 进行自定义爬取:${JSON.stringify(url)}`);
  try {
    const response = await fetch("https://api.search1api.com/crawl", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SEARCH1_API_KEY}`,
      },
      body: JSON.stringify({
        url: url,
      }),
    });

    if (!response.ok) {
      console.error(`API 请求失败, 状态码: ${response.status}`);
      return `API 请求失败, 状态码: ${response.status}`;
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      console.error("收到的响应不是有效的 JSON 格式");
      return "收到的响应不是有效的 JSON 格式";
    }

    const data = await response.json();
    console.log("自定义爬取服务调用完成");
    return JSON.stringify(data);
  } catch (error) {
    console.error(`在 crawler 函数中捕获到错误: ${error}`);
    return `在 crawler 函数中捕获到错误: ${error}`;
  }
}
