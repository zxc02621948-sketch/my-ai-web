import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import ImageAnalytics from '@/models/ImageAnalytics';
import VideoAnalytics from '@/models/VideoAnalytics';
import MusicAnalytics from '@/models/MusicAnalytics';

export const dynamic = 'force-dynamic';

// 這個 API 會被 Vercel Cron Jobs 調用（每10分鐘）
// 需要在 vercel.json 中配置 cron job
export async function GET(request) {
  try {
    // 驗證 Cron Secret（防止未授權調用）
    // Vercel Cron Jobs 會自動添加 x-vercel-signature header，這裡簡化驗證
    // 如果需要更嚴格的驗證，可以使用 Vercel 的簽名驗證
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
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

    console.log(`[Cron] Aggregated analytics: ${imageStats.length} image events, ${musicStats.length} music events, ${videoStats.length} video events`);

    return NextResponse.json({
      success: true,
      period: {
        start: tenMinutesAgo.toISOString(),
        end: now.toISOString(),
      },
      stats: {
        image: {
          totalEvents: imageStats.length,
        },
        music: {
          totalEvents: musicStats.length,
        },
        video: {
          totalEvents: videoStats.length,
        },
      },
    });
  } catch (error) {
    console.error('[Cron AggregateAnalytics] Error:', error);
    return NextResponse.json(
      { error: 'Aggregation failed' },
      { status: 500 }
    );
  }
}

