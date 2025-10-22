import { dbConnect } from "@/lib/db";
import Comment from "@/models/Comment";
import { NextResponse } from "next/server";
import User from "@/models/User";
import Image from "@/models/Image";
import { Notification } from "@/models/Notification";
import { creditPoints } from "@/services/pointsService";
import { computePopScore } from "@/utils/score";
import {
  COMMENT_GLOBAL_INTERVAL,
  COMMENT_IMAGE_INTERVAL,
  COMMENT_PER_IMAGE_LIMIT,
  COMMENT_DUPLICATE_CHECK_COUNT,
  validateCommentContent,
  checkTimeInterval,
  getUserDailyCommentLimit
} from "@/utils/commentLimits";

export async function GET(req, context) {
  await dbConnect();

  try {
    const imageId = (await context.params).id;

    const rawComments = await Comment.find({ imageId })
      .sort({ createdAt: 1 })
      .populate({
        path: "parentCommentId",
        populate: {
          path: "userId",
          select: "username _id",
        },
        options: { strictPopulate: false },
      })
      .populate({
        path: "userId",
        select: "username image currentFrame frameSettings",
      });

    const comments = rawComments.map((c) => {
      const obj = c.toObject();
      return {
        _id: obj._id.toString(),
        text: obj.text,
        userId: obj.userId?._id?.toString() || null,
        userName: obj.userId?.username || "匿名用戶",
        userImage: obj.userId?.image || "/default-avatar.png",
        userFrame: obj.userId?.currentFrame || "default",
        imageId: obj.imageId,
        createdAt: obj.createdAt,
        parentCommentId: obj.parentCommentId?._id?.toString() || null,
        parentUserId: obj.parentCommentId?.userId?._id?.toString() || null,
        parentUserName: obj.parentCommentId?.userId?.username || null,
        replies: [],
      };
    });

    const commentMap = {};
    comments.forEach((c) => {
      commentMap[c._id] = c;
      commentMap[c._id.toString()] = c;
    });

    const roots = [];
    comments.forEach((c) => {
      const parentId = c.parentCommentId ? c.parentCommentId.toString() : null;
      if (parentId && commentMap[parentId]) {
        // 確保不會重複添加同一個留言
        const existing = commentMap[parentId].replies.find(r => r._id === c._id);
        if (!existing) {
          commentMap[parentId].replies.push(c);
        }
      } else if (!c.parentCommentId) {
        // 只有真正的頂層留言才加入 roots
        roots.push(c);
      }
    });

    return NextResponse.json(roots);
  } catch (err) {
    console.error("❌ 留言讀取失敗：", err);
    return NextResponse.json({ error: "留言讀取失敗" }, { status: 500 });
  }
}

export async function POST(req, context) {
  await dbConnect();

  try {
    const imageId = (await context.params).id;
    const body = await req.json();
    const { text, userId, userName, parentCommentId } = body;

    // ===== 🛡️ 防刷機制 =====
    
    // 1. 內容檢查
    const contentValidation = validateCommentContent(text);
    if (!contentValidation.valid) {
      return NextResponse.json(
        { error: contentValidation.error },
        { status: 400 }
      );
    }

    // 2-5. 僅對已登入用戶進行防刷檢查
    if (userId && userId !== "匿名用戶") {
      // 2a. 檢查全局最後留言時間
      const lastComment = await Comment.findOne({ userId })
        .sort({ createdAt: -1 })
        .lean();
      
      if (lastComment) {
        const globalCheck = checkTimeInterval(lastComment.createdAt, COMMENT_GLOBAL_INTERVAL);
        if (!globalCheck.allowed) {
          const waitSeconds = Math.ceil(globalCheck.waitTime / 1000);
          return NextResponse.json(
            { error: `請等待 ${waitSeconds} 秒後再留言` },
            { status: 429 }
          );
        }
      }
      
      // 2b. 檢查同一張圖片的最後留言時間
      const lastCommentOnThisImage = await Comment.findOne({ userId, imageId })
        .sort({ createdAt: -1 })
        .lean();
      
      if (lastCommentOnThisImage) {
        const imageCheck = checkTimeInterval(lastCommentOnThisImage.createdAt, COMMENT_IMAGE_INTERVAL);
        if (!imageCheck.allowed) {
          const waitSeconds = Math.ceil(imageCheck.waitTime / 1000);
          return NextResponse.json(
            { error: `請等待 ${waitSeconds} 秒後再對此圖片留言` },
            { status: 429 }
          );
        }
      }

      // 3. 每日留言上限
      const user = await User.findById(userId);
      const dailyLimit = getUserDailyCommentLimit(user);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayCommentsCount = await Comment.countDocuments({
        userId,
        createdAt: { $gte: today }
      });
      
      if (todayCommentsCount >= dailyLimit) {
        return NextResponse.json(
          { error: `今日留言已達上限（${dailyLimit} 條）` },
          { status: 429 }
        );
      }

      // 4. 單張圖片留言上限
      const commentsOnThisImage = await Comment.countDocuments({
        userId,
        imageId
      });
      
      if (commentsOnThisImage >= COMMENT_PER_IMAGE_LIMIT) {
        return NextResponse.json(
          { error: `你在此圖片的留言已達上限（${COMMENT_PER_IMAGE_LIMIT} 條）` },
          { status: 429 }
        );
      }

      // 5. 檢測重複內容
      const recentComments = await Comment.find({ userId })
        .sort({ createdAt: -1 })
        .limit(COMMENT_DUPLICATE_CHECK_COUNT)
        .lean();
      
      const isDuplicate = recentComments.some(
        c => c.text.trim() === text.trim()
      );
      
      if (isDuplicate) {
        return NextResponse.json(
          { error: "請不要重複發送相同的留言" },
          { status: 400 }
        );
      }
    }

    // ===== 原有的留言創建邏輯 =====
    const newComment = await Comment.create({
      text,
      userId: userId || "匿名用戶",
      userName: userName || "匿名用戶",
      imageId,
      parentCommentId: parentCommentId || null,
      createdAt: new Date(),
    });

    // ✨ 新增通知處理區塊
    const image = await Image.findById(imageId);

    // ✅ 更新圖片的留言數和熱門度分數
    if (image) {
      // 計算當前留言總數（包括回覆）
      const totalComments = await Comment.countDocuments({ imageId });
      image.commentsCount = totalComments;
      
      // 重新計算熱門度分數
      image.popScore = computePopScore(image);
      
      await image.save();
    }

    // ✅ 積分：為作品作者入帳 +1（每日上限5），同用戶同作品同日僅計一次
    try {
      const authorId = image?.user || image?.userId;
      if (authorId && String(authorId) !== String(userId)) {
        await creditPoints({ userId: authorId, type: "comment_received", sourceId: imageId, actorUserId: userId, meta: { commentId: newComment._id } });
      }
    } catch (e) {
      console.warn("[points] comment_received 入帳失敗：", e);
    }

    // 📨 通知圖片作者
    if (!parentCommentId && userId !== image.user.toString()) {
      await Notification.create({
        userId: image.user,
        fromUserId: userId,
        type: "comment",
        imageId,
        commentId: newComment._id,
        text,
      });
    }

    // 📨 通知被回覆的留言者
    if (parentCommentId) {
      const parentComment = await Comment.findById(parentCommentId);
      if (parentComment && userId !== parentComment.userId.toString()) {
        await Notification.create({
          userId: parentComment.userId,
          fromUserId: userId,
          type: "reply",
          imageId,
          commentId: newComment._id,
          text,
        });
      }
    }

    const populated = await Comment.findById(newComment._id)
      .populate({ path: "userId", select: "username image currentFrame" })
      .populate({
        path: "parentCommentId",
        populate: {
          path: "userId",
          select: "username _id",
        },
        options: { strictPopulate: false },
      });

    const obj = populated.toObject();

    return NextResponse.json({
      _id: obj._id.toString(),
      text: obj.text,
      userId: obj.userId?._id?.toString() || null,
      userName: obj.userId?.username || "匿名用戶",
      userImage: obj.userId?.image || "/default-avatar.png",
      userFrame: obj.userId?.currentFrame || "default",
      imageId: obj.imageId,
      createdAt: obj.createdAt,
      parentCommentId: obj.parentCommentId?._id?.toString() || null,
      parentUserId: obj.parentCommentId?.userId?._id?.toString() || null,
      parentUserName: obj.parentCommentId?.userId?.username || null,
      replies: [],
    });
  } catch (err) {
    console.error("❌ 留言儲存失敗：", err);
    return NextResponse.json({ error: "留言儲存失敗" }, { status: 500 });
  }
}
