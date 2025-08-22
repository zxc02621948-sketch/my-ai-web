// app/api/images/[id]/click/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import { computePopScore, ensureLikesCount } from "@/utils/score";

export const dynamic = "force-dynamic";

export async function POST(_req, { params }) {
  try {
    await dbConnect();
    const { id } = await params;

    // 1) 點擊 +1
    await Image.updateOne({ _id: id }, { $inc: { clicks: 1 } });

    // 2) 重新取資料（這裡多抓 initialBoost）
    const fresh = await Image.findById(
      id,
      "clicks likes likesCount completenessScore createdAt initialBoost"
    ).lean();
    if (!fresh) return NextResponse.json({ ok: false }, { status: 404 });

    // 3) 校正 likesCount
    const likesCount = ensureLikesCount(fresh);

    // 4) 重算 popScore
    const popScore = computePopScore({ ...fresh, _id: id, likesCount });

    // 5) 存回 DB
    const updated = await Image.findByIdAndUpdate(
      id,
      { $set: { likesCount, popScore } },
      { new: true }
    ).lean();

    // 6) 回傳更新後的完整資訊，方便前端 & debug
    return NextResponse.json({
      ok: true,
      _id: updated._id,
      clicks: updated.clicks,
      likesCount: updated.likesCount,
      popScore: updated.popScore,
    });
  } catch (err) {
    console.error("❌ click 記錄失敗:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
