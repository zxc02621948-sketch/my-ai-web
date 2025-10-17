import { getCurrentUserFromRequest } from '@/lib/serverAuth';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';

export async function POST(req) {
  try {
    console.log('🔄 [Reset Premium Skin] 開始處理重置請求');
    
    const currentUser = await getCurrentUserFromRequest(req);
    
    if (!currentUser) {
      console.log('🔄 [Reset Premium Skin] 未登入');
      return Response.json({ error: '未登入' }, { status: 401 });
    }

    // 只有管理員可以重置
    if (!currentUser.isAdmin) {
      console.log('🔄 [Reset Premium Skin] 權限不足');
      return Response.json({ error: '權限不足' }, { status: 403 });
    }

    await dbConnect();
    const user = await User.findById(currentUser._id);
    
    if (!user) {
      console.log('🔄 [Reset Premium Skin] 用戶不存在');
      return Response.json({ error: '用戶不存在' }, { status: 404 });
    }

    console.log('🔄 [Reset Premium Skin] 重置前狀態:', {
      username: user.username,
      premiumPlayerSkin: user.premiumPlayerSkin,
      pointsBalance: user.pointsBalance
    });

    // 重置高階造型狀態（保留積分和其他設定）
    user.premiumPlayerSkin = false;
    user.premiumPlayerSkinExpiry = null;
    // 保留 playerSkinSettings，因為購買後會用到

    await user.save();

    console.log('🔄 [Reset Premium Skin] 重置完成:', {
      username: user.username,
      premiumPlayerSkin: user.premiumPlayerSkin,
      pointsBalance: user.pointsBalance
    });

    return Response.json({ 
      success: true,
      message: '✅ 高階造型狀態已重置！現在可以正常購買了。',
      premiumPlayerSkin: user.premiumPlayerSkin,
      pointsBalance: user.pointsBalance
    });
  } catch (error) {
    console.error('🔄 [Reset Premium Skin] 重置失敗:', error);
    return Response.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
