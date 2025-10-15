import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";

export async function GET(request) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const user = await User.findById(currentUser._id).select('subscriptions');
    
    if (!user) {
      console.log("❌ 用戶不存在:", currentUser._id);
      return NextResponse.json({ 
        success: true,
        subscriptions: [] // 返回空數組而不是 404
      });
    }

    return NextResponse.json({
      success: true,
      subscriptions: user.subscriptions || []
    });
  } catch (error) {
    console.error("獲取訂閱狀態失敗:", error);
    return NextResponse.json(
      { 
        success: true,
        subscriptions: [] // 出錯時也返回空數組，避免前端報錯
      },
      { status: 200 }
    );
  }
}

