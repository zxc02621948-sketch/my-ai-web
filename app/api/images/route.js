// app/api/images/route.js
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

/**
 * 支援參數：
 * - page, limit, sort = popular|newest|oldest|mostLikes|random|hybrid
 * - q = 關鍵字（title/tags/description/prompts/作者名）
 * - categories = 逗號分隔（例：女孩,建築）
 * - ratings    = 逗號分隔（例：all,15,18；不帶則預設排除 18）
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

    // 關鍵字
    const qRaw = (url.searchParams.get("q") || "").trim();
    const qRegex = qRaw ? new RegExp(qRaw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;

    // 分類
    const categoriesParam = (url.searchParams.get("categories") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // 分級（不帶 -> 預設排除 18）
    const ratingsParam = (url.searchParams.get("ratings") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const match = {};
    if (categoriesParam.length) {
      match.category = { $in: categoriesParam };
    }
    if (ratingsParam.length) {
      match.rating = { $in: ratingsParam };
    } else {
      // 與前端原本邏輯一致：未選任何分級時，排除 18
      match.rating = { $ne: "18" };
    }

    const skip = (page - 1) * limit;
    const usersColl = mongoose.model("User").collection.name;

    // 搜尋條件（需先 lookup 取得 user.username）
    const searchMatch = qRegex
      ? {
          $or: [
            { title: { $regex: qRegex } },
            { description: { $regex: qRegex } },
            { positivePrompt: { $regex: qRegex } },
            { negativePrompt: { $regex: qRegex } },
            { tags: { $elemMatch: { $regex: qRegex } } },
            { "user.username": { $regex: qRegex } },
          ],
        }
      : null;

    const projectBase = {
      title: 1,
      imageId: 1,
      imageUrl: 1,
      category: 1,
      rating: 1,
      tags: 1,
      likes: 1,
      createdAt: 1,
      user: 1,
      userId: 1,
      description: 1,
      positivePrompt: 1,
      negativePrompt: 1,
    };

    const findAndPopulate = async (query) => {
      const docs = await query.populate("user", "username image").lean();
      return docs;
    };

    const lookupUser = [
      {
        $lookup: {
          from: usersColl,
          localField: "user",
          foreignField: "_id",
          as: "userObj",
          pipeline: [{ $project: { username: 1, image: 1 } }],
        },
      },
      {
        $addFields: {
          user: {
            $cond: [
              { $gt: [{ $size: "$userObj" }, 0] },
              { $arrayElemAt: ["$userObj", 0] },
              "$user",
            ],
          },
        },
      },
      { $project: { userObj: 0 } },
    ];

    // ===== newest =====
    if (sort === "newest") {
      if (!qRegex) {
        const docs = await findAndPopulate(
          Image.find(match).sort({ createdAt: -1 }).skip(skip).limit(limit)
        );
        return NextResponse.json({ images: decorate(docs) });
      }
      const docs = await Image.aggregate([
        { $match: match },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        { $project: projectBase },
        ...lookupUser,
        { $match: searchMatch },
      ]);
      return NextResponse.json({ images: decorate(docs) });
    }

    // ===== oldest =====
    if (sort === "oldest") {
      if (!qRegex) {
        const docs = await findAndPopulate(
          Image.find(match).sort({ createdAt: 1 }).skip(skip).limit(limit)
        );
        return NextResponse.json({ images: decorate(docs) });
      }
      const docs = await Image.aggregate([
        { $match: match },
        { $sort: { createdAt: 1 } },
        { $skip: skip },
        { $limit: limit },
        { $project: projectBase },
        ...lookupUser,
        { $match: searchMatch },
      ]);
      return NextResponse.json({ images: decorate(docs) });
    }

    // ===== mostLikes =====
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
        { $skip: skip },
        { $limit: limit },
        { $project: { ...projectBase, likesCount: 1 } },
        ...lookupUser,
        ...(searchMatch ? [{ $match: searchMatch }] : []),
      ]);
      return NextResponse.json({ images: decorate(docs) });
    }

    // ===== random =====
    if (sort === "random") {
      // 有搜尋：先篩再抽樣
      if (searchMatch) {
        const docs = await Image.aggregate([
          { $match: match },
          { $project: projectBase },
          ...lookupUser,
          { $match: searchMatch },
          { $sample: { size: limit } },
        ]);
        return NextResponse.json({ images: decorate(docs) });
      }
      const docs = await Image.aggregate([
        { $match: match },
        { $sample: { size: limit } },
        { $project: projectBase },
        ...lookupUser,
      ]);
      return NextResponse.json({ images: decorate(docs) });
    }

    // ===== hybrid（置頂最新 N 張 + 其餘隨機）=====
    if (sort === "hybrid") {
      // 有搜尋：回退為 newest 搜尋
      if (searchMatch) {
        const docs = await Image.aggregate([
          { $match: match },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          { $project: projectBase },
          ...lookupUser,
          { $match: searchMatch },
        ]);
        return NextResponse.json({ images: decorate(docs) });
      }

      const pinned = await Image.find(match)
        .sort({ createdAt: -1 })
        .limit(pinRecent)
        .populate("user", "username image")
        .lean();

      const excludeIds = pinned.map((d) => new mongoose.Types.ObjectId(d._id));
      const remain = Math.max(0, limit - pinned.length);

      let randoms = [];
      if (remain > 0) {
        randoms = await Image.aggregate([
          { $match: { ...match, _id: { $nin: excludeIds } } },
          { $sample: { size: remain } },
          { $project: projectBase },
          ...lookupUser,
        ]);
      }

      return NextResponse.json({ images: decorate([...pinned, ...randoms]) });
    }

    // ===== popular（預設）=====
    const W_CLICK = 1.0;
    const W_LIKE = 2.0;
    const W_COMPLETE = 0.05;
    const TIMEBOOST_MAX = 10;
    const now = new Date();

    const docs = await Image.aggregate([
      { $match: match },
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
      {
        $addFields: {
          hoursSince: { $divide: [{ $subtract: [now, "$_createdAt"] }, 1000 * 60 * 60] },
          timeBoost: {
            $max: [
              0,
              {
                $subtract: [
                  TIMEBOOST_MAX,
                  { $divide: [{ $subtract: [now, "$_createdAt"] }, 1000 * 60 * 60] },
                ],
              },
            ],
          },
        },
      },
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
      { $skip: skip },
      { $limit: limit },
      { $project: projectBase, ...(debug ? { score: 1, clicksNum: 1, likesNum: 1, compNum: 1, hoursSince: 1, timeBoost: 1 } : {}) },
      ...lookupUser,
      ...(searchMatch ? [{ $match: searchMatch }] : []),
      ...(!debug ? [{ $unset: ["clicksNum", "likesNum", "compNum", "hoursSince", "timeBoost", "score"] }] : []),
    ]);

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
