// /app/api/reports/[id]/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Report from "@/models/Report";
import { getCurrentUser } from "@/lib/serverAuth";
import mongoose from "mongoose";
import Message from "@/models/Message";
import Image from "@/models/Image";
import { renderTemplate } from "@/utils/notifTemplates";

const ALLOWED = ["open", "action_taken", "rejected", "closed"];

function simplify(s) {
  if (s == null) return "";
  return String(s).trim().toLowerCase().replace(/[\s_\-:：]/g, "");
}

// 關鍵詞表（包含中英文與常見變體）
const KW = {
  action_taken: [
    "actiontaken","deleted","delete","remove","removed","taken","fixed",
    "已處置","處置","已刪除","刪除","删除","已删除","處理","已處理","處置完成","處理完成"
  ],
  closed: [
    "closed","close","done","resolved","resolve",
    "已結案","結案","已關閉","關閉","已完成","完成","已解決","解決","結束"
  ],
  open: [
    "open","reopen","reopened",
    "重開","重新開啟","重新開案","重啟","再開","重啟處理"
  ],
  rejected: [
    "rejected","reject",
    "駁回","已駁回","拒絕","不受理","否決"
  ],
};

function guessFromAny(input, raw) {
  // 1) boolean/number
  if (input === true || input === 1 || input === "1") return "action_taken";
  if (input === false || input === 0 || input === "0") return "closed";

  // 2) 明確欄位值
  const s = simplify(input);
  if (!s) {
    // 3) 旗標式：例如 { deleted: "1" }、{ "已處置": true }
    for (const [k, v] of Object.entries(raw || {})) {
      const on = v === true || v === "true" || v === 1 || v === "1";
      if (!on) continue;
      const key = simplify(k);
      for (const [std, words] of Object.entries(KW)) {
        if (words.some(w => key.includes(simplify(w)))) return std;
      }
    }
    return null;
  }

  // 4) 精準/包含式比對
  for (const [std, words] of Object.entries(KW)) {
    if (words.some(w => s === simplify(w) || s.includes(simplify(w)))) return std;
  }

  // 5) 已經就是合法值
  if (ALLOWED.includes(s)) return s;

  return null;
}

async function readPayload(req) {
  const out = {};
  // JSON
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) Object.assign(out, (await req.json()) || {});
  } catch {}
  // formData
  try {
    const fd = await req.formData();
    for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  } catch {}
  // query
  const sp = req.nextUrl?.searchParams;
  if (sp) {
    for (const k of ["status","state","action","note","debug"]) {
      if (!(k in out) && sp.get(k) != null) out[k] = sp.get(k);
    }
  }
  return out;
}

export async function PATCH(req, context) {
  try {
    await dbConnect();

    const me = await getCurrentUser();
    if (!me?.isAdmin) {
      return NextResponse.json({ ok: false, message: "沒有權限" }, { status: 403 });
    }

    const { id } = await context.params; // App Router 需要 await
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "無效的 report id" }, { status: 400 });
    }

    const payload = await readPayload(req);
    const rawStatus = payload.status ?? payload.state ?? payload.action ?? null;
    const normalized = guessFromAny(rawStatus, payload);
    const debug = payload.debug === true || String(payload.debug).toLowerCase() === "1";

    const headers = { "X-Reports-Route": "v4", "X-Status-Normalized": String(normalized || "") };

    if (debug) {
      return new NextResponse(
        JSON.stringify({ ok: true, debug: { received: payload, normalized, allowed: ALLOWED } }),
        { status: 200, headers }
      );
    }

    if (!normalized || !ALLOWED.includes(normalized)) {
      return new NextResponse(
        JSON.stringify({
          ok: false,
          message:
            `無效的狀態。收到: ${rawStatus ?? "(空)"} → 正規化: ${normalized ?? "(無)"}；` +
            `允許: ${ALLOWED.join(", ")}；中英關鍵詞皆可，例如：已處置/刪除→action_taken，結案/已解決→closed，重開→open，駁回→rejected`,
          received: payload
        }),
        { status: 400, headers }
      );
    }

    const update = { status: normalized };
    if (typeof payload.note === "string") update.note = payload.note.slice(0, 2000);

    // 先取得原始檢舉資料（用於發送通知）
    const originalReport = await Report.findById(id).lean();
    if (!originalReport) {
      return new NextResponse(JSON.stringify({ ok: false, message: "找不到報告" }), { status: 404, headers });
    }

    const updated = await Report.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!updated) {
      return new NextResponse(JSON.stringify({ ok: false, message: "找不到報告" }), { status: 404, headers });
    }

    // 發送站內信通知檢舉人
    let notifyResult = { sent: false };
    if (originalReport.reporterId && (normalized === "rejected" || normalized === "action_taken" || normalized === "closed")) {
      try {
        // 取得圖片資訊
        let imageInfo = { title: "未知圖片", _id: originalReport.imageId };
        if (originalReport.imageId) {
          const img = await Image.findById(originalReport.imageId).select("title _id imageId").lean();
          if (img) imageInfo = { title: img.title || "無標題", _id: img._id, imageId: img.imageId };
        }

        // 選擇模板
        let templateKey = "report.closed";
        if (normalized === "rejected") templateKey = "report.rejected";
        else if (normalized === "action_taken") templateKey = "report.action_taken";

        const ctx = {
          image: imageInfo,
          note: update.note || "",
          action: normalized === "action_taken" ? "已處理" : normalized === "rejected" ? "不成立" : "已結案",
        };

        const tpl = renderTemplate(templateKey, ctx);

        await Message.create({
          conversationId: `pair:${String(originalReport.reporterId)}:system`,
          fromId: null,
          toId: originalReport.reporterId,
          subject: tpl.subject || tpl.title || "檢舉處理結果通知",
          body: tpl.body || "",
          kind: "system",
          ref: {
            type: "other",
            id: originalReport._id,
            extra: { reportStatus: normalized, imageId: originalReport.imageId }
          },
        });

        notifyResult = { sent: true, to: String(originalReport.reporterId), template: templateKey };
      } catch (e) {
        console.error("發送檢舉通知失敗：", e);
        notifyResult = { sent: false, error: e?.message || String(e) };
      }
    }

    return new NextResponse(
      JSON.stringify({ ok: true, item: updated, notify: notifyResult }), 
      { status: 200, headers }
    );
  } catch (err) {
    console.error("PATCH /api/reports/[id] error:", err);
    return NextResponse.json({ ok: false, message: "伺服器錯誤" }, { status: 500 });
  }
}
