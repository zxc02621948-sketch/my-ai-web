// app/api/music/[id]/click/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Music from "@/models/Music";
import { computeMusicPopScore } from "@/utils/scoreMusic";

export const dynamic = "force-dynamic";

export async function POST(_req, ctx) {
  try {
    await dbConnect();
    const params = await ctx.params;
    const { id } = params;

    // 1) 點擊 +1
    await Music.updateOne({ _id: id }, { $inc: { clicks: 1 } });

    // 2) 重新取資料
    const fresh = await Music.findById(
      id,
      "clicks likes likesCount plays completenessScore createdAt initialBoost",
    ).lean();

    if (!fresh) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    // 3) 校正 likesCount
    const likesCount = Array.isArray(fresh.likes)
      ? fresh.likes.length
      : fresh.likesCount || 0;

    // 4) 重算 popScore
    const popScore = computeMusicPopScore({ ...fresh, _id: id, likesCount });

    // 5) 存回 DB
    const updated = await Music.findByIdAndUpdate(
      id,
      { $set: { likesCount, popScore } },
      { new: true },
    ).lean();

    // 6) 回傳更新後的完整資訊
    return NextResponse.json({
      ok: true,
      _id: updated._id,
      clicks: updated.clicks,
      plays: updated.plays,
      likesCount: updated.likesCount,
      popScore: updated.popScore,
    });
  } catch (err) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
