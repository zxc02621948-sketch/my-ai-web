import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";

// ⚠️ 僅供測試！創建一個即將到期的訂閱
export async function POST(request) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const user = await User.findById(currentUser._id);
    if (!user) {
      return NextResponse.json({ error: "用戶不存在" }, { status: 404 });
    }

    // 創建一個 3 天後到期的測試訂閱（觸發到期提醒）
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 天後

    const testSubscription = {
      type: 'pinPlayerTest',
      startDate: now,
      expiresAt: expiresAt,
      isActive: true,
      monthlyCost: 10,
      lastRenewedAt: now
    };

    if (!user.subscriptions) {
      user.subscriptions = [];
    }
    
    // 移除現有的測試訂閱
    user.subscriptions = user.subscriptions.filter(s => s.type !== 'pinPlayerTest');
    
    // 添加新的測試訂閱
    user.subscriptions.push(testSubscription);
    
    await user.save();

    console.log('✅ 測試訂閱已創建:', {
      userId: user.username,
      expiresAt: expiresAt.toISOString(),
      remainingDays: 3
    });

    return NextResponse.json({
      success: true,
      message: '測試訂閱已創建（3天後到期，會觸發到期提醒）',
      expiresAt: expiresAt.toISOString(),
      remainingDays: 3
    });
  } catch (error) {
    console.error("創建測試訂閱失敗:", error);
    return NextResponse.json(
      { error: error.message || "創建失敗" },
      { status: 500 }
    );
  }
}
