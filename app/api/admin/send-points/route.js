// app/api/admin/send-points/route.js
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/serverAuth";
import User from "@/models/User";
import PointsTransaction from "@/models/PointsTransaction";
import { dbConnect } from "@/lib/db";

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

    const { targetUserId, amount, reason } = await req.json();
    
    // 驗證參數
    if (!targetUserId || !amount) {
      return NextResponse.json({ success: false, message: "缺少必要參數" }, { status: 400 });
    }

    const pointsAmount = parseInt(amount);
    if (isNaN(pointsAmount) || pointsAmount <= 0) {
      return NextResponse.json({ success: false, message: "無效的積分數量" }, { status: 400 });
    }

    // 查找目標用戶
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return NextResponse.json({ success: false, message: "目標用戶不存在" }, { status: 404 });
    }

    // 初始化積分餘額（如果不存在）
    if (typeof targetUser.pointsBalance !== 'number') {
      targetUser.pointsBalance = 0;
    }

    // 更新積分
    const oldBalance = targetUser.pointsBalance;
    targetUser.pointsBalance += pointsAmount;
    
    await targetUser.save();

    // ✅ 創建積分交易記錄
    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10); // YYYY-MM-DD
    
    await PointsTransaction.create({
      userId: targetUser._id,
      points: pointsAmount,
      type: "admin_gift",
      dateKey: dateKey,
      sourceId: null,
      actorUserId: currentUser._id,
      meta: { 
        adminUsername: currentUser.username,
        targetUsername: targetUser.username,
        description: reason || "管理員發送測試積分"
      },
      createdAt: now
    });

    console.log(`💰 管理員 ${currentUser.username} 發送 ${pointsAmount} 積分給 ${targetUser.username}`);
    console.log(`   原積分: ${oldBalance}, 新積分: ${targetUser.pointsBalance}`);
    console.log(`   原因: ${reason || '無'}`);

    return NextResponse.json({
      success: true,
      message: `成功發送 ${pointsAmount} 積分`,
      data: {
        targetUser: {
          id: targetUser._id,
          username: targetUser.username,
          oldBalance: oldBalance,
          newBalance: targetUser.pointsBalance
        }
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
