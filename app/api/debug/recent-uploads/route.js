// app/api/debug/recent-uploads/route.js
// 查询最近两天内上传的内容状态

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/serverAuth";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import Video from "@/models/Video";
import Music from "@/models/Music";

const POP_NEW_WINDOW_HOURS = 10;

// 图片计算函数
function computeImageBoostDecay(image) {
  const now = new Date();
  const powerUsed = image.powerUsed && image.powerUsedAt && image.powerExpiry && new Date(image.powerExpiry) > now;
  const createdMs = powerUsed ? new Date(image.powerUsedAt).getTime() : new Date(image.createdAt).getTime();
  const hoursElapsed = (now.getTime() - createdMs) / (1000 * 60 * 60);
  const boostFactor = Math.max(0, 1 - hoursElapsed / POP_NEW_WINDOW_HOURS);
  const initialBoost = image.initialBoost || 0;
  const decayedBoost = initialBoost * boostFactor;
  return { hoursElapsed, boostFactor, decayedBoost, initialBoost, powerUsed };
}

// 视频计算函数
function computeVideoBoostDecay(video) {
  const now = new Date();
  const powerUsed = video.powerUsed && video.powerUsedAt && video.powerExpiry && new Date(video.powerExpiry) > now;
  const createdMs = powerUsed 
    ? new Date(video.powerUsedAt).getTime() 
    : new Date(video.createdAt || video.uploadDate).getTime();
  const hoursElapsed = (now.getTime() - createdMs) / (1000 * 60 * 60);
  const boostFactor = Math.max(0, 1 - hoursElapsed / POP_NEW_WINDOW_HOURS);
  const initialBoost = video.initialBoost || 0;
  const decayedBoost = initialBoost * boostFactor;
  return { hoursElapsed, boostFactor, decayedBoost, initialBoost, powerUsed };
}

// 音乐计算函数
function computeMusicBoostDecay(music) {
  const now = new Date();
  const powerUsed = music.powerUsed && music.powerUsedAt && music.powerExpiry && new Date(music.powerExpiry) > now;
  const createdMs = powerUsed 
    ? new Date(music.powerUsedAt).getTime() 
    : new Date(music.createdAt || music.uploadDate).getTime();
  const hoursElapsed = (now.getTime() - createdMs) / (1000 * 60 * 60);
  const boostFactor = Math.max(0, 1 - hoursElapsed / POP_NEW_WINDOW_HOURS);
  const initialBoost = music.initialBoost || 0;
  const decayedBoost = initialBoost * boostFactor;
  return { hoursElapsed, boostFactor, decayedBoost, initialBoost, powerUsed };
}

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
    const days = parseInt(searchParams.get("days")) || 2;
    const contentType = searchParams.get("type") || "all"; // all, image, video, music

    const now = new Date();
    const daysAgo = new Date(now);
    daysAgo.setDate(daysAgo.getDate() - days);
    daysAgo.setHours(0, 0, 0, 0); // 设置为当天的开始时间

    const results = {
      images: [],
      videos: [],
      music: [],
      summary: {
        total: 0,
        withPowerCoupon: 0,
        stillInBoostWindow: 0
      },
      debug: {
        queryTime: now.toISOString(),
        daysAgo: daysAgo.toISOString(),
        days: days
      }
    };

    // 查询图片
    if (contentType === "all" || contentType === "image") {
      // 图片没有isPublic字段，直接查询所有图片
      const allImages = await Image.find({})
        .sort({ createdAt: -1 })
        .limit(200) // 增加查询数量，确保能查到
        .lean();
      
      // 过滤出最近N天的图片
      const images = allImages.filter(img => {
        if (!img.createdAt) return false;
        const imgDate = new Date(img.createdAt);
        const isRecent = imgDate >= daysAgo;
        // 调试：记录第一个图片的信息
        if (allImages.indexOf(img) === 0) {
          results.debug.firstImage = {
            title: img.title,
            createdAt: img.createdAt ? new Date(img.createdAt).toISOString() : null,
            imgDate: imgDate.toISOString(),
            daysAgo: daysAgo.toISOString(),
            isRecent: isRecent,
            hoursDiff: (now.getTime() - imgDate.getTime()) / (1000 * 60 * 60)
          };
        }
        return isRecent;
      });
      
      results.debug.totalImagesFound = allImages.length;
      results.debug.recentImagesCount = images.length;

      for (const image of images) {
        const boost = computeImageBoostDecay(image);
        const uploadTime = new Date(image.createdAt);
        const hoursSinceUpload = (now.getTime() - uploadTime.getTime()) / (1000 * 60 * 60);
        
        results.images.push({
          id: image._id.toString(),
          title: image.title || "未命名圖片",
          contentType: "image",
          uploadTime: uploadTime.toISOString(),
          hoursSinceUpload: parseFloat(hoursSinceUpload.toFixed(2)),
          powerUsed: image.powerUsed || false,
          powerUsedAt: image.powerUsedAt ? new Date(image.powerUsedAt).toISOString() : null,
          powerExpiry: image.powerExpiry ? new Date(image.powerExpiry).toISOString() : null,
          powerType: image.powerType || null,
          effectiveTime: boost.powerUsed && image.powerUsedAt 
            ? new Date(image.powerUsedAt).toISOString() 
            : uploadTime.toISOString(),
          hoursFromEffective: parseFloat(boost.hoursElapsed.toFixed(2)),
          initialBoost: boost.initialBoost,
          currentBoost: parseFloat(boost.decayedBoost.toFixed(2)),
          boostFactor: parseFloat(boost.boostFactor.toFixed(3)),
          stillInWindow: boost.boostFactor > 0,
          popScore: image.popScore || 0,
          clicks: image.clicks || 0,
          likesCount: Array.isArray(image.likes) ? image.likes.length : (image.likesCount || 0),
          completenessScore: image.completenessScore || 0
        });

        if (image.powerUsed) results.summary.withPowerCoupon++;
        if (boost.boostFactor > 0) results.summary.stillInBoostWindow++;
      }
    }

    // 查询视频
    if (contentType === "all" || contentType === "video") {
      const allVideos = await Video.find({ isPublic: true })
        .sort({ createdAt: -1, uploadDate: -1 })
        .limit(100)
        .lean();
      
      const videos = allVideos.filter(video => {
        const videoDate = new Date(video.createdAt || video.uploadDate);
        return videoDate >= daysAgo;
      });

      for (const video of videos) {
        const boost = computeVideoBoostDecay(video);
        const uploadTime = new Date(video.createdAt || video.uploadDate);
        const hoursSinceUpload = (now.getTime() - uploadTime.getTime()) / (1000 * 60 * 60);
        
        results.videos.push({
          id: video._id.toString(),
          title: video.title || "未命名影片",
          contentType: "video",
          uploadTime: uploadTime.toISOString(),
          hoursSinceUpload: parseFloat(hoursSinceUpload.toFixed(2)),
          powerUsed: video.powerUsed || false,
          powerUsedAt: video.powerUsedAt ? new Date(video.powerUsedAt).toISOString() : null,
          powerExpiry: video.powerExpiry ? new Date(video.powerExpiry).toISOString() : null,
          powerType: video.powerType || null,
          effectiveTime: boost.powerUsed && video.powerUsedAt 
            ? new Date(video.powerUsedAt).toISOString() 
            : uploadTime.toISOString(),
          hoursFromEffective: parseFloat(boost.hoursElapsed.toFixed(2)),
          initialBoost: boost.initialBoost,
          currentBoost: parseFloat(boost.decayedBoost.toFixed(2)),
          boostFactor: parseFloat(boost.boostFactor.toFixed(3)),
          stillInWindow: boost.boostFactor > 0,
          popScore: video.popScore || 0,
          clicks: video.clicks || 0,
          likesCount: Array.isArray(video.likes) ? video.likes.length : (video.likesCount || 0),
          views: video.views || 0,
          completenessScore: video.completenessScore || 0
        });

        if (video.powerUsed) results.summary.withPowerCoupon++;
        if (boost.boostFactor > 0) results.summary.stillInBoostWindow++;
      }
    }

    // 查询音乐
    if (contentType === "all" || contentType === "music") {
      const allMusic = await Music.find({ isPublic: true })
        .sort({ createdAt: -1, uploadDate: -1 })
        .limit(100)
        .lean();
      
      const music = allMusic.filter(item => {
        const itemDate = new Date(item.createdAt || item.uploadDate);
        return itemDate >= daysAgo;
      });

      for (const item of music) {
        const boost = computeMusicBoostDecay(item);
        const uploadTime = new Date(item.createdAt || item.uploadDate);
        const hoursSinceUpload = (now.getTime() - uploadTime.getTime()) / (1000 * 60 * 60);
        
        results.music.push({
          id: item._id.toString(),
          title: item.title || "未命名音樂",
          contentType: "music",
          uploadTime: uploadTime.toISOString(),
          hoursSinceUpload: parseFloat(hoursSinceUpload.toFixed(2)),
          powerUsed: item.powerUsed || false,
          powerUsedAt: item.powerUsedAt ? new Date(item.powerUsedAt).toISOString() : null,
          powerExpiry: item.powerExpiry ? new Date(item.powerExpiry).toISOString() : null,
          powerType: item.powerType || null,
          effectiveTime: boost.powerUsed && item.powerUsedAt 
            ? new Date(item.powerUsedAt).toISOString() 
            : uploadTime.toISOString(),
          hoursFromEffective: parseFloat(boost.hoursElapsed.toFixed(2)),
          initialBoost: boost.initialBoost,
          currentBoost: parseFloat(boost.decayedBoost.toFixed(2)),
          boostFactor: parseFloat(boost.boostFactor.toFixed(3)),
          stillInWindow: boost.boostFactor > 0,
          popScore: item.popScore || 0,
          plays: item.plays || 0,
          likesCount: Array.isArray(item.likes) ? item.likes.length : (item.likesCount || 0),
          completenessScore: item.completenessScore || 0
        });

        if (item.powerUsed) results.summary.withPowerCoupon++;
        if (boost.boostFactor > 0) results.summary.stillInBoostWindow++;
      }
    }

    results.summary.total = results.images.length + results.videos.length + results.music.length;

    return NextResponse.json({
      success: true,
      query: {
        days,
        contentType,
        from: daysAgo.toISOString(),
        to: now.toISOString()
      },
      ...results
    });

  } catch (error) {
    console.error("查询最近上传内容错误:", error);
    return NextResponse.json(
      { success: false, message: "查询失败", error: error.message },
      { status: 500 }
    );
  }
}

