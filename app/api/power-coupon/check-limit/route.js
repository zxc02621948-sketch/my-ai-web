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

    const { type } = await req.json();
    
    // 檢查限購規則
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

