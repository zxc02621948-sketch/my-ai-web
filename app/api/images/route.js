// ✅ 讓 Vercel 優先用 Node 環境 + 靠近 Atlas 的節點（改成你 MongoDB 的區域）
export const runtime = "nodejs";
export const preferredRegion = ["hnd1"]; // 東京 → 如果你的 Atlas 在新加坡改成 ["sin1"]

import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

// ✅ HEAD: 用於預熱（連 DB 後回 204）
export async function HEAD(req) {
  try {
    await dbConnect();
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}

export async function GET(req) {
  try {
    // 🛡️ 復用已建立的連線，避免每次 cold start 重連
    await dbConnect();

    const url = new URL(req.url);

    // ✅ 可選：雲端 ping /api/images?warm=1 預熱，讓 Serverless 保持熱機
    if (url.searchParams.get("warm") === "1") {
      return new NextResponse(null, { status: 204 });
    }

    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(url.searchParams.get("limit") || "24", 10));
    const sort = (url.searchParams.get("sort") || "popular").toLowerCase();
    const pinRecent = Math.max(0, parseInt(url.searchParams.get("pinRecent") || "6", 10));
    const debug = url.searchParams.get("debug") === "1";

    const q = (url.searchParams.get("search") || "").trim();
    const qRegex = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;

    const categoriesParam = (url.searchParams.get("categories") || "")
      .split(",").map((s) => s.trim()).filter(Boolean);
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
      _id: 1,
      title: 1,
      description: 1,
      positivePrompt: 1,
      negativePrompt: 1,
      tags: 1,
      category: 1,
      rating: 1,
      createdAt: 1,
      likes: 1,
      popScore: 1,
      imageUrl: 1,
      imageId: 1,
      userId: 1,
    };

    const lookupUser = [
      {
        $lookup: {
          from: usersColl,
          localField: "userId",
          foreignField: "_id",
          as: "user",
          pipeline: [{ $project: { _id: 1, username: 1, image: 1 } }],
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    ];

    const decorate = (docs) =>
      (docs || []).map((img) => ({
        ...img,
        likesCount: Array.isArray(img.likes) ? img.likes.length : 0,
        user: img.user || null,
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
        { $project: projectBase },
        ...lookupUser,
        { $match: searchMatch },
        { $sort: { createdAt: -1 } },
        { $skip: skip }, { $limit: limit },
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
        { $project: projectBase },
        ...lookupUser,
        { $match: searchMatch },
        { $sort: { createdAt: 1 } },
        { $skip: skip }, { $limit: limit },
      ]);
      return NextResponse.json({ images: decorate(docs) });
    }

    // ===== mostLikes =====
    if (sort === "mostlikes") {
      const docs = await Image.aggregate([
        { $match: match },
        { $project: { 
            ...projectBase,
            likesCount: { $size: { $ifNull: ["$likes", []] } }
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

    // ===== hybrid =====
    if (sort === "hybrid") {
      if (searchMatch) {
        const docs = await Image.aggregate([
          { $match: match },
          { $project: projectBase },
          ...lookupUser,
          { $match: searchMatch },
          { $sort: { createdAt: -1 } },
          { $skip: skip }, { $limit: limit },
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

    // ===== popular =====
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
