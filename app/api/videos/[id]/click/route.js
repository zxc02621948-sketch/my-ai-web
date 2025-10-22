// app/api/videos/[id]/click/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Video from "@/models/Video";
import { computeVideoPopScore } from "@/utils/scoreVideo";

export const dynamic = "force-dynamic";

export async function POST(_req, ctx) {
  try {
    await dbConnect();
    const params = await ctx.params;
    const { id } = params;

    // 1) 點擊 +1
    await Video.updateOne({ _id: id }, { $inc: { clicks: 1 } });

    // 2) 重新取資料
    const fresh = await Video.findById(
      id,
      "clicks likes likesCount views completenessScore createdAt initialBoost"
    ).lean();
    
    if (!fresh) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    // 3) 校正 likesCount
    const likesCount = Array.isArray(fresh.likes) 
      ? fresh.likes.length 
      : (fresh.likesCount || 0);

    // 4) 重算 popScore
    const popScore = computeVideoPopScore({ ...fresh, _id: id, likesCount });

    // 5) 存回 DB
    const updated = await Video.findByIdAndUpdate(
      id,
      { $set: { likesCount, popScore } },
      { new: true }
    ).lean();

    // 6) 回傳更新後的完整資訊
    return NextResponse.json({
      ok: true,
      _id: updated._id,
      clicks: updated.clicks,
      views: updated.views,
      likesCount: updated.likesCount,
      popScore: updated.popScore,
    });
  } catch (err) {
    console.error("❌ 影片點擊記錄失敗:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

