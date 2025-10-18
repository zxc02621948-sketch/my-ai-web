import { dbConnect } from "@/lib/db";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/serverAuth";
import { Notification } from "@/models/Notification"; // ✅ 改這裡

export async function POST(req) {
  await dbConnect();

  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  try {
    await Notification.updateMany(
      { userId: currentUser._id.toString(), isRead: false },
      { $set: { isRead: true } }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ 標記通知為已讀失敗：", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
