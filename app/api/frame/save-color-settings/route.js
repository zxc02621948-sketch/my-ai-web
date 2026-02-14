import { NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import PointsTransaction from "@/models/PointsTransaction";
import { getLevelIndex } from "@/utils/pointsLevels";
import { sanitizeFrameSettings } from "@/lib/sanitizeFrameSettings";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUserFromRequest(req);
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

    // ✅ 檢查是否達到 LV2（150 積分）
    // 檢查方式：字段已設置 OR 等級達到 LV2（索引 >= 1）
    const userLevel = getLevelIndex(user.totalEarnedPoints || 0);
    const isUnlocked = user.frameColorEditorUnlocked || userLevel >= 1; // LV2 的索引是 1
    
    if (!isUnlocked) {
      return NextResponse.json({ 
        error: "此功能需要達到 LV2 才能使用",
        needLevel: "LV2"
      }, { status: 403 });
    }

    // 檢查積分是否足夠
    const COST = 20;
    if (user.pointsBalance < COST) {
      return NextResponse.json({ 
        error: `積分不足！保存設定需要 ${COST} 積分`,
        need: COST,
        current: user.pointsBalance
      }, { status: 400 });
    }

    // 扣除積分
    user.pointsBalance -= COST;

    // 保存顏色設定
    if (!user.frameSettings) {
      user.frameSettings = {};
    }
    const safeSettings = sanitizeFrameSettings(settings);
    user.frameSettings[frameId] = safeSettings;

    await user.save();

    // 記錄積分交易
    await PointsTransaction.create({
      userId: user._id,
      type: "frame_color_edit",
      points: -COST,
      dateKey: new Date().toISOString().split('T')[0],
      meta: {
        frameId: frameId,
        settings: safeSettings
      }
    });

    console.log(`✅ 用戶 ${user.username} 使用調色盤功能，扣除 ${COST} 積分`);

    return NextResponse.json({
      success: true,
      message: "顏色設定已保存",
      newBalance: user.pointsBalance,
      cost: COST
    });

  } catch (error) {
    console.error("保存調色盤設定失敗:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

