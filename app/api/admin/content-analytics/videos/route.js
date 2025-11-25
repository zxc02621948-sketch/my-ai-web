import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import VideoAnalytics from '@/models/VideoAnalytics';
import Video from '@/models/Video';
import { getCurrentUserFromRequest } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

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

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 1. 影片播放開始成功率
    const playStartStats = await VideoAnalytics.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          eventType: { $in: ['play_start', 'error'] },
        },
      },
      {
        $group: {
          _id: '$videoId',
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
          videoId: '$_id',
          playStarts: 1,
          errors: 1,
          successRate: {
            $cond: [
              { $gt: [{ $add: ['$playStarts', '$errors'] }, 0] },
              {
                $multiply: [
                  {
                    $divide: [
                      '$playStarts',
                      { $add: ['$playStarts', '$errors'] },
                    ],
                  },
                  100,
                ],
              },
              0,
            ],
          },
        },
      },
      {
        $sort: { successRate: 1 }, // 成功率最低的在前
      },
      {
        $limit: limit,
      },
      {
        $lookup: {
          from: 'videos',
          localField: '_id',
          foreignField: '_id',
          as: 'video',
        },
      },
      {
        $unwind: {
          path: '$video',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          videoId: 1,
          title: '$video.title',
          playStarts: 1,
          errors: 1,
          successRate: { $round: ['$successRate', 2] },
        },
      },
    ]);

    // 2. 平均觀看時長（從打開彈窗到關閉的時長）
    const watchStats = await VideoAnalytics.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          eventType: 'abandon',
          watchDuration: { $ne: null },
        },
      },
      {
        $group: {
          _id: null,
          avgWatchDuration: { $avg: '$watchDuration' },
          totalWatches: { $sum: 1 },
        },
      },
    ]);

    // 3. 播放開始次數統計
    const playStartCount = await VideoAnalytics.countDocuments({
      createdAt: { $gte: startDate },
      eventType: 'play_start',
    });

    // 4. 平均觀看輪數（播放完成次數 / 播放開始次數）
    const playCompleteCount = await VideoAnalytics.countDocuments({
      createdAt: { $gte: startDate },
      eventType: 'play_complete',
    });

    const avgWatchRounds = playStartCount > 0
      ? (playCompleteCount / playStartCount).toFixed(2)
      : 0;

    // 5. 平均卡頓次數
    const bufferingStats = await VideoAnalytics.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          eventType: 'buffering',
        },
      },
      {
        $group: {
          _id: '$videoId',
          avgBufferCount: { $avg: '$bufferCount' },
          totalBufferCount: { $sum: '$bufferCount' },
          avgBufferDuration: { $avg: '$bufferDuration' },
          bufferingEvents: { $sum: 1 },
        },
      },
      {
        $sort: { avgBufferCount: -1 },
      },
      {
        $limit: limit,
      },
      {
        $lookup: {
          from: 'videos',
          localField: '_id',
          foreignField: '_id',
          as: 'video',
        },
      },
      {
        $unwind: {
          path: '$video',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          videoId: '$_id',
          title: '$video.title',
          avgBufferCount: { $round: ['$avgBufferCount', 2] },
          totalBufferCount: 1,
          avgBufferDuration: { $round: ['$avgBufferDuration', 2] },
          bufferingEvents: 1,
        },
      },
    ]);


    return NextResponse.json({
      success: true,
      data: {
        playStartStats,
        watchStats: watchStats[0] || {
          avgWatchDuration: 0,
          totalWatches: 0,
        },
        playStartCount,
        playCompleteCount,
        avgWatchRounds: parseFloat(avgWatchRounds),
        bufferingStats,
        period: {
          days,
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('[VideoAnalytics] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video analytics' },
      { status: 500 }
    );
  }
}

