// app/api/admin/recompute-scores/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import { computeCompleteness } from "@/utils/score";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/recompute-scores?missingOnly=1&batch=500&dryRun=0
 * Headers（若已設定環境變數 ADMIN_SECRET）：x-admin-secret: <同值>
 *
 * Query:
 * - missingOnly: 1=只處理沒有 completenessScore 的，0/缺省=全部重算
 * - batch: 每批次 bulk 大小（預設 500）
 * - dryRun: 1=不寫入，只回報預估結果；0/缺省=實際寫入
 */
export async function POST(req) {
  try {
    await dbConnect();

    // 簡易管理驗證（可選）
    const adminSecret = process.env.ADMIN_SECRET || "";
    if (adminSecret) {
      const header = req.headers.get("x-admin-secret") || "";
      if (header !== adminSecret) {
        return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
      }
    }

    const url = new URL(req.url);
    const missingOnly = url.searchParams.get("missingOnly") === "1";
    const batchSize = Math.max(1, parseInt(url.searchParams.get("batch") || "500", 10));
    const dryRun = url.searchParams.get("dryRun") === "1";

    const match = missingOnly
      ? { $or: [{ completenessScore: { $exists: false } }, { completenessScore: null }] }
      : {};

    const cursor = Image.find(match).cursor(); // 用 cursor 省記憶體

    let total = 0;
    let updated = 0;
    let ops = [];
    let sum = 0;
    let min = 101;
    let max = -1;

    for await (const doc of cursor) {
      total += 1;

      const s = computeCompleteness(doc);
      sum += s;
      if (s < min) min = s;
      if (s > max) max = s;

      if (!dryRun) {
        ops.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { completenessScore: s } },
          },
        });
        if (ops.length >= batchSize) {
          const res = await Image.bulkWrite(ops, { ordered: false });
          updated += res.modifiedCount || 0;
          ops = [];
        }
      }
    }

    if (!dryRun && ops.length) {
      const res = await Image.bulkWrite(ops, { ordered: false });
      updated += res.modifiedCount || 0;
    }

    const avg = total > 0 ? Number((sum / total).toFixed(2)) : 0;

    return NextResponse.json({
      ok: true,
      mode: missingOnly ? "missingOnly" : "all",
      dryRun,
      totalScanned: total,
      updated,
      stats: { avg, min: min === 101 ? 0 : min, max: max === -1 ? 0 : max },
      hint:
        "可用 dryRun=1 先試跑觀察分佈；若設了 ADMIN_SECRET，請在請求頭帶 x-admin-secret。",
    });
  } catch (err) {
    console.error("recompute-scores error:", err);
    return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
  }
}
