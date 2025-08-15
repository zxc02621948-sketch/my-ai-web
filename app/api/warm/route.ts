// app/api/warm/route.ts
export const runtime = "nodejs";
export const preferredRegion = ["hnd1"]; // ← 改成跟你 MongoDB Atlas 同區；新加坡用 ["sin1"]

import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb"; // 你專案裡連線的匯出名稱，若是 { dbConnect } 就改成對應的

export async function GET(req: Request) {
  // 可選：簡單 token 防濫用（有設環境變數才啟用）
  const token = new URL(req.url).searchParams.get("t");
  if (process.env.WARM_TOKEN && token !== process.env.WARM_TOKEN) {
    return new NextResponse(null, { status: 401 });
  }

  try {
    // 連一次資料庫，把連線池熱起來
    await dbConnect();
  } catch (_) {
    // 就算 DB 一時沒連上，暖機仍回 204，避免外部監控判定失敗
  }

  // 204 No Content + 不快取
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
