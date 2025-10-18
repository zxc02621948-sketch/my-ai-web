// app/api/admin/give-me-points/route.js
// 管理員快速給自己發送積分（測試用）
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/serverAuth";
import User from "@/models/User";
import PointsTransaction from "@/models/PointsTransaction";
import { dbConnect } from "@/lib/db";
import { getLevelIndex } from "@/utils/pointsLevels";
import { grantLevelRewards } from "@/utils/levelRewards";

export async function POST(req) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, message: "未登入" }, { status: 401 });
    }

    // 檢查是否為管理員
    if (!currentUser.isAdmin) {
      return NextResponse.json({ success: false, message: "無權限" }, { status: 403 });
    }

    const { amount = 1000 } = await req.json();
    
    const pointsAmount = parseInt(amount);
    if (isNaN(pointsAmount) || pointsAmount <= 0) {
      return NextResponse.json({ success: false, message: "無效的積分數量" }, { status: 400 });
    }

    // 查找自己
    const user = await User.findById(currentUser._id);
    if (!user) {
      return NextResponse.json({ success: false, message: "用戶不存在" }, { status: 404 });
    }

    // 初始化積分餘額（如果不存在）
    if (typeof user.pointsBalance !== 'number') {
      user.pointsBalance = 0;
    }

    // 更新積分（同時更新餘額和等級經驗）
    const oldBalance = user.pointsBalance;
    const oldTotalEarned = user.totalEarnedPoints || 0;
    const oldLevel = getLevelIndex(oldTotalEarned);
    
    user.pointsBalance += pointsAmount;
    user.totalEarnedPoints = oldTotalEarned + pointsAmount; // ✅ 同時計入等級經驗
    
    const newLevel = getLevelIndex(user.totalEarnedPoints);
    
    // 檢查是否升級
    let levelUpRewards = null;
    if (newLevel > oldLevel) {
      // 升級了！發放獎勵
      levelUpRewards = await grantLevelRewards(user, oldLevel, newLevel);
      
      // 處理訂閱獎勵
      if (levelUpRewards.subscriptionTrial) {
        const trial = levelUpRewards.subscriptionTrial;
        const startDate = new Date();
        const expiresAt = new Date(startDate);
        expiresAt.setDate(expiresAt.getDate() + trial.duration);
        
        const existingSub = user.subscriptions.find(s => s.type === 'pinPlayerTest' && s.isActive);
        if (!existingSub) {
          user.subscriptions.push({
            type: 'pinPlayerTest',
            startDate: startDate,
            expiresAt: expiresAt,
            isActive: true,
            monthlyCost: 0,
            lastRenewedAt: startDate
          });
        }
      }
      
      if (levelUpRewards.subscriptionPermanent) {
        const permanentDate = new Date('2099-12-31');
        const existingSub = user.subscriptions.find(s => s.type === 'pinPlayer' && s.isActive);
        
        if (existingSub) {
          // 升級現有訂閱為永久
          if (existingSub.expiresAt <= new Date('2099-01-01')) {
            existingSub.expiresAt = permanentDate;
            existingSub.monthlyCost = 0;
            existingSub.lastRenewedAt = new Date();
          }
        } else {
          // 創建新的永久訂閱
          const startDate = new Date();
          user.subscriptions.push({
            type: 'pinPlayer',
            startDate: startDate,
            expiresAt: permanentDate,
            isActive: true,
            monthlyCost: 0,
            lastRenewedAt: startDate
          });
        }
      }
    }
    
    await user.save();

    // ✅ 創建積分交易記錄
    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10); // YYYY-MM-DD
    
    await PointsTransaction.create({
      userId: user._id,
      points: pointsAmount,
      type: "daily_login", // 使用現有的類型（管理員發送視為特殊登入獎勵）
      dateKey: dateKey,
      sourceId: null,
      actorUserId: user._id,
      meta: { 
        source: "admin_gift",
        adminUsername: user.username,
        description: "管理員發送測試積分"
      },
      createdAt: now
    });

    console.log(`💰 管理員 ${user.username} 給自己發送 ${pointsAmount} 積分`);
    console.log(`   原積分: ${oldBalance}, 新積分: ${user.pointsBalance}`);

    return NextResponse.json({
      success: true,
      message: `成功獲得 ${pointsAmount} 積分！${newLevel > oldLevel ? ` 等級提升至 LV${newLevel + 1}！` : ''}`,
      data: {
        oldBalance: oldBalance,
        newBalance: user.pointsBalance,
        added: pointsAmount,
        oldLevel: oldLevel + 1,
        newLevel: newLevel + 1,
        levelUp: newLevel > oldLevel,
        rewards: levelUpRewards
      }
    });

  } catch (error) {
    console.error("發送積分錯誤:", error);
    return NextResponse.json({ 
      success: false, 
      message: "伺服器錯誤" 
    }, { status: 500 });
  }
}
