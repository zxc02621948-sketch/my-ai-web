// app/api/debug/video-live-score/route.js
// 診斷查詢 API 的實時分數計算

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/serverAuth";
import { dbConnect } from "@/lib/db";
import Video from "@/models/Video";
import { VIDEO_AUTHOR_STAGES } from "@/utils/videoQuery";

// 熱門度計算常數（與查詢 API 一致）
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

    // 明確指定要保留的字段（與查詢 API 一致）
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

    const { searchParams } = new URL(request.url);
    const videoTitle = searchParams.get("title");
    const videoId = searchParams.get("id");

    if (!videoTitle && !videoId) {
      return NextResponse.json(
        { success: false, message: "請提供影片標題或ID" },
        { status: 400 }
      );
    }

    // 使用與查詢 API 相同的聚合管道邏輯
    const match = {
      isPublic: true
    };
    
    if (videoId) {
      // 使用 mongoose.Types.ObjectId 來轉換 ID
      const { Types } = await import('mongoose');
      match._id = new Types.ObjectId(videoId);
    } else {
      match.title = { $regex: videoTitle.trim(), $options: "i" };
    }

    // 完全按照查詢 API 的方式，在一個 $addFields 階段完成所有計算（與圖片 API 一致）
    const calcLive = {
      $addFields: {
        likesCountCalc: {
          $cond: [
            { $isArray: "$likes" },
            { $size: { $ifNull: ["$likes", []] } },
            { $ifNull: ["$likesCount", 0] }
          ]
        },
        // 計算有效的「上架時間」（權力券會重置這個時間）
        // 完全按照圖片 API 的方式，直接使用字段（字段已經是 Date 類型）
        effectiveCreatedAt: {
          $cond: [
            {
              $and: [
                { $eq: ["$powerUsed", true] },
                { $ne: [{ $ifNull: ["$powerUsedAt", null] }, null] }
              ]
            },
            "$powerUsedAt",  // 使用過權力券：用權力券時間作為新的上架時間
            { $ifNull: ["$createdAt", "$uploadDate"] }  // 沒用過：用真實上架時間
          ]
        },
        // 調試：檢查原始字段是否存在
        debugPowerUsed: "$powerUsed",
        debugPowerUsedAt: "$powerUsedAt",
        debugCreatedAt: "$createdAt",
        debugUploadDate: "$uploadDate",
        // 統一計算加成（只有一套邏輯）
        // 直接在 $subtract 中計算 effectiveCreatedAt，避免引用問題
        hoursElapsed: { 
          $divide: [
            { 
              $subtract: [
                "$$NOW", 
                {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$powerUsed", true] },
                        { $ne: [{ $ifNull: ["$powerUsedAt", null] }, null] }
                      ]
                    },
                    "$powerUsedAt",
                    { $ifNull: ["$createdAt", "$uploadDate"] }
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
                            "$$NOW", 
                            {
                              $cond: [
                                {
                                  $and: [
                                    { $eq: ["$powerUsed", true] },
                                    { $ne: [{ $ifNull: ["$powerUsedAt", null] }, null] }
                                  ]
                                },
                                "$powerUsedAt",
                                { $ifNull: ["$createdAt", "$uploadDate"] }
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
                { $ifNull: ["$initialBoost", 0] }, 
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
                                    "$$NOW", 
                                    {
                                      $cond: [
                                        {
                                          $and: [
                                            { $eq: ["$powerUsed", true] },
                                            { $ne: [{ $ifNull: ["$powerUsedAt", null] }, null] }
                                          ]
                                        },
                                        "$powerUsedAt",
                                        { $ifNull: ["$createdAt", "$uploadDate"] }
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
            { $multiply: [{ $ifNull: ["$clicks", 0] }, POP_W_CLICK] },
            { $multiply: [{ $ifNull: ["$likesCountCalc", 0] }, POP_W_LIKE] },
            { $multiply: [{ $ifNull: ["$views", 0] }, POP_W_VIEW] },
            { $multiply: [{ $ifNull: ["$completenessScore", 0] }, POP_W_COMPLETE] }
          ]
        },
        livePopScore: { 
          $add: [
            {
              $add: [
                { $multiply: [{ $ifNull: ["$clicks", 0] }, POP_W_CLICK] },
                { $multiply: [{ $ifNull: ["$likesCountCalc", 0] }, POP_W_LIKE] },
                { $multiply: [{ $ifNull: ["$views", 0] }, POP_W_VIEW] },
                { $multiply: [{ $ifNull: ["$completenessScore", 0] }, POP_W_COMPLETE] }
              ]
            },
            {
              $round: [
                { 
                  $multiply: [
                    { $ifNull: ["$initialBoost", 0] }, 
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
                                        "$$NOW", 
                                        {
                                          $cond: [
                                            {
                                              $and: [
                                                { $eq: ["$powerUsed", true] },
                                                { $ne: [{ $ifNull: ["$powerUsedAt", null] }, null] }
                                              ]
                                            },
                                            "$powerUsedAt",
                                            { $ifNull: ["$createdAt", "$uploadDate"] }
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
        popScoreDB: { $ifNull: ["$popScore", 0] }
      }
    };

    // 完全按照查詢 API 的順序：$match → $project → lookup → calcLive
    // 注意：calcLive 在 lookup 之後執行，可以引用所有字段
    const pipeline = [
      { $match: match },
      { $project: videoProjectBase },  // 明確保留所有需要的字段
      ...VIDEO_AUTHOR_STAGES,  // 然後執行 lookup
      calcLive,  // 最後計算分數（可以引用前面定義的所有字段）
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

    return NextResponse.json({
      success: true,
      video: {
        id: video._id.toString(),
        title: video.title,
        // 分數
        popScoreDB: video.popScoreDB || 0,
        livePopScore: video.livePopScore || 0,
        // 基礎數據
        clicks: video.clicks || 0,
        likesCountCalc: video.likesCountCalc || 0,
        views: video.views || 0,
        completenessScore: video.completenessScore || 0,
        initialBoost: video.initialBoost || 0,
        // 時間計算
        effectiveCreatedAt: video.effectiveCreatedAt
          ? new Date(video.effectiveCreatedAt).toISOString()
          : null,
        // 調試：檢查 $$NOW 和時間差
        debugNow: video.debugNow ? new Date(video.debugNow).toISOString() : null,
        debugPowerUsed: video.debugPowerUsed,
        debugPowerUsedAt: video.debugPowerUsedAt ? new Date(video.debugPowerUsedAt).toISOString() : null,
        debugCreatedAt: video.debugCreatedAt ? new Date(video.debugCreatedAt).toISOString() : null,
        debugUploadDate: video.debugUploadDate ? new Date(video.debugUploadDate).toISOString() : null,
        debugEffectiveCreatedAt: video.debugEffectiveCreatedAt 
          ? new Date(video.debugEffectiveCreatedAt).toISOString() 
          : null,
        debugEffectiveCreatedAtType: video.debugEffectiveCreatedAtType,
        debugNowType: video.debugNowType,
        debugTimeDiff: video.debugTimeDiff,  // 毫秒數
        debugTimeDiffHours: video.debugTimeDiff 
          ? (video.debugTimeDiff / (1000 * 60 * 60)).toFixed(2) 
          : null,
        hoursElapsed: video.hoursElapsed !== undefined && video.hoursElapsed !== null ? video.hoursElapsed : null,
        hoursElapsedRaw: video.hoursElapsed,  // 原始值，用于调试
        hoursElapsedType: typeof video.hoursElapsed,  // 类型，用于调试
        hoursElapsedIsNull: video.hoursElapsed === null,  // 是否为 null
        hoursElapsedIsUndefined: video.hoursElapsed === undefined,  // 是否为 undefined
        boostFactor: video.boostFactor !== undefined ? video.boostFactor : 0,
        boostFactorRaw: video.boostFactor,  // 原始值，用于调试
        boostFactorType: typeof video.boostFactor,  // 类型，用于调试
        // 手動計算 boostFactor 用於對比
        manualBoostFactor: video.hoursElapsed !== undefined 
          ? Math.max(0, 1 - video.hoursElapsed / 10)
          : null,
        // 調試資訊：檢查 effectiveCreatedAt 的實際值
        effectiveCreatedAtRaw: video.effectiveCreatedAt,
        effectiveCreatedAtType: typeof video.effectiveCreatedAt,
        effectiveCreatedAtValue: video.effectiveCreatedAt instanceof Date 
          ? video.effectiveCreatedAt.toISOString() 
          : (video.effectiveCreatedAt ? String(video.effectiveCreatedAt) : null),
        // 分數組成
        baseScore: video.baseScore !== undefined ? video.baseScore : null,
        baseScoreRaw: video.baseScore,  // 原始值
        finalBoost: video.finalBoost !== undefined ? video.finalBoost : null,
        finalBoostRaw: video.finalBoost,  // 原始值
        // 基礎數據（用於檢查）
        clicks: video.clicks,
        likesCountCalc: video.likesCountCalc,
        views: video.views,
        completenessScore: video.completenessScore,
        initialBoost: video.initialBoost,
        // 權力券資訊
        powerUsed: video.powerUsed || false,
        powerType: video.powerType || null,
        powerUsedAt: video.powerUsedAt
          ? new Date(video.powerUsedAt).toISOString()
          : null,
        powerExpiry: video.powerExpiry
          ? new Date(video.powerExpiry).toISOString()
          : null,
        createdAt: video.createdAt
          ? new Date(video.createdAt).toISOString()
          : null,
        // 診斷資訊
        diagnosis: {
          effectiveCreatedAtType: video.powerUsed
            ? "powerUsedAt (權力券時間)"
            : "createdAt (上傳時間)",
          hoursFromEffective: video.hoursElapsed
            ? video.hoursElapsed.toFixed(2)
            : "0",
          boostFactorValue: video.boostFactor ? video.boostFactor.toFixed(3) : "0",
          finalBoostValue: video.finalBoost || 0,
          baseScoreValue: video.baseScore || 0,
          livePopScoreValue: video.livePopScore || 0,
          // 手動計算的時間差（用於對比）
          manualHoursElapsed: (() => {
            if (!video.effectiveCreatedAt) return null;
            const now = new Date();
            const effectiveTime = new Date(video.effectiveCreatedAt);
            return (now - effectiveTime) / (1000 * 60 * 60);
          })(),
          // 檢查 powerExpiry 狀態
          powerExpiryStatus: video.powerExpiry
            ? (new Date(video.powerExpiry) > new Date() ? "未過期" : "已過期")
            : "無過期時間"
        }
      }
    });
  } catch (error) {
    console.error("診斷實時分數錯誤:", error);
    return NextResponse.json(
      {
        success: false,
        message: "伺服器錯誤",
        error: error.message
      },
      { status: 500 }
    );
  }
}

