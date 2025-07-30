import { searchLogMap } from "./shared";

export async function POST(req) {
  try {
    const { keyword, level = "all" } = await req.json();

    if (!keyword || typeof keyword !== "string") {
      return new Response(JSON.stringify({ error: "Missing keyword" }), { status: 400 });
    }

    const key = `${level}:${keyword.trim().toLowerCase()}`;

    const currentCount = searchLogMap.get(key) || 0;
    searchLogMap.set(key, currentCount + 1);

    return new Response(JSON.stringify({ success: true, count: currentCount + 1 }), { status: 200 });
  } catch (err) {
    console.error("搜尋記錄失敗：", err);
    return new Response(JSON.stringify({ error: "Internal Error" }), { status: 500 });
  }
}
