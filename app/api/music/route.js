import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Music from "@/models/Music";
import {
  ensureMusicLikesCount,
  computeMusicInitialBoostDecay,
} from "@/utils/scoreMusic";

// 熱門度計算常數（音樂系統：播放分已包含點擊分）
const POP_W_LIKE = 8.0;
const POP_W_PLAY = 1.0; // 播放分與點擊分合併：播放計數 = 1次 = 1分
const POP_W_COMPLETE = 0.25;
const POP_NEW_WINDOW_HOURS = 10;

export async function GET(request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 20;
    const sort = (searchParams.get("sort") || "popular").toLowerCase();
    const useLive = searchParams.get("live") === "1";
    const search = searchParams.get("search") || "";

    // ✅ 新增：篩選參數
    const ratings = searchParams.get("ratings");
    const categories = searchParams.get("categories"); // 曲風
    const types = searchParams.get("types"); // BGM/歌曲
    const languages = searchParams.get("languages"); // 語言

    const skip = (page - 1) * limit;

    // 基礎匹配條件
    const match = { isPublic: true };

    // 搜尋條件
    if (search.trim()) {
      match.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { artist: { $regex: search.trim(), $options: "i" } },
        { album: { $regex: search.trim(), $options: "i" } },
        { tags: { $regex: search.trim(), $options: "i" } },
      ];
    }

    // ✅ 新增：評級篩選
    if (ratings) {
      const ratingList = ratings.split(",").map((rating) => {
        const r = rating.trim();
        // 映射 "一般音樂" -> "all", "15+ 音樂" -> "15", "18+ 音樂" -> "18"
        if (r === "sfw") return "all"; // 向後兼容
        return r;
      });
      match.rating = { $in: ratingList };
    }

    // ✅ 新增：曲風篩選
    if (categories) {
      const categoryList = categories
        .split(",")
        .map((cat) => decodeURIComponent(cat.trim()));
      match.genre = { $in: categoryList };
    }

    // ✅ 新增：音樂類型篩選（BGM/歌曲）
    if (types) {
      const typeList = types
        .split(",")
        .map((t) => decodeURIComponent(t.trim()));
      match.category = { $in: typeList };
    }

    // ✅ 新增：語言篩選
    if (languages) {
      const languageList = languages
        .split(",")
        .map((lang) => decodeURIComponent(lang.trim()));
      match.language = { $in: languageList };
    }

    // 查詢總數
    const total = await Music.countDocuments(match);

    // 根據排序方式建立 pipeline
    let pipeline = [];

    switch (sort) {
      case "newest":
        // 最新音樂
        pipeline = [
          { $match: match },
          { $sort: { createdAt: -1, _id: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "users",
              localField: "author",
              foreignField: "_id",
              as: "author",
              pipeline: [
                {
                  $project: {
                    _id: 1,
                    username: 1,
                    avatar: 1,
                    currentFrame: 1,
                    frameSettings: 1,
                  },
                },
              ],
            },
          },
          { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
        ];
        break;

      case "oldest":
        // 最舊音樂
        pipeline = [
          { $match: match },
          { $sort: { createdAt: 1, _id: 1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "users",
              localField: "author",
              foreignField: "_id",
              as: "author",
              pipeline: [
                {
                  $project: {
                    _id: 1,
                    username: 1,
                    avatar: 1,
                    currentFrame: 1,
                    frameSettings: 1,
                  },
                },
              ],
            },
          },
          { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
        ];
        break;

      case "mostlikes":
        // 最多愛心
        pipeline = [
          { $match: match },
          {
            $addFields: {
              likesCount: {
                $cond: [
                  { $isArray: "$likes" },
                  { $size: { $ifNull: ["$likes", []] } },
                  { $ifNull: ["$likesCount", 0] },
                ],
              },
            },
          },
          { $sort: { likesCount: -1, createdAt: -1, _id: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "users",
              localField: "author",
              foreignField: "_id",
              as: "author",
              pipeline: [
                {
                  $project: {
                    _id: 1,
                    username: 1,
                    avatar: 1,
                    currentFrame: 1,
                    frameSettings: 1,
                  },
                },
              ],
            },
          },
          { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
        ];
        break;

      case "mostplays":
        // 最多播放
        pipeline = [
          { $match: match },
          { $sort: { plays: -1, createdAt: -1, _id: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "users",
              localField: "author",
              foreignField: "_id",
              as: "author",
              pipeline: [
                {
                  $project: {
                    _id: 1,
                    username: 1,
                    avatar: 1,
                    currentFrame: 1,
                    frameSettings: 1,
                  },
                },
              ],
            },
          },
          { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
        ];
        break;

      case "random":
        // 隨機音樂
        pipeline = [
          { $match: match },
          { $sample: { size: limit } },
          {
            $lookup: {
              from: "users",
              localField: "author",
              foreignField: "_id",
              as: "author",
              pipeline: [
                {
                  $project: {
                    _id: 1,
                    username: 1,
                    avatar: 1,
                    currentFrame: 1,
                    frameSettings: 1,
                  },
                },
              ],
            },
          },
          { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
        ];
        break;

      case "hybrid": {
        // 混排（前幾張最新 + 隨機）
        const pinRecent = Math.min(5, Math.floor(limit * 0.25)); // 前 25%，最多 5 張
        const pinned = await Music.aggregate([
          { $match: match },
          { $sort: { createdAt: -1, _id: -1 } },
          { $limit: pinRecent },
          {
            $lookup: {
              from: "users",
              localField: "author",
              foreignField: "_id",
              as: "author",
              pipeline: [
                {
                  $project: {
                    _id: 1,
                    username: 1,
                    avatar: 1,
                    currentFrame: 1,
                    frameSettings: 1,
                  },
                },
              ],
            },
          },
          { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
        ]);
        
        const excludeIds = pinned.map((d) => d._id);
        const remain = Math.max(0, limit - pinned.length);
        let randoms = [];
        
        if (remain > 0) {
          randoms = await Music.aggregate([
            { $match: { ...match, _id: { $nin: excludeIds } } },
            { $sample: { size: remain } },
            {
              $lookup: {
                from: "users",
                localField: "author",
                foreignField: "_id",
                as: "author",
                pipeline: [
                  {
                    $project: {
                      _id: 1,
                      username: 1,
                      avatar: 1,
                      currentFrame: 1,
                      frameSettings: 1,
                    },
                  },
                ],
              },
            },
            { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
          ]);
        }
        
        const merged = [...pinned, ...randoms];
        return NextResponse.json(
          {
            success: true,
            music: merged,
            total: await Music.countDocuments(match),
          },
          { headers: { "Cache-Control": "no-store" } }
        );
      }

      default:
        pipeline = [
          { $match: match },
          { $sort: { popScore: -1, createdAt: -1, _id: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "users",
              localField: "author",
              foreignField: "_id",
              as: "author",
              pipeline: [
                {
                  $project: {
                    _id: 1,
                    username: 1,
                    avatar: 1,
                    currentFrame: 1,
                    frameSettings: 1,
                  },
                },
              ],
            },
          },
          { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
        ];
        break;
    }

    const music = pipeline.length > 0
      ? await Music.aggregate(pipeline)
      : await Music.find(match)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

    // ✅ 將音樂 URL 轉換為串流 API URL
    const musicWithStreamUrl = music.map((item) => ({
      ...item,
      musicUrl: `/api/music/stream/${item._id}`,
    }));

    return NextResponse.json({
      success: true,
      music: musicWithStreamUrl,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("載入音樂失敗:", error);
    return NextResponse.json({ error: "載入音樂失敗" }, { status: 500 });
  }
}
