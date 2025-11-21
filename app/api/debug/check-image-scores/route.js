// app/api/debug/check-image-scores/route.js
// 检查图片分数的计算是否正确

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/serverAuth";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import mongoose from "mongoose";

const POP_W_CLICK = 1.0;
const POP_W_LIKE = 8.0;
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
    const imageTitle = searchParams.get("title");
    const imageId = searchParams.get("id");

    if (!imageTitle && !imageId) {
      return NextResponse.json(
        { success: false, message: "請提供圖片標題或ID" },
        { status: 400 }
      );
    }

    const usersColl = mongoose.model("User").collection.name;

    const projectBase = {
      _id: 1, title: 1, description: 1, positivePrompt: 1, negativePrompt: 1, tags: 1, category: 1, rating: 1,
      createdAt: 1, likes: 1, likesCount: 1, popScore: 1, imageUrl: 1, imageId: 1, variant: 1, userId: 1, user: 1,
      platform: 1, modelName: 1, modelLink: 1, modelHash: 1, loraName: 1, loraLink: 1, author: 1,
      sampler: 1, steps: 1, cfgScale: 1, seed: 1, clipSkip: 1, width: 1, height: 1,
      initialBoost: 1, completenessScore: 1, clicks: 1,
      powerUsed: 1, powerExpiry: 1, powerType: 1, powerUsedAt: 1,
      comfy: 1, "raw.comfyWorkflowJson": 1,
      hasMetadata: 1,
    };

    const addUserRef = {
      $addFields: {
        userRef: {
          $switch: {
            branches: [
              { case: { $eq: [{ $type: "$user" }, "objectId"] }, then: "$user" },
              { case: { $eq: [{ $type: "$userId" }, "objectId"] }, then: "$userId" },
              { case: { $eq: [{ $type: "$userId" }, "string"] }, then: { $toObjectId: "$userId" } },
            ],
            default: null,
          },
        },
      },
    };

    const lookupUser = [
      addUserRef,
      {
        $lookup: {
          from: usersColl,
          localField: "userRef",
          foreignField: "_id",
          as: "user",
          pipeline: [{ $project: { _id: 1, username: 1, image: 1, currentFrame: 1, frameSettings: 1 } }],
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    ];

    const match = {};
    if (imageId) {
      const { Types } = await import('mongoose');
      match._id = new Types.ObjectId(imageId);
    } else {
      match.title = { $regex: imageTitle.trim(), $options: "i" };
    }

    const calcLive = {
      $addFields: {
        likesCountCalc: {
          $cond: [
            { $isArray: "$likes" },
            { $size: { $ifNull: ["$likes", []] } },
            { $ifNull: ["$likesCount", 0] },
          ],
        },
        effectiveCreatedAt: {
          $cond: [
            {
              $and: [
                { $eq: ["$powerUsed", true] },
                { $ne: [{ $ifNull: ["$powerUsedAt", null] }, null] }
              ]
            },
            "$powerUsedAt",
            "$createdAt"
          ]
        },
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
                    "$createdAt"
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
                                "$createdAt"
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
                                        "$createdAt"
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
            { $multiply: [{ $ifNull: ["$completenessScore", 0] }, POP_W_COMPLETE] },
          ],
        },
        livePopScore: { 
          $add: [
            {
              $add: [
                { $multiply: [{ $ifNull: ["$clicks", 0] }, POP_W_CLICK] },
                { $multiply: [{ $ifNull: ["$likesCountCalc", 0] }, POP_W_LIKE] },
                { $multiply: [{ $ifNull: ["$completenessScore", 0] }, POP_W_COMPLETE] },
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
                                            "$createdAt"
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

    const base = [{ $match: match }, { $project: projectBase }, ...lookupUser];
    const pipeline = [...base, calcLive, { $limit: 1 }];

    const images = await Image.aggregate(pipeline);

    if (!images || images.length === 0) {
      return NextResponse.json(
        { success: false, message: "找不到圖片" },
        { status: 404 }
      );
    }

    const image = images[0];

    // 手动计算（用于对比）
    const now = new Date();
    const powerUsed = image.powerUsed && image.powerUsedAt && image.powerExpiry && new Date(image.powerExpiry) > now;
    const effectiveTime = powerUsed ? new Date(image.powerUsedAt) : new Date(image.createdAt);
    const hoursElapsedManual = (now.getTime() - effectiveTime.getTime()) / (1000 * 60 * 60);
    const boostFactorManual = Math.max(0, 1 - hoursElapsedManual / POP_NEW_WINDOW_HOURS);
    const initialBoost = image.initialBoost || 0;
    const finalBoostManual = Math.round(initialBoost * boostFactorManual * 10) / 10;
    
    const likesCountManual = Array.isArray(image.likes) ? image.likes.length : (image.likesCount || 0);
    const baseScoreManual = 
      (image.clicks || 0) * POP_W_CLICK +
      likesCountManual * POP_W_LIKE +
      (image.completenessScore || 0) * POP_W_COMPLETE;
    const livePopScoreManual = baseScoreManual + finalBoostManual;

    return NextResponse.json({
      success: true,
      image: {
        id: image._id.toString(),
        title: image.title,
        popScoreDB: image.popScoreDB || 0,
        livePopScoreFromAPI: image.livePopScore || 0,
        livePopScoreManual: parseFloat(livePopScoreManual.toFixed(2)),
        difference: {
          apiVsDB: parseFloat((image.livePopScore || 0) - (image.popScoreDB || 0)).toFixed(2),
          manualVsDB: parseFloat(livePopScoreManual - (image.popScoreDB || 0)).toFixed(2),
          apiVsManual: parseFloat((image.livePopScore || 0) - livePopScoreManual).toFixed(2)
        },
        debug: {
          likesCountCalc: image.likesCountCalc,
          effectiveCreatedAt: image.effectiveCreatedAt ? new Date(image.effectiveCreatedAt).toISOString() : null,
          hoursElapsed: image.hoursElapsed,
          hoursElapsedType: typeof image.hoursElapsed,
          boostFactor: image.boostFactor,
          boostFactorType: typeof image.boostFactor,
          finalBoost: image.finalBoost,
          finalBoostType: typeof image.finalBoost,
          baseScore: image.baseScore,
          baseScoreType: typeof image.baseScore,
          livePopScore: image.livePopScore,
          livePopScoreType: typeof image.livePopScore,
          clicks: image.clicks,
          likes: image.likes,
          completenessScore: image.completenessScore,
          initialBoost: image.initialBoost
        },
        calculation: {
          clicks: image.clicks || 0,
          likesCount: likesCountManual,
          completenessScore: image.completenessScore || 0,
          initialBoost: initialBoost,
          uploadTime: new Date(image.createdAt).toISOString(),
          powerUsed: image.powerUsed || false,
          effectiveTime: effectiveTime.toISOString(),
          hoursElapsed: {
            fromAPI: image.hoursElapsed !== undefined && image.hoursElapsed !== null ? parseFloat(image.hoursElapsed.toFixed(2)) : null,
            manual: parseFloat(hoursElapsedManual.toFixed(2))
          },
          boostFactor: {
            fromAPI: image.boostFactor !== undefined && image.boostFactor !== null ? parseFloat(image.boostFactor.toFixed(3)) : null,
            manual: parseFloat(boostFactorManual.toFixed(3))
          },
          finalBoost: {
            fromAPI: image.finalBoost !== undefined && image.finalBoost !== null ? parseFloat(image.finalBoost.toFixed(2)) : null,
            manual: parseFloat(finalBoostManual.toFixed(2))
          },
          baseScore: {
            fromAPI: image.baseScore !== undefined && image.baseScore !== null ? parseFloat(image.baseScore.toFixed(2)) : null,
            manual: parseFloat(baseScoreManual.toFixed(2))
          }
        }
      }
    });

  } catch (error) {
    console.error("检查图片分数错误:", error);
    return NextResponse.json(
      { success: false, message: "检查失败", error: error.message },
      { status: 500 }
    );
  }
}

