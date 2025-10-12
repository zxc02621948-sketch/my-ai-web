import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import User from "@/models/User";

export async function POST(req) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const { productId, cost } = await req.json();
    
    console.log("🔧 購買功能請求:", { productId, cost, currentUser: currentUser._id });
    console.log("🔧 當前用戶狀態:", {
      _id: currentUser._id,
      frameColorEditorUnlocked: currentUser.frameColorEditorUnlocked,
      miniPlayerPurchased: currentUser.miniPlayerPurchased,
      pointsBalance: currentUser.pointsBalance
    });
    
    if (!productId) {
      return NextResponse.json({ error: "請選擇商品" }, { status: 400 });
    }

    // 檢查積分是否足夠
    if (currentUser.pointsBalance < cost) {
      return NextResponse.json({ 
        error: `積分不足！需要 ${cost} 積分，你目前有 ${currentUser.pointsBalance} 積分` 
      }, { status: 400 });
    }

    let updateData = {};
    let successMessage = "";

    // 根據商品 ID 處理不同的功能解鎖
    switch (productId) {
      case "frame-color-editor":
        // 檢查是否已解鎖
        if (currentUser.frameColorEditorUnlocked) {
          return NextResponse.json({ 
            error: "你已經解鎖了頭像框調色盤功能" 
          }, { status: 400 });
        }
        updateData = { frameColorEditorUnlocked: true };
        successMessage = "頭像框調色盤功能解鎖成功！";
        break;
        
      case "player-1day-coupon":
        // 檢查是否已購買過（終身限購1次）
        if (currentUser.playerCouponUsed) {
          return NextResponse.json({ 
            error: "你已經使用過 1 日免費體驗券了" 
          }, { status: 400 });
        }
        
        // 設置體驗券過期時間（1天）
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 1);
        
        updateData = { 
          playerCouponUsed: true,
          miniPlayerExpiry: expiryDate
        };
        successMessage = "播放器 1 日免費體驗券已激活！";
        break;
        
      default:
        return NextResponse.json({ error: "無效的商品" }, { status: 400 });
    }

    // 扣除積分並解鎖功能
    const updatedUser = await User.findByIdAndUpdate(
      currentUser._id,
      {
        $inc: { pointsBalance: -cost },
        $set: updateData
      },
      { new: true }
    );

    console.log("🔧 購買後用戶狀態:", {
      _id: updatedUser._id,
      pointsBalance: updatedUser.pointsBalance,
      frameColorEditorUnlocked: updatedUser.frameColorEditorUnlocked,
      miniPlayerPurchased: updatedUser.miniPlayerPurchased
    });

    return NextResponse.json({
      success: true,
      message: successMessage,
      data: {
        newBalance: updatedUser.pointsBalance,
        unlocked: true
      }
    });

  } catch (error) {
    console.error("❌ 購買功能失敗:", error);
    return NextResponse.json(
      { error: "購買功能失敗" },
      { status: 500 }
    );
  }
}
