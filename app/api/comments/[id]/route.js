import { dbConnect } from "@/lib/db";
import Comment from "@/models/Comment";
import { NextResponse } from "next/server";
import User from "@/models/User";
import Image from "@/models/Image";
import { Notification } from "@/models/Notification";

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
        select: "username image",
      });

    const comments = rawComments.map((c) => {
      const obj = c.toObject();
      return {
        _id: obj._id.toString(),
        text: obj.text,
        userId: obj.userId?._id?.toString() || null,
        userName: obj.userId?.username || "匿名用戶",
        userImage: obj.userId?.image || "/default-avatar.png",
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
        commentMap[parentId].replies.push(c);
      } else {
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
      .populate({ path: "userId", select: "username image" })
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
