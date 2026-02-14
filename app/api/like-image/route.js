// app/api/like-image/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import User from "@/models/User";
import mongoose from "mongoose";
import { computePopScore, ensureLikesCount } from "@/utils/score";
import { creditPoints } from "@/services/pointsService";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

async function getUserId(req) {
  const user = await getCurrentUserFromRequest(req).catch(() => null);
  return user?._id ? String(user._id) : null;
}

export async function PUT(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // ✅ 確保 userId 是 ObjectId 類型，用於正確保存到 likes 數組
    const userIdObjectId = mongoose.Types.ObjectId.isValid(userId) 
      ? new mongoose.Types.ObjectId(userId) 
      : userId;

    const img = await Image.findById(id);
    if (!img) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // 可選：明確指定最終狀態（true=一定要讚、false=一定取消）
    let shouldLike = null;
    try {
      const body = await req.json();
      if (typeof body?.shouldLike === "boolean") {
        shouldLike = body.shouldLike;
      }
    } catch {
      // 兼容舊客戶端：無 body 時走 toggle 模式
    }

    // ✅ 檢查時同時比較 ObjectId 和字符串格式，確保能找到所有情況
    const had = (img.likes || []).some((x) => {
      const xStr = String(x);
      const userIdStr = String(userId);
      const userIdObjectIdStr = userIdObjectId.toString();
      return xStr === userIdStr || xStr === userIdObjectIdStr;
    });
    
    const targetLikeState = shouldLike === null ? !had : shouldLike;
    const didAdd = !had && targetLikeState;
    const didRemove = had && !targetLikeState;

    if (didRemove) {
      // ✅ 移除時同時過濾 ObjectId 和字符串格式
      img.likes = (img.likes || []).filter((x) => {
        const xStr = String(x);
        const userIdStr = String(userId);
        const userIdObjectIdStr = userIdObjectId.toString();
        return xStr !== userIdStr && xStr !== userIdObjectIdStr;
      });
    } else if (didAdd) {
      // ✅ 保存時使用 ObjectId，確保類型匹配
      img.likes = [...(img.likes || []), userIdObjectId];
    }
    
    console.log(
      `[like-image] 用戶 ${userId} ${didAdd ? "添加" : didRemove ? "取消" : "維持"}收藏圖片 ${id}，當前 likes 數量: ${img.likes.length}`
    );

    img.likesCount = ensureLikesCount(img);
    img.popScore = computePopScore(img);
    
    // ✅ 先保存 Mongoose 文档
    await img.save({ validateBeforeSave: false });
    
    // ✅ 如果添加收藏，使用原生 MongoDB 操作確保保存成功
    if (didAdd) {
      try {
        // 使用原生 MongoDB $addToSet 確保添加成功（避免重複）
        const updateResult = await Image.collection.updateOne(
          { _id: new mongoose.Types.ObjectId(id) },
          { $addToSet: { likes: userIdObjectId } }
        );
        console.log(`[like-image] 原生 MongoDB $addToSet 結果:`, {
          matchedCount: updateResult.matchedCount,
          modifiedCount: updateResult.modifiedCount,
          acknowledged: updateResult.acknowledged
        });
      } catch (nativeErr) {
        console.warn(`[like-image] 原生 MongoDB 操作失敗:`, nativeErr);
      }
    }
    
    // ✅ 驗證保存後的數據（使用原生 MongoDB 查詢）
    const savedImgRaw = await Image.collection.findOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { projection: { likes: 1 } }
    );
    const savedLikes = savedImgRaw?.likes || [];
    const hasUserIdInLikes = savedLikes.some((x) => {
      const xStr = String(x);
      const userIdStr = String(userId);
      const userIdObjectIdStr = userIdObjectId.toString();
      return xStr === userIdStr || xStr === userIdObjectIdStr;
    });
    
    console.log(`[like-image] 保存後驗證:`, {
      imageId: id,
      userId,
      userIdObjectId: userIdObjectId.toString(),
      action: didRemove ? '取消收藏' : didAdd ? '添加收藏' : '維持原狀',
      savedLikesCount: savedLikes.length,
      hasUserIdInLikes,
      savedLikes: savedLikes.map(l => ({
        value: String(l),
        type: typeof l,
        constructor: l?.constructor?.name
      }))
    });
    
    if (didAdd && !hasUserIdInLikes) {
      console.error(`[like-image] 錯誤：添加收藏後驗證失敗，userId 不在 likes 中！`);
      // ✅ 如果驗證失敗，再次嘗試使用原生 MongoDB 強制添加
      try {
        await Image.collection.updateOne(
          { _id: new mongoose.Types.ObjectId(id) },
          { $addToSet: { likes: userIdObjectId } }
        );
        console.log(`[like-image] 已使用原生 MongoDB 強制添加 likes`);
      } catch (retryErr) {
        console.error(`[like-image] 強制添加失敗:`, retryErr);
      }
    }
    
    // ✅ 重新讀取以確保數據一致
    const finalImg = await Image.findById(id);
    if (finalImg) {
      finalImg.likesCount = ensureLikesCount(finalImg);
      finalImg.popScore = computePopScore(finalImg);
      await finalImg.save({ validateBeforeSave: false });
    }

    let currentUserPointsBalance = undefined;

    // ✅ 积分：新增讚時入帳（作者 like_received、按讚者 like_given），自讚不計
    try {
      if (didAdd) {
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
