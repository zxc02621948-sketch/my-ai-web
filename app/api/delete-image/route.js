// /app/api/delete-image/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUser } from "@/lib/serverAuth";
import mongoose from "mongoose";
import Image from "@/models/Image";
import Message from "@/models/Message";

export const dynamic = "force-dynamic";

// 嘗試載入 Report 模型（沒有也可運作）
let Report = null;
try {
  const mod = await import("@/models/Report");
  Report = mod?.default || mod?.Report || null;
} catch { /* ignore */ }

const json = (data, status = 200, headers = {}) =>
  new NextResponse(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });

const toOid = (v) =>
  mongoose.Types.ObjectId.isValid(String(v)) ? new mongoose.Types.ObjectId(String(v)) : null;

const pairCid = (a, b) => (String(a) < String(b) ? `pair:${a}:${b}` : `pair:${b}:${a}`);

function normalizeMongoId(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  const m = s.match(/^\s*(?:new\s+)?ObjectId\(\s*['"]?([0-9a-fA-F]{24})['"]?\s*\)\s*$/);
  if (m) return m[1];
  const m2 = s.match(/([0-9a-fA-F]{24})/);
  if (m2) return m2[1];
  return s; // 可能是 Cloudflare UUID
}

// 讀 JSON / form / query 都吃，避免型別/格式問題
async function readPayload(req) {
  const out = {};
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try { Object.assign(out, (await req.json()) || {}); } catch {}
  } else if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    try {
      const fd = await req.formData();
      for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
    } catch {}
  }
  const sp = req.nextUrl?.searchParams;
  if (sp) for (const k of sp.keys()) if (!(k in out)) out[k] = sp.get(k);
  return out;
}

async function resolveImage(idOrImageId) {
  // 1) 以 Mongo _id 找
  if (mongoose.Types.ObjectId.isValid(idOrImageId)) {
    const byId = await Image.findById(idOrImageId).select("_id user title imageId").lean();
    if (byId) return { image: byId, mode: "image:_id" };
  }
  // 2) 以 Cloudflare imageId 找
  const byImageId = await Image.findOne({ imageId: idOrImageId }).select("_id user title imageId").lean();
  if (byImageId) return { image: byImageId, mode: "image:imageId" };

  // 3) 若傳入的是 report._id，反查出圖片
  if (Report && mongoose.Types.ObjectId.isValid(idOrImageId)) {
    const rpt = await Report.findById(idOrImageId).select("imageId").lean();
    if (rpt?.imageId) {
      const norm = normalizeMongoId(rpt.imageId);
      if (mongoose.Types.ObjectId.isValid(norm)) {
        const imgA = await Image.findById(norm).select("_id user title imageId").lean();
        if (imgA) return { image: imgA, mode: "report->image:_id" };
      }
      const imgB = await Image.findOne({ imageId: norm }).select("_id user title imageId").lean();
      if (imgB) return { image: imgB, mode: "report->image:imageId" };
    }
  }
  return { image: null, mode: "unresolved" };
}

export async function POST(req) {
  try {
    await dbConnect();

    const me = await getCurrentUser();
    if (!me?._id) return json({ ok: false, message: "需要登入" }, 401);

    const body = await readPayload(req);
    const rawId = body?.imageId ?? body?.id;
    const inputId = normalizeMongoId(rawId);
    const reason = typeof body?.reason === "string" ? body.reason : "";
    const incomingReportId = body?.reportId || body?.report_id || null;

    if (!inputId) return json({ ok: false, message: "缺少 imageId（或 id）" }, 400);

    const { image, mode } = await resolveImage(String(inputId));
    if (!image) return json({ ok: false, message: `找不到圖片（提供的是 ${inputId}）` }, 404);

    const ownerOid = toOid(image.user);
    const meOid = toOid(me._id);
    if (!ownerOid || !meOid) return json({ ok: false, message: "使用者 ID 解析失敗" }, 500);

    const isAdmin = !!me.isAdmin;
    const isOwner = String(meOid) === String(ownerOid);
    if (!isAdmin && !isOwner) return json({ ok: false, message: "沒有權限刪除這張圖片" }, 403);

    // 先刪圖
    await Image.deleteOne({ _id: image._id });

    // ===== 關鍵：自動偵測是否「因檢舉」 =====
    let matchedReport = null;
    if (Report) {
      const queryOr = [
        { imageId: image._id },                  // 有些報告存的是 ObjectId
        { imageId: String(image._id) },          // 有些存字串化的 _id
        { imageId: image.imageId },              // 或存 Cloudflare imageId
      ];
      // 若有明確傳入 reportId，就優先找那筆
      const byRid = mongoose.Types.ObjectId.isValid(incomingReportId)
        ? await Report.findById(incomingReportId).lean()
        : null;

      matchedReport =
        byRid ||
        (await Report.findOne({ $or: queryOr })
          .sort({ createdAt: -1 })
          .lean());
    }

    const shouldNotify = !!matchedReport; // 只要有檢舉單存在，就寄站內信
    const results = { shouldNotify, notify: { ok: true }, reportUpdate: { ok: true } };

    if (shouldNotify) {
      // 建對話：管理員 ↔ 作者
      try {
        const cid = pairCid(meOid, ownerOid);
        const ref = {
          type: "action",
          id: matchedReport?._id || undefined,
          extra: {
            action: "delete_due_to_report",
            reason: reason || undefined,
            image: { _id: image._id, imageId: image.imageId },
          },
        };

        const created = await Message.create({
          conversationId: cid,
          fromId: meOid,
          toId: ownerOid,
          subject: "圖片已因檢舉被刪除",
          body:
            `你的圖片（${mode.includes("imageId") ? `imageId: ${image.imageId}` : `ID: ${image._id}`}）因檢舉已被管理員刪除。` +
            (reason ? `\n原因：${String(reason).slice(0, 300)}` : ""),
          kind: "admin",
          ref,
        });

        // 寫入後硬確認
        const confirmed = await Message.findById(created._id)
          .select("_id conversationId fromId toId kind createdAt")
          .lean();

        results.notify = confirmed
          ? {
              ok: true,
              messageId: String(created._id),
              conversationId: confirmed.conversationId,
              toId: String(confirmed.toId),
              fromId: String(confirmed.fromId),
            }
          : { ok: false, error: "created-but-not-found" };
      } catch (e) {
        console.error("Create message failed:", e);
        results.notify = { ok: false, error: e?.message || String(e) };
      }

      // 自動把檢舉單設為「已處置」
      if (matchedReport && Report) {
        try {
          if (matchedReport.status !== "action_taken") {
            await Report.findByIdAndUpdate(matchedReport._id, { status: "action_taken" }, { new: false });
          }
        } catch (e) {
          results.reportUpdate = { ok: false, error: e?.message || String(e) };
        }
      }
    }

    return json(
      {
        ok: true,
        message: "已刪除圖片",
        deletedId: image._id,
        mode,
        hasReport: !!matchedReport,
        reportId: matchedReport?._id || null,
        ...results,
      },
      200,
      { "X-Delete-Image-Route": "v10", "X-Has-Report": String(!!matchedReport) }
    );
  } catch (err) {
    console.error("POST /api/delete-image error:", err);
    return json({ ok: false, message: "伺服器錯誤" }, 500);
  }
}
