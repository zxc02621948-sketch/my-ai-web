// app/api/exposure/purchase/route.js
// 注意：此API已棄用，曝光分數是訂閱專屬，不可積分購買
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/serverAuth";
import User from "@/models/User";
import { dbConnect } from "@/lib/db";

export async function POST(req) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, message: "未登入" }, { status: 401 });
    }
    
    // 此功能已棄用
    return NextResponse.json({ 
      success: false, 
      message: "曝光分數是訂閱專屬功能，請訂閱以獲得此權益" 
    }, { status: 400 });

    const { type, duration, bonus } = await req.json();
    
    // 驗證參數
    const validTypes = ['7day', '30day'];
    const validDurations = [7, 30];
    const validBonuses = [0, 50, 100, 200];
    
    if (!validTypes.includes(type) || !validDurations.includes(duration) || !validBonuses.includes(bonus)) {
      return NextResponse.json({ success: false, message: "無效參數" }, { status: 400 });
    }

    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ success: false, message: "用戶不存在" }, { status: 404 });
    }

    // 計算價格
    const prices = {
      '7day': { 0: 30, 50: 50, 100: 80, 200: 120 },
      '30day': { 0: 100, 50: 150, 100: 200, 200: 300 }
    };
    
    const price = prices[type][bonus];
    
    // 檢查積分是否足夠
    if (user.pointsBalance < price) {
      return NextResponse.json({ 
        success: false, 
        message: `積分不足，需要 ${price} 積分` 
      }, { status: 400 });
    }

    // 計算過期時間
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + duration);

    // 更新用戶曝光設定
    user.exposureMultiplier = 1.2;
    user.exposureBonus = bonus;
    user.exposureExpiry = expiryDate;
    user.exposureType = 'temporary';
    user.pointsBalance -= price;

    await user.save();

    return NextResponse.json({
      success: true,
      message: "曝光分數購買成功",
      data: {
        exposureMultiplier: user.exposureMultiplier,
        exposureBonus: user.exposureBonus,
        exposureExpiry: user.exposureExpiry,
        pointsBalance: user.pointsBalance
      }
    });

  } catch (error) {
    console.error("曝光分數購買錯誤:", error);
    return NextResponse.json({ 
      success: false, 
      message: "伺服器錯誤" 
    }, { status: 500 });
  }
}
