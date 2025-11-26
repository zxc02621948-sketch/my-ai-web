import { getCurrentUserFromRequest } from '@/lib/serverAuth';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';

// POST - 切換播放器造型
export async function POST(req) {
  try {
    const currentUser = await getCurrentUserFromRequest(req);
    
    if (!currentUser) {
      return Response.json({ error: '未登入' }, { status: 401 });
    }

    const body = await req.json();
    const { skinId } = body;

    // 驗證參數
    if (!skinId || typeof skinId !== 'string') {
      return Response.json({ error: '無效的造型 ID' }, { status: 400 });
    }

    // 可用的造型列表
    const availableSkins = ['default', 'cat-headphone'];
    
    if (!availableSkins.includes(skinId)) {
      return Response.json({ error: '不支援的造型' }, { status: 400 });
    }

    await dbConnect();
    const user = await User.findById(currentUser._id);
    
    if (!user) {
      return Response.json({ error: '用戶不存在' }, { status: 404 });
    }

    // 如果選擇高階造型，檢查是否有購買權限
    if (skinId !== 'default' && !user.premiumPlayerSkin) {
      return Response.json({ error: '您尚未購買此造型' }, { status: 403 });
    }

    // 更新啟用的造型
    user.activePlayerSkin = skinId;
    await user.save();

    // 造型名稱對應
    const skinNames = {
      'default': '預設造型',
      'cat-headphone': '貓咪耳機造型'
    };

    return Response.json({ 
      success: true,
      activePlayerSkin: user.activePlayerSkin,
      message: `已切換至${skinNames[skinId] || '未知造型'}！`
    });
  } catch (error) {
    console.error('切換播放器造型失敗:', error);
    return Response.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}

