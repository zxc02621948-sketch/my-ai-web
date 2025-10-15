// app/api/power-coupon/purchase/route.js
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/serverAuth.js";
import User from "@/models/User.js";
import PowerCoupon from "@/models/PowerCoupon.js";
import PointsTransaction from "@/models/PointsTransaction.js";
import { dbConnect } from "@/lib/db.js";

export async function POST(req) {
  try {
    console.log("權力券購買 API 被調用");
    await dbConnect();
    
    const currentUser = await getCurrentUser();
    console.log("當前用戶:", currentUser);
    if (!currentUser) {
      console.log("用戶未登入");
      return NextResponse.json({ success: false, message: "未登入" }, { status: 401 });
    }

    const body = await req.json();
    console.log("權力券購買請求:", body);
    const { type, quantity = 1 } = body;
    
    // 驗證參數
    console.log("驗證參數:", { type, quantity });
    const validTypes = ['7day', '30day'];
    if (!validTypes.includes(type)) {
      console.log("無效的券類型:", type);
      return NextResponse.json({ success: false, message: "無效的券類型" }, { status: 400 });
    }

    const user = await User.findById(currentUser._id);
    if (!user) {
      return NextResponse.json({ success: false, message: "用戶不存在" }, { status: 404 });
    }

    // 計算價格
    const prices = {
      '7day': 30,
      '30day': 100
    };
    
    const price = prices[type] * quantity;
    
    // 檢查積分是否足夠
    console.log("檢查積分:", { pointsBalance: user.pointsBalance, price });
    if (user.pointsBalance < price) {
      console.log("積分不足");
      return NextResponse.json({ 
        success: false, 
        message: `積分不足，需要 ${price} 積分` 
      }, { status: 400 });
    }

    // 檢查限購規則（管理員可繞過）
    const now = new Date();
    const limitPeriods = {
      '7day': 3, // 3天限購1張
      '30day': 7  // 7天限購1張
    };
    
    const limitPeriod = limitPeriods[type];
    const limitDate = new Date(now.getTime() - limitPeriod * 24 * 60 * 60 * 1000);
    
    const recentPurchases = await PowerCoupon.countDocuments({
      userId: user._id,
      type: type,
      purchaseMethod: 'shop',
      createdAt: { $gte: limitDate }
    });
    
    console.log("檢查限購規則:", { recentPurchases, limitPeriod });
    
    // 管理員可以繞過限購規則
    if (recentPurchases > 0 && !user.isAdmin) {
      console.log("限購規則觸發");
      return NextResponse.json({ 
        success: false, 
        message: `${type === '7day' ? '7天券' : '30天券'}在${limitPeriod}天內只能購買一次` 
      }, { status: 400 });
    }
    
    if (recentPurchases > 0 && user.isAdmin) {
      console.log("管理員繞過限購規則");
    }

    // 計算過期時間
    const expiryDate = new Date();
    if (type === '7day') {
      expiryDate.setDate(expiryDate.getDate() + 7);
    } else {
      expiryDate.setDate(expiryDate.getDate() + 30);
    }

    // 創建權力券
    console.log("創建權力券:", { userId: user._id, type, quantity, expiry: expiryDate, price });
    const powerCoupon = new PowerCoupon({
      userId: user._id,
      type: type,
      quantity: quantity,
      expiry: expiryDate,
      purchasePrice: price,
      purchaseMethod: 'shop'
    });

    await powerCoupon.save();
    console.log("權力券創建成功:", powerCoupon._id);

    // 更新用戶積分
    user.pointsBalance -= price;
    await user.save();

    // 記錄積分交易
    const dateKey = new Date().toISOString().split('T')[0];
    await PointsTransaction.create({
      userId: user._id,
      points: -price,
      type: 'store_purchase',
      dateKey: dateKey,
      meta: { 
        productId: `power-coupon-${type}`,
        description: `權力券購買 (${type === '7day' ? '7天券' : '30天券'})`,
        quantity,
        couponId: powerCoupon._id
      }
    });

    return NextResponse.json({
      success: true,
      message: "權力券購買成功",
      data: {
        couponId: powerCoupon._id,
        type: powerCoupon.type,
        quantity: powerCoupon.quantity,
        expiry: powerCoupon.expiry,
        pointsBalance: user.pointsBalance
      }
    });

  } catch (error) {
    console.error("權力券購買錯誤:", error);
    console.error("錯誤詳情:", error.message);
    console.error("錯誤堆疊:", error.stack);
    return NextResponse.json({ 
      success: false, 
      message: "伺服器錯誤",
      error: error.message 
    }, { status: 500 });
  }
}
