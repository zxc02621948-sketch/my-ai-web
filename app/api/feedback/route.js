// /app/api/feedback/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Feedback from "@/models/Feedback";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import { Resend } from "resend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ----- ENV -----
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM = process.env.RESEND_FROM || ""; // 例: 'noreply@aicreateaworld.com' 或 'App <noreply@...>'
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || "";
const THROTTLE_MS = Number(process.env.FEEDBACK_NOTIFY_COOLDOWN_MS || 15 * 60 * 1000);

// ----- Resend client -----
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

function isSafePageUrl(value) {
  const s = String(value || "").trim();
  if (!s) return false;
  if (s.startsWith("/") && !s.startsWith("//")) return true;
  try {
    const u = new URL(s, "https://placeholder.local");
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// ---------- GET：維持你原本格式 { feedbacks } ----------
export async function GET(req) {
  try {
    await dbConnect();
    const me = await getCurrentUserFromRequest(req);
    if (!me || !me.isAdmin) {
      return NextResponse.json({ error: "無權限存取" }, { status: 403 });
    }

    const feedbacks = await Feedback.find()
      .sort({ createdAt: -1 })
      .populate("userId", "username email")
      .lean();

    return NextResponse.json({ feedbacks });
  } catch (error) {
    console.error("載入回報失敗：", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

// ---------- 寄管理員通知（Resend） ----------
async function sendAdminEmail({ type, message, pageUrl, user, docId, testSender = false }) {
  if (!resend) return { ok:false, stage:"config", error:"RESEND_API_KEY missing" };

  const from = testSender ? "onboarding@resend.dev" : RESEND_FROM;
  if (!from) return { ok:false, stage:"config", error:"RESEND_FROM missing" };
  if (!ADMIN_EMAILS.length) return { ok:false, stage:"config", error:"ADMIN_EMAILS empty" };

  const safePageUrl = isSafePageUrl(pageUrl) ? String(pageUrl).trim().slice(0, 2000) : "";
  const subject = `🔔 新回報：${type || "未分類"}`;
  const manageLink = BASE_URL ? `${BASE_URL}/admin/feedback/${docId}` : "";
  const html = `
    <div style="font:14px/1.6,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto">
      <p><b>類型：</b>${esc(type || "未分類")}</p>
      <p><b>內容：</b><br/>${esc(message).replace(/\n/g,"<br/>")}</p>
      <p><b>頁面：</b>${safePageUrl ? `<a href="${esc(safePageUrl)}">${esc(safePageUrl)}</a>` : "(未指定)"}</p>
      <p><b>使用者：</b>${esc(user?.username || "匿名")} (${user?._id || "-"})</p>
      ${manageLink ? `<hr/><p>查看後台：<a href="${manageLink}">${manageLink}</a></p>` : ""}
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: ADMIN_EMAILS,
      subject,
      html,
    });
    if (error) return { ok:false, stage:"send", error };
    return { ok:true, stage:"send", id:data?.id || null, from, to:ADMIN_EMAILS };
  } catch (e) {
    return { ok:false, stage:"exception", error:String(e) };
  }
}

// ---------- POST：先查節流 → create → 視需要寄信（保留你原本回傳） ----------
export async function POST(req) {
  // 除錯參數：?debug=1（回傳寄信結果、略過節流） & ?testsndr=1（改用 onboarding@resend.dev 寄）
  const { searchParams } = new URL(req.url);
  const debug = searchParams.get("debug") === "1";
  const testsndr = searchParams.get("testsndr") === "1";

  try {
    await dbConnect();
    const body = await req.json().catch(() => ({}));
    const { type, message, pageUrl } = body || {};
    if (!type || !message) {
      return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });
    }

    // 嚴格檢查 enum：避免送入非法 type 造成 500
    const typePath = Feedback.schema?.path?.("type");
    const allowed = typePath?.options?.enum || [];
    if (allowed.length && !allowed.includes(type)) {
      return NextResponse.json({ error: "Invalid type", allow: allowed }, { status: 400 });
    }

    const currentUser = await getCurrentUserFromRequest(req).catch(() => null);
    const userId = currentUser?._id || null;
    const safePageUrl = isSafePageUrl(pageUrl) ? String(pageUrl).trim().slice(0, 2000) : "";

    // ✅ 先做節流查詢（找舊紀錄，避免新建的自己把自己節流掉）
    let hasRecent = false;
    if (!debug && THROTTLE_MS > 0) {
      const since = new Date(Date.now() - THROTTLE_MS);
      const throttleQuery = userId
        ? { userId, createdAt: { $gte: since } }
        : { pageUrl: safePageUrl, createdAt: { $gte: since } };
      hasRecent = !!(await Feedback.findOne(throttleQuery).sort({ createdAt: -1 }).lean());
    }

    // 再寫入 DB（保持你原本行為與回傳結構）
    const newFeedback = await Feedback.create({
      type,
      message: String(message).trim().slice(0, 5000),
      pageUrl: safePageUrl,
      userId,
    });

    // 視需要寄信
    let mail = { skipped:false };
    if (debug || !hasRecent) {
      mail = await sendAdminEmail({
        type,
        message,
        pageUrl: safePageUrl,
        user: currentUser,
        docId: newFeedback._id,
        testSender: testsndr,
      });
    } else {
      mail = { skipped:true, reason:"throttled" };
    }

    // 🛠️ debug 模式回傳寄信結果，正常模式維持 { success, feedback }
    if (debug) {
      return NextResponse.json({
        success: true,
        feedback: newFeedback,
        debug: {
          env: {
            hasApiKey: !!RESEND_API_KEY,
            from: testsndr ? "onboarding@resend.dev" : RESEND_FROM || "(empty)",
            toCount: ADMIN_EMAILS.length,
            throttleMs: THROTTLE_MS,
          },
          mail,
          allowedTypes: allowed,
          throttledByOld: hasRecent,
        },
      });
    }

    return NextResponse.json({ success: true, feedback: newFeedback });
  } catch (error) {
    console.error("建立回報失敗：", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
