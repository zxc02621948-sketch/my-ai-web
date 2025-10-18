import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/serverAuth";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import { getLevelIndex } from "@/utils/pointsLevels";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const { frameId, settings } = await req.json();
    
    if (!frameId || !settings) {
      return NextResponse.json({ error: "參數錯誤" }, { status: 400 });
    }

    // 查找完整用戶數據
    const user = await User.findById(currentUser._id);
    if (!user) {
      return NextResponse.json({ error: "用戶不存在" }, { status: 404 });
    }

    // 檢查是否達到 LV2（150 積分）
    const userLevel = getLevelIndex(user.totalEarnedPoints || 0);
    if (userLevel < 1) { // LV2 的索引是 1
      return NextResponse.json({ 
        error: "此功能需要達到 LV2 才能使用",
        needLevel: "LV2"
      }, { status: 403 });
    }

    // 保存預覽設定到 frameSettings，但不扣分
    if (!user.frameSettings) {
      user.frameSettings = {};
    }
    user.frameSettings[frameId] = settings;

    await user.save();

    console.log(`✅ 用戶 ${user.username} 保存調色預覽設定，frameId: ${frameId}`);

    return NextResponse.json({
      success: true,
      message: "預覽設定已保存",
      settings: settings
    });

  } catch (error) {
    console.error("保存調色預覽設定失敗:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
