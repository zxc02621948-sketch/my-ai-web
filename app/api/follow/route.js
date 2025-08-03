// app/api/follow/route.js
import { dbConnect } from "@/lib/db";
import { getCurrentUser } from "@/lib/serverAuth";
import User from "@/models/User";

export async function POST(req) {
  await dbConnect();
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    return new Response("未授權", { status: 401 });
  }

  try {
    const { userIdToFollow } = await req.json();

    if (!userIdToFollow || userIdToFollow === currentUser._id.toString()) {
      return new Response("無效的追蹤目標", { status: 400 });
    }

    const user = await User.findById(currentUser._id);
    if (!user.following.includes(userIdToFollow)) {
      user.following.push(userIdToFollow);
      await user.save();
    }

    return Response.json({ success: true, following: user.following });
  } catch (error) {
    console.error("追蹤失敗：", error);
    return new Response("伺服器錯誤", { status: 500 });
  }
}

export async function DELETE(req) {
  await dbConnect();
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    return new Response("未授權", { status: 401 });
  }

  try {
    const { userIdToUnfollow } = await req.json();

    const user = await User.findById(currentUser._id);
    user.following = user.following.filter(
      (id) => id.toString() !== userIdToUnfollow
    );
    await user.save();

    return Response.json({ success: true, following: user.following });
  } catch (error) {
    console.error("取消追蹤失敗：", error);
    return new Response("伺服器錯誤", { status: 500 });
  }
}
