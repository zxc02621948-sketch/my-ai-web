import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import MusicAnalytics from '@/models/MusicAnalytics';
import Music from '@/models/Music';
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

export async function GET(request) {
  try {
    const admin = await checkAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await dbConnect();

    // 獲取查詢參數
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 1. Top 10 最卡歌曲（平均緩衝時長最高）
    // ✅ 只統計音樂區播放（source: 'modal' 或 null），排除播放器播放（source: 'player'）
    const topBufferingSongs = await MusicAnalytics.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          eventType: 'buffering',
          $or: [
            { source: 'modal' },
            { source: null }, // 向後兼容舊數據
          ],
        },
      },
      {
        $group: {
          _id: '$musicId',
          avgBufferDuration: { $avg: '$bufferDuration' },
          totalBufferCount: { $sum: '$bufferCount' },
          totalBufferingEvents: { $sum: 1 },
        },
      },
      {
        $sort: { avgBufferDuration: -1 },
      },
      {
        $limit: limit,
      },
      {
        $lookup: {
          from: 'music',
          localField: '_id',
          foreignField: '_id',
          as: 'music',
        },
      },
      {
        $unwind: {
          path: '$music',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          musicId: '$_id',
          title: '$music.title',
          avgBufferDuration: { $round: ['$avgBufferDuration', 2] },
          totalBufferCount: 1,
          totalBufferingEvents: 1,
        },
      },
    ]);

    // 2. 播放失敗比例
    // ✅ 只統計音樂區播放
    const errorStats = await MusicAnalytics.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          eventType: { $in: ['play_start', 'error'] },
          $or: [
            { source: 'modal' },
            { source: null }, // 向後兼容舊數據
          ],
        },
      },
      {
        $group: {
          _id: '$musicId',
          playStarts: {
            $sum: { $cond: [{ $eq: ['$eventType', 'play_start'] }, 1, 0] },
          },
          errors: {
            $sum: { $cond: [{ $eq: ['$eventType', 'error'] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 1,
          musicId: '$_id',
          playStarts: 1,
          errors: 1,
          errorRate: {
            $cond: [
              { $gt: ['$playStarts', 0] },
              { $divide: ['$errors', '$playStarts'] },
              0,
            ],
          },
        },
      },
      {
        $sort: { errorRate: -1 },
      },
      {
        $limit: limit,
      },
      {
        $lookup: {
          from: 'music',
          localField: '_id',
          foreignField: '_id',
          as: 'music',
        },
      },
      {
        $unwind: {
          path: '$music',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          musicId: '$_id',
          title: '$music.title',
          playStarts: 1,
          errors: 1,
          errorRate: { $round: ['$errorRate', 4] },
        },
      },
    ]);

    // 3. 平均 Buffer 時間（整體統計）
    // ✅ 只統計音樂區播放
    const bufferStats = await MusicAnalytics.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          eventType: 'buffering',
          bufferDuration: { $ne: null },
          $or: [
            { source: 'modal' },
            { source: null }, // 向後兼容舊數據
          ],
        },
      },
      {
        $group: {
          _id: null,
          avgBufferDuration: { $avg: '$bufferDuration' },
          totalBufferCount: { $sum: '$bufferCount' },
          totalBufferingEvents: { $sum: 1 },
        },
      },
    ]);

    // 4. 播放完成率
    // ✅ 只統計音樂區播放
    const completionStats = await MusicAnalytics.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          eventType: { $in: ['play_start', 'play_complete'] },
          $or: [
            { source: 'modal' },
            { source: null }, // 向後兼容舊數據
          ],
        },
      },
      {
        $group: {
          _id: '$musicId',
          playStarts: {
            $sum: { $cond: [{ $eq: ['$eventType', 'play_start'] }, 1, 0] },
          },
          completions: {
            $sum: { $cond: [{ $eq: ['$eventType', 'play_complete'] }, 1, 0] },
          },
        },
      },
      {
        $group: {
          _id: null,
          totalPlayStarts: { $sum: '$playStarts' },
          totalCompletions: { $sum: '$completions' },
        },
      },
    ]);

    const completionRate =
      completionStats[0]?.totalPlayStarts > 0
        ? completionStats[0].totalCompletions / completionStats[0].totalPlayStarts
        : 0;

    // 5. 用戶設備與網路分佈
    // ✅ 只統計音樂區播放
    const deviceStats = await MusicAnalytics.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          eventType: 'play_start',
          $or: [
            { source: 'modal' },
            { source: null }, // 向後兼容舊數據
          ],
        },
      },
      {
        $group: {
          _id: {
            deviceType: '$deviceInfo.type',
            networkType: '$networkInfo.type',
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    // 6. 最近播放統計（按小時）
    // ✅ 只統計音樂區播放
    const hourlyStats = await MusicAnalytics.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          eventType: 'play_start',
          $or: [
            { source: 'modal' },
            { source: null }, // 向後兼容舊數據
          ],
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d %H:00:00',
              date: '$createdAt',
              timezone: '+08:00', // ✅ 轉換為 UTC+8 (台灣/中國時區)
            },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: -1 },
      },
      {
        $limit: 24 * days, // 每小時一條，最多顯示指定天數
      },
    ]);

    return NextResponse.json({
      success: true,
      data: {
        topBufferingSongs,
        errorStats,
        bufferStats: bufferStats[0] || {
          avgBufferDuration: 0,
          totalBufferCount: 0,
          totalBufferingEvents: 0,
        },
        completionRate: Math.round(completionRate * 10000) / 100, // 轉換為百分比，保留2位小數
        deviceStats,
        hourlyStats,
        period: {
          days,
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('[MusicAnalytics] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch music analytics' },
      { status: 500 }
    );
  }
}

