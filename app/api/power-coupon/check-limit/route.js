import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/serverAuth.js";
import PowerCoupon from "@/models/PowerCoupon.js";
import { dbConnect } from "@/lib/db.js";

export async function POST(req) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, message: "未登入" }, { status: 401 });
    }

    let body = {};
    try {
      body = await req.json();
    } catch (e) {
      // 忽略空 body 錯誤
    }
    
    const { type, types } = body; // 支持單個類型或多個類型
    
    // 如果請求多個類型，一次返回所有結果
    if (types && Array.isArray(types)) {
      const now = new Date();
      const limitPeriods = {
        '7day': 3, // 3天限購1張
        '30day': 7  // 7天限購1張
      };
      
      const results = {};
      
      for (const t of types) {
        const limitPeriod = limitPeriods[t];
        if (!limitPeriod) continue;
        
        const limitDate = new Date(now.getTime() - limitPeriod * 24 * 60 * 60 * 1000);
        
        const recentPurchases = await PowerCoupon.countDocuments({
          userId: currentUser._id,
          type: t,
          purchaseMethod: 'shop',
          createdAt: { $gte: limitDate }
        });
        
        const canPurchase = recentPurchases === 0 || currentUser.isAdmin;
        const remainingDays = canPurchase ? 0 : Math.ceil((limitDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        
        results[t] = {
          success: true,
          canPurchase,
          recentPurchases,
          limitPeriod,
          remainingDays: Math.max(0, remainingDays),
          isAdmin: currentUser.isAdmin
        };
      }
      
      return NextResponse.json({
        success: true,
        limits: results
      });
    }
    
    // 兼容舊的單個類型查詢
    const now = new Date();
    const limitPeriods = {
      '7day': 3, // 3天限購1張
      '30day': 7  // 7天限購1張
    };
    
    const limitPeriod = limitPeriods[type];
    const limitDate = new Date(now.getTime() - limitPeriod * 24 * 60 * 60 * 1000);
    
    const recentPurchases = await PowerCoupon.countDocuments({
      userId: currentUser._id,
      type: type,
      purchaseMethod: 'shop',
      createdAt: { $gte: limitDate }
    });
    
    const canPurchase = recentPurchases === 0 || currentUser.isAdmin;
    const remainingDays = canPurchase ? 0 : Math.ceil((limitDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    
    return NextResponse.json({
      success: true,
      canPurchase,
      recentPurchases,
      limitPeriod,
      remainingDays: Math.max(0, remainingDays),
      isAdmin: currentUser.isAdmin
    });
  } catch (error) {
    console.error("檢查權力券限購狀態錯誤:", error);
    return NextResponse.json({ 
      success: false, 
      message: "伺服器錯誤" 
    }, { status: 500 });
  }
}


