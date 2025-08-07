import { dbConnect } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { getCurrentUserFromRequest } from "@/lib/auth/getCurrentUserFromRequest";
import { NextResponse } from "next/server";

export async function DELETE(req) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    // 🔥 刪除目前使用者所有已讀通知
    await Notification.deleteMany({
      userId: currentUser._id,
      isRead: true,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ 刪除已讀通知失敗：", error);
    return NextResponse.json({ error: "無法刪除" }, { status: 500 });
  }
}
