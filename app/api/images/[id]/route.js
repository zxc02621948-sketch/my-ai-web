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

  const currentUser = await getCurrentUser().catch(() => null);

  const doc = await Image.findById(id)
    .populate({ path: "user", select: "_id username image isAdmin level currentFrame" })
    .lean();

  if (!doc) {
    return apiError("找不到圖片", 404);
  }

  // 18+ 必須登入
  if (doc.rating === "18" && !currentUser) {
    return apiError("請登入以查看 18+ 圖片", 401);
  }

  const normalized = {
    ...doc,
    author: typeof doc.author === "string" ? doc.author : "",
    userId: doc.user?._id || null,
  };

  const isOwner = !!currentUser && String(normalized.user?._id) === String(currentUser._id);
  const isAdmin = !!currentUser?.isAdmin;
  const canEdit = !!currentUser && (isOwner || isAdmin);
  const isOwnerOrAdmin = isOwner || isAdmin;

  const sanitized = stripComfyIfNotAllowed(normalized, { isOwnerOrAdmin });

  return apiSuccess({ image: sanitized, isOwner, canEdit });
});
