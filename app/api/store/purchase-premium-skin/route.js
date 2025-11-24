import { getCurrentUserFromRequest } from '@/lib/serverAuth';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import PointsTransaction from '@/models/PointsTransaction';

export async function POST(req) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    
    if (!currentUser) {
      return Response.json({ error: '未登入' }, { status: 401 });
    }

    await dbConnect();
    const user = await User.findById(currentUser._id);
    
    if (!user) {
      return Response.json({ error: '用戶不存在' }, { status: 404 });
    }

    // 檢查是否已經購買
    if (user.premiumPlayerSkin) {
      return Response.json({ error: '您已經擁有高階播放器造型' }, { status: 400 });
    }

    // 商品價格
    const PRICE = 500;

    // 檢查積分是否足夠
    if (user.pointsBalance < PRICE) {
      return Response.json({ 
        error: '積分不足', 
        required: PRICE, 
        current: user.pointsBalance 
      }, { status: 400 });
    }

    // 扣除積分
    user.pointsBalance -= PRICE;
    
    // 啟用高階播放器造型
    user.premiumPlayerSkin = true;
    user.premiumPlayerSkinExpiry = null; // 永久購買
    user.activePlayerSkin = 'cat-headphone'; // 自動切換到新造型
    
    // 初始化預設顏色設定（如果沒有）
    if (!user.playerSkinSettings) {
      user.playerSkinSettings = {
        mode: 'rgb',
        speed: 0.02,
        saturation: 50,
        lightness: 60,
        hue: 0,
        opacity: 0.7
      };
    }

    await user.save();

    // 記錄積分交易
    const dateKey = new Date().toISOString().split('T')[0];
    await PointsTransaction.create({
      userId: user._id,
      type: 'store_purchase',
      points: -PRICE,
      dateKey: dateKey,
      meta: {
        productId: 'premium-player-skin',
        productName: '高階播放器造型 - 貓咪耳機',
        balanceBefore: user.pointsBalance + PRICE,
        balanceAfter: user.pointsBalance
      }
    });

    return Response.json({ 
      success: true,
      message: '🎉 購買成功！您現在可以使用高階播放器造型了！',
      newBalance: user.pointsBalance,
      premiumPlayerSkin: true,
      activePlayerSkin: user.activePlayerSkin, // ✅ 返回當前啟用的造型
      playerSkinSettings: user.playerSkinSettings
    });
  } catch (error) {
    console.error('購買高階播放器造型失敗:', error);
    return Response.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}

