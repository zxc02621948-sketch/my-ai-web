import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import ImageAnalytics from '@/models/ImageAnalytics';
import Image from '@/models/Image';
import { getCurrentUserFromRequest } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403, headers: NO_STORE_HEADERS });
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 1. 圖片瀏覽深度統計
    const scrollDepthStats = await ImageAnalytics.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          eventType: 'scroll_depth',
          scrollDepth: { $ne: null },
        },
      },
      {
        $group: {
          _id: null,
          avgScrollDepth: { $avg: '$scrollDepth' },
          maxScrollDepth: { $max: '$scrollDepth' },
          minScrollDepth: { $min: '$scrollDepth' },
          totalEvents: { $sum: 1 },
          // ✅ 計算完整查看的圖片數量（scrollDepth >= 100）
          fullyViewedCount: {
            $sum: {
              $cond: [{ $gte: ['$scrollDepth', 100] }, 1, 0]
            }
          },
        },
      },
    ]);

    // 計算完整查看率（需要知道總查看次數）
    const viewStats = await ImageAnalytics.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          eventType: 'view',
        },
      },
      {
        $group: {
          _id: null,
          totalViews: { $sum: 1 },
        },
      },
    ]);

    const totalViews = viewStats[0]?.totalViews || 0;
    const fullyViewedCount = scrollDepthStats[0]?.fullyViewedCount || 0;
    const completeViewRate = totalViews > 0 ? (fullyViewedCount / totalViews) * 100 : 0;

    // 2. 最吸睛分類（基於打開 Modal 次數）
    const categoryStats = await ImageAnalytics.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          eventType: 'open_modal',
        },
      },
      {
        $lookup: {
          from: 'images',
          localField: 'imageId',
          foreignField: '_id',
          as: 'image',
        },
      },
      {
        $unwind: {
          path: '$image',
          preserveNullAndEmptyArrays: false, // ✅ 只保留有圖片記錄的事件
        },
      },
      {
        // ✅ 過濾掉沒有分類或分類為空的圖片
        $match: {
          'image.categories': { $exists: true, $ne: null, $not: { $size: 0 } },
        },
      },
      {
        $unwind: {
          path: '$image.categories',
          preserveNullAndEmptyArrays: false, // ✅ 只保留有分類值的記錄
        },
      },
      {
        // ✅ 再次過濾掉 null 或空字串的分類
        $match: {
          'image.categories': { $ne: null, $ne: '' },
        },
      },
      {
        $group: {
          _id: '$image.categories',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: limit,
      },
    ]);

    // 3. 收藏轉換率（需要結合 LikeLog，這裡簡化為 Modal 打開後的互動）
    const interactionStats = await ImageAnalytics.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          eventType: { $in: ['open_modal', 'like', 'comment'] },
        },
      },
      {
        $group: {
          _id: '$imageId',
          opens: {
            $sum: { $cond: [{ $eq: ['$eventType', 'open_modal'] }, 1, 0] },
          },
          likes: {
            $sum: { $cond: [{ $eq: ['$eventType', 'like'] }, 1, 0] },
          },
          comments: {
            $sum: { $cond: [{ $eq: ['$eventType', 'comment'] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 1,
          imageId: '$_id',
          opens: 1,
          likes: 1,
          comments: 1,
          likeConversionRate: {
            $cond: [
              { $gt: ['$opens', 0] },
              { $multiply: [{ $divide: ['$likes', '$opens'] }, 100] },
              0,
            ],
          },
        },
      },
      {
        $sort: { likeConversionRate: -1 },
      },
      {
        $limit: limit,
      },
      {
        $lookup: {
          from: 'images',
          localField: '_id',
          foreignField: '_id',
          as: 'image',
        },
      },
      {
        $unwind: {
          path: '$image',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          imageId: 1,
          title: '$image.title',
          opens: 1,
          likes: 1,
          comments: 1,
          dbClicks: { $ifNull: ['$image.clicks', 0] },
          dbViewCount: { $ifNull: ['$image.viewCount', 0] },
          likeConversionRate: { $round: ['$likeConversionRate', 2] },
        },
      },
    ]);

    // 3.5 圖片資料表（DB）內的總瀏覽/點擊數
    const dbTotals = await Image.aggregate([
      {
        $group: {
          _id: null,
          totalImages: { $sum: 1 },
          totalClicks: { $sum: { $ifNull: ['$clicks', 0] } },
          totalViewCount: { $sum: { $ifNull: ['$viewCount', 0] } },
        },
      },
    ]);

    // 4. 平均停留時間
    const timeSpentStats = await ImageAnalytics.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          eventType: 'exit',
          timeSpent: { $ne: null },
        },
      },
      {
        $group: {
          _id: null,
          avgTimeSpent: { $avg: '$timeSpent' },
          maxTimeSpent: { $max: '$timeSpent' },
          minTimeSpent: { $min: '$timeSpent' },
          totalExits: { $sum: 1 },
        },
      },
    ]);

    return NextResponse.json(
      {
        success: true,
        data: {
          scrollDepth: scrollDepthStats[0] || {
            avgScrollDepth: 0,
            maxScrollDepth: 0,
            minScrollDepth: 0,
            totalEvents: 0,
            fullyViewedCount: 0,
          },
          completeViewRate: Math.round(completeViewRate * 100) / 100, // 保留2位小數
          totalViews,
          categoryStats,
          interactionStats,
          dbTotals: dbTotals[0] || {
            totalImages: 0,
            totalClicks: 0,
            totalViewCount: 0,
          },
          timeSpent: timeSpentStats[0] || {
            avgTimeSpent: 0,
            maxTimeSpent: 0,
            minTimeSpent: 0,
            totalExits: 0,
          },
          period: {
            days,
            startDate: startDate.toISOString(),
            endDate: new Date().toISOString(),
          },
        },
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error('[ImageAnalytics] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch image analytics' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

