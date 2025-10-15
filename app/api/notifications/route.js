// app/api/notifications/route.js
import { dbConnect } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { getCurrentUserFromRequest } from "@/lib/auth/getCurrentUserFromRequest";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const notifications = await Notification.find({ userId: currentUser._id })
      .sort({ createdAt: -1 })
      .populate("fromUserId", "username image")
      .limit(30);

    // 🔍 調試：輸出通知詳情
    console.log('\n=== 📋 通知詳情調試 ===');
    console.log('用戶:', currentUser.username);
    console.log('通知數量:', notifications.length);
    
    notifications.forEach((n, index) => {
      console.log(`\n通知 ${index + 1}:`);
      console.log('  _id:', n._id);
      console.log('  type:', n.type);
      console.log('  message:', n.message);
      console.log('  text:', n.text);
      console.log('  link:', n.link);
      console.log('  fromUserId:', n.fromUserId);
      console.log('  isRead:', n.isRead);
    });
    console.log('=== 調試完畢 ===\n');

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("❌ 取得通知失敗：", error);
    return NextResponse.json({ error: "無法取得通知" }, { status: 500 });
  }
}
