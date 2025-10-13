// app/api/follow/route.js
import { dbConnect } from "@/lib/db";
import { getCurrentUser } from "@/lib/serverAuth";
import User from "@/models/User";
import mongoose from "mongoose";

export async function POST(req) {
  await dbConnect();
  const currentUser = await getCurrentUser(req);
  if (!currentUser) return new Response("未授權", { status: 401 });

  try {
    const { userIdToFollow } = await req.json();

    if (!userIdToFollow || userIdToFollow === currentUser._id.toString()) {
      return new Response("無效的追蹤目標", { status: 400 });
    }
 
    // ✅ 檢查 ID 合法性
    if (!mongoose.Types.ObjectId.isValid(userIdToFollow)) {
      return new Response("格式錯誤：非法 ID", { status: 400 });
    }

    const user = await User.findById(currentUser._id);

    user.following = user.following.filter((entry) => entry?.userId);   
 
    const alreadyFollowing = user.following.some(
      (entry) => entry?.userId?.toString?.() === userIdToFollow
    );

    if (!alreadyFollowing) {
      user.following.push({
        userId: new mongoose.Types.ObjectId(userIdToFollow),
        note: "",
      });
      await user.save();
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("追蹤失敗：", error);
    return new Response("伺服器錯誤", { status: 500 });
  }
}

export async function DELETE(req) {
  await dbConnect();
  const currentUser = await getCurrentUser(req);
  if (!currentUser) return new Response("未授權", { status: 401 });

  try {
    const { userIdToUnfollow } = await req.json();

    const user = await User.findById(currentUser._id);
    user.following = user.following.filter(
      (entry) => entry.userId.toString() !== userIdToUnfollow
    );
    await user.save();

    return Response.json({ success: true });
  } catch (error) {
    console.error("取消追蹤失敗：", error);
    return new Response("伺服器錯誤", { status: 500 });
  }
}

export async function PATCH(req) {
  await dbConnect();
  const currentUser = await getCurrentUser(req);
  if (!currentUser) return new Response("未授權", { status: 401 });

  try {
    const { userIdToUpdate, newNote } = await req.json();

    const user = await User.findById(currentUser._id);
    const target = user.following.find(
      (entry) => entry.userId.toString() === userIdToUpdate
    );

    if (!target) return new Response("找不到此追蹤對象", { status: 404 });

    target.note = newNote;
    await user.save();

    return Response.json({ success: true });
  } catch (error) {
    console.error("更新備註失敗：", error);
    return new Response("伺服器錯誤", { status: 500 });
  }
}

export async function GET(req) {
  await dbConnect();
  const currentUser = await getCurrentUser(req);
  if (!currentUser) return new Response("未授權", { status: 401 });

  try {
    const user = await User.findById(currentUser._id).populate({
      path: "following.userId",
      select: "username image gender",
    });

    const followingWithNote = user.following
      .filter((entry) => entry.userId)
      .map((entry) => ({
        _id: entry.userId._id,
        username: entry.userId.username,
        image: entry.userId.image,
        gender: entry.userId.gender,
        note: entry.note || "",
      }));

    return Response.json({ following: followingWithNote });
  } catch (error) {
    console.error("讀取追蹤清單失敗：", error);
    return new Response("伺服器錯誤", { status: 500 });
  }
}
