// app/api/admin/give-me-points/route.js
// 管理員快速給自己發送積分（測試用）
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

    // 更新積分
    const oldBalance = user.pointsBalance;
    user.pointsBalance += pointsAmount;
    
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
      message: `成功獲得 ${pointsAmount} 積分！`,
      data: {
        oldBalance: oldBalance,
        newBalance: user.pointsBalance,
        added: pointsAmount
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
