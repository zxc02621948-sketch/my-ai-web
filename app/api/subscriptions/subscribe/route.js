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
    
    // ✅ 特殊處理：pinPlayer 訂閱需要檢查是否有 pinPlayerTest 試用訂閱
    let testSub = null;
    let remainingTestDays = 0;
    if (subscriptionType === 'pinPlayer') {
      // 查找 pinPlayerTest 試用訂閱
      testSub = user.subscriptions?.find(s => s.type === 'pinPlayerTest' && s.isActive);
      
      // 計算試用剩餘天數（如果有的話）
      if (testSub && testSub.expiresAt) {
        const testExpiresAt = new Date(testSub.expiresAt);
        if (testExpiresAt > now) {
          // 試用尚未過期，計算剩餘天數
          remainingTestDays = Math.ceil((testExpiresAt - now) / (1000 * 60 * 60 * 24));
        }
      }
    }
    
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
      
      // ✅ 如果是 pinPlayer 訂閱且有試用剩餘天數，累加到正式訂閱
      const testRemainingMs = (subscriptionType === 'pinPlayer' && remainingTestDays > 0) 
        ? remainingTestDays * 24 * 60 * 60 * 1000 
        : 0;
      
      const newExpiresAt = new Date(baseTime.getTime() + addedDuration + testRemainingMs);
      
      existingSub.expiresAt = newExpiresAt;
      existingSub.isActive = true;
      existingSub.lastRenewedAt = now;
      existingSub.cancelledAt = null; // 清除取消標記
      // ✅ 如果用戶明確設置了 autoRenew，更新它（否則保持原值）
      if (autoRenew !== undefined) {
        existingSub.autoRenew = autoRenew;
      }
      existingSub.nextBillingDate = newExpiresAt; // ✅ 更新下次扣款日期
    } 
    // 首次購買
    else {
      // ✅ 如果是 pinPlayer 訂閱且有試用剩餘天數，累加到正式訂閱
      const testRemainingMs = (subscriptionType === 'pinPlayer' && remainingTestDays > 0) 
        ? remainingTestDays * 24 * 60 * 60 * 1000 
        : 0;
      
      const expiresAt = new Date(now.getTime() + addedDuration + testRemainingMs);
      
      const newSubscription = {
        type: subscriptionType,
        startDate: now,
        expiresAt: expiresAt,
        isActive: true,
        monthlyCost: config.monthlyCost,
        lastRenewedAt: now,
        autoRenew: autoRenew !== false, // ✅ 默認開啟自動續訂，除非明確設置為 false
        nextBillingDate: expiresAt // ✅ 下次扣款日期設為到期日
      };

      if (!user.subscriptions) {
        user.subscriptions = [];
      }
      user.subscriptions.push(newSubscription);
      existingSub = newSubscription; // 用於後續返回
    }
    
    // ✅ 將試用訂閱標記為不活躍（已轉換為正式訂閱）
    if (subscriptionType === 'pinPlayer' && testSub) {
      testSub.isActive = false;
      testSub.cancelledAt = now; // 標記為已取消/轉換
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

