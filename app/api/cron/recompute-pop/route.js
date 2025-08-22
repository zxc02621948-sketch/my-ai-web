// app/api/cron/recompute-pop/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import { ensureLikesCount, computePopScore } from "@/utils/score";

async function handler(req) {
  try {
    await dbConnect();

    const url = new URL(req.url);
    const secret = req.headers.get("x-cron-secret") || url.searchParams.get("secret");
    if (secret !== process.env.ADMIN_SECRET) {
      // 保護避免被亂觸發
      return new NextResponse("Not found", { status: 404 });
    }

    const WINDOW_HOURS = Number(process.env.POP_NEW_WINDOW_HOURS ?? 10);
    const marginHours = Number(url.searchParams.get("marginHours") ?? 2); // 緩衝時數
    const since = new Date(Date.now() - (WINDOW_HOURS + marginHours) * 60 * 60 * 1000);

    const limit = Math.min(Number(url.searchParams.get("limit") ?? 1000), 5000);
    const dryRun = url.searchParams.get("dry") === "1";

    const cursor = Image.find(
      { createdAt: { $gte: since }, initialBoost: { $gt: 0 } },
      { likes: 1, likesCount: 1, clicks: 1, completenessScore: 1, initialBoost: 1, createdAt: 1, popScore: 1 }
    )
      .sort({ createdAt: 1 })
      .cursor();

    let scanned = 0, updated = 0;
    for await (const img of cursor) {
      scanned++;
      const nextLikesCount = ensureLikesCount(img);
      const nextPop = computePopScore({ ...img.toObject(), likesCount: nextLikesCount });

      const needUpdate = img.likesCount !== nextLikesCount || img.popScore !== nextPop;
      if (needUpdate) {
        if (!dryRun) {
          img.likesCount = nextLikesCount;
          img.popScore = nextPop; // 寫回含「新圖加成衰減」後的分數
          await img.save();
        }
        updated++;
      }
      if (updated >= limit) break; // 大量資料時分批跑
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      scanned,
      updated,
      windowHours: WINDOW_HOURS,
      marginHours,
      note: "已重算近窗格內新圖的 popScore（只在需要時寫回）"
    });
  } catch (err) {
    console.error("recompute-pop cron failed:", err);
    return new NextResponse("Server error", { status: 500 });
  }
}

export async function GET(req)  { return handler(req); }
export async function POST(req) { return handler(req); }
