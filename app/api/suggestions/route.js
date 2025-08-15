// app/api/suggestions/route.js
import { NextResponse } from "next/server";
import Image from "@/models/Image"; // 你的圖片 Model；內含 title / tags / user.username 等欄位
// 若有集中連線工具（如 dbConnect），可在此引入並呼叫；沒有就略過
// import dbConnect from "@/lib/db";

function getQ(url) {
  return (
    url.searchParams.get("q") ||
    url.searchParams.get("search") ||
    ""
  ).trim();
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const q = getQ(url);
    if (!q) {
      return NextResponse.json({ suggestions: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    // await dbConnect?.(); // 若你有 dbConnect，可取消註解

    // 安全的 regex（跳脫特殊字元）
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const r = new RegExp(esc, "i");

    // 從圖片集合裡抓到可能的候選（標題 / 標籤 / 內嵌的 user ）
    const rows = await Image.find({
      $or: [
        { title: r },
        { description: r },
        { positivePrompt: r },
        { tags: r },
        { "user.username": r },
        { "user.name": r },
      ],
    })
      .select("title tags user.username user.name")
      .limit(60)       // 適度限制
      .lean();

    // 萃取字串並去重
    const bag = new Set();
    for (const it of rows) {
      if (it?.title && r.test(it.title)) bag.add(String(it.title));
      if (Array.isArray(it?.tags)) {
        for (const tag of it.tags) if (typeof tag === "string" && r.test(tag)) bag.add(tag);
      }
      const uname = it?.user?.username || it?.user?.name;
      if (uname && r.test(uname)) bag.add(String(uname));
    }

    // 輕度排序：把以 q 開頭的放前面，其餘照加入順序
    const qLower = q.toLowerCase();
    const list = Array.from(bag);
    list.sort((a, b) => {
      const aStarts = a.toLowerCase().startsWith(qLower);
      const bStarts = b.toLowerCase().startsWith(qLower);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return a.length - b.length; // 短的排前面一點
    });

    return NextResponse.json(
      { suggestions: list.slice(0, 10) },                 // 統一回傳 JSON
      { headers: { "Cache-Control": "max-age=60, public" } } // 可視需求調整快取
    );
  } catch (err) {
    // 即使出錯也回 JSON，避免前端解析 HTML 而報 Unexpected token '<'
    return NextResponse.json({ suggestions: [] }, { status: 200 });
  }
}
