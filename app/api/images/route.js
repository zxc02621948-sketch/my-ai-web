// /app/api/images/route.js
export const runtime = "nodejs";
export const preferredRegion = ["hnd1"];
export const dynamic = "force-dynamic"; // 必須設定為 dynamic 因為使用了 request.url

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import User from "@/models/User";
import { ensureLikesCount, computePopScore } from "@/utils/score";
import { getCurrentUser } from "@/lib/serverAuth";
import { stripComfyIfNotAllowed } from "@/lib/sanitizeComfy";

const bool = (v) => v === true || v === "1" || v === "true";

// ---- 與 utils/score.js 對齊的分數常數（可用環境變數覆蓋；保持正數）----
const toNum = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const POP_W_CLICK = toNum(process.env.POP_W_CLICK, 1.0);
const POP_W_LIKE = toNum(process.env.POP_W_LIKE, 8.0);
const POP_W_COMPLETE = toNum(process.env.POP_W_COMPLETE, 0.05);
const POP_NEW_WINDOW_HOURS = toNum(process.env.POP_NEW_WINDOW_HOURS, 10);

// ============== 一鍵遷移（原樣保留） ==============
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

    // 遷移 / 一鍵補救（原樣保留）
    if (url.searchParams.get("migrate") === "1") {
      const dryRun = bool(url.searchParams.get("dry"));
      const result = await migrateUserIdStringsToObjectIds({ dryRun });
      return NextResponse.json(result);
    }
    if (url.searchParams.get("repairLikes") === "1") {
      const dryRun = url.searchParams.get("dry") === "1";
      let scanned = 0, modified = 0;

      const cursor = Image.find(
        {},
        { likes: 1, likesCount: 1, clicks: 1, completenessScore: 1, initialBoost: 1, createdAt: 1, popScore: 1 }
      ).cursor();

      for await (const img of cursor) {
        scanned++;
        const nextLikesCount = ensureLikesCount(img);
        const nextPop = computePopScore({ ...img.toObject(), likesCount: nextLikesCount });

        const needUpdate =
          (img.likesCount || 0) !== nextLikesCount ||
          (img.popScore || 0) !== nextPop;

        if (needUpdate && !dryRun) {
          img.likesCount = nextLikesCount;
          img.popScore = nextPop;
          await img.save();
        }
        if (needUpdate) modified++;
      }

      return NextResponse.json({ dryRun, scanned, modified, note: "likesCount 與 popScore 已補正（或預覽）。" });
    }

    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.max(1, parseInt(url.searchParams.get("limit") || "24", 10) || 24);
    const sort = (url.searchParams.get("sort") || "popular").toLowerCase();
    const pinRecent = Math.max(0, parseInt(url.searchParams.get("pinRecent") || "6", 10));

    const q = (url.searchParams.get("search") || "").trim();
    const qRegex = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;

    const categoriesParam = (url.searchParams.get("categories") || "")
      .split(",").map((s) => s.trim()).filter(Boolean);

    // ratings（原樣）
    const parseCSV = (v) => {
      if (!v) return [];
      if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
      return String(v).split(",").map((s) => s.trim()).filter(Boolean);
    };
    function normalizeRatings(tokens) {
      const mapOne = (t) => {
        const x = t.toLowerCase();
        if (["sfw", "general", "g", "一般"].includes(x)) return "sfw";
        if (["15", "15+", "r15"].includes(x)) return "15";
        if (["18", "18+", "r18", "nsfw"].includes(x)) return "18";
        return "";
      };
      return Array.from(new Set(tokens.map(mapOne).filter(Boolean)));
    }

    const ratingsParam = normalizeRatings(parseCSV(url.searchParams.get("ratings") || ""));
    const selected = new Set(ratingsParam);

    const match = {};
    if (categoriesParam.length) match.category = { $in: categoriesParam };

    // ✅ 支持 hasMetadata 篩選（用於「作品展示」vs「創作參考」）
    const hasMetadataParam = url.searchParams.get("hasMetadata");
    if (hasMetadataParam === "true") {
      // 使用更智能的質量篩選：只顯示優質圖和標準圖
      match.$or = [
        // 優質圖條件：有模型/LoRA/Prompt 且自動抓取比例高
        {
          $and: [
            { $or: [
              { modelName: { $exists: true, $ne: "", $ne: "(未提供)" } },
              { loraName: { $exists: true, $ne: "", $ne: "(未提供)" } },
              { positivePrompt: { $exists: true, $ne: "", $ne: "(無)" } }
            ]},
            { $or: [
              { steps: { $exists: true, $ne: null } },
              { sampler: { $exists: true, $ne: "" } },
              { cfgScale: { $exists: true, $ne: null } },
              { seed: { $exists: true, $ne: "" } },
              { width: { $exists: true, $ne: null } },
              { height: { $exists: true, $ne: null } }
            ]}
          ]
        }
      ];
    }

    const hasSfw = selected.has("sfw");
    const has15 = selected.has("15");
    const has18 = selected.has("18");
    const applyDefaultGeneralPlus15 = () => { match.rating = { $ne: "18" }; };

    if (!hasSfw && !has15 && !has18) {
      applyDefaultGeneralPlus15();
    } else if (hasSfw && !has15 && !has18) {
      match.rating = { $nin: ["15", "18"] };
    } else if (!hasSfw && has15 && !has18) {
      match.rating = "15";
    } else if (!hasSfw && !has15 && has18) {
      match.rating = "18";
    } else if (hasSfw && has15 && !has18) {
      applyDefaultGeneralPlus15();
    } else if (hasSfw && !has15 && has18) {
      match.$or = [{ rating: { $nin: ["15", "18"] } }, { rating: "18" }];
    } else if (!hasSfw && has15 && has18) {
      match.rating = { $in: ["15", "18"] };
    } else {
      match.$or = [{ rating: { $nin: ["15", "18"] } }, { rating: { $in: ["15", "18"] } }];
    }

    const useLive = url.searchParams.get("live") === "1";
    const skip = (page - 1) * limit;
    const usersColl = mongoose.model("User").collection.name;

    const projectBase = {
      _id: 1, title: 1, description: 1, positivePrompt: 1, negativePrompt: 1, tags: 1, category: 1, rating: 1,
      createdAt: 1, likes: 1, likesCount: 1, popScore: 1, imageUrl: 1, imageId: 1, variant: 1, userId: 1, user: 1,
      platform: 1, modelName: 1, modelLink: 1, modelHash: 1, loraName: 1, loraLink: 1, author: 1,
      sampler: 1, steps: 1, cfgScale: 1, seed: 1, clipSkip: 1, width: 1, height: 1,
      initialBoost: 1, completenessScore: 1, clicks: 1,
      // ⭐ 權力券相關字段
      powerUsed: 1, powerExpiry: 1, powerType: 1, powerUsedAt: 1,
      // ⭐ 會帶出 comfy 與 raw.comfyWorkflowJson，但回傳前會經 stripComfyIfNotAllowed 清掉不該看的
      comfy: 1, "raw.comfyWorkflowJson": 1,
      // ✅ 作品展示/創作參考篩選字段
      hasMetadata: 1,
    }; // ← 這裡原本就有把 comfy 帶出去，需在回傳前清理掉不該看的:contentReference[oaicite:1]{index=1}

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
          pipeline: [{ $project: { _id: 1, username: 1, image: 1, currentFrame: 1, frameSettings: 1 } }],
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    ];

    const qRegexMatch = qRegex
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
    const withSearch = qRegexMatch ? [...base, { $match: qRegexMatch }] : base;

    const calcLive = {
      $addFields: {
        likesCountCalc: {
          $cond: [
            { $isArray: "$likes" },
            { $size: { $ifNull: ["$likes", []] } },
            { $ifNull: ["$likesCount", 0] },
          ],
        },
        // 計算有效的「上架時間」（權力券會重置這個時間）
        effectiveCreatedAt: {
          $cond: [
            {
              $and: [
                { $eq: ["$powerUsed", true] },
                { $ne: [{ $ifNull: ["$powerUsedAt", null] }, null] }
              ]
            },
            "$powerUsedAt",  // 使用過權力券：用權力券時間作為新的上架時間
            "$createdAt"     // 沒用過：用真實上架時間
          ]
        },
        // 統一計算加成（只有一套邏輯）
        hoursElapsed: { $divide: [{ $subtract: ["$$NOW", "$effectiveCreatedAt"] }, 1000 * 60 * 60] },
        boostFactor: { $max: [0, { $subtract: [1, { $divide: ["$hoursElapsed", POP_NEW_WINDOW_HOURS] }] } ] },
        finalBoost: { $round: [{ $multiply: [{ $ifNull: ["$initialBoost", 0] }, "$boostFactor"] }, 1] },
        baseScore: {
          $add: [
            { $multiply: [{ $ifNull: ["$clicks", 0] }, POP_W_CLICK] },
            { $multiply: ["$likesCountCalc", POP_W_LIKE] },
            { $multiply: [{ $ifNull: ["$completenessScore", 0] }, POP_W_COMPLETE] },
          ],
        },
        livePopScore: { $add: ["$baseScore", "$finalBoost"] },
        popScoreDB: { $ifNull: ["$popScore", 0] },
      },
    };

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
            ...(qRegexMatch ? [{ $match: qRegexMatch }] : []),
            { $sample: { size: remain } },
          ]);
        }

        const currentUser = await getCurrentUser().catch(() => null);
        const userId = currentUser?._id || null;
        const isAdmin = !!currentUser?.isAdmin;

        const sanitize = (arr) =>
          arr.map((doc) => {
            const ownerId = doc.user?._id || doc.user || doc.userRef || doc.userId || null;
            const isOwnerOrAdmin = isAdmin || (userId && ownerId && String(userId) === String(ownerId));
            return stripComfyIfNotAllowed(doc, { isOwnerOrAdmin });
          });

        const merged = [...sanitize(pinned), ...sanitize(randoms)];
        return NextResponse.json({ images: decorate(merged) }, { headers: { "Cache-Control": "no-store" } });
      }
      default: {
        // 如果有登入用戶，需要整合曝光分數計算
        const currentUserForExposure = await getCurrentUser().catch(() => null);
        if (currentUserForExposure) {
          const user = await User.findById(currentUserForExposure._id);
          if (user && user.exposureMultiplier > 1.0 && user.exposureExpiry && new Date() < new Date(user.exposureExpiry)) {
            // 用戶有曝光加成，需要重新計算分數
            const exposureCalc = {
              $addFields: {
                exposureBonus: user.exposureBonus || 0,
                exposureMultiplier: user.exposureMultiplier || 1.0,
                finalScore: {
                  $multiply: [
                    { $add: ["$livePopScore", user.exposureBonus || 0] },
                    user.exposureMultiplier || 1.0
                  ]
                }
              }
            };
            
            pipeline = useLive
              ? [...withSearch, calcLive, exposureCalc, { $sort: { finalScore: -1, createdAt: -1, _id: -1 } }, { $skip: skip }, { $limit: limit }]
              : [...withSearch, calcLive, exposureCalc, { $sort: { finalScore: -1, createdAt: -1, _id: -1 } }, { $skip: skip }, { $limit: limit }];
          } else {
            // 沒有曝光加成，使用原本邏輯
            pipeline = useLive
              ? [...withSearch, calcLive, { $sort: { livePopScore: -1, createdAt: -1, _id: -1 } }, { $skip: skip }, { $limit: limit }]
              : [...withSearch, calcLive, { $sort: { popScore: -1, createdAt: -1, _id: -1 } }, { $skip: skip }, { $limit: limit }];
          }
        } else {
          // 未登入用戶，使用原本邏輯
          pipeline = useLive
            ? [...withSearch, calcLive, { $sort: { livePopScore: -1, createdAt: -1, _id: -1 } }, { $skip: skip }, { $limit: limit }]
            : [...withSearch, calcLive, { $sort: { popScore: -1, createdAt: -1, _id: -1 } }, { $skip: skip }, { $limit: limit }];
        }
        break;
      }
    }

    const docs = await Image.aggregate(pipeline);

    // ✅ 在這裡依使用者身分清理 Comfy JSON（遊客只看得到公開）
    const currentUser = await getCurrentUser().catch(() => null);
    const userId = currentUser?._id || null;
    const isAdmin = !!currentUser?.isAdmin;

    const sanitizedDocs = docs.map((doc) => {
      const ownerId = doc.user?._id || doc.user || doc.userRef || doc.userId || null;
      const isOwnerOrAdmin = isAdmin || (userId && ownerId && String(userId) === String(ownerId));
      return stripComfyIfNotAllowed(doc, { isOwnerOrAdmin });
    });

    return NextResponse.json({ images: decorate(sanitizedDocs) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("❌ /api/images 失敗：", err);
    return new NextResponse("Failed to fetch images", { status: 500 });
  }
}
