import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { dbConnect } from "@/lib/db";
import Notification from "@/models/Notification";

// 檢查當前用戶的通知詳情
export async function GET(request) {
  try {
    await dbConnect();
    
    console.log('\n=== 🔍 開始檢查通知 API ===');
    
    const currentUser = await getCurrentUser();
    console.log('當前用戶:', currentUser ? currentUser.username : '未登入');
    
    if (!currentUser) {
      console.log('❌ 用戶未登入，返回 401');
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const notifications = await Notification.find({ userId: currentUser._id })
      .sort({ createdAt: -1 })
      .limit(10);

    console.log('\n=== 📋 用戶通知詳情檢查 ===');
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
      console.log('  createdAt:', n.createdAt);
    });
    console.log('=== 檢查完畢 ===\n');

    return NextResponse.json({
      success: true,
      userId: currentUser.username,
      notificationsCount: notifications.length,
      notifications: notifications.map(n => ({
        _id: n._id,
        type: n.type,
        message: n.message,
        text: n.text,
        link: n.link,
        fromUserId: n.fromUserId,
        isRead: n.isRead,
        createdAt: n.createdAt
      }))
    });
  } catch (error) {
    console.error("檢查通知失敗:", error);
    return NextResponse.json(
      { error: error.message || "檢查失敗" },
      { status: 500 }
    );
  }
}
