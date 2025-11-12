// app/api/like-image/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import User from "@/models/User";
import jwt from "jsonwebtoken";
import { computePopScore, ensureLikesCount } from "@/utils/score";
import { creditPoints } from "@/services/pointsService";

export const dynamic = "force-dynamic";

function getUserIdFromAuth(req) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded?.id || decoded?._id || null;
  } catch {
    return null;
  }
}

export async function PUT(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const userId = getUserIdFromAuth(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const img = await Image.findById(id);
    if (!img) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const had = (img.likes || []).some((x) => String(x) === String(userId));
    if (had) {
      img.likes = (img.likes || []).filter((x) => String(x) !== String(userId));
    } else {
      img.likes = [...(img.likes || []), userId];
    }

    img.likesCount = ensureLikesCount(img);
    img.popScore = computePopScore(img);
    await img.save({ validateBeforeSave: false });

    let currentUserPointsBalance = undefined;

    // ✅ 积分：新增讚時入帳（作者 like_received、按讚者 like_given），自讚不計
    try {
      if (!had) {
        const authorId = img.user || img.userId; // 模型欄位兼容
        if (authorId && String(authorId) !== String(userId)) {
          // 作者獲得 like_received
          await creditPoints({ userId: authorId, type: "like_received", sourceId: img._id, actorUserId: userId, meta: { imageId: img._id } });
          // 按讚者獲得 like_given（每日上限 5）
          const result = await creditPoints({ userId: userId, type: "like_given", sourceId: img._id, actorUserId: userId, meta: { imageId: img._id } });
          if (result?.ok) {
            // 查詢最新的 pointsBalance 以便前端即時更新
            const me = await User.findById(userId).select("pointsBalance");
            currentUserPointsBalance = Number(me?.pointsBalance ?? 0);
          }
        }
      }
    } catch (e) {
      console.warn("[points] like 入帳失敗：", e);
    }

    return NextResponse.json({
      ok: true,
      _id: img._id.toString(),
      likes: img.likes,
      likesCount: img.likesCount,
      popScore: img.popScore,
      currentUserPointsBalance,
    });
  } catch (err) {
    console.error("❌ like-image 失敗:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// 移除多餘的按讚區塊，積分邏輯已在 PUT 內處理。
