// app/api/debug/check-video-sorting/route.js
// 检查视频排序是否正确

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
    const limit = parseInt(searchParams.get("limit")) || 20;

    const match = { isPublic: true };
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
      powerUsed: 1,
      powerUsedAt: 1,
      powerExpiry: 1,
      powerType: 1,
      author: 1,
      authorName: 1,
      authorAvatar: 1,
      videoUrl: 1,
      thumbnailUrl: 1,
      streamId: 1,
      previewUrl: 1,
      duration: 1,
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
      isPublic: 1,
      status: 1
    };

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
      { $sort: { livePopScore: -1, createdAt: -1, _id: -1 } },
      { $limit: limit }
    ];

    const videos = await Video.aggregate(pipeline);

    const results = videos.map((video, index) => {
      const uploadTime = new Date(video.createdAt || video.uploadDate);
      const now = new Date();
      const hoursSinceUpload = (now.getTime() - uploadTime.getTime()) / (1000 * 60 * 60);
      
      const powerUsed = video.powerUsed && video.powerUsedAt && video.powerExpiry && new Date(video.powerExpiry) > now;
      const effectiveTime = powerUsed 
        ? new Date(video.powerUsedAt) 
        : uploadTime;
      const hoursFromEffective = (now.getTime() - effectiveTime.getTime()) / (1000 * 60 * 60);
      
      const boostFactor = Math.max(0, 1 - hoursFromEffective / POP_NEW_WINDOW_HOURS);
      const initialBoost = video.initialBoost || 0;
      const currentBoost = initialBoost * boostFactor;
      
      const likesCount = Array.isArray(video.likes) ? video.likes.length : (video.likesCount || 0);
      const baseScore = 
        (video.clicks || 0) * POP_W_CLICK +
        likesCount * POP_W_LIKE +
        (video.views || 0) * POP_W_VIEW +
        (video.completenessScore || 0) * POP_W_COMPLETE;
      
      const livePopScoreManual = baseScore + currentBoost;
      const stillInWindow = boostFactor > 0;

      return {
        sortPosition: index + 1,
        id: video._id.toString(),
        title: video.title || "未命名影片",
        uploadTime: uploadTime.toISOString(),
        hoursSinceUpload: parseFloat(hoursSinceUpload.toFixed(2)),
        powerUsed: powerUsed,
        effectiveTime: effectiveTime.toISOString(),
        hoursFromEffective: parseFloat(hoursFromEffective.toFixed(2)),
        initialBoost: initialBoost,
        currentBoost: parseFloat(currentBoost.toFixed(2)),
        boostFactor: parseFloat(boostFactor.toFixed(3)),
        stillInWindow: stillInWindow,
        baseScore: parseFloat(baseScore.toFixed(2)),
        livePopScoreFromAPI: video.livePopScore || 0,
        livePopScoreManual: parseFloat(livePopScoreManual.toFixed(2)),
        popScoreDB: video.popScore || 0,
        scoreDifference: parseFloat((video.livePopScore || 0) - livePopScoreManual).toFixed(2),
        clicks: video.clicks || 0,
        likesCount: likesCount,
        views: video.views || 0,
        completenessScore: video.completenessScore || 0
      };
    });

    return NextResponse.json({
      success: true,
      videos: results,
      summary: {
        total: results.length,
        stillInWindow: results.filter(v => v.stillInWindow).length,
        withPowerCoupon: results.filter(v => v.powerUsed).length
      }
    });

  } catch (error) {
    console.error("检查视频排序错误:", error);
    return NextResponse.json(
      { success: false, message: "检查失败", error: error.message },
      { status: 500 }
    );
  }
}

