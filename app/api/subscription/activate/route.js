// app/api/subscription/activate/route.js
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

    const { type, duration, bonus = 0 } = await req.json();
    
    // 驗證參數
    const validTypes = ['monthly', 'yearly'];
    const validDurations = [30, 365]; // 30天或365天
    
    if (!validTypes.includes(type) || !validDurations.includes(duration)) {
      return NextResponse.json({ success: false, message: "無效的訂閱類型" }, { status: 400 });
    }

    const user = await User.findById(currentUser._id);
    if (!user) {
      return NextResponse.json({ success: false, message: "用戶不存在" }, { status: 404 });
    }

    // 計算過期時間
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + duration);

    // 更新用戶訂閱狀態和曝光分數
    user.isSubscribed = true;
    user.subscriptionExpiry = expiryDate;
    user.subscriptionType = type;
    
    // 訂閱用戶自動獲得曝光分數加成
    user.exposureMultiplier = 1.2;
    user.exposureBonus = bonus;
    user.exposureExpiry = expiryDate;
    user.exposureType = 'permanent'; // 訂閱期間永久有效

    await user.save();

    return NextResponse.json({
      success: true,
      message: "訂閱激活成功",
      data: {
        isSubscribed: user.isSubscribed,
        subscriptionExpiry: user.subscriptionExpiry,
        subscriptionType: user.subscriptionType,
        exposureMultiplier: user.exposureMultiplier,
        exposureBonus: user.exposureBonus,
        exposureExpiry: user.exposureExpiry
      }
    });

  } catch (error) {
    console.error("訂閱激活錯誤:", error);
    return NextResponse.json({ 
      success: false, 
      message: "伺服器錯誤" 
    }, { status: 500 });
  }
}
