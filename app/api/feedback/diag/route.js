// /app/api/feedback/diag/route.js
import { NextResponse } from "next/server";
import {
  extractMailFlags,
  getMailerDiagnostics,
  makeBasicTemplate,
  sendAdminMail,
} from "@/lib/mailer";

/**
 * 診斷用 API：
 * - 支援 ?debug=1（回傳寄信結果細節）
 * - 支援 ?testsndr=1（改用 onboarding@resend.dev 寄件者）
 * - 支援 ?both=1（各寄一次：testsndr=1 與正式寄件，方便一次驗證兩種寄件者）
 *
 * 回應：
 * {
 *   ok: true,
 *   diagnostics: { hasApiKey, defaultFrom, adminEmails },
 *   send: { ...單次寄送結果... } 或
 *   sends: [{label:"testsndr", ...}, {label:"normal", ...}]
 * }
 */
export async function GET(req) {
  const url = req.nextUrl;
  const sp = url.searchParams;
  const flags = extractMailFlags(req);
  const both = sp.get("both") === "1";

  // 基本設定檢查
  const diag = getMailerDiagnostics();
  if (!diag.hasApiKey) {
    return NextResponse.json(
      { ok: false, error: "RESEND_API_KEY 未設定", diagnostics: diag },
      { status: 500 }
    );
  }
  if (!diag.adminEmails?.length) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_EMAILS 未設定", diagnostics: diag },
      { status: 500 }
    );
  }

  // 組診斷信內容
  const now = new Date().toISOString();
  const ua = req.headers.get("user-agent") || "-";
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "-";

  const baseHtml = makeBasicTemplate({
    title: "郵件通知診斷（/api/feedback/diag）",
    bodyHtml: `
      <p>時間：${now}</p>
      <p>IP：${ip}</p>
      <p>UA：${ua}</p>
      <p>flags：debug=${flags.debug ? "1" : "0"}, testsndr=${
      flags.testsndr ? "1" : "0"
    }</p>
      <p>both=${both ? "1" : "0"}</p>
    `,
    footerHtml:
      "<p>這封信由系統自動發送，用於確認寄信設定與路由可用性。</p>",
  });

  // 單次 or 兩次寄送（testsndr 與正式）
  try {
    if (both) {
      const r1 = await sendAdminMail(
        {
          subject: "【診斷】testsndr=1 測試寄送",
          html: baseHtml,
        },
        { ...flags, testsndr: true }
      );
      const r2 = await sendAdminMail(
        {
          subject: "【診斷】正式寄送（非 testsndr）",
          html: baseHtml,
        },
        { ...flags, testsndr: false }
      );

      const status =
        r1.ok && r2.ok ? 200 : r1.ok || r2.ok ? 207 /* Multi-Status-ish */ : 500;

      return NextResponse.json(
        {
          ok: r1.ok && r2.ok,
          diagnostics: diag,
          sends: [
            { label: "testsndr", ...r1 },
            { label: "normal", ...r2 },
          ],
        },
        { status }
      );
    } else {
      const r = await sendAdminMail(
        {
          subject: flags.testsndr
            ? "【診斷】testsndr=1 測試寄送"
            : "【診斷】正式寄送",
          html: baseHtml,
        },
        flags
      );

      return NextResponse.json(
        { ok: r.ok, diagnostics: diag, send: r },
        { status: r.ok ? 200 : 500 }
      );
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err), diagnostics: diag },
      { status: 500 }
    );
  }
}
