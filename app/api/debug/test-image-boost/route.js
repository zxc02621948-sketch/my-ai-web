// app/api/debug/test-image-boost/route.js
// 测试图片加成系统，可以模拟时间流逝

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/serverAuth";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import { computePopScore } from "@/utils/score";

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
    const hoursAhead = parseFloat(searchParams.get("hours") || "0"); // 模拟未来X小时

    if (!imageTitle && !imageId) {
      return NextResponse.json(
        { success: false, message: "請提供圖片標題或ID" },
        { status: 400 }
      );
    }

    // 查询图片
    let image;
    if (imageId) {
      const { Types } = await import('mongoose');
      image = await Image.findById(new Types.ObjectId(imageId)).lean();
    } else {
      // 使用标题查询时，优先返回最新的匹配项
      const matches = await Image.find({
        title: { $regex: imageTitle.trim(), $options: "i" }
      })
        .sort({ createdAt: -1 }) // 按创建时间降序，最新的在前
        .limit(1)
        .lean();
      
      image = matches.length > 0 ? matches[0] : null;
    }

    if (!image) {
      // 尝试模糊匹配
      const suggestions = await Image.find({
        title: { $regex: imageTitle.trim(), $options: "i" }
      })
        .select("_id title")
        .limit(5)
        .lean();

      return NextResponse.json({
        success: false,
        message: "找不到圖片",
        suggestions: suggestions.map(s => ({ id: s._id, title: s.title }))
      });
    }

    // 计算当前时间的分数
    const now = new Date();
    const simulatedNow = hoursAhead > 0 
      ? new Date(now.getTime() + hoursAhead * 60 * 60 * 1000)
      : now;

    // 使用模拟时间计算分数
    const originalDateNow = Date.now;
    Date.now = () => simulatedNow.getTime();

    try {
      const currentScore = computePopScore(image);
      
      // 确保日期是Date对象（在计算timePoints之前）
      const createdAtDateForTimePoints = image.createdAt instanceof Date ? image.createdAt : new Date(image.createdAt);
      const powerUsedAtDateForTimePoints = image.powerUsedAt ? (image.powerUsedAt instanceof Date ? image.powerUsedAt : new Date(image.powerUsedAt)) : null;
      const powerExpiryDateForTimePoints = image.powerExpiry ? (image.powerExpiry instanceof Date ? image.powerExpiry : new Date(image.powerExpiry)) : null;

      // 确定有效创建时间（用于计算时间线）
      const effectiveBaseTime = image.powerUsed && powerUsedAtDateForTimePoints && powerExpiryDateForTimePoints && powerExpiryDateForTimePoints > simulatedNow
        ? powerUsedAtDateForTimePoints
        : createdAtDateForTimePoints;

      // 计算不同时间点的分数（基于有效创建时间）
      const timePoints = [0, 1, 2, 3, 5, 7, 10, 12, 15, 20, 24].map(hours => {
        // 基于有效创建时间计算测试时间
        const testTime = new Date(effectiveBaseTime.getTime() + hours * 60 * 60 * 1000);
        Date.now = () => testTime.getTime();
        const score = computePopScore(image);
        
        // 计算加成信息（始终基于有效创建时间）
        const effectiveCreatedAtForTest = effectiveBaseTime;
        const hoursElapsed = (testTime - effectiveCreatedAtForTest) / (1000 * 60 * 60);
        const boostFactor = Math.max(0, 1 - hoursElapsed / POP_NEW_WINDOW_HOURS);
        const initialBoost = image.initialBoost || 0;
        const currentBoost = initialBoost * boostFactor;
        const stillInWindow = hoursElapsed < POP_NEW_WINDOW_HOURS;

        return {
          hoursAfterEffective: hours, // 改为"从有效创建时间后经过多少小时"
          time: testTime.toISOString(),
          score: parseFloat(score.toFixed(2)),
          hoursElapsed: parseFloat(hoursElapsed.toFixed(2)),
          boostFactor: parseFloat(boostFactor.toFixed(3)),
          currentBoost: parseFloat(currentBoost.toFixed(2)),
          stillInWindow,
          initialBoost
        };
      });

      // 恢复原始 Date.now
      Date.now = originalDateNow;

      // 计算基础分数（无加成）
      const baseScore = (image.clicks || 0) * 1.0 + 
                       (image.likesCount || (Array.isArray(image.likes) ? image.likes.length : 0)) * 8.0 + 
                       (image.completenessScore || 0) * 0.25;

      // 确保日期是Date对象
      const createdAtDate = image.createdAt instanceof Date ? image.createdAt : new Date(image.createdAt);
      const powerUsedAtDate = image.powerUsedAt ? (image.powerUsedAt instanceof Date ? image.powerUsedAt : new Date(image.powerUsedAt)) : null;
      const powerExpiryDate = image.powerExpiry ? (image.powerExpiry instanceof Date ? image.powerExpiry : new Date(image.powerExpiry)) : null;

      // 计算有效创建时间
      const effectiveCreatedAt = image.powerUsed && powerUsedAtDate && powerExpiryDate && powerExpiryDate > simulatedNow
        ? powerUsedAtDate
        : createdAtDate;

      const hoursElapsed = (simulatedNow - effectiveCreatedAt) / (1000 * 60 * 60);
      const boostFactor = Math.max(0, 1 - hoursElapsed / POP_NEW_WINDOW_HOURS);
      const initialBoost = image.initialBoost || 0;
      const currentBoost = initialBoost * boostFactor;
      const stillInWindow = hoursElapsed < POP_NEW_WINDOW_HOURS;

      return NextResponse.json({
        success: true,
        image: {
          id: image._id,
          title: image.title,
          createdAt: createdAtDate.toISOString(),
          createdAtRaw: image.createdAt,
          createdAtType: typeof image.createdAt,
          powerUsed: image.powerUsed || false,
          powerUsedAt: powerUsedAtDate ? powerUsedAtDate.toISOString() : null,
          powerUsedAtRaw: image.powerUsedAt,
          powerExpiry: powerExpiryDate ? powerExpiryDate.toISOString() : null,
          powerExpiryRaw: image.powerExpiry,
          clicks: image.clicks || 0,
          likesCount: image.likesCount || (Array.isArray(image.likes) ? image.likes.length : 0),
          completenessScore: image.completenessScore || 0,
          popScore: image.popScore || 0,
          initialBoost: initialBoost,
        },
        current: {
          simulatedTime: simulatedNow.toISOString(),
          realTime: now.toISOString(),
          hoursAhead: hoursAhead,
          score: parseFloat(currentScore.toFixed(2)),
          baseScore: parseFloat(baseScore.toFixed(2)),
          effectiveCreatedAt: effectiveCreatedAt.toISOString(),
          effectiveCreatedAtSource: image.powerUsed && powerUsedAtDate && powerExpiryDate && powerExpiryDate > simulatedNow ? 'powerUsedAt (权力券时间)' : 'createdAt (上传时间)',
          hoursElapsed: parseFloat(hoursElapsed.toFixed(2)),
          boostFactor: parseFloat(boostFactor.toFixed(3)),
          currentBoost: parseFloat(currentBoost.toFixed(2)),
          stillInWindow,
          debug: {
            createdAtValue: createdAtDate.toISOString(),
            powerUsedAtValue: powerUsedAtDate ? powerUsedAtDate.toISOString() : null,
            powerExpiryValue: powerExpiryDate ? powerExpiryDate.toISOString() : null,
            powerExpiryCheck: powerExpiryDate ? (powerExpiryDate > simulatedNow ? '有效' : '已过期') : '无权力券',
            timeDifferenceMs: simulatedNow - effectiveCreatedAt,
            timeDifferenceHours: parseFloat(hoursElapsed.toFixed(4)),
          }
        },
        timePoints, // 不同时间点的分数变化
        summary: {
          message: stillInWindow 
            ? `✅ 仍在加成窗口内，还有 ${(POP_NEW_WINDOW_HOURS - hoursElapsed).toFixed(1)} 小时加成时间`
            : `❌ 已超过加成窗口（${POP_NEW_WINDOW_HOURS}小时），加成已归零`,
          windowEndsAt: new Date(effectiveCreatedAt.getTime() + POP_NEW_WINDOW_HOURS * 60 * 60 * 1000).toISOString(),
        }
      });
    } catch (error) {
      Date.now = originalDateNow;
      throw error;
    }
  } catch (error) {
    console.error("测试图片加成错误:", error);
    return NextResponse.json(
      { success: false, message: error.message || "測試失敗" },
      { status: 500 }
    );
  }
}

