// app/api/cron/cleanup-expired-coupons/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import PowerCoupon from "@/models/PowerCoupon";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await dbConnect();

    const url = new URL(req.url);
    const secret = req.headers.get("x-cron-secret") || url.searchParams.get("secret");
    if (secret !== process.env.ADMIN_SECRET) {
      return new NextResponse("Not found", { status: 404 });
    }

    const now = new Date();
    const dryRun = url.searchParams.get("dry") === "1";
    
    console.log(`🧹 [Cron] 開始清理過期權力券 (${dryRun ? '模擬模式' : '實際執行'})`);

    // 查找過期的權力券
    const expiredCoupons = await PowerCoupon.find({
      used: false,
      expiry: { $lte: now }
    });

    console.log(`🔍 [Cron] 找到 ${expiredCoupons.length} 張過期權力券`);

    if (!dryRun && expiredCoupons.length > 0) {
      // 刪除過期券
      const result = await PowerCoupon.deleteMany({
        used: false,
        expiry: { $lte: now }
      });

      console.log(`✅ [Cron] 已刪除 ${result.deletedCount} 張過期權力券`);
    }

    return NextResponse.json({
      success: true,
      message: `清理完成 (${dryRun ? '模擬模式' : '實際執行'})`,
      expiredCount: expiredCoupons.length,
      deletedCount: dryRun ? 0 : expiredCoupons.length
    });

  } catch (error) {
    console.error("清理過期權力券錯誤:", error);
    return NextResponse.json({ 
      success: false, 
      message: "伺服器錯誤" 
    }, { status: 500 });
  }
}
