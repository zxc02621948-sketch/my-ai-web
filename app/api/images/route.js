// app/api/images/route.js
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

/**
 * sort：
 * popular(預設) | newest | oldest | mostLikes | random | hybrid
 * hybrid = 置頂最新 N 張，其餘隨機
 *
 * debug：
 * ?debug=1 時 popular 會回傳 score/clicksNum/likesNum/compNum/timeBoost 等欄位
 */
export async function GET(req) {
  try {
    await dbConnect();

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(url.searchParams.get("limit") || "24", 10));
    const sort = (url.searchParams.get("sort") || "popular").toLowerCase();
    const pinRecent = Math.max(0, parseInt(url.searchParams.get("pinRecent") || "6", 10));
    const debug = url.searchParams.get("debug") === "1";

    const match = {}; // 之後可加入你的篩選條件

    // --- 基本幾種排序 ---
    if (sort === "newest") {
      const docs = await Image.find(match)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
      return NextResponse.json({ images: decorate(docs) });
    }

    if (sort === "oldest") {
      const docs = await Image.find(match)
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
      return NextResponse.json({ images: decorate(docs) });
    }

    if (sort === "mostlikes") {
      const docs = await Image.aggregate([
        { $match: match },
        {
          $addFields: {
            likesCount: {
              $cond: [
                { $eq: [{ $type: "$likes" }, "array"] },
                { $size: "$likes" },
                {
                  $toDouble: {
                    $convert: { input: "$likes", to: "double", onError: 0, onNull: 0 },
                  },
                },
              ],
            },
          },
        },
        { $sort: { likesCount: -1, createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
      ]);
      return NextResponse.json({ images: decorate(docs) });
    }

    if (sort === "random") {
      const docs = await Image.aggregate([{ $match: match }, { $sample: { size: limit } }]);
      return NextResponse.json({ images: decorate(docs) });
    }

    if (sort === "hybrid") {
      const pinned = await Image.find(match).sort({ createdAt: -1 }).limit(pinRecent).lean();
      const excludeIds = pinned.map((d) => new mongoose.Types.ObjectId(d._id));
      const remain = Math.max(0, limit - pinned.length);
      const randoms = remain
        ? await Image.aggregate([
            { $match: { ...match, _id: { $nin: excludeIds } } },
            { $sample: { size: remain } },
          ])
        : [];
      return NextResponse.json({ images: decorate([...pinned, ...randoms]) });
    }

    // --- popular（預設）：加權分數 + debug 開關 ---
    const W_CLICK = 1.0;
    const W_LIKE = 2.0;
    const W_COMPLETE = 0.05; // completenessScore 0~100 => 0~5 分
    const TIMEBOOST_MAX = 10;
    const now = new Date();

    const pipeline = [
      { $match: match },
      // 統一型別
      {
        $addFields: {
          clicksNum: {
            $cond: [
              { $eq: [{ $type: "$clicks" }, "array"] },
              { $size: "$clicks" },
              {
                $toDouble: {
                  $convert: { input: "$clicks", to: "double", onError: 0, onNull: 0 },
                },
              },
            ],
          },
          likesNum: {
            $cond: [
              { $eq: [{ $type: "$likes" }, "array"] },
              { $size: "$likes" },
              {
                $toDouble: {
                  $convert: { input: "$likes", to: "double", onError: 0, onNull: 0 },
                },
              },
            ],
          },
          compNum: {
            $toDouble: {
              $convert: { input: "$completenessScore", to: "double", onError: 0, onNull: 0 },
            },
          },
          _createdAt: { $ifNull: ["$createdAt", now] },
        },
      },
      // 時間衰減
      {
        $addFields: {
          hoursSince: { $divide: [{ $subtract: [now, "$_createdAt"] }, 1000 * 60 * 60] },
          timeBoost: {
            $max: [0, { $subtract: [TIMEBOOST_MAX, { $divide: [{ $subtract: [now, "$_createdAt"] }, 1000 * 60 * 60] }] }],
          },
        },
      },
      // 加權分數
      {
        $addFields: {
          score: {
            $add: [
              { $multiply: ["$clicksNum", W_CLICK] },
              { $multiply: ["$likesNum", W_LIKE] },
              { $multiply: ["$compNum", W_COMPLETE] },
              "$timeBoost",
            ],
          },
        },
      },
      { $sort: { score: -1, _createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ];

    // 沒開 debug 就把內部欄位遮掉
    if (!debug) {
      pipeline.push({
        $project: {
          clicksNum: 0,
          likesNum: 0,
          compNum: 0,
          hoursSince: 0,
          timeBoost: 0,
          score: 0,
        },
      });
    }

    const docs = await Image.aggregate(pipeline);
    return NextResponse.json({ images: decorate(docs), debug });
  } catch (error) {
    console.error("❌ 無法取得圖片列表", error);
    return new NextResponse("Failed to fetch images", { status: 500 });
  }
}

function decorate(raw = []) {
  return raw.map((img) => ({
    ...img,
    author: typeof img.author === "string" ? img.author : "",
    imageUrl:
      img.imageUrl ||
      (img.imageId
        ? `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${img.imageId}/public`
        : ""),
  }));
}
