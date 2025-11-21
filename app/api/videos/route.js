import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import Video from '@/models/Video';
import { VIDEO_AUTHOR_STAGES } from '@/utils/videoQuery';

// 熱門度計算常數（與圖片系統一致）
const POP_W_CLICK = 1.0;
const POP_W_LIKE = 8.0;
const POP_W_VIEW = 0.5;
const POP_W_COMPLETE = 0.25;
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

    // 明確指定要保留的字段（與圖片 API 的 projectBase 類似）
    // 這確保在 $lookup 之前所有需要的字段都被保留
    const videoProjectBase = {
      _id: 1,
      title: 1,
      description: 1,
      tags: 1,
      category: 1,
      rating: 1,
      createdAt: 1,
      uploadDate: 1,
      likes: 1,
      likesCount: 1,
      clicks: 1,
      views: 1,
      completenessScore: 1,
      initialBoost: 1,
      popScore: 1,
      // 權力券相關字段
      powerUsed: 1,
      powerUsedAt: 1,
      powerExpiry: 1,
      powerType: 1,
      // 作者字段（用於 lookup）
      author: 1,
      authorName: 1,
      authorAvatar: 1,
      // 檔案相關字段
      videoUrl: 1,
      thumbnailUrl: 1,
      streamId: 1,
      previewUrl: 1,
      duration: 1,
      // AI 元數據
      platform: 1,
      prompt: 1,
      negativePrompt: 1,
      modelName: 1,
      modelLink: 1,
      fps: 1,
      resolution: 1,
      steps: 1,
      cfgScale: 1,
      seed: 1,
      width: 1,
      height: 1,
      // 其他字段
      isPublic: 1,
      status: 1
    };

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
        // 完全按照圖片 API 的方式，在一個 $addFields 階段完成所有計算
        const calcLive = {
          $addFields: {
            likesCountCalc: {
              $cond: [
                { $isArray: '$likes' },
                { $size: { $ifNull: ['$likes', []] } },
                { $ifNull: ['$likesCount', 0] }
              ]
            },
            // 計算有效的「上架時間」（權力券會重置這個時間）
            // 完全按照圖片 API 的方式，直接使用字段（字段已經是 Date 類型）
            effectiveCreatedAt: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$powerUsed', true] },
                    { $ne: [{ $ifNull: ['$powerUsedAt', null] }, null] }
                  ]
                },
                '$powerUsedAt',  // 使用過權力券：用權力券時間作為新的上架時間
                { $ifNull: ['$createdAt', '$uploadDate'] }  // 沒用過：用真實上架時間
              ]
            },
            // 統一計算加成（只有一套邏輯）
            // 直接在 $subtract 中計算 effectiveCreatedAt，避免引用問題
            hoursElapsed: { 
              $divide: [
                { 
                  $subtract: [
                    '$$NOW', 
                    {
                      $cond: [
                        {
                          $and: [
                            { $eq: ['$powerUsed', true] },
                            { $ne: [{ $ifNull: ['$powerUsedAt', null] }, null] }
                          ]
                        },
                        '$powerUsedAt',
                        { $ifNull: ['$createdAt', '$uploadDate'] }
                      ]
                    }
                  ] 
                }, 
                1000 * 60 * 60
              ] 
            },
            boostFactor: { 
              $max: [
                0, 
                { 
                  $subtract: [
                    1, 
                    { 
                      $divide: [
                        { 
                          $divide: [
                            { 
                              $subtract: [
                                '$$NOW', 
                                {
                                  $cond: [
                                    {
                                      $and: [
                                        { $eq: ['$powerUsed', true] },
                                        { $ne: [{ $ifNull: ['$powerUsedAt', null] }, null] }
                                      ]
                                    },
                                    '$powerUsedAt',
                                    { $ifNull: ['$createdAt', '$uploadDate'] }
                                  ]
                                }
                              ] 
                            }, 
                            1000 * 60 * 60
                          ] 
                        }, 
                        POP_NEW_WINDOW_HOURS
                      ] 
                    }
                  ] 
                }
              ] 
            },
            finalBoost: { 
              $round: [
                { 
                  $multiply: [
                    { $ifNull: ['$initialBoost', 0] }, 
                    { 
                      $max: [
                        0, 
                        { 
                          $subtract: [
                            1, 
                            { 
                              $divide: [
                                { 
                                  $divide: [
                                    { 
                                      $subtract: [
                                        '$$NOW', 
                                        {
                                          $cond: [
                                            {
                                              $and: [
                                                { $eq: ['$powerUsed', true] },
                                                { $ne: [{ $ifNull: ['$powerUsedAt', null] }, null] }
                                              ]
                                            },
                                            '$powerUsedAt',
                                            { $ifNull: ['$createdAt', '$uploadDate'] }
                                          ]
                                        }
                                      ] 
                                    }, 
                                    1000 * 60 * 60
                                  ] 
                                }, 
                                POP_NEW_WINDOW_HOURS
                              ] 
                            }
                          ] 
                        }
                      ] 
                    }
                  ] 
                }, 
                1
              ]
            },
            baseScore: {
              $add: [
                { $multiply: [{ $ifNull: ['$clicks', 0] }, POP_W_CLICK] },
                { $multiply: [{ $ifNull: ['$likesCountCalc', 0] }, POP_W_LIKE] },
                { $multiply: [{ $ifNull: ['$views', 0] }, POP_W_VIEW] },
                { $multiply: [{ $ifNull: ['$completenessScore', 0] }, POP_W_COMPLETE] }
              ]
            },
            livePopScore: { 
              $add: [
                {
                  $add: [
                    { $multiply: [{ $ifNull: ['$clicks', 0] }, POP_W_CLICK] },
                    { $multiply: [{ $ifNull: ['$likesCountCalc', 0] }, POP_W_LIKE] },
                    { $multiply: [{ $ifNull: ['$views', 0] }, POP_W_VIEW] },
                    { $multiply: [{ $ifNull: ['$completenessScore', 0] }, POP_W_COMPLETE] }
                  ]
                },
                {
                  $round: [
                    { 
                      $multiply: [
                        { $ifNull: ['$initialBoost', 0] }, 
                        { 
                          $max: [
                            0, 
                            { 
                              $subtract: [
                                1, 
                                { 
                                  $divide: [
                                    { 
                                      $divide: [
                                        { 
                                          $subtract: [
                                            '$$NOW', 
                                            {
                                              $cond: [
                                                {
                                                  $and: [
                                                    { $eq: ['$powerUsed', true] },
                                                    { $ne: [{ $ifNull: ['$powerUsedAt', null] }, null] }
                                                  ]
                                                },
                                                '$powerUsedAt',
                                                { $ifNull: ['$createdAt', '$uploadDate'] }
                                              ]
                                            }
                                          ] 
                                        }, 
                                        1000 * 60 * 60
                                      ] 
                                    }, 
                                    POP_NEW_WINDOW_HOURS
                                  ] 
                                }
                              ] 
                            }
                          ] 
                        }
                      ] 
                    }, 
                    1
                  ]
                }
              ] 
            },
            popScoreDB: { $ifNull: ['$popScore', 0] }
          }
        };

        // 完全按照圖片 API 的順序：$match → $project → lookup → calcLive
        // 注意：calcLive 在 lookup 之後執行，可以引用所有字段
        pipeline = [
          { $match: match },
          { $project: videoProjectBase },  // 明確保留所有需要的字段
          ...VIDEO_AUTHOR_STAGES,  // 然後執行 lookup
          calcLive,  // 最後計算分數（可以引用前面定義的所有字段）
          { 
            $sort: useLive 
              ? { livePopScore: -1, createdAt: -1, _id: -1 }
              : { popScoreDB: -1, createdAt: -1, _id: -1 }
          },
          { $skip: skip },
          { $limit: limit }
        ];
        break;
    }

    // 執行查詢
    const videos = await Video.aggregate(pipeline);
    const normalizedVideos = videos.map((video) => {
      if (!video) return video;
      const thumbnailCandidates = [];
      if (video.thumbnailUrl) thumbnailCandidates.push(video.thumbnailUrl);
      if (video.streamId) {
        thumbnailCandidates.push(`https://customer-h5be4kbubhrszsgr.cloudflarestream.com/${video.streamId}/thumbnails/thumbnail.jpg?time=1s`);
        thumbnailCandidates.push(`https://videodelivery.net/${video.streamId}/thumbnails/thumbnail.jpg?time=1s`);
      }
      return {
        ...video,
        thumbnailUrl: thumbnailCandidates.find(Boolean) || '',
      };
    });

    return NextResponse.json({
      success: true,
      videos: normalizedVideos,
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
