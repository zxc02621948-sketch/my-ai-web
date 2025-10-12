import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import User from "@/models/User";

const VALID_FRAMES = [
  "default", "ai-generated", "animals", "leaves", "magic-circle", "magic-circle-2"
];

export async function POST(req) {
  try {
    console.log("🔧 收到設置頭像框請求");
    await dbConnect();
    
    const currentUser = await getCurrentUser();
    console.log("🔧 getCurrentUser 結果:", currentUser ? "找到用戶" : "未找到用戶");
    if (!currentUser) {
      console.log("❌ 設置頭像框失敗: 用戶未登入");
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }
    
    console.log("🔧 當前用戶詳細信息:", {
      id: currentUser._id,
      username: currentUser.username,
      ownedFrames: currentUser.ownedFrames
    });

    const body = await req.json();
    console.log("🔧 請求體:", body);
    const { frameId, settings } = body;
    console.log("🔧 設置頭像框請求:", { frameId, settings, currentUser: currentUser._id, ownedFrames: currentUser.ownedFrames });
    
    if (!frameId || !VALID_FRAMES.includes(frameId)) {
      console.log("❌ 無效的頭像框:", frameId, "有效選項:", VALID_FRAMES);
      return NextResponse.json({ error: "無效的頭像框" }, { status: 400 });
    }

    // 所有頭像框都是免費的，不需要檢查擁有權
    console.log("🔧 設置頭像框:", frameId, "（所有頭像框都是免費的）");

    // 更新用戶的當前頭像框和設定
    const updateData = { currentFrame: frameId };
    if (settings) {
      updateData.frameSettings = {
        ...(currentUser.frameSettings || {}),
        [frameId]: settings
      };
    }
    
    console.log("🔧 準備更新數據庫:", updateData);
    const result = await User.findByIdAndUpdate(
      currentUser._id,
      updateData
    );
    console.log("🔧 數據庫更新結果:", result ? "成功" : "失敗");

    return NextResponse.json({
      success: true,
      message: "頭像框設置成功！",
      data: {
        currentFrame: frameId
      }
    });

  } catch (error) {
    console.error("❌ 設置頭像框失敗:", error);
    return NextResponse.json(
      { error: "設置頭像框失敗" },
      { status: 500 }
    );
  }
}
