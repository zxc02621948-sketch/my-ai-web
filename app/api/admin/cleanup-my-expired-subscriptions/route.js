import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";

// 立即清理當前用戶的過期訂閱

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

    const now = new Date();
    let expiredCount = 0;
    const expiredSubs = [];

    for (const sub of user.subscriptions || []) {
      if (!sub.isActive) continue;
      
      const expiresAt = sub.expiresAt || sub.nextBillingDate;
      if (!expiresAt) continue;
      
      const expiresAtDate = new Date(expiresAt);
      
      // 如果已經過期
      if (expiresAtDate < now) {
        sub.isActive = false;
        expiredCount++;
        expiredSubs.push({
          type: sub.type,
          expiresAt: expiresAtDate.toISOString(),
          cancelledAt: sub.cancelledAt ? sub.cancelledAt.toISOString() : null
        });
        
        console.log(`  ❌ 清理 ${user.username} 的過期訂閱: ${sub.type} (過期時間: ${expiresAtDate.toLocaleString('zh-TW')})`);
      }
    }

    if (expiredCount > 0) {
      await user.save();
      
      return NextResponse.json({
        success: true,
        message: `已清理 ${expiredCount} 個過期訂閱`,
        expiredCount,
        expiredSubscriptions: expiredSubs
      });
    } else {
      return NextResponse.json({
        success: true,
        message: "沒有需要清理的過期訂閱",
        expiredCount: 0
      });
    }

  } catch (error) {
    console.error("清理過期訂閱失敗:", error);
    return NextResponse.json(
      { error: "清理失敗" },
      { status: 500 }
    );
  }
}




