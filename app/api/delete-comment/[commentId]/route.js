import { dbConnect } from "@/lib/db";
import Comment from "@/models/Comment";
import Image from "@/models/Image";
import { verifyToken } from "@/lib/serverAuth";
import { getCurrentUserFromRequest } from "@/lib/auth/getCurrentUserFromRequest";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { computePopScore } from "@/utils/score";

// ✅ Edge Runtime workaround
export async function DELETE(req, context) {
  await dbConnect();

  try {
    const commentId = (await context.params).commentId;

    const authHeader = req.headers.get("authorization") || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    let userId = null;
    let isAdmin = false;

    if (bearer) {
      const decoded = await verifyToken(bearer);
      if (decoded?.id) {
        userId = String(decoded.id);
        isAdmin = decoded.isAdmin === true;
      }
    }

    if (!userId) {
      const currentUser = await getCurrentUserFromRequest(req).catch(() => null);
      if (currentUser?._id) {
        userId = String(currentUser._id);
        isAdmin = currentUser.isAdmin === true;
      }
    }

    if (!userId) {
      return NextResponse.json({ message: "未授權" }, { status: 401 });
    }

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return NextResponse.json({ message: "無效的 commentId" }, { status: 400 });
    }

    const comment = await Comment.findById(commentId);

    if (!comment) {
      return NextResponse.json({ message: "找不到留言" }, { status: 404 });
    }

    const isOwner =
      comment.userId &&
      comment.userId.toString &&
      comment.userId.toString() === userId;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ message: "沒有刪除權限" }, { status: 403 });
    }

    // 記錄 imageId 以便更新計數
    const imageId = comment.imageId;

    // ✅ 新增：刪除所有回覆留言（children）
    await Comment.deleteMany({ parentCommentId: commentId });

    // ✅ 刪除主留言
    await Comment.findByIdAndDelete(commentId);

    // ✅ 更新圖片的留言數和熱門度分數
    if (imageId) {
      try {
        const image = await Image.findById(imageId);
        if (image) {
          // 重新計算留言總數
          const totalComments = await Comment.countDocuments({ imageId });
          image.commentsCount = totalComments;
          
          // 重新計算熱門度分數（轉換為普通對象以確保兼容性）
          const imageObj = image.toObject ? image.toObject() : image;
          image.popScore = computePopScore(imageObj);
          
          await image.save();
        }
      } catch (updateErr) {
        console.error("更新圖片分數失敗:", updateErr);
        // 繼續執行，不中斷刪除流程
      }
    }

    return NextResponse.json({ message: "留言刪除成功" }, { status: 200 });
  } catch (err) {
    console.error("留言刪除錯誤：", err);
    return NextResponse.json({ message: "刪除留言失敗", error: err.message }, { status: 500 });
  }
}
