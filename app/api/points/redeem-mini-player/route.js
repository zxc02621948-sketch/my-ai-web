// app/api/points/redeem-mini-player/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

/**
 * 測試用：0 積分購買迷你播放器（不扣點）
 * - 僅本人可操作
 * - 設定 miniPlayerPurchased = true
 */
export async function POST(req) {
  try {
    await dbConnect();

    const current = await getCurrentUserFromRequest(req);
    if (!current?._id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    // 直接開通，不扣積分（測試用）
    await User.updateOne({ _id: current._id }, { $set: { miniPlayerPurchased: true } });

    const me = await User.findById(current._id).select("_id username pointsBalance miniPlayerPurchased miniPlayerTheme");

    return NextResponse.json({ ok: true, user: me });
  } catch (err) {
    console.error("[redeem-mini-player] failed:", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}