// app/api/admin/backfill-popscore/route.js
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

export async function GET() {
  return NextResponse.json({ ok: true, tip: "這支路由存在，請用 POST 並帶 x-admin-secret 呼叫。" });
}

export async function POST(req) {
  try {
    const secret = process.env.ADMIN_SECRET;
    const provided = req.headers.get("x-admin-secret");
    if (!secret) return NextResponse.json({ ok: false, error: "ADMIN_SECRET 未設定" }, { status: 500 });
    if (provided !== secret) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    await dbConnect();

    const cursor = Image.find({}, { _id: 1, likes: 1, likesCount: 1, clicks: 1, completenessScore: 1, createdAt: 1 }).cursor();
    const ops = [];
    let processed = 0;

    for await (const doc of cursor) {
      const obj = doc.toObject();
      const lc = typeof obj.likesCount === "number" ? obj.likesCount :
                 Array.isArray(obj.likes) ? obj.likes.length : 0;
      const ps = computePopScore({ ...obj, likesCount: lc });
      ops.push({
        updateOne: { filter: { _id: obj._id }, update: { $set: { likesCount: lc, popScore: ps } } }
      });
      if (ops.length >= 500) {
        await Image.bulkWrite(ops);
        processed += 500;
        ops.length = 0;
      }
    }
    if (ops.length) {
      await Image.bulkWrite(ops);
      processed += ops.length;
    }

    return NextResponse.json({ ok: true, processed });
  } catch (err) {
    console.error("❌ backfill 失敗:", err);
    return NextResponse.json({ ok: false, error: err?.message || "backfill failed" }, { status: 500 });
  }
}
