import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import PointsTransaction from "@/models/PointsTransaction";

// 訂閱配置
const SUBSCRIPTION_CONFIG = {
  pinPlayer: {
    name: "釘選播放器",
    monthlyCost: 200,
    durationDays: 30
  },
};

export async function POST(request) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const { subscriptionType, autoRenew } = await request.json();
    
    // 驗證訂閱類型
    if (!SUBSCRIPTION_CONFIG[subscriptionType]) {
      return NextResponse.json({ error: "無效的訂閱類型" }, { status: 400 });
    }

    const user = await User.findById(currentUser._id);
    
    if (!user) {
      return NextResponse.json({ error: "用戶不存在" }, { status: 404 });
    }

    const config = SUBSCRIPTION_CONFIG[subscriptionType];

    // 檢查積分是否足夠
    if (user.pointsBalance < config.monthlyCost) {
      return NextResponse.json({ 
        error: `積分不足！需要 ${config.monthlyCost} 積分，當前只有 ${user.pointsBalance} 積分` 
      }, { status: 400 });
    }

    const now = new Date();
    
    // 查找現有訂閱（不管是否過期）
    let existingSub = user.subscriptions?.find(s => s.type === subscriptionType);
    
    // 扣除積分
    user.pointsBalance -= config.monthlyCost;
    
    // 計算新增的時長
    let addedDuration = 0; // 毫秒
    if (config.durationDays) {
      addedDuration = config.durationDays * 24 * 60 * 60 * 1000;
    } else if (config.durationMinutes) {
      addedDuration = config.durationMinutes * 60 * 1000;
    }
    
    // 如果已有訂閱（累積制）
    if (existingSub) {
      // 兼容舊數據：優先使用 expiresAt，否則使用 nextBillingDate
      const currentExpiresAt = existingSub.expiresAt 
        ? new Date(existingSub.expiresAt) 
        : (existingSub.nextBillingDate ? new Date(existingSub.nextBillingDate) : now);
      
      // 如果未過期，從 expiresAt 開始累加
      // 如果已過期，從 now 開始累加
      const baseTime = currentExpiresAt > now ? currentExpiresAt : now;
      const newExpiresAt = new Date(baseTime.getTime() + addedDuration);
      
      existingSub.expiresAt = newExpiresAt;
      existingSub.isActive = true;
      existingSub.lastRenewedAt = now;
      existingSub.cancelledAt = null; // 清除取消標記
    } 
    // 首次購買
    else {
      const expiresAt = new Date(now.getTime() + addedDuration);
      
      const newSubscription = {
        type: subscriptionType,
        startDate: now,
        expiresAt: expiresAt,
        isActive: true,
        monthlyCost: config.monthlyCost,
        lastRenewedAt: now
      };

      if (!user.subscriptions) {
        user.subscriptions = [];
      }
      user.subscriptions.push(newSubscription);
      existingSub = newSubscription; // 用於後續返回
    }

    // ✅ 如果用戶已經有釘選播放器，同步更新 pinnedPlayer.expiresAt
    if (subscriptionType === 'pinPlayer' && user.pinnedPlayer) {
      user.pinnedPlayer.expiresAt = existingSub.expiresAt;
    }

    await user.save();

    // 記錄積分交易
    const dateKey = now.toISOString().split('T')[0];
    await PointsTransaction.create({
      userId: user._id,
      points: -config.monthlyCost,
      type: 'subscription_purchase',
      dateKey: dateKey,
      meta: { 
        subscriptionType,
        action: existingSub.lastRenewedAt !== existingSub.startDate ? 'renew' : 'subscribe',
        description: `${config.name} ${existingSub.lastRenewedAt !== existingSub.startDate ? '續費' : '訂閱'}`
      }
    });

    // 計算剩餘天數
    const daysRemaining = Math.ceil((new Date(existingSub.expiresAt) - now) / (1000 * 60 * 60 * 24));

    return NextResponse.json({
      success: true,
      subscription: existingSub,
      remainingPoints: user.pointsBalance,
      expiresAt: existingSub.expiresAt,
      daysRemaining: daysRemaining
    });
  } catch (error) {
    console.error("❌ [訂閱] 訂閱失敗:", error);
    console.error("錯誤詳情:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json(
      { error: error.message || "訂閱失敗，請稍後再試" },
      { status: 500 }
    );
  }
}

