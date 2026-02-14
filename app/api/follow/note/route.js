import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";

export async function PATCH(req) {
  await dbConnect();
  const { targetUserId, note } = await req.json();
  const authUser = await getCurrentUserFromRequest(req).catch(() => null);
  const currentUser = authUser?._id ? await User.findById(authUser._id) : null;

  if (!currentUser) {
    return NextResponse.json({ message: "未授權" }, { status: 401 });
  }

  const followEntry = currentUser.following.find(
    (f) => f.userId.toString() === targetUserId
  );

  if (!followEntry) {
    return NextResponse.json({ message: "尚未追蹤該使用者" }, { status: 400 });
  }

  followEntry.note = note || "";
  await currentUser.save();

  return NextResponse.json({ message: "備註更新成功" });
}
