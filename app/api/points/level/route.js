// app/api/points/level/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import { getLevelInfo } from "@/utils/pointsLevels";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const targetId = searchParams.get("userId") || null;

    let userDoc = null;
    if (targetId) {
      userDoc = await User.findById(targetId).lean();
    } else {
      const current = await getCurrentUserFromRequest(request);
      if (!current?._id) {
        return NextResponse.json({ ok: false, error: "未登入" }, { status: 401 });
      }
      userDoc = await User.findById(current._id).lean();
    }

    if (!userDoc) {
      return NextResponse.json({ ok: false, error: "用戶不存在" }, { status: 404 });
    }

    const points = Number(userDoc.totalEarnedPoints || 0);
    const info = getLevelInfo(points);

    return NextResponse.json({
      ok: true,
      data: {
        userId: String(userDoc._id),
        points,
        currentBalance: Number(userDoc.pointsBalance || 0),
        levelName: info.name,
        rank: info.rank,
        title: info.title,
        display: info.display,
        levelIndex: info.index,
        color: info.color,
        min: info.min,
        nextMin: info.nextMin,
        progressPct: info.progressPct,
        toNext: info.toNext,
        isMax: info.isMax,
      },
    });
  } catch (e) {
    console.error("GET /api/points/level error", e);
    return NextResponse.json({ ok: false, error: "伺服器錯誤" }, { status: 500 });
  }
}