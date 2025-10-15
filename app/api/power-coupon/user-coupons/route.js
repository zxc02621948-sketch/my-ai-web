// app/api/power-coupon/user-coupons/route.js
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/serverAuth";
import PowerCoupon from "@/models/PowerCoupon";
import { dbConnect } from "@/lib/db";

export async function GET(req) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, message: "未登入" }, { status: 401 });
    }

    const now = new Date();
    const coupons = await PowerCoupon.find({
      userId: currentUser._id,
      used: false,
      $or: [
        { expiry: null }, // 沒有過期時間的券（如稀有券）
        { expiry: { $gt: now } } // 還沒過期的券
      ]
    }).sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      coupons: coupons
    });

  } catch (error) {
    console.error("獲取權力券錯誤:", error);
    return NextResponse.json({ 
      success: false, 
      message: "伺服器錯誤" 
    }, { status: 500 });
  }
}
