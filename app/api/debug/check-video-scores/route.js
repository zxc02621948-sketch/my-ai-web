// app/api/debug/check-video-scores/route.js
// 检查视频分数的计算是否正确

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/serverAuth";
import { dbConnect } from "@/lib/db";
import Video from "@/models/Video";
import { VIDEO_AUTHOR_STAGES } from "@/utils/videoQuery";

const POP_W_CLICK = 1.0;
const POP_W_LIKE = 8.0;
const POP_W_VIEW = 0.5;
const POP_W_COMPLETE = 0.25;
const POP_NEW_WINDOW_HOURS = 10;

export async function GET(request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "請先登入" },
        { status: 401 }
      );
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get("id");
    const videoTitle = searchParams.get("title");

    if (!videoId && !videoTitle) {
      return NextResponse.json(
        { success: false, message: "請提供影片ID或標題" },
        { status: 400 }
      );
    }

    // 查询视频
    const match = { isPublic: true };
    if (videoId) {
      const { Types } = await import('mongoose');
      match._id = new Types.ObjectId(videoId);
    } else {
      match.title = { $regex: videoTitle.trim(), $options: "i" };
    }

    const videoProjectBase = {
      _id: 1,
      title: 1,
      createdAt: 1,
      uploadDate: 1,
      likes: 1,
      likesCount: 1,
      clicks: 1,
      views: 1,
      completenessScore: 1,
      initialBoost: 1,
      popScore: 1,
      powerUsed: 1,
      powerUsedAt: 1,
      powerExpiry: 1,
      powerType: 1
    };

    // 使用与查询 API 完全相同的 pipeline
    const calcLive = {
      $addFields: {
        likesCountCalc: {
          $cond: [
            { $isArray: '$likes' },
            { $size: { $ifNull: ['$likes', []] } },
            { $ifNull: ['$likesCount', 0] }
          ]
        },
        effectiveCreatedAt: {
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
        },
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

    const pipeline = [
      { $match: match },
      { $project: videoProjectBase },
      ...VIDEO_AUTHOR_STAGES,
      calcLive,
      { $limit: 1 }
    ];

    const videos = await Video.aggregate(pipeline);

    if (!videos || videos.length === 0) {
      return NextResponse.json(
        { success: false, message: "找不到影片" },
        { status: 404 }
      );
    }

    const video = videos[0];

    // 手动计算（用于对比）
    const now = new Date();
    const powerUsed = video.powerUsed && video.powerUsedAt && video.powerExpiry && new Date(video.powerExpiry) > now;
    const effectiveTime = powerUsed 
      ? new Date(video.powerUsedAt) 
      : new Date(video.createdAt || video.uploadDate);
    const hoursElapsedManual = (now.getTime() - effectiveTime.getTime()) / (1000 * 60 * 60);
    const boostFactorManual = Math.max(0, 1 - hoursElapsedManual / POP_NEW_WINDOW_HOURS);
    const initialBoost = video.initialBoost || 0;
    const finalBoostManual = Math.round(initialBoost * boostFactorManual * 10) / 10;
    
    const likesCountManual = Array.isArray(video.likes) ? video.likes.length : (video.likesCount || 0);
    const baseScoreManual = 
      (video.clicks || 0) * POP_W_CLICK +
      likesCountManual * POP_W_LIKE +
      (video.views || 0) * POP_W_VIEW +
      (video.completenessScore || 0) * POP_W_COMPLETE;
    const livePopScoreManual = baseScoreManual + finalBoostManual;

    return NextResponse.json({
      success: true,
      video: {
        id: video._id.toString(),
        title: video.title,
        // 数据库存储的分数
        popScoreDB: video.popScoreDB || 0,
        // 查询 API 计算的实时分数（aggregation pipeline）
        livePopScoreFromAPI: video.livePopScore || 0,
        // 手动计算的实时分数（JavaScript）
        livePopScoreManual: parseFloat(livePopScoreManual.toFixed(2)),
        // 分数差异
        difference: {
          apiVsDB: parseFloat((video.livePopScore || 0) - (video.popScoreDB || 0)).toFixed(2),
          manualVsDB: parseFloat(livePopScoreManual - (video.popScoreDB || 0)).toFixed(2),
          apiVsManual: parseFloat((video.livePopScore || 0) - livePopScoreManual).toFixed(2)
        },
        // 调试：检查 aggregation pipeline 中的中间值
        debug: {
          likesCountCalc: video.likesCountCalc,
          effectiveCreatedAt: video.effectiveCreatedAt ? new Date(video.effectiveCreatedAt).toISOString() : null,
          hoursElapsed: video.hoursElapsed,
          hoursElapsedType: typeof video.hoursElapsed,
          hoursElapsedIsNull: video.hoursElapsed === null,
          hoursElapsedIsUndefined: video.hoursElapsed === undefined,
          boostFactor: video.boostFactor,
          boostFactorType: typeof video.boostFactor,
          finalBoost: video.finalBoost,
          finalBoostType: typeof video.finalBoost,
          baseScore: video.baseScore,
          baseScoreType: typeof video.baseScore,
          baseScoreIsNull: video.baseScore === null,
          // 检查原始字段是否存在
          powerUsed: video.powerUsed,
          powerUsedAt: video.powerUsedAt ? new Date(video.powerUsedAt).toISOString() : null,
          createdAt: video.createdAt ? new Date(video.createdAt).toISOString() : null,
          uploadDate: video.uploadDate ? new Date(video.uploadDate).toISOString() : null,
          clicks: video.clicks,
          views: video.views,
          completenessScore: video.completenessScore,
          initialBoost: video.initialBoost
        },
        // 详细计算过程
        calculation: {
          // 基础数据
          clicks: video.clicks || 0,
          likesCount: likesCountManual,
          views: video.views || 0,
          completenessScore: video.completenessScore || 0,
          initialBoost: initialBoost,
          // 时间相关
          uploadTime: new Date(video.createdAt || video.uploadDate).toISOString(),
          powerUsed: video.powerUsed || false,
          powerUsedAt: video.powerUsedAt ? new Date(video.powerUsedAt).toISOString() : null,
          powerExpiry: video.powerExpiry ? new Date(video.powerExpiry).toISOString() : null,
          effectiveTime: effectiveTime.toISOString(),
          hoursElapsed: {
            fromAPI: video.hoursElapsed !== undefined && video.hoursElapsed !== null ? parseFloat(video.hoursElapsed.toFixed(2)) : null,
            manual: parseFloat(hoursElapsedManual.toFixed(2))
          },
          // 加成相关
          boostFactor: {
            fromAPI: video.boostFactor !== undefined && video.boostFactor !== null ? parseFloat(video.boostFactor.toFixed(3)) : null,
            manual: parseFloat(boostFactorManual.toFixed(3))
          },
          finalBoost: {
            fromAPI: video.finalBoost !== undefined && video.finalBoost !== null ? parseFloat(video.finalBoost.toFixed(2)) : null,
            manual: parseFloat(finalBoostManual.toFixed(2))
          },
          // 基础分数
          baseScore: {
            fromAPI: video.baseScore !== undefined && video.baseScore !== null ? parseFloat(video.baseScore.toFixed(2)) : null,
            manual: parseFloat(baseScoreManual.toFixed(2))
          }
        }
      }
    });

  } catch (error) {
    console.error("检查视频分数错误:", error);
    return NextResponse.json(
      { success: false, message: "检查失败", error: error.message },
      { status: 500 }
    );
  }
}

