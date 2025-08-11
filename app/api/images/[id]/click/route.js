// app/api/images/[id]/click/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import { computePopScore, ensureLikesCount } from "@/utils/score";

export const dynamic = "force-dynamic";

export async function POST(_req, context) {
  try {
    await dbConnect();
    const { id } = await context.params;

    // 點擊 +1
    await Image.updateOne({ _id: id }, { $inc: { clicks: 1 } });

    // 取資料 → 更新 likesCount & popScore
    const fresh = await Image.findById(
      id,
      "clicks likes likesCount completenessScore createdAt"
    ).lean();
    if (!fresh) return NextResponse.json({ ok: false }, { status: 404 });

    const likesCount = ensureLikesCount(fresh);
    const popScore = computePopScore({ ...fresh, _id: id, likesCount });

    await Image.updateOne({ _id: id }, { $set: { likesCount, popScore } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ click 記錄失敗:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
