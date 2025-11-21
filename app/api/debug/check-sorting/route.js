// app/api/debug/check-sorting/route.js
// 检查排序和新图加成系统

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/serverAuth";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import Video from "@/models/Video";
import Music from "@/models/Music";

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
    const contentType = searchParams.get("type") || "image"; // image, video, music
    const limit = parseInt(searchParams.get("limit")) || 50;

    const now = new Date();
    const results = {
      contentType,
      queryTime: now.toISOString(),
      items: []
    };

    // 查询最近上传的内容
    let items = [];
    if (contentType === "image") {
      items = await Image.find({ isPublic: true })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    } else if (contentType === "video") {
      items = await Video.find({ isPublic: true })
        .sort({ createdAt: -1, uploadDate: -1 })
        .limit(limit)
        .lean();
    } else if (contentType === "music") {
      items = await Music.find({ isPublic: true })
        .sort({ createdAt: -1, uploadDate: -1 })
        .limit(limit)
        .lean();
    }

    // 计算每个项目的详细信息
    for (const item of items) {
      const uploadTime = new Date(item.createdAt || item.uploadDate);
      const hoursSinceUpload = (now.getTime() - uploadTime.getTime()) / (1000 * 60 * 60);
      
      // 检查是否使用权力券
      const powerUsed = item.powerUsed && item.powerUsedAt && item.powerExpiry && new Date(item.powerExpiry) > now;
      const effectiveTime = powerUsed 
        ? new Date(item.powerUsedAt) 
        : uploadTime;
      const hoursFromEffective = (now.getTime() - effectiveTime.getTime()) / (1000 * 60 * 60);
      
      // 计算加成
      const boostFactor = Math.max(0, 1 - hoursFromEffective / POP_NEW_WINDOW_HOURS);
      const initialBoost = item.initialBoost || 0;
      const currentBoost = initialBoost * boostFactor;
      
      // 计算基础分数
      let baseScore = 0;
      if (contentType === "image") {
        const likesCount = Array.isArray(item.likes) ? item.likes.length : (item.likesCount || 0);
        baseScore = 
          (item.clicks || 0) * 1.0 +
          likesCount * 8.0 +
          (item.completenessScore || 0) * 0.25;
      } else if (contentType === "video") {
        const likesCount = Array.isArray(item.likes) ? item.likes.length : (item.likesCount || 0);
        baseScore = 
          (item.clicks || 0) * 1.0 +
          likesCount * 8.0 +
          (item.views || 0) * 0.5 +
          (item.completenessScore || 0) * 0.25;
      } else if (contentType === "music") {
        const likesCount = Array.isArray(item.likes) ? item.likes.length : (item.likesCount || 0);
        baseScore = 
          (item.plays || 0) * 0.5 +
          likesCount * 8.0 +
          (item.completenessScore || 0) * 0.25;
      }
      
      const livePopScore = baseScore + currentBoost;
      const stillInWindow = boostFactor > 0;

      results.items.push({
        id: item._id.toString(),
        title: item.title || "未命名",
        uploadTime: uploadTime.toISOString(),
        hoursSinceUpload: parseFloat(hoursSinceUpload.toFixed(2)),
        powerUsed: powerUsed,
        powerUsedAt: item.powerUsedAt ? new Date(item.powerUsedAt).toISOString() : null,
        powerExpiry: item.powerExpiry ? new Date(item.powerExpiry).toISOString() : null,
        effectiveTime: effectiveTime.toISOString(),
        hoursFromEffective: parseFloat(hoursFromEffective.toFixed(2)),
        initialBoost: initialBoost,
        currentBoost: parseFloat(currentBoost.toFixed(2)),
        boostFactor: parseFloat(boostFactor.toFixed(3)),
        stillInWindow: stillInWindow,
        baseScore: parseFloat(baseScore.toFixed(2)),
        livePopScore: parseFloat(livePopScore.toFixed(2)),
        popScoreDB: item.popScore || 0,
        scoreDifference: parseFloat((livePopScore - (item.popScore || 0)).toFixed(2)),
        // 统计数据
        clicks: item.clicks || 0,
        likesCount: Array.isArray(item.likes) ? item.likes.length : (item.likesCount || 0),
        views: item.views || 0,
        plays: item.plays || 0,
        completenessScore: item.completenessScore || 0
      });
    }

    // 按 livePopScore 排序（模拟实际排序）
    results.items.sort((a, b) => {
      if (b.livePopScore !== a.livePopScore) {
        return b.livePopScore - a.livePopScore;
      }
      // 如果分数相同，按上传时间排序
      return new Date(b.uploadTime) - new Date(a.uploadTime);
    });

    // 添加排序位置
    results.items = results.items.map((item, index) => ({
      ...item,
      sortPosition: index + 1
    }));

    // 统计信息
    results.summary = {
      total: results.items.length,
      stillInWindow: results.items.filter(i => i.stillInWindow).length,
      withPowerCoupon: results.items.filter(i => i.powerUsed).length,
      avgScore: parseFloat((results.items.reduce((sum, i) => sum + i.livePopScore, 0) / results.items.length).toFixed(2)),
      maxScore: Math.max(...results.items.map(i => i.livePopScore)),
      minScore: Math.min(...results.items.map(i => i.livePopScore))
    };

    return NextResponse.json({
      success: true,
      ...results
    });

  } catch (error) {
    console.error("检查排序错误:", error);
    return NextResponse.json(
      { success: false, message: "检查失败", error: error.message },
      { status: 500 }
    );
  }
}

