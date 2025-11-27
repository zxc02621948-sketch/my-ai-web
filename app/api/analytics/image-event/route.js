import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import ImageAnalytics from '@/models/ImageAnalytics';
import { getCurrentUserFromRequest } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    // ✅ 優化：並行執行數據庫連接和請求解析
    const [dbConnection, body] = await Promise.all([
      dbConnect(),
      (async () => {
        const contentType = request.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          return await request.json();
        } else {
          const text = await request.text();
          return JSON.parse(text);
        }
      })(),
    ]);

    const { events } = body;

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'Invalid events array' }, { status: 400 });
    }

    // 獲取會話ID（從請求頭或事件數據）
    const sessionId = request.headers.get('x-session-id') || events[0]?.sessionId || null;
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // ✅ 優化：並行執行用戶認證和數據準備
    const [currentUser] = await Promise.allSettled([
      getCurrentUserFromRequest(request).catch(() => null),
    ]);
    
    const user = currentUser.status === 'fulfilled' ? currentUser.value : null;
    const userId = user?._id || null;

    // 檢查隱私設定
    if (user && user.privacyPreferences?.allowDataAnalytics === false) {
      return NextResponse.json({ success: true, skipped: true });
    }

    // ✅ 優化：準備批量插入數據
    const analytics = events.map(event => ({
      imageId: event.imageId,
      userId: userId || event.userId || null,
      sessionId: sessionId || event.sessionId,
      eventType: event.eventType,
      scrollDepth: event.scrollDepth || null,
      timeSpent: event.timeSpent || null,
      exitPoint: event.exitPoint || null,
      deviceInfo: event.deviceInfo || {},
      networkInfo: event.networkInfo || { type: 'unknown' },
      metadata: event.metadata || {},
      createdAt: new Date(),
    }));

    // ✅ 優化：使用 ordered: false 允許部分失敗，提高插入速度
    // 即使部分文檔插入失敗，也不會中斷整個批量操作
    await ImageAnalytics.insertMany(analytics, { 
      ordered: false, // 允許部分失敗，不中斷整個批量插入
    });

    return NextResponse.json({ success: true, count: analytics.length });
  } catch (error) {
    console.error('[ImageAnalytics] Error:', error);
    // ✅ 優化：即使部分失敗也返回成功（因為使用了 ordered: false）
    return NextResponse.json({ success: true, error: 'Some events may not be logged' }, { status: 200 });
  }
}

