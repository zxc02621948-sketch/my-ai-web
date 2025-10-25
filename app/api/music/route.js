import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import Music from '@/models/Music';

export const dynamic = 'force-dynamic';

// 熱門度計算常數（與圖片系統一致）
const POP_W_CLICK = 1.0;
const POP_W_LIKE = 8.0;
const POP_W_PLAY = 0.3;
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

    const skip = (page - 1) * limit;

    // 基礎匹配條件
    const match = { isPublic: true };

    // 搜尋條件
    if (search.trim()) {
      match.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { artist: { $regex: search.trim(), $options: 'i' } },
        { album: { $regex: search.trim(), $options: 'i' } },
        { tags: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    // 查詢總數
    const total = await Music.countDocuments(match);

    // 根據排序方式建立 pipeline
    let pipeline;
    
    switch (sort) {
      case 'newest':
        // 最新音樂
        pipeline = [
          { $match: match },
          { $sort: { createdAt: -1, _id: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'users',
              localField: 'author',
              foreignField: '_id',
              as: 'author',
              pipeline: [
                { $project: { _id: 1, username: 1, avatar: 1, currentFrame: 1, frameSettings: 1 } }
              ]
            }
          },
          { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } }
        ];
        break;

      case 'oldest':
        // 最舊音樂
        pipeline = [
          { $match: match },
          { $sort: { createdAt: 1, _id: 1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'users',
              localField: 'author',
              foreignField: '_id',
              as: 'author',
              pipeline: [
                { $project: { _id: 1, username: 1, avatar: 1, currentFrame: 1, frameSettings: 1 } }
              ]
            }
          },
          { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } }
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
          {
            $lookup: {
              from: 'users',
              localField: 'author',
              foreignField: '_id',
              as: 'author',
              pipeline: [
                { $project: { _id: 1, username: 1, avatar: 1, currentFrame: 1, frameSettings: 1 } }
              ]
            }
          },
          { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } }
        ];
        break;

      case 'mostplays':
        // 最多播放
        pipeline = [
          { $match: match },
          { $sort: { plays: -1, createdAt: -1, _id: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'users',
              localField: 'author',
              foreignField: '_id',
              as: 'author',
              pipeline: [
                { $project: { _id: 1, username: 1, avatar: 1, currentFrame: 1, frameSettings: 1 } }
              ]
            }
          },
          { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } }
        ];
        break;

      case 'random':
        // 隨機音樂
        pipeline = [
          { $match: match },
          { $sample: { size: limit } },
          {
            $lookup: {
              from: 'users',
              localField: 'author',
              foreignField: '_id',
              as: 'author',
              pipeline: [
                { $project: { _id: 1, username: 1, avatar: 1, currentFrame: 1, frameSettings: 1 } }
              ]
            }
          },
          { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } }
        ];
        break;

      default:
        // 熱門度排序（預設）
        const calcLive = {
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
                    { $divide: ['$hoursElapsed', POP_NEW_WINDOW_HOURS] }
                  ] 
                }
              ] 
            },
            // 最終加成 = 初始加成 × 衰減因子
            finalBoost: {
              $round: [
                { 
                  $multiply: [
                    { $ifNull: ['$initialBoost', 0] }, 
                    '$boostFactor'
                  ] 
                }, 
                1
              ]
            },
            // 基礎分數
            baseScore: {
              $add: [
                { $multiply: [{ $ifNull: ['$clicks', 0] }, POP_W_CLICK] },
                { $multiply: ['$likesCountCalc', POP_W_LIKE] },
                { $multiply: [{ $ifNull: ['$plays', 0] }, POP_W_PLAY] },
                { $multiply: [{ $ifNull: ['$completenessScore', 0] }, POP_W_COMPLETE] }
              ]
            },
            // 即時熱門度分數
            livePopScore: { $add: ['$baseScore', '$finalBoost'] },
            // 資料庫快照分數
            popScoreDB: { $ifNull: ['$popScore', 0] }
          }
        };

        pipeline = [
          { $match: match },
          calcLive,
          { 
            $sort: useLive 
              ? { livePopScore: -1, createdAt: -1, _id: -1 }
              : { popScoreDB: -1, createdAt: -1, _id: -1 }
          },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'users',
              localField: 'author',
              foreignField: '_id',
              as: 'author',
              pipeline: [
                { $project: { _id: 1, username: 1, avatar: 1, currentFrame: 1, frameSettings: 1 } }
              ]
            }
          },
          { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } }
        ];
        break;
    }

    // 執行查詢
    const music = await Music.aggregate(pipeline);

    return NextResponse.json({
      success: true,
      music,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error('載入音樂失敗:', error);
    return NextResponse.json({ error: '載入音樂失敗' }, { status: 500 });
  }
}


