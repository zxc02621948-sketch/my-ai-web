// app/api/images/[id]/click/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";

export const dynamic = "force-dynamic";

function computePopScore(img) {
  const W_CLICK = 1.0;
  const W_LIKE = 2.0;
  const W_COMPLETE = 0.05;
  const TIMEBOOST_MAX = 10;

  const now = Date.now();
  const created = new Date(img.createdAt || now).getTime();
  const hoursSince = Math.max(0, (now - created) / 36e5);
  const timeBoost = Math.max(0, TIMEBOOST_MAX - hoursSince);

  const clicks = Number(img.clicks || 0);
  const likesCount = Number(img.likesCount ?? (Array.isArray(img.likes) ? img.likes.length : 0));
  const comp = Number(img.completenessScore || 0);

  return clicks * W_CLICK + likesCount * W_LIKE + comp * W_COMPLETE + timeBoost;
}

export async function POST(_req, context) {
  try {
    await dbConnect();

    // ✅ 這裡重點：await context.params 再取 id
    const { id } = await context.params;

    // 先 +1（避免讀取舊值）
    await Image.updateOne({ _id: id }, { $inc: { clicks: 1 } });

    // 取回計分需要的欄位
    const fresh = await Image.findById(
      id,
      "clicks likes likesCount completenessScore createdAt"
    ).lean();
    if (!fresh) return NextResponse.json({ ok: false }, { status: 404 });

    const likesCount =
      typeof fresh.likesCount === "number"
        ? fresh.likesCount
        : Array.isArray(fresh.likes)
        ? fresh.likes.length
        : 0;

    const popScore = computePopScore({ ...fresh, likesCount });

    await Image.updateOne({ _id: id }, { $set: { likesCount, popScore } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ click 記錄失敗:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
