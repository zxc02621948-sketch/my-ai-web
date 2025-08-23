// /app/api/delete-image/route.js
// v11.2 — exact mapping for 6 report categories + robust fallbacks + debugPreview

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { getCurrentUser } from "@/lib/serverAuth";

import Image from "@/models/Image";
import Message from "@/models/Message";
import User from "@/models/User";
import { renderTemplate } from "@/utils/notifTemplates";

// ---------- helpers ----------
function json(data, status = 200, extraHeaders = {}) {
  return NextResponse.json(data, { status, headers: { ...extraHeaders } });
}
function isOid(v) {
  try { return !!v && mongoose.Types.ObjectId.isValid(String(v)); }
  catch { return false; }
}
function toBool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes" || s === "y" || s === "on";
  }
  return false;
}
function ensureAdmin(user) {
  return !!user && (user.isAdmin === true || String(user.role || "").toLowerCase() === "admin");
}

// ---- text normalize utils ----
// 移除空白、全形括號/斜線/標點，保留中英文與數字，方便做「顯示文字」直切
function stripToKey(s) {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .replace(/[！＂＃＄％＆＇（）＊＋，－．／：；＜＝＞？＠［＼］＾＿｀｛｜｝～\s]/g, "") // 全形標點+空白
    .replace(/[()\/\[\],.:;'"`|_+\-]/g, "") // 半形常見符號
    ;
}
function normLoose(s) {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[／]/g, "/"); // 全形斜線 → 半形
}

// ---- category -> actionKey (exact first, then fuzzy) ----
function pickActionFromReport(rpt) {
  if (!rpt || typeof rpt !== "object") return { actionKey: null, reason: "" };

  const rawReason =
    rpt.reason || rpt.message || rpt.note ||
    (Array.isArray(rpt.reasons) ? rpt.reasons.join(", ") : "") || "";
  const catRaw = rpt.category || rpt.kind || rpt.type || "";

  // 1) 先用「顯示文字」直切（把斜線/括號/空白去掉）
  const catKey = stripToKey(catRaw);

  // 明確列你下拉的 6 個選項（處理過的 key）：
  // 分類錯誤 → "分類錯誤"
  // 分級錯誤 → "分級錯誤"
  // 重複/洗版 → "重複洗版"
  // 壞圖/無法顯示 → "壞圖無法顯示"
  // 站規違規 → "站規違規"
  // 其他（需說明） → "其他需說明"
  const EXACT = {
    "分類錯誤": "takedown.category_wrong",
    "分級錯誤": "takedown.rating_wrong",
    "重複洗版": "takedown.duplicate_spam",
    "壞圖無法顯示": "takedown.broken_image",
    "站規違規": "takedown.policy_violation",
    "其他需說明": "takedown.other_with_note",
  };
  if (EXACT[catKey]) {
    return { actionKey: EXACT[catKey], reason: rawReason };
  }

  // 2) 對不到就做鬆散關鍵字（類別與理由都比）
  const catN = normLoose(catRaw);
  const txtN = normLoose(rawReason);
  const MATCH = [
    { keys: ["分類錯誤","wrongcategory","categorywrong"], actionKey: "takedown.category_wrong" },
    { keys: ["分級錯誤","ratingwrong","adult","18","r18","nsfw"], actionKey: "takedown.rating_wrong" },
    { keys: ["重複/洗版","重複","洗版","duplicate","spam","repeat"], actionKey: "takedown.duplicate_spam" },
    { keys: ["壞圖/無法顯示","壞圖","無法顯示","broken","corrupt","badfile","loadfail","cantdisplay"], actionKey: "takedown.broken_image" },
    { keys: ["站規違規","policy","rule","violation","侵權","copyright","ban","違規"], actionKey: "takedown.policy_violation" },
    { keys: ["其他","其他（需說明）","other"], actionKey: "takedown.other_with_note" },
  ];
  for (const m of MATCH) {
    if (m.keys.some(k => catN.includes(normLoose(k)))) {
      return { actionKey: m.actionKey, reason: rawReason };
    }
  }
  for (const m of MATCH) {
    if (m.keys.some(k => txtN.includes(normLoose(k)))) {
      return { actionKey: m.actionKey, reason: rawReason };
    }
  }

  // 3) 最後保底
  return { actionKey: "takedown.policy_violation", reason: rawReason };
}

// ---- Report model loader ----
async function getReportModelSafe() {
  try {
    const m = await import("@/models/Report");
    return m?.default || null;
  } catch {
    return null;
  }
}

// ---- resolve image by multiple hints ----
async function resolveImageByAny({ idOrImageId, reportId, ReportModel }) {
  if (idOrImageId && isOid(idOrImageId)) {
    const img = await Image.findById(idOrImageId)
      .select("_id user userId imageId title")
      .lean();
    if (img) return { image: img, mode: "image:_id" };
  }
  if (idOrImageId) {
    const img = await Image.findOne({ imageId: idOrImageId })
      .select("_id user userId imageId title")
      .lean();
    if (img) return { image: img, mode: "image:imageId" };
  }
  if (reportId && ReportModel && isOid(reportId)) {
    const rpt = await ReportModel.findById(reportId).lean();
    if (rpt) {
      const candidates = [rpt.image, rpt.imageId, rpt.targetImageId, rpt.target].filter(Boolean);
      for (const x of candidates) {
        if (isOid(x)) {
          const img = await Image.findById(x)
            .select("_id user userId imageId title")
            .lean();
          if (img) return { image: img, mode: "report:imageRef" };
        }
        const img2 = await Image.findOne({ imageId: x })
          .select("_id user userId imageId title")
          .lean();
        if (img2) return { image: img2, mode: "report:imageId" };
      }
    }
  }
  return { image: null, mode: "notfound" };
}

// ---- owner id fallback (user or userId) ----
function ownerObjectIdFromImage(img) {
  let ownerId = img?.user?._id || img?.user || null;
  if (!ownerId && img?.userId && /^[0-9a-fA-F]{24}$/.test(String(img.userId))) {
    ownerId = new mongoose.Types.ObjectId(String(img.userId));
  }
  return ownerId;
}

// ---------- main ----------
export async function POST(req) {
  try {
    await dbConnect();

    const me = await getCurrentUser();

    const { searchParams } = new URL(req.url);
    const q = Object.fromEntries(searchParams.entries());
    const body = await (async () => { try { return await req.json(); } catch { return {}; } })();

    const idOrImageId = (body?.id ?? body?.imageId ?? q.id ?? q.imageId ?? "").trim();
    const reportId = (body?.reportId ?? q.reportId ?? "").trim();
    const debugPreview = toBool(body?.debugPreview ?? q.debugPreview);

    let notify = toBool(body?.notify ?? body?.fromReport ?? q.notify ?? q.fromReport);
    let actionKey = (body?.actionKey ?? q.actionKey ?? "").trim();
    let reason = typeof (body?.reason ?? q.reason) === "string" ? (body?.reason ?? q.reason) : "";

    if (!notify && reportId) notify = true;

    const ReportModel = await getReportModelSafe();
    const { image, mode } = await resolveImageByAny({ idOrImageId, reportId, ReportModel });
    if (!image) {
      return json({ ok: false, message: `找不到圖片（提供的是 ${idOrImageId || reportId}）` }, 404);
    }

    // ✅ 權限：管理員或圖片作者本人可刪除
    let ownerId = ownerObjectIdFromImage(image);
    if (typeof ownerId === "string" && /^[0-9a-fA-F]{24}$/.test(ownerId)) {
      ownerId = new mongoose.Types.ObjectId(ownerId);
    }
    const isOwner = me && ownerId && String(ownerId) === String(me._id);
    if (!ensureAdmin(me) && !isOwner) {
      return json({ ok: false, message: "需要管理員或作者本人權限" }, 403);
    }

    await Image.deleteOne({ _id: image._id });

    let reportDoc = null;
    if ((!actionKey || !actionKey.length) && reportId && ReportModel && isOid(reportId)) {
      try { reportDoc = await ReportModel.findById(reportId).lean(); } catch {}
      if (reportDoc) {
        const picked = pickActionFromReport(reportDoc);
        actionKey = picked.actionKey || "takedown.policy_violation";
        if (!reason) reason = picked.reason || "";
      }
    }
    if (!actionKey || !actionKey.length) actionKey = "takedown.nsfw_in_sfw";

    if (reportDoc) {
      try {
        await ReportModel.updateOne(
          { _id: reportDoc._id },
          { $set: { resolved: true, resolvedAt: new Date(), resolution: "deleted" } }
        );
      } catch {}
    }

    let notifyResult = { ok: false };
    let tplPreview = null;

    if (notify) {
      try {
        let ownerId = ownerObjectIdFromImage(image);
        if (typeof ownerId === "string" && /^[0-9a-fA-F]{24}$/.test(ownerId)) {
          ownerId = new mongoose.Types.ObjectId(ownerId);
        }
        if (!ownerId) throw new Error("OWNER_NOT_FOUND");

        const owner = await User.findById(ownerId).select("_id username email").lean();

        const ctx = {
          user: { username: owner?.username || "" },
          image: {
            _id: String(image._id),
            title: image.title || "",
            imageId: image.imageId || ""
          },
          // legacy ctx
          username: owner?.username || "",
          imageTitle: image.title || "",
          imageUuid: image.imageId || "",
          reason: reason || "",
        };

        const tpl = renderTemplate(actionKey, ctx); // { title, subject, body }
        tplPreview = debugPreview ? { subject: tpl.subject || tpl.title, body: tpl.body } : null;

        const msg = await Message.create({
          conversationId: `pair:${String(ownerId)}:system`,
          fromId: null,
          toId: ownerId,
          subject: tpl.subject || tpl.title || "(系統通知)",
          body: tpl.body || "",
          isSystem: true,
          archived: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          meta: {
            actionKey,
            imageRef: { _id: image._id, imageId: image.imageId || null, title: image.title || "" },
            reportId: reportDoc?._id || null,
          },
        });

        notifyResult = {
          ok: true,
          conversationId: `pair:${String(ownerId)}:system`,
          messageId: String(msg._id),
          actionKey,
        };
      } catch (e) {
        console.error("notify(create Message) failed:", e);
        notifyResult = { ok: false, error: e?.message || String(e) };
      }
    }

    return json(
      {
        ok: true,
        message: "已刪除圖片",
        deletedId: String(image._id),
        mode,
        notifyUsed: notify,
        notify: notifyResult,
        ...(debugPreview ? { tplPreview } : {}),
      },
      200,
      { "X-Delete-Image-Route": "v11.2" }
    );
  } catch (err) {
    console.error("POST /api/delete-image error:", err);
    return json({ ok: false, message: "伺服器錯誤" }, 500);
  }
}
