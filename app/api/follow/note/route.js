import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import jwt from "jsonwebtoken";

export async function PATCH(req) {
  await dbConnect();
  const { targetUserId, note } = await req.json();

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.split(" ")[1];

  if (!token) {
    return NextResponse.json({ message: "未授權" }, { status: 401 });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return NextResponse.json({ message: "Token 驗證失敗" }, { status: 401 });
  }

  const currentUser = await User.findById(decoded.id);

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
