// app/api/admin/fix-level-rewards/route.js
// 管理員專用：修復已達到等級但未授予的獎勵
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import { getLevelIndex } from "@/utils/pointsLevels";
import { grantLevelRewards } from "@/utils/levelRewards";

export async function POST(request) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    // 檢查是否為管理員
    if (!currentUser.isAdmin) {
      return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
    }

    const { userId } = await request.json();
    
    // 如果沒有指定 userId，則修復當前用戶
    const targetUserId = userId || currentUser._id;

    const user = await User.findById(targetUserId);
    
    if (!user) {
      return NextResponse.json({ error: "用戶不存在" }, { status: 404 });
    }

    // 獲取當前等級
    const currentLevel = getLevelIndex(user.totalEarnedPoints || 0);
    
    // 從等級 0 開始重新授予所有獎勵（確保不會遺漏）
    const rewards = await grantLevelRewards(user, -1, currentLevel);
    
    await user.save();

    console.log(`🔧 [修復等級獎勵] ${user.username} (LV${currentLevel + 1}):`, {
      解鎖功能: rewards.features,
      獲得頭像框: rewards.frames,
      獲得積分: rewards.points
    });

    return NextResponse.json({
      success: true,
      message: `已修復等級獎勵`,
      userId: user._id,
      username: user.username,
      currentLevel: currentLevel + 1,
      rewards: {
        features: rewards.features,
        frames: rewards.frames,
        points: rewards.points,
        messages: rewards.messages
      },
      userState: {
        frameColorEditorUnlocked: user.frameColorEditorUnlocked,
        miniPlayerPurchased: user.miniPlayerPurchased,
        ownedFrames: user.ownedFrames
      }
    });
  } catch (error) {
    console.error("❌ [修復等級獎勵] 失敗:", error);
    return NextResponse.json(
      { error: "修復失敗，請稍後再試", details: error.message },
      { status: 500 }
    );
  }
}

