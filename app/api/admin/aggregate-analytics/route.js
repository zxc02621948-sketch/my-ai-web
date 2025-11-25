import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import ImageAnalytics from '@/models/ImageAnalytics';
import VideoAnalytics from '@/models/VideoAnalytics';
import MusicAnalytics from '@/models/MusicAnalytics';
import { getCurrentUserFromRequest } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

// 檢查管理員權限
async function checkAdmin(request) {
  const currentUser = await getCurrentUserFromRequest(request);
  if (!currentUser || !currentUser.isAdmin) {
    return null;
  }
  return currentUser;
}

// 這個 API 會被定時任務調用（每10分鐘）
export async function POST(request) {
  try {
    const admin = await checkAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await dbConnect();

    // 聚合最近10分鐘的數據
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const now = new Date();

    // 圖片分析聚合
    const imageStats = await ImageAnalytics.aggregate([
      {
        $match: {
          createdAt: { $gte: tenMinutesAgo, $lt: now },
        },
      },
      {
        $group: {
          _id: { imageId: '$imageId', eventType: '$eventType' },
          count: { $sum: 1 },
          avgScrollDepth: { $avg: '$scrollDepth' },
          avgTimeSpent: { $avg: '$timeSpent' },
        },
      },
    ]);

    // 音樂分析聚合
    const musicStats = await MusicAnalytics.aggregate([
      {
        $match: {
          createdAt: { $gte: tenMinutesAgo, $lt: now },
        },
      },
      {
        $group: {
          _id: { musicId: '$musicId', eventType: '$eventType' },
          count: { $sum: 1 },
          avgBufferDuration: { $avg: '$bufferDuration' },
          totalBufferCount: { $sum: '$bufferCount' },
          avgPlayProgress: { $avg: '$playProgress' },
        },
      },
    ]);

    // 影片分析聚合
    const videoStats = await VideoAnalytics.aggregate([
      {
        $match: {
          createdAt: { $gte: tenMinutesAgo, $lt: now },
        },
      },
      {
        $group: {
          _id: { videoId: '$videoId', eventType: '$eventType' },
          count: { $sum: 1 },
          avgBufferDuration: { $avg: '$bufferDuration' },
          totalBufferCount: { $sum: '$bufferCount' },
          avgPlayProgress: { $avg: '$playProgress' },
        },
      },
    ]);

    return NextResponse.json({
      success: true,
      period: {
        start: tenMinutesAgo.toISOString(),
        end: now.toISOString(),
      },
      stats: {
        image: {
          totalEvents: imageStats.length,
          events: imageStats,
        },
        music: {
          totalEvents: musicStats.length,
          events: musicStats,
        },
        video: {
          totalEvents: videoStats.length,
          events: videoStats,
        },
      },
    });
  } catch (error) {
    console.error('[AggregateAnalytics] Error:', error);
    return NextResponse.json(
      { error: 'Aggregation failed' },
      { status: 500 }
    );
  }
}

