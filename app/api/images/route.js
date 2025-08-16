// /app/api/images/route.js
export const runtime = "nodejs";
export const preferredRegion = ["hnd1"]; // 依你的 DB 區域調整
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";

// 小工具
const bool = (v) => v === true || v === "1" || v === "true";

// ============== A) 一鍵遷移：把 userId: string -> ObjectId，並補 user 欄位 ==============
async function migrateUserIdStringsToObjectIds({ dryRun = false } = {}) {
  const col = mongoose.connection.collection("images");

  // 型別統計
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

  // 1) userId 字串 → ObjectId
  const r1 = await col.updateMany(filterStringUserId, [{ $set: { userId: { $toObjectId: "$userId" } } }]);

  // 2) 若沒有 user 欄位，補上 user = userId（ObjectId）
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

// =============================== API ===============================

export async function HEAD() {
  try {
    await dbConnect();
  } catch {}
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
    const ratingsParam = (url.searchParams.get("ratings") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const match = {};
    if (categoriesParam.length) match.category = { $in: categoriesParam };
    if (ratingsParam.length) match.rating = { $in: ratingsParam };
    else match.rating = { $ne: "18" };

    const skip = (page - 1) * limit;
    const usersColl = mongoose.model("User").collection.name;

    // —— 基礎輸出欄位（image）——
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
      user: 1, // 兼容已有 populate 的狀況

      // 右側欄會顯示的欄位
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

    // —— 一律統一 user 連結：先產生 userRef（支援 user/objectId 與 userId/string）——
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
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } }, // 不丟資料
    ];

    // —— 搜尋條件（含 user.username）——
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

    // —— 輸出前裝飾：likesCount / imageUrl / user fallback —— 
    const decorate = (docs) =>
      (docs || []).map((img) => {
        const likesCount = Array.isArray(img.likes) ? img.likes.length : img.likesCount || 0;

        // user 物件優先；其餘情況用 userRef 或 userId 給最小物件，避免前端出現「未命名」
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

    // —— 共用 base pipeline —— 
    const base = [{ $match: match }, { $project: projectBase }, ...lookupUser];
    const withSearch = searchMatch ? [...base, { $match: searchMatch }] : base;

    // —— 統一：首頁（無搜尋）與搜尋都走 aggregate —— 
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
        // 置頂最新 pinRecent，剩餘用隨機補
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
        return NextResponse.json({ images: decorate([...pinned, ...randoms]) });
      }
      default: // popular
        pipeline = [...withSearch, { $sort: { popScore: -1, createdAt: -1, _id: -1 } }, { $skip: skip }, { $limit: limit }];
        break;
    }

    const docs = await Image.aggregate(pipeline);
    return NextResponse.json({ images: decorate(docs) });
  } catch (err) {
    console.error("❌ /api/images 失敗：", err);
    return new NextResponse("Failed to fetch images", { status: 500 });
  }
}
