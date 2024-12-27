export async function news(query: any) {
  console.log(`正在使用查询进行新闻搜索: ${JSON.stringify(query)}`);
  try {
    const searXNGResponse = await fetch(
      `${process.env.NEXT_SEARXNG_BASE_URL}/search?q=${encodeURIComponent(
        query,
      )}&category=news&format=json`,
    );
    const searXNGData = await searXNGResponse.json();
    console.log("searXNGData", searXNGData);
  } catch (error) {
    console.error("新闻搜索失败", error);
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
    console.log("searXNGData", searXNGData);
  } catch (error) {
    console.error("社群搜索失败", error);
  }
}
