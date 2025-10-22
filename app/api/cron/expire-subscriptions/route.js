import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";

// 清理過期訂閱，將 isActive 設置為 false

export async function GET(request) {
  try {
    await dbConnect();
    
    const now = new Date();
    
    console.log(`\n🧹 開始清理過期訂閱（${now.toLocaleString('zh-TW')}）`);
    
    // 查找所有有活躍訂閱的用戶
    const users = await User.find({
      'subscriptions.isActive': true
    }).select('subscriptions username _id');
    
    let expiredCount = 0;
    const SUBSCRIPTION_NAMES = {
      pinPlayer: '釘選播放器',
      pinPlayerTest: '釘選播放器（測試）',
      uploadQuota: '上傳配額',
      premiumFeatures: '高級功能'
    };
    
    for (const user of users) {
      let hasChanges = false;
      
      for (const sub of user.subscriptions) {
        if (!sub.isActive) continue;
        
        const expiresAt = sub.expiresAt || sub.nextBillingDate;
        if (!expiresAt) continue;
        
        const expiresAtDate = new Date(expiresAt);
        
        // 如果已經過期
        if (expiresAtDate < now) {
          const subName = SUBSCRIPTION_NAMES[sub.type] || sub.type;
          
          sub.isActive = false;
          hasChanges = true;
          expiredCount++;
          
          console.log(`  ❌ ${user.username} 的「${subName}」已過期（${expiresAtDate.toLocaleDateString('zh-TW')}）`);
        }
      }
      
      if (hasChanges) {
        await user.save();
      }
    }
    
    console.log(`\n📊 清理統計: ${expiredCount} 個訂閱已設置為過期\n`);
    
    return NextResponse.json({
      success: true,
      message: `已清理 ${expiredCount} 個過期訂閱`,
      expiredCount
    });

  } catch (error) {
    console.error("清理過期訂閱失敗:", error);
    return NextResponse.json(
      { error: "清理失敗" },
      { status: 500 }
    );
  }
}




