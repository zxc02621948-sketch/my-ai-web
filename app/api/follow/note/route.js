import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import jwt from "jsonwebtoken";
import { getCurrentUserFromRequest } from "@/lib/auth/getCurrentUserFromRequest";

export async function PATCH(req) {
  await dbConnect();
  const { targetUserId, note } = await req.json();

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.split(" ")[1];

  let currentUser = null;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded?.id) {
        currentUser = await User.findById(decoded.id);
      }
    } catch {
      // Bearer 驗證失敗時，改由 cookie 驗證嘗試。
    }
  }

  if (!currentUser) {
    const cookieUser = await getCurrentUserFromRequest(req).catch(() => null);
    if (cookieUser?._id) {
      currentUser = await User.findById(cookieUser._id);
    }
  }

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
