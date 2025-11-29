// app/api/debug/user-stats/route.js
// 临时调试API：查询用户统计数据详情
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import Music from "@/models/Music";
import Video from "@/models/Video";
import Comment from "@/models/Comment";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const username = searchParams.get("username");

    if (!userId && !username) {
      return NextResponse.json(
        { error: "需要提供 userId 或 username" },
        { status: 400 }
      );
    }

    await dbConnect();

    // 解析用户ID
    let validUserId;
    let user;
    
    if (username) {
      user = await User.findOne({ username }).lean();
      if (!user) {
        return NextResponse.json({ error: "用户不存在" }, { status: 404 });
      }
      validUserId = new mongoose.Types.ObjectId(user._id);
    } else {
      if (mongoose.Types.ObjectId.isValid(userId)) {
        validUserId = new mongoose.Types.ObjectId(userId);
        user = await User.findById(userId).lean();
      } else {
        return NextResponse.json({ error: "无效的用户ID" }, { status: 400 });
      }
    }

    const userIdString = validUserId.toString();

    // 1. 查询用户上传的图片
    const imageQuery1 = { userId: userIdString };
    const imageQuery2 = { user: validUserId };
    const imageQueryBoth = { $or: [{ user: validUserId }, { userId: userIdString }] };

    const images1 = await Image.find(imageQuery1, { _id: 1, userId: 1, user: 1, likes: 1, title: 1 }).lean();
    const images2 = await Image.find(imageQuery2, { _id: 1, userId: 1, user: 1, likes: 1, title: 1 }).lean();
    const imagesBoth = await Image.find(imageQueryBoth, { _id: 1, userId: 1, user: 1, likes: 1, title: 1 }).lean();

    // 2. 计算图片获得的点赞数
    let totalImageLikes = 0;
    const imageLikesDetails = imagesBoth.map(img => {
      const likesCount = Array.isArray(img.likes) ? img.likes.length : 0;
      totalImageLikes += likesCount;
      return {
        imageId: img._id.toString(),
        title: img.title || "无标题",
        userId: img.userId,
        user: img.user ? img.user.toString() : null,
        likesCount,
        likes: img.likes ? img.likes.map(l => l.toString()) : []
      };
    });

    // 3. 查询用户点赞的图片
    const likedImagesQuery = {
      $or: [
        { likes: validUserId },
        { likes: userIdString },
        { likes: validUserId.toString() },
        { likes: userIdString.toString() }
      ]
    };
    const likedImages = await Image.find(likedImagesQuery, { _id: 1, title: 1, likes: 1 }).lean();
    
    // 检查 likes 数组中的实际内容
    const likedImagesDetails = likedImages.map(img => {
      const matchingLikes = img.likes.filter(like => {
        const likeStr = like.toString();
        return likeStr === userIdString || likeStr === validUserId.toString();
      });
      return {
        imageId: img._id.toString(),
        title: img.title || "无标题",
        allLikes: img.likes ? img.likes.map(l => l.toString()) : [],
        matchingLikes: matchingLikes.map(l => l.toString())
      };
    });

    // 4. 查询音乐和视频
    const userMusic = await Music.find({ author: validUserId }, { _id: 1, likes: 1, title: 1 }).lean();
    const userVideos = await Video.find({ author: validUserId }, { _id: 1, likes: 1, title: 1 }).lean();
    
    const musicLikes = userMusic.reduce((total, m) => total + (Array.isArray(m.likes) ? m.likes.length : 0), 0);
    const videoLikes = userVideos.reduce((total, v) => total + (Array.isArray(v.likes) ? v.likes.length : 0), 0);

    // 5. 查询评论
    const commentsCount = await Comment.countDocuments({ userId: validUserId });

    // 6. 查询用户点赞的音乐和视频
    const likedMusic = await Music.find({
      $or: [
        { likes: validUserId },
        { likes: userIdString }
      ]
    }, { _id: 1, title: 1 }).lean();

    const likedVideos = await Video.find({
      $or: [
        { likes: validUserId },
        { likes: userIdString }
      ]
    }, { _id: 1, title: 1 }).lean();

    return NextResponse.json({
      user: {
        _id: user._id.toString(),
        username: user.username,
        userIdString,
        validUserId: validUserId.toString()
      },
      queries: {
        imagesByUserId: {
          query: imageQuery1,
          count: images1.length,
          sample: images1.slice(0, 3).map(img => ({
            _id: img._id.toString(),
            userId: img.userId,
            user: img.user ? img.user.toString() : null
          }))
        },
        imagesByUserObjectId: {
          query: imageQuery2,
          count: images2.length,
          sample: images2.slice(0, 3).map(img => ({
            _id: img._id.toString(),
            userId: img.userId,
            user: img.user ? img.user.toString() : null
          }))
        },
        imagesByBoth: {
          query: imageQueryBoth,
          count: imagesBoth.length
        }
      },
      stats: {
        worksCount: {
          images: imagesBoth.length,
          music: userMusic.length,
          videos: userVideos.length,
          total: imagesBoth.length + userMusic.length + userVideos.length
        },
        likesReceived: {
          images: totalImageLikes,
          music: musicLikes,
          videos: videoLikes,
          total: totalImageLikes + musicLikes + videoLikes
        },
        favoritesCount: {
          images: likedImages.length,
          music: likedMusic.length,
          videos: likedVideos.length,
          total: likedImages.length + likedMusic.length + likedVideos.length
        },
        commentsCount
      },
      details: {
        imageLikesDetails: imageLikesDetails.slice(0, 10), // 只显示前10个
        likedImagesDetails: likedImagesDetails.slice(0, 10),
        sampleLikedImage: likedImages.length > 0 ? {
          imageId: likedImages[0]._id.toString(),
          allLikes: likedImages[0].likes ? likedImages[0].likes.map(l => l.toString()) : [],
          userIdString,
          validUserIdString: validUserId.toString(),
          matches: likedImages[0].likes ? likedImages[0].likes.some(l => {
            const likeStr = l.toString();
            return likeStr === userIdString || likeStr === validUserId.toString();
          }) : false
        } : null
      }
    });

  } catch (error) {
    console.error("[debug/user-stats] error:", error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}

