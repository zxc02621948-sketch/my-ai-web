// app/api/images/[id]/route.js
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import { getCurrentUser } from "@/lib/serverAuth";
import { stripComfyIfNotAllowed } from "@/lib/sanitizeComfy";
import { apiError, apiSuccess, withErrorHandling } from "@/lib/errorHandler";

export const GET = withErrorHandling(async (_req, ctx) => {
  await dbConnect();

  const { id } = (await ctx.params) || {};
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return apiError("無效的圖片 ID", 400);
  }

  // ✅ 優化：並行執行用戶認證和圖片查詢，不阻塞主查詢
  const [currentUser, doc] = await Promise.all([
    getCurrentUser().catch(() => null),
    Image.findById(id)
      .populate({ path: "user", select: "_id username image isAdmin currentFrame frameSettings" })
      .lean(),
  ]);
  
  // ✅ 如果 lean() 返回的 doc 沒有 originalImageUrl，直接從原生 MongoDB 查詢
  if (!doc.originalImageUrl) {
    const rawDoc = await Image.collection.findOne({ _id: doc._id });
    if (rawDoc?.originalImageUrl) {
      doc.originalImageUrl = rawDoc.originalImageUrl;
      console.log("🔧 從原生 MongoDB 補回 originalImageUrl:", doc.originalImageUrl);
    }
  }

  if (!doc) {
    return apiError("找不到圖片", 404);
  }

  // 18+ 必須登入
  if (doc.rating === "18" && !currentUser) {
    return apiError("請登入以查看 18+ 圖片", 401);
  }

  // ✅ 優先使用數據庫中的 originalImageUrl，不要回退到 imageUrl
  // 如果 originalImageUrl 存在且不是空字符串，就使用它；否則才回退
  const originalImageUrl = (doc.originalImageUrl && doc.originalImageUrl.trim() !== "" && doc.originalImageUrl !== doc.imageUrl)
    ? doc.originalImageUrl 
    : (doc.imageUrl || "");
  const originalImageId = (doc.originalImageId && doc.originalImageId.trim() !== "" && doc.originalImageId !== doc.imageId)
    ? doc.originalImageId 
    : (doc.imageId || "");

  console.log("📥 從數據庫讀取圖片:", {
    imageId: doc._id,
    dbOriginalImageUrl: doc.originalImageUrl,
    dbImageUrl: doc.imageUrl,
    finalOriginalImageUrl: originalImageUrl,
    isR2: originalImageUrl.includes('media.aicreateaworld.com'),
    isSameAsImageUrl: doc.originalImageUrl === doc.imageUrl,
  });

  const normalized = {
    ...doc,
    author: typeof doc.author === "string" ? doc.author : "",
    userId: doc.user?._id || null,
    // ✅ 使用處理後的 originalImageUrl 和 originalImageId
    originalImageUrl,
    originalImageId,
  };

  const isOwner = !!currentUser && String(normalized.user?._id) === String(currentUser._id);
  const isAdmin = !!currentUser?.isAdmin;
  const canEdit = !!currentUser && (isOwner || isAdmin);
  const isOwnerOrAdmin = isOwner || isAdmin;

  const sanitized = stripComfyIfNotAllowed(normalized, { isOwnerOrAdmin });

  // ✅ 確保 originalImageUrl 和 originalImageId 在 sanitized 中
  if (!sanitized.originalImageUrl) {
    sanitized.originalImageUrl = normalized.originalImageUrl;
  }
  if (!sanitized.originalImageId) {
    sanitized.originalImageId = normalized.originalImageId;
  }

  console.log("📤 返回圖片數據:", {
    imageId: sanitized._id,
    hasOriginalImageUrl: !!sanitized.originalImageUrl,
    originalImageUrl: sanitized.originalImageUrl,
  });

  return apiSuccess({ image: sanitized, isOwner, canEdit });
});
