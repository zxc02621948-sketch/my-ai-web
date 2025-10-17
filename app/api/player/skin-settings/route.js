import { getCurrentUserFromRequest } from '@/lib/serverAuth';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';

// GET - 獲取用戶的播放器造型設定
export async function GET(req) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    
    if (!currentUser) {
      return Response.json({ error: '未登入' }, { status: 401 });
    }

    await dbConnect();
    const user = await User.findById(currentUser._id).select('premiumPlayerSkin playerSkinSettings');
    
    if (!user) {
      return Response.json({ error: '用戶不存在' }, { status: 404 });
    }

    return Response.json({
      hasPremiumSkin: user.premiumPlayerSkin || false,
      settings: user.playerSkinSettings || {
        mode: 'rgb',
        speed: 0.02,
        saturation: 50,
        lightness: 60,
        hue: 0,
        opacity: 0.7
      }
    });
  } catch (error) {
    console.error('獲取播放器造型設定失敗:', error);
    return Response.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}

// POST - 保存用戶的播放器造型設定
export async function POST(req) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    
    if (!currentUser) {
      return Response.json({ error: '未登入' }, { status: 401 });
    }

    const body = await req.json();
    const { mode, speed, saturation, lightness, hue, opacity } = body;

    // 驗證參數
    if (!mode || !['rgb', 'solid', 'custom'].includes(mode)) {
      return Response.json({ error: '無效的顏色模式' }, { status: 400 });
    }

    if (typeof speed !== 'number' || speed < 0 || speed > 0.1) {
      return Response.json({ error: '無效的速度值' }, { status: 400 });
    }

    if (typeof saturation !== 'number' || saturation < 0 || saturation > 100) {
      return Response.json({ error: '無效的飽和度值' }, { status: 400 });
    }

    if (typeof lightness !== 'number' || lightness < 0 || lightness > 100) {
      return Response.json({ error: '無效的亮度值' }, { status: 400 });
    }

    if (typeof hue !== 'number' || hue < 0 || hue > 360) {
      return Response.json({ error: '無效的色相值' }, { status: 400 });
    }

    if (typeof opacity !== 'number' || opacity < 0 || opacity > 1) {
      return Response.json({ error: '無效的透明度值' }, { status: 400 });
    }

    await dbConnect();
    const user = await User.findById(currentUser._id);
    
    if (!user) {
      return Response.json({ error: '用戶不存在' }, { status: 404 });
    }

    // 檢查用戶是否有購買高階造型
    if (!user.premiumPlayerSkin) {
      return Response.json({ error: '您尚未購買高階播放器造型' }, { status: 403 });
    }

    // 更新設定
    user.playerSkinSettings = {
      mode,
      speed,
      saturation,
      lightness,
      hue,
      opacity
    };

    await user.save();

    return Response.json({ 
      success: true, 
      settings: user.playerSkinSettings 
    });
  } catch (error) {
    console.error('保存播放器造型設定失敗:', error);
    return Response.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}

