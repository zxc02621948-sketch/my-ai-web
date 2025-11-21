// app/api/debug/video-score/route.js
// 診斷特定影片的分數計算問題

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/serverAuth";
import { dbConnect } from "@/lib/db";
import Video from "@/models/Video";
import { computeVideoPopScore } from "@/utils/scoreVideo";

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
    const videoTitle = searchParams.get("title");
    const videoId = searchParams.get("id");

    if (!videoTitle && !videoId) {
      return NextResponse.json(
        { success: false, message: "請提供影片標題或ID" },
        { status: 400 }
      );
    }

    let video;
    if (videoId) {
      video = await Video.findById(videoId).lean();
    } else {
      // 使用更寬鬆的搜尋，包括部分匹配
      video = await Video.findOne({ 
        title: { $regex: videoTitle.trim(), $options: "i" },
        isPublic: true 
      }).lean();
    }

    if (!video) {
      // 如果找不到，列出所有使用權力券的影片標題
      const powerVideos = await Video.find({ 
        powerUsed: true,
        isPublic: true 
      })
        .select('title _id powerType')
        .limit(10)
        .lean();
      
      return NextResponse.json(
        { 
          success: false, 
          message: "找不到影片",
          searchTerm: videoTitle || videoId,
          suggestions: powerVideos.map(v => ({
            id: v._id.toString(),
            title: v.title,
            powerType: v.powerType
          }))
        },
        { status: 404 }
      );
    }

    const now = new Date();
    const createdAt = new Date(video.createdAt || video.uploadDate);
    const powerUsedAt = video.powerUsedAt ? new Date(video.powerUsedAt) : null;
    const powerExpiry = video.powerExpiry ? new Date(video.powerExpiry) : null;
    const isExpired = powerExpiry && powerExpiry < now;

    // 計算有效時間
    let effectiveTime;
    if (video.powerUsed && powerUsedAt && !isExpired) {
      effectiveTime = powerUsedAt;
    } else {
      effectiveTime = createdAt;
    }

    const hoursFromCreated = (now - createdAt) / (1000 * 60 * 60);
    const hoursFromPower = powerUsedAt ? (now - powerUsedAt) / (1000 * 60 * 60) : null;
    const hoursFromEffective = (now - effectiveTime) / (1000 * 60 * 60);

    // 手動計算分數
    const W_CLICK = 1.0;
    const W_LIKE = 8.0;
    const W_VIEW = 0.5;
    const W_COMPLETE = 0.25;
    const WINDOW_HOURS = 10;

    const clickScore = (video.clicks || 0) * W_CLICK;
    const likeScore = (video.likesCount || (Array.isArray(video.likes) ? video.likes.length : 0)) * W_LIKE;
    const viewScore = (video.views || 0) * W_VIEW;
    const completeScore = (video.completenessScore || 0) * W_COMPLETE;

    // 計算加成衰減
    const baseBoost = video.initialBoost || 0;
    let boostFactor = 0;
    if (baseBoost > 0 && hoursFromEffective < WINDOW_HOURS) {
      boostFactor = Math.max(0, 1 - hoursFromEffective / WINDOW_HOURS);
    }
    const decayedBoost = baseBoost * boostFactor;

    const manualScore = clickScore + likeScore + viewScore + completeScore + decayedBoost;
    const computedScore = computeVideoPopScore(video);

    return NextResponse.json({
      success: true,
      video: {
        id: video._id.toString(),
        title: video.title,
        // 基礎數據
        clicks: video.clicks || 0,
        likesCount: video.likesCount || (Array.isArray(video.likes) ? video.likes.length : 0),
        views: video.views || 0,
        completenessScore: video.completenessScore || 0,
        initialBoost: video.initialBoost || 0,
        // 分數
        popScore: video.popScore || 0,
        computedScore: parseFloat(computedScore.toFixed(2)),
        manualScore: parseFloat(manualScore.toFixed(2)),
        // 權力券資訊
        powerUsed: video.powerUsed || false,
        powerType: video.powerType || null,
        powerUsedAt: video.powerUsedAt ? new Date(video.powerUsedAt).toISOString() : null,
        powerExpiry: video.powerExpiry ? new Date(video.powerExpiry).toISOString() : null,
        isExpired,
        // 時間資訊
        createdAt: createdAt.toISOString(),
        hoursFromCreated: parseFloat(hoursFromCreated.toFixed(2)),
        powerUsedAtFormatted: powerUsedAt ? powerUsedAt.toISOString() : null,
        hoursFromPower: powerUsedAt ? parseFloat(hoursFromPower.toFixed(2)) : null,
        effectiveTime: effectiveTime.toISOString(),
        hoursFromEffective: parseFloat(hoursFromEffective.toFixed(2)),
        // 手動計算詳情
        manualCalculation: {
          clickScore: parseFloat(clickScore.toFixed(2)),
          likeScore: parseFloat(likeScore.toFixed(2)),
          viewScore: parseFloat(viewScore.toFixed(2)),
          completeScore: parseFloat(completeScore.toFixed(2)),
          baseBoost: parseFloat(baseBoost.toFixed(2)),
          boostFactor: parseFloat(boostFactor.toFixed(3)),
          decayedBoost: parseFloat(decayedBoost.toFixed(2)),
          total: parseFloat(manualScore.toFixed(2))
        },
        // 分數差異
        scoreDifference: parseFloat(Math.abs(computedScore - manualScore).toFixed(2)),
        // 問題診斷
        diagnosis: {
          expectedLiveScore: manualScore.toFixed(2),
          actualLiveScore: 'N/A (需從查詢 API 獲取)',
          dbScore: video.popScore || 0,
          issue: hoursFromEffective > 10 
            ? '加成已完全衰減（超過10小時）'
            : hoursFromEffective > 0
            ? `加成正在衰減（已過 ${hoursFromEffective.toFixed(2)} 小時）`
            : '加成未衰減',
          shouldUsePowerTime: video.powerUsed && powerUsedAt && !isExpired,
          actualEffectiveTime: effectiveTime.toISOString()
        }
      }
    });

  } catch (error) {
    console.error("診斷影片分數錯誤:", error);
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

