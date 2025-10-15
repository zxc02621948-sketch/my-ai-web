import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";

export async function POST(request) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const { subscriptionType } = await request.json();

    const user = await User.findById(currentUser._id);
    
    if (!user) {
      return NextResponse.json({ error: "用戶不存在" }, { status: 404 });
    }

    // 找到對應的訂閱
    const subscription = user.subscriptions?.find(
      s => s.type === subscriptionType && s.isActive
    );

    if (!subscription) {
      return NextResponse.json({ 
        error: "未找到有效訂閱" 
      }, { status: 404 });
    }

    // 取消訂閱（標記為已取消，但繼續有效到到期時間）
    subscription.cancelledAt = new Date();
    
    // 注意：不設置 isActive = false，讓訂閱繼續有效到 expiresAt
    // 這樣用戶可以用完已付費的時間

    await user.save();

    console.log(`✅ [訂閱] ${user.username} 取消了 ${subscriptionType} 訂閱（將在 ${subscription.expiresAt.toLocaleString('zh-TW')} 到期）`);

    return NextResponse.json({
      success: true,
      message: `訂閱已取消，將在 ${new Date(subscription.expiresAt).toLocaleDateString('zh-TW')} 到期後失效`,
      expiresAt: subscription.expiresAt
    });
  } catch (error) {
    console.error("取消訂閱失敗:", error);
    return NextResponse.json(
      { error: "取消訂閱失敗，請稍後再試" },
      { status: 500 }
    );
  }
}

