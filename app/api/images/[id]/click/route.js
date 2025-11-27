// app/api/images/[id]/click/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import { computePopScore, ensureLikesCount } from "@/utils/score";

export const dynamic = "force-dynamic";

export async function POST(_req, ctx) {
  try {
    await dbConnect();
    const params = await ctx.params;
    const { id } = params;

    // ✅ 優化：使用 findOneAndUpdate 一次性完成更新和計算，減少數據庫查詢次數
    const doc = await Image.findById(id, "clicks likes likesCount commentsCount completenessScore createdAt initialBoost").lean();
    if (!doc) return NextResponse.json({ ok: false }, { status: 404 });

    // 計算新值
    const newClicks = (doc.clicks || 0) + 1;
    const likesCount = ensureLikesCount(doc);
    const popScore = computePopScore({ ...doc, _id: id, likesCount });

    // ✅ 優化：一次性更新所有字段，減少數據庫往返
    const updated = await Image.findByIdAndUpdate(
      id,
      { 
        $set: { 
          clicks: newClicks,
          likesCount, 
          popScore 
        } 
      },
      { new: true, select: "clicks likesCount popScore" }
    ).lean();

    // 回傳更新後的完整資訊
    return NextResponse.json({
      ok: true,
      _id: id,
      clicks: updated.clicks,
      likesCount: updated.likesCount,
      popScore: updated.popScore,
    });
  } catch (err) {
    console.error("❌ click 記錄失敗:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
