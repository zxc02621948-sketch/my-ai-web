import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import Notification from "@/models/Notification";

// 檢查即將到期的訂閱，發送提醒通知
// 建議每天運行一次（Vercel Cron Job）
export async function GET(request) {
  try {
    await dbConnect();
    
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    
    console.log(`\n📅 檢查即將到期的訂閱（${now.toLocaleString('zh-TW')}）`);
    
    // 查找所有有活躍訂閱的用戶
    const users = await User.find({
      'subscriptions.isActive': true
    }).select('subscriptions username _id');
    
    let notifiedCount = 0;
    const SUBSCRIPTION_NAMES = {
      pinPlayer: '釘選播放器',
      pinPlayerTest: '釘選播放器（測試）',
      uploadQuota: '上傳配額',
      premiumFeatures: '高級功能'
    };
    
    for (const user of users) {
      for (const sub of user.subscriptions) {
        if (!sub.isActive) continue;
        
        const expiresAt = sub.expiresAt || sub.nextBillingDate;
        if (!expiresAt) continue;
        
        const expiresAtDate = new Date(expiresAt);
        const daysRemaining = Math.ceil((expiresAtDate - now) / (1000 * 60 * 60 * 24));
        
        // 如果剩餘 3 天且還沒取消
        if (daysRemaining === 3 && !sub.cancelledAt) {
          const subName = SUBSCRIPTION_NAMES[sub.type] || sub.type;
          
          // 檢查是否已經發送過提醒（避免重複）
          // ⚠️ 測試訂閱不去重，正式訂閱才去重
          let existingNotif = null;
          if (sub.type !== 'pinPlayerTest') {
            existingNotif = await Notification.findOne({
              userId: user._id,
              type: 'subscription_expiring',
              createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }, // 24小時內
              message: { $regex: subName }
            });
          }
          
          if (!existingNotif) {
            await Notification.create({
              userId: user._id,
              type: 'subscription_expiring',
              message: `您的「${subName}」訂閱還有 3 天到期（${expiresAtDate.toLocaleDateString('zh-TW')}）。前往商店續費，時間會累積延長！`,
              link: '/store',
              isRead: false // 確保未讀
            });
            
            notifiedCount++;
            console.log(`  ✅ 已提醒用戶 ${user.username}: ${subName} (剩餘 ${daysRemaining} 天)`);
          } else {
            console.log(`  ⏭️ 跳過重複提醒: ${user.username} - ${subName} (24小時內已提醒過)`);
          }
        }
      }
    }
    
    console.log(`\n📊 提醒統計: ${notifiedCount} 個用戶收到到期提醒\n`);
    
    // ✅ 提示前端刷新通知（通過響應頭）
    const response = NextResponse.json({
      success: true,
      notifiedCount,
      message: `已發送 ${notifiedCount} 個到期提醒`,
      shouldRefresh: notifiedCount > 0 // 如果有通知，建議前端刷新
    });
    
    return response;
  } catch (error) {
    console.error("檢查到期訂閱失敗:", error);
    return NextResponse.json(
      { error: "檢查失敗" },
      { status: 500 }
    );
  }
}

