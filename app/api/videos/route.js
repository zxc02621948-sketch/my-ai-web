import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import Video from '@/models/Video';
import { VIDEO_AUTHOR_STAGES } from '@/utils/videoQuery';

// 熱門度計算常數（與圖片系統一致）
const POP_W_CLICK = 1.0;
const POP_W_LIKE = 8.0;
const POP_W_VIEW = 0.5;
const POP_W_COMPLETE = 0.05;
const POP_NEW_WINDOW_HOURS = 10;

export async function GET(request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 20;
    const sort = (searchParams.get('sort') || 'popular').toLowerCase();
    const useLive = searchParams.get('live') === '1';
    const search = searchParams.get('search') || '';
    
    // ✅ 新增：分類和分級篩選支援
    const categories = searchParams.get('categories');
    const ratings = searchParams.get('ratings');

    const skip = (page - 1) * limit;

    // 基礎匹配條件
    const match = { isPublic: true };

    // 搜尋條件
    if (search.trim()) {
      match.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
        { tags: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    // ✅ 新增：分類篩選
    if (categories) {
      const categoryList = categories.split(',').map(cat => decodeURIComponent(cat));
      match.category = { $in: categoryList };
    }

    // ✅ 新增：分級篩選
    if (ratings) {
      const ratingList = ratings.split(',').map(rating => decodeURIComponent(rating));
      // 支援 'all' 映射到 'sfw'，確保向後兼容
      const mappedRatings = ratingList.map(rating => rating === 'all' ? 'sfw' : rating);
      match.rating = { $in: mappedRatings };
    }

    // 查詢總數
    const total = await Video.countDocuments(match);

    // 根據排序方式建立 pipeline
    let pipeline;
    
    switch (sort) {
      case 'newest':
        // 最新影片
        pipeline = [
          { $match: match },
          { $sort: { createdAt: -1, _id: -1 } },
          { $skip: skip },
          { $limit: limit },
          ...VIDEO_AUTHOR_STAGES
        ];
        break;

      case 'oldest':
        // 最舊影片
        pipeline = [
          { $match: match },
          { $sort: { createdAt: 1, _id: 1 } },
          { $skip: skip },
          { $limit: limit },
          ...VIDEO_AUTHOR_STAGES
        ];
        break;

      case 'mostlikes':
        // 最多愛心
        pipeline = [
          { $match: match },
          {
            $addFields: {
              likesCount: {
                $cond: [
                  { $isArray: '$likes' },
                  { $size: { $ifNull: ['$likes', []] } },
                  { $ifNull: ['$likesCount', 0] }
                ]
              }
            }
          },
          { $sort: { likesCount: -1, createdAt: -1, _id: -1 } },
          { $skip: skip },
          { $limit: limit },
          ...VIDEO_AUTHOR_STAGES
        ];
        break;

      case 'random':
        // 隨機影片
        pipeline = [
          { $match: match },
          { $sample: { size: limit } },
          ...VIDEO_AUTHOR_STAGES
        ];
        break;

      default:
        // 熱門度排序（預設）
        // 第一階段：計算基礎數據
        const calcStep1 = {
          $addFields: {
            likesCountCalc: {
              $cond: [
                { $isArray: '$likes' },
                { $size: { $ifNull: ['$likes', []] } },
                { $ifNull: ['$likesCount', 0] }
              ]
            },
            // 計算經過時間（小時）
            hoursElapsed: { 
              $divide: [
                { $subtract: ['$$NOW', { $ifNull: ['$createdAt', '$$NOW'] }] }, 
                1000 * 60 * 60
              ] 
            },
            // 計算加成因子（10小時內線性衰減）
            boostFactor: { 
              $max: [
                0, 
                { 
                  $subtract: [
                    1, 
                    { $divide: [
                        { $divide: [
                          { $subtract: ['$$NOW', { $ifNull: ['$createdAt', '$$NOW'] }] }, 
                          1000 * 60 * 60
                        ] }, 
                        POP_NEW_WINDOW_HOURS
                      ] 
                    }
                  ] 
                }
              ] 
            },
            // 資料庫快照分數
            popScoreDB: { $ifNull: ['$popScore', 0] }
          }
        };
        
        // 第二階段：計算分數（可以引用第一階段的字段）
        const calcStep2 = {
          $addFields: {
            // 最終加成 = 初始加成 × 衰減因子
            finalBoost: {
              $round: [
                { 
                  $multiply: [
                    { $ifNull: ['$initialBoost', 0] }, 
                    { $ifNull: ['$boostFactor', 0] }
                  ] 
                }, 
                1
              ]
            },
            // 基礎分數
            baseScore: {
              $add: [
                { $multiply: [{ $ifNull: ['$clicks', 0] }, POP_W_CLICK] },
                { $multiply: [{ $ifNull: ['$likesCountCalc', 0] }, POP_W_LIKE] },
                { $multiply: [{ $ifNull: ['$views', 0] }, POP_W_VIEW] },
                { $multiply: [{ $ifNull: ['$completenessScore', 0] }, POP_W_COMPLETE] }
              ]
            }
          }
        };
        
        // 第三階段：計算最終分數（可以引用前兩階段的字段）
        const calcStep3 = {
          $addFields: {
            // 即時熱門度分數
            livePopScore: { 
              $add: [
                { $ifNull: ['$baseScore', 0] }, 
                { $ifNull: ['$finalBoost', 0] }
              ] 
            }
          }
        };

        pipeline = [
          { $match: match },
          calcStep1,
          calcStep2,
          calcStep3,
          { 
            $sort: useLive 
              ? { livePopScore: -1, createdAt: -1, _id: -1 }
              : { popScoreDB: -1, createdAt: -1, _id: -1 }
          },
          { $skip: skip },
          { $limit: limit },
          ...VIDEO_AUTHOR_STAGES
        ];
        break;
    }

    // 執行查詢
    const videos = await Video.aggregate(pipeline);

    return NextResponse.json({
      success: true,
      videos,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error('載入影片失敗:', error);
    return NextResponse.json({ error: '載入影片失敗' }, { status: 500 });
  }
}
