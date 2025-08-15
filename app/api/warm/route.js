// app/api/warm/route.js
export const runtime = "nodejs";
export const preferredRegion = ["hnd1"]; // 依你的 DB 區域調整，如新加坡用 ["sin1"]

import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db"; // 依你的專案：你是具名匯出 { dbConnect }

export async function GET(req) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t");

  // 可選：若設定了 WARM_TOKEN，就驗證 ?t=...
  if (process.env.WARM_TOKEN && token !== process.env.WARM_TOKEN) {
    return new NextResponse(null, {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    // 熱資料庫連線池
    await dbConnect();
  } catch (e) {
    // 就算失敗也別讓監控誤判：仍回 204
  }

  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
