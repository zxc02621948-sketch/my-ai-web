import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import ImageAnalytics from '@/models/ImageAnalytics';
import { getCurrentUserFromRequest } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    await dbConnect();
    
    // 處理 sendBeacon 的 Blob 數據
    let body;
    const contentType = request.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      body = await request.json();
    } else {
      // sendBeacon 發送的是 Blob
      const text = await request.text();
      body = JSON.parse(text);
    }

    const { events } = body;

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'Invalid events array' }, { status: 400 });
    }

    const currentUser = await getCurrentUserFromRequest(request);
    const userId = currentUser?._id || null;

    // 檢查隱私設定
    if (currentUser && currentUser.privacyPreferences?.allowDataAnalytics === false) {
      return NextResponse.json({ success: true, skipped: true });
    }

    // 獲取會話ID（從請求頭或事件數據）
    const sessionId = request.headers.get('x-session-id') || events[0]?.sessionId || null;
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // 批量插入
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

    await ImageAnalytics.insertMany(analytics);

    return NextResponse.json({ success: true, count: analytics.length });
  } catch (error) {
    console.error('[ImageAnalytics] Error:', error);
    return NextResponse.json({ error: 'Failed to log events' }, { status: 500 });
  }
}

