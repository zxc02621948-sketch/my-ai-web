import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import User from "@/models/User";
import PointsTransaction from "@/models/PointsTransaction";

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
    let updatedUser = null; // ✅ 聲明 updatedUser 變量

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
            error: "你已經使用過完整功能體驗券了" 
          }, { status: 400 });
        }
        
        // 設置體驗券過期時間（3天）
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 3);
        
        // ✅ 獲取用戶文檔以更新訂閱
        const user = await User.findById(currentUser._id);
        if (!user) {
          return NextResponse.json({ error: "用戶不存在" }, { status: 404 });
        }
        
        // ✅ 同時創建播放器功能和釘選訂閱（全功能體驗券）
        updateData = { 
          playerCouponUsed: true,
          miniPlayerExpiry: expiryDate
        };
        
        // ✅ 創建 pinPlayerTest 訂閱（3天體驗期）
        const startDate = new Date();
        const subscriptionExpiresAt = new Date(startDate);
        subscriptionExpiresAt.setDate(subscriptionExpiresAt.getDate() + 3);
        
        // 檢查是否已有 pinPlayerTest 訂閱
        const existingTestSub = user.subscriptions?.find(s => s.type === 'pinPlayerTest' && s.isActive);
        if (!existingTestSub) {
          // 如果沒有訂閱數組，初始化它
          if (!user.subscriptions) {
            user.subscriptions = [];
          }
          user.subscriptions.push({
            type: 'pinPlayerTest',
            startDate: startDate,
            expiresAt: subscriptionExpiresAt,
            isActive: true,
            monthlyCost: 0, // 免費體驗
            lastRenewedAt: startDate
          });
        } else {
          // 如果已有測試訂閱，更新到期時間
          existingTestSub.expiresAt = subscriptionExpiresAt;
          existingTestSub.isActive = true;
        }
        
        // ✅ 同時更新積分並保存用戶文檔（包含訂閱）
        user.playerCouponUsed = true;
        user.miniPlayerExpiry = expiryDate;
        user.pointsBalance -= cost; // 扣除積分
        await user.save();
        
        // ✅ 使用保存後的用戶文檔
        updatedUser = user;
        
        successMessage = "播放器完整功能體驗券已激活！已解鎖播放器與釘選功能（3天）";
        break;
        
      default:
        return NextResponse.json({ error: "無效的商品" }, { status: 400 });
    }

    // ✅ 如果已經在 switch 中處理了用戶更新（如 player-1day-coupon），則不需要再次更新
    if (productId !== "player-1day-coupon") {
      // 其他商品正常處理
      updatedUser = await User.findByIdAndUpdate(
        currentUser._id,
        {
          $inc: { pointsBalance: -cost },
          $set: updateData
        },
        { new: true }
      );
    }

    // 記錄積分交易
    const dateKey = new Date().toISOString().split('T')[0];
    await PointsTransaction.create({
      userId: currentUser._id,
      points: -cost,
      type: 'store_purchase',
      dateKey: dateKey,
      meta: { 
        productId,
        description: successMessage,
        cost
      }
    });

    // ✅ 確保 updatedUser 已設置
    if (!updatedUser) {
      console.error("❌ updatedUser 未設置");
      return NextResponse.json(
        { error: "購買功能失敗：用戶更新失敗" },
        { status: 500 }
      );
    }

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
    console.error("❌ 錯誤堆棧:", error.stack);
    return NextResponse.json(
      { 
        error: "購買功能失敗",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
