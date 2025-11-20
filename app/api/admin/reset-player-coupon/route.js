import { getCurrentUserFromRequest } from '@/lib/serverAuth';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';

export async function POST(req) {
  try {
    console.log('🔄 [Reset Player Coupon] 開始處理重置請求');
    
    const currentUser = await getCurrentUserFromRequest(req);
    
    if (!currentUser) {
      console.log('🔄 [Reset Player Coupon] 未登入');
      return Response.json({ error: '未登入' }, { status: 401 });
    }

    // 只有管理員可以重置
    if (!currentUser.isAdmin) {
      console.log('🔄 [Reset Player Coupon] 權限不足');
      return Response.json({ error: '權限不足' }, { status: 403 });
    }

    await dbConnect();

    // ✅ 獲取請求參數（targetUserId 或 targetUsername）
    const { targetUserId, targetUsername } = await req.json();
    
    // ✅ 確定目標用戶
    let targetUser;
    if (targetUserId) {
      // 通過 ID 查找
      targetUser = await User.findById(targetUserId);
    } else if (targetUsername) {
      // 通過用戶名查找
      targetUser = await User.findOne({ username: targetUsername });
    } else {
      // 沒有指定目標，重置自己的帳號
      targetUser = await User.findById(currentUser._id);
    }
    
    if (!targetUser) {
      console.log('🔄 [Reset Player Coupon] 目標用戶不存在');
      return Response.json({ error: '目標用戶不存在' }, { status: 404 });
    }

    console.log('🔄 [Reset Player Coupon] 重置前狀態:', {
      targetUsername: targetUser.username,
      playerCouponUsed: targetUser.playerCouponUsed,
      miniPlayerExpiry: targetUser.miniPlayerExpiry,
      hasPinPlayerTest: targetUser.subscriptions?.some(s => s.type === 'pinPlayerTest' && s.isActive)
    });

    // ✅ 重置體驗券標記
    targetUser.playerCouponUsed = false;
    targetUser.miniPlayerExpiry = null;
    
    // ✅ 移除 pinPlayerTest 訂閱（如果存在）
    if (targetUser.subscriptions && targetUser.subscriptions.length > 0) {
      targetUser.subscriptions = targetUser.subscriptions.filter(s => s.type !== 'pinPlayerTest');
    }

    await targetUser.save();

    console.log('🔄 [Reset Player Coupon] 重置完成:', {
      targetUsername: targetUser.username,
      playerCouponUsed: targetUser.playerCouponUsed,
      miniPlayerExpiry: targetUser.miniPlayerExpiry,
      adminUsername: currentUser.username
    });

    return Response.json({ 
      success: true,
      message: `✅ ${targetUser.username} 的播放器體驗券標記已重置！現在可以再次使用體驗券了。`,
      data: {
        targetUser: {
          id: targetUser._id,
          username: targetUser.username
        },
        playerCouponUsed: targetUser.playerCouponUsed,
        miniPlayerExpiry: targetUser.miniPlayerExpiry,
        subscriptions: targetUser.subscriptions
      }
    });
  } catch (error) {
    console.error('🔄 [Reset Player Coupon] 重置失敗:', error);
    return Response.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}

