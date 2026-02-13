// app/api/images/[id]/click/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import ClickThrottle from "@/models/ClickThrottle";
import { getCurrentUserFromRequest } from "@/lib/auth/getCurrentUserFromRequest";
import { getIdentifier, strictLimiter } from "@/lib/rateLimit";
import { computePopScore, ensureLikesCount } from "@/utils/score";

export const dynamic = "force-dynamic";

function buildThrottleKey(req, userId) {
  if (userId) return `u:${String(userId)}`;
  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const ua = (req.headers.get("user-agent") || "unknown").slice(0, 120);
  return `ip:${ip}|ua:${ua}`;
}

export async function POST(req, ctx) {
  try {
    await dbConnect();
    const params = await ctx.params;
    const { id } = params;
    const currentUser = await getCurrentUserFromRequest(req).catch(() => null);

    // 基礎限流：避免短時間大量灌點擊
    const rateLimitKey = getIdentifier(req, currentUser?._id ? String(currentUser._id) : null);
    const rateLimitResult = strictLimiter.check(rateLimitKey, 20);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          ok: false,
          message: "點擊過於頻繁，請稍後再試",
          error: "RATE_LIMIT_EXCEEDED",
        },
        { status: 429 }
      );
    }

    const doc = await Image.findById(
      id,
      "clicks viewCount likes likesCount commentsCount completenessScore createdAt initialBoost popScore"
    ).lean();
    if (!doc) return NextResponse.json({ ok: false }, { status: 404 });

    // 同圖 + 同來源 30 秒內只計一次，防止 popScore 被機器人灌高
    const throttleKey = buildThrottleKey(req, currentUser?._id);
    try {
      await ClickThrottle.create({ imageId: id, key: throttleKey });
    } catch (error) {
      if (error?.code === 11000) {
        return NextResponse.json({
          ok: true,
          throttled: true,
          _id: id,
          clicks: doc.clicks || 0,
          likesCount: ensureLikesCount(doc),
          popScore: doc.popScore || 0,
        });
      }
      throw error;
    }

    const newClicks = (doc.clicks || 0) + 1;
    const newViewCount = (doc.viewCount || 0) + 1;
    const likesCount = ensureLikesCount(doc);
    const popScore = computePopScore({ ...doc, _id: id, clicks: newClicks, likesCount });

    const updated = await Image.findByIdAndUpdate(
      id,
      { 
        $set: { 
          clicks: newClicks,
          viewCount: newViewCount,
          lastViewedAt: new Date(),
          lastInteractionAt: new Date(),
          likesCount, 
          popScore 
        } 
      },
      { new: true, select: "clicks viewCount likesCount popScore" }
    ).lean();

    // 回傳更新後的完整資訊
    return NextResponse.json({
      ok: true,
      _id: id,
      clicks: updated.clicks,
      viewCount: updated.viewCount,
      likesCount: updated.likesCount,
      popScore: updated.popScore,
    });
  } catch (err) {
    console.error("❌ click 記錄失敗:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
