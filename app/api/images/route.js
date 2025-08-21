// /app/api/images/route.js
export const runtime = "nodejs";
export const preferredRegion = ["hnd1"];
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";

const bool = (v) => v === true || v === "1" || v === "true";

// ============== 一鍵遷移（保留原功能） ==============
async function migrateUserIdStringsToObjectIds({ dryRun = false } = {}) {
  const col = mongoose.connection.collection("images");

  const typeStats = await col
    .aggregate([{ $project: { t: { $type: "$userId" } } }, { $group: { _id: "$t", n: { $sum: 1 } } }])
    .toArray();

  const filterStringUserId = { $expr: { $eq: [{ $type: "$userId" }, "string"] } };
  const toConvertCount = await col.countDocuments(filterStringUserId);

  if (dryRun) {
    return {
      dryRun: true,
      typeStats,
      toConvertCount,
      updatedCount: 0,
      note: "這是模擬（dry=1），未對資料做任何修改。",
    };
  }

  const r1 = await col.updateMany(filterStringUserId, [{ $set: { userId: { $toObjectId: "$userId" } } }]);
  const r2 = await col.updateMany(
    { $or: [{ user: { $exists: false } }, { user: null }], userId: { $type: "objectId" } },
    [{ $set: { user: "$userId" } }]
  );

  return {
    dryRun: false,
    typeStats,
    toConvertCount,
    updatedCount: (r1.modifiedCount || 0) + (r2.modifiedCount || 0),
    modifiedUserId: r1.modifiedCount || 0,
    filledUserFromUserId: r2.modifiedCount || 0,
    note: "已完成遷移：userId 字串已轉 ObjectId，並補 user 欄位（若原本不存在）。",
  };
}

export async function HEAD() {
  try { await dbConnect(); } catch {}
  return new NextResponse(null, { status: 204 });
}

export async function GET(req) {
  try {
    await dbConnect();

    const url = new URL(req.url);

    // 遷移入口：/api/images?migrate=1（可加 &dry=1）
    if (url.searchParams.get("migrate") === "1") {
      const dryRun = bool(url.searchParams.get("dry"));
      const result = await migrateUserIdStringsToObjectIds({ dryRun });
      return NextResponse.json(result);
    }

    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(url.searchParams.get("limit") || "24", 10));
    const sort = (url.searchParams.get("sort") || "popular").toLowerCase();
    const pinRecent = Math.max(0, parseInt(url.searchParams.get("pinRecent") || "6", 10));

    const q = (url.searchParams.get("search") || "").trim();
    const qRegex = q ? new RegExp(q.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i") : null;

    const categoriesParam = (url.searchParams.get("categories") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // -------- ratings 安全解析（加強版）--------
    const parseCSV = (v) => {
      if (!v) return [];
      if (Array.isArray(v)) return v.map(String).map(s => s.trim()).filter(Boolean);
      return String(v).split(",").map(s => s.trim()).filter(Boolean);
    };

    // 白名單；含 all → 視為 ["all"]（不套任何過濾）；忽略 15:1 / 18=true 等雜訊
    function normalizeRatings(tokens) {
      const ALLOWED = new Set(["15", "18", "sfw", "nsfw", "all"]);
      const clean = tokens
        .filter(t => !t.includes(":") && !t.includes("="))
        .map(t => t.toLowerCase())
        .filter(t => ALLOWED.has(t));
      if (clean.includes("all")) return ["all"]; // 核心：有 all 就只保留 all
      return Array.from(new Set(clean));
    }

    const inIf = (arr) => (Array.isArray(arr) && arr.length > 0) ? { $in: arr } : undefined;

    const ratingsRawStr = url.searchParams.get("ratings") || "";
    const hasRatingsParam = url.searchParams.has("ratings");

    // ---- 建 where ----
    const match = {};
    if (categoriesParam.length) match.category = { $in: categoriesParam };

    // ratings 解析（try/catch：任何異常一律略過分級過濾，以避免 500）
    try {
      const ratingsTokens = parseCSV(ratingsRawStr);
      const ratingsParam = normalizeRatings(ratingsTokens);

      if (ratingsParam.length === 1 && ratingsParam[0] === "all") {
        // 不加 rating 過濾
      } else if (ratingsParam.length) {
        match.rating = inIf(ratingsParam); // 例如 { $in: ['15','18'] }
      } else if (!hasRatingsParam) {
        // 完全沒帶 ratings 參數：保留原預設 → 排除 18
        match.rating = { $ne: "18" };
      }
      // 若有帶 ratings 但最後是空（例如全是雜訊）→ 不加任何 rating 過濾
    } catch (e) {
      console.warn("ratings-parse-safe-fallback:", e?.message || e);
      // 出現任何解析異常 → 不加 rating 過濾（避免 500）
    }

    const skip = (page - 1) * limit;
    const usersColl = mongoose.model("User").collection.name;

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
      likesCount: 1,
      popScore: 1,
      imageUrl: 1,
      imageId: 1,
      userId: 1,
      user: 1,

      platform: 1,
      modelName: 1,
      modelLink: 1,
      modelHash: 1,
      loraName: 1,
      loraLink: 1,
      author: 1,

      sampler: 1,
      steps: 1,
      cfgScale: 1,
      seed: 1,
      clipSkip: 1,
      width: 1,
      height: 1,
    };

    const addUserRef = {
      $addFields: {
        userRef: {
          $switch: {
            branches: [
              { case: { $eq: [{ $type: "$user" }, "objectId"] }, then: "$user" },
              { case: { $eq: [{ $type: "$userId" }, "objectId"] }, then: "$userId" },
              { case: { $eq: [{ $type: "$userId" }, "string"] }, then: { $toObjectId: "$userId" } },
            ],
            default: null,
          },
        },
      },
    };

    const lookupUser = [
      addUserRef,
      {
        $lookup: {
          from: usersColl,
          localField: "userRef",
          foreignField: "_id",
          as: "user",
          pipeline: [{ $project: { _id: 1, username: 1, image: 1 } }],
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    ];

    const searchMatch = qRegex
      ? {
          $or: [
            { title: { $regex: qRegex } },
            { description: { $regex: qRegex } },
            { positivePrompt: { $regex: qRegex } },
            { negativePrompt: { $regex: qRegex } },
            { tags: { $elemMatch: { $regex: qRegex } } },
            { "user.username": { $regex: qRegex } },
            { platform: { $regex: qRegex } },
            { modelName: { $regex: qRegex } },
            { loraName: { $regex: qRegex } },
            { author: { $regex: qRegex } },
          ],
        }
      : null;

    const decorate = (docs) =>
      (docs || []).map((img) => {
        const likesCount = Array.isArray(img.likes) ? img.likes.length : img.likesCount || 0;

        let user =
          img.user && typeof img.user === "object"
            ? img.user
            : img.userRef
            ? { _id: img.userRef, username: "" }
            : img.userId
            ? { _id: img.userId, username: "" }
            : null;

        const imageUrl =
          img.imageUrl ||
          (img.imageId
            ? `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${img.imageId}/public`
            : "");

        return { ...img, likesCount, user, imageUrl };
      });

    const base = [{ $match: match }, { $project: projectBase }, ...lookupUser];
    const withSearch = searchMatch ? [...base, { $match: searchMatch }] : base;

    let pipeline;

    switch (sort) {
      case "newest":
        pipeline = [...withSearch, { $sort: { createdAt: -1, _id: -1 } }, { $skip: skip }, { $limit: limit }];
        break;
      case "oldest":
        pipeline = [...withSearch, { $sort: { createdAt: 1, _id: 1 } }, { $skip: skip }, { $limit: limit }];
        break;
      case "mostlikes":
        pipeline = [
          ...withSearch,
          { $addFields: { likesCount: { $size: { $ifNull: ["$likes", []] } } } },
          { $sort: { likesCount: -1, createdAt: -1, _id: -1 } },
          { $skip: skip },
          { $limit: limit },
        ];
        break;
      case "random":
        pipeline = [...withSearch, { $sample: { size: limit } }];
        break;
      case "hybrid": {
        const pinned = await Image.aggregate([
          ...withSearch,
          { $sort: { createdAt: -1, _id: -1 } },
          { $limit: Math.max(0, pinRecent) },
        ]);
        const excludeIds = pinned.map((d) => d._id);
        const remain = Math.max(0, limit - pinned.length);
        let randoms = [];
        if (remain > 0) {
          randoms = await Image.aggregate([
            { $match: { ...match, _id: { $nin: excludeIds } } },
            { $project: projectBase },
            ...lookupUser,
            ...(searchMatch ? [{ $match: searchMatch }] : []),
            { $sample: { size: remain } },
          ]);
        }
        return NextResponse.json({ images: decorate([...pinned, ...randoms]) }, { headers: { "Cache-Control": "no-store" } });
      }
      default: // popular
        pipeline = [...withSearch, { $sort: { popScore: -1, createdAt: -1, _id: -1 } }, { $skip: skip }, { $limit: limit }];
        break;
    }

    const docs = await Image.aggregate(pipeline);
    return NextResponse.json({ images: decorate(docs) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("❌ /api/images 失敗：", err);
    return new NextResponse("Failed to fetch images", { status: 500 });
  }
}
