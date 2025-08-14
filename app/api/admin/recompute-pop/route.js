// app/api/admin/recompute-pop/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";                 // 你專案的連線工具（具名匯出）
import { getCurrentUser } from "@/lib/serverAuth";    // 你專案的使用者驗證
import Image from "@/models/Image";                   // 你的 Image model
import {
  computeCompleteness,
  computePopScore,
  ensureLikesCount,
} from "@/utils/score";                               // 直接用你現在的 score.js

// 批次大小可視資料量調整
const BATCH_SIZE = 300;

/**
 * 重新計算全站圖片的 popularScore / completenessScore / likesCount 快取（可選）
 * - 僅限管理員
 * - 依照「當前的 utils/score.js」邏輯計算
 * - 不改變 createdAt / initialBoost（新圖加成是否存在＆大小，依每張圖現有欄位與現在時間判定）
 */
export async function POST(req) {
  await dbConnect();

  // 權限檢查（需管理員）
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ message: "需要管理員權限" }, { status: 403 });
  }

  // 查詢要處理的全部圖片 _id（避免一次撈全欄位吃記憶體）
  const ids = await Image.find({}, { _id: 1 }).lean();
  let updated = 0;

  // 分批處理
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batchIds = ids.slice(i, i + BATCH_SIZE).map((x) => x._id);
    const batchDocs = await Image.find(
      { _id: { $in: batchIds } },
      {
        _id: 1,
        clicks: 1,
        likes: 1,
        likesCount: 1,
        initialBoost: 1,
        createdAt: 1,
        // 計算完整度可能用到的欄位（依你實際 schema 取捨）
        modelName: 1,
        modelLink: 1,
        loraName: 1,
        loraLink: 1,
        positivePrompt: 1,
        negativePrompt: 1,
        sampler: 1,
        steps: 1,
        cfgScale: 1,
        clipSkip: 1,
        seed: 1,
        width: 1,
        height: 1,
        rating: 1,
        category: 1,
        tags: 1,
        description: 1,
      }
    ).lean();

    const ops = [];

    for (const doc of batchDocs) {
      // 1) 重新計算 likesCount（保險：有些舊資料沒快取）
      const likesCount = ensureLikesCount(doc); // ← 你的工具函式

      // 2) 重新計算完整度
      const completenessScore = computeCompleteness(doc);

      // 3) 依「目前時間」與「此圖的 initialBoost / createdAt」計算新總分
      //    computePopScore 內部會呼叫 computeTimeBoost，
      //    timeBoost 只在新圖時間窗內存在；窗外 = 0（依你現在的 score.js）
      const popularScore = computePopScore({
        ...doc,
        likesCount,
        completenessScore,
      });

      ops.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              likesCount,            // 可選：同步快取
              completenessScore,     // 可選：同步快取
              popularScore,          // 主要：重算的熱門度分數
              popRecomputedAt: new Date(), // 記錄重算時間（可選）
            },
          },
        },
      });
    }

    if (ops.length) {
      const res = await Image.bulkWrite(ops, { ordered: false });
      updated += res.modifiedCount || 0;
    }
  }

  return NextResponse.json({ ok: true, updated, total: ids.length });
}
