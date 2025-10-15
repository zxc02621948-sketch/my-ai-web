import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { dbConnect } from "@/lib/db";
import Notification from "@/models/Notification";

// ⚠️ 僅供測試！部署前請刪除
export async function POST(request) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    // 創建一個測試訂閱到期提醒通知
    const notification = await Notification.create({
      userId: currentUser._id,
      type: 'subscription_expiring',
      message: '您的「釘選播放器」訂閱還有 3 天到期（2025/10/17）。前往商店續費，時間會累積延長！',
      link: '/store',
      isRead: false
    });

    console.log('✅ 測試通知已創建:', {
      _id: notification._id,
      userId: currentUser.username,
      type: notification.type,
      message: notification.message,
      link: notification.link
    });

    return NextResponse.json({
      success: true,
      message: '測試通知已創建',
      notification: {
        _id: notification._id,
        type: notification.type,
        message: notification.message,
        link: notification.link,
        createdAt: notification.createdAt
      }
    });
  } catch (error) {
    console.error("創建測試通知失敗:", error);
    return NextResponse.json(
      { error: error.message || "創建失敗" },
      { status: 500 }
    );
  }
}

