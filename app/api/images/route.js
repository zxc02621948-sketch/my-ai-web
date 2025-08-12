// app/api/images/route.js
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

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
      .split(",").map((s) => s.trim()).filter(Boolean);

    // 分級（不帶 -> 預設排除 18）
    const ratingsParam = (url.searchParams.get("ratings") || "")
      .split(",").map((s) => s.trim()).filter(Boolean);

    const match = {};
    if (categoriesParam.length) match.category = { $in: categoriesParam };
    if (ratingsParam.length) match.rating = { $in: ratingsParam };
    else match.rating = { $ne: "18" };

    const skip = (page - 1) * limit;
    const usersColl = mongoose.model("User").collection.name;

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
      likesCount: 1,
      clicks: 1,
      completenessScore: 1,
      popScore: 1,
      createdAt: 1,
      user: 1,
      userId: 1,
      description: 1,
      positivePrompt: 1,
      negativePrompt: 1,
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

    const decorate = (raw = []) =>
      raw.map((img) => ({
        ...img,
        author: typeof img.author === "string" ? img.author : "",
        imageUrl:
          img.imageUrl ||
          (img.imageId
            ? `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${img.imageId}/public`
            : ""),
      }));

    // ===== newest =====
    if (sort === "newest") {
      if (!qRegex) {
        const docs = await Image.find(match).sort({ createdAt: -1 }).skip(skip).limit(limit)
          .populate("user", "username image").lean();
        return NextResponse.json({ images: decorate(docs) });
      }
      const docs = await Image.aggregate([
        { $match: match },
        { $sort: { createdAt: -1 } },
        { $skip: skip }, { $limit: limit },
        { $project: projectBase },
        ...lookupUser,
        { $match: searchMatch },
      ]);
      return NextResponse.json({ images: decorate(docs) });
    }

    // ===== oldest =====
    if (sort === "oldest") {
      if (!qRegex) {
        const docs = await Image.find(match).sort({ createdAt: 1 }).skip(skip).limit(limit)
          .populate("user", "username image").lean();
        return NextResponse.json({ images: decorate(docs) });
      }
      const docs = await Image.aggregate([
        { $match: match },
        { $sort: { createdAt: 1 } },
        { $skip: skip }, { $limit: limit },
        { $project: projectBase },
        ...lookupUser,
        { $match: searchMatch },
      ]);
      return NextResponse.json({ images: decorate(docs) });
    }

    // ===== mostLikes =====（直接用 likesCount）
    if (sort === "mostlikes") {
      const docs = await Image.aggregate([
        { $match: match },
        { $project: { 
            ...projectBase,
            likesCount: { $size: { $ifNull: ["$likes", []] } }  // ✅ 永遠以 likes 陣列計算
          } 
        },
        ...lookupUser,
        ...(searchMatch ? [{ $match: searchMatch }] : []),
        { $sort: { likesCount: -1, createdAt: -1 } },
        { $skip: skip }, { $limit: limit },
      ]);
      return NextResponse.json({ images: decorate(docs) });
    }

    // ===== random =====
    if (sort === "random") {
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
      if (searchMatch) {
        const docs = await Image.aggregate([
          { $match: match },
          { $sort: { createdAt: -1 } },
          { $skip: skip }, { $limit: limit },
          { $project: projectBase },
          ...lookupUser,
          { $match: searchMatch },
        ]);
        return NextResponse.json({ images: decorate(docs) });
      }
      const pinned = await Image.find(match)
        .sort({ createdAt: -1 })
        .limit(pinRecent)
        .populate("user", "username image").lean();

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

    // ===== popular（✅ 用預算分 popScore）=====
    if (!qRegex) {
      const docs = await Image.find(match)
        .sort({ popScore: -1, createdAt: -1, _id: -1 })
        .skip(skip).limit(limit)
        .populate("user", "username image").lean();
      return NextResponse.json({ images: decorate(docs), debug: !!debug });
    }
    const docs = await Image.aggregate([
      { $match: match },
      { $project: projectBase },
      ...lookupUser,
      { $match: searchMatch },
      { $sort: { popScore: -1, createdAt: -1, _id: -1 } },
      { $skip: skip }, { $limit: limit },
    ]);
    return NextResponse.json({ images: decorate(docs), debug: !!debug });
  } catch (error) {
    console.error("❌ 無法取得圖片列表", error);
    return new NextResponse("Failed to fetch images", { status: 500 });
  }
}
