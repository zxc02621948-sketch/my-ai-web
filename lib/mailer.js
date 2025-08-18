// /lib/mailer.js
// 共用寄信工具（Resend）
// 需要環境變數：RESEND_API_KEY, RESEND_FROM, ADMIN_EMAILS
// 用法：
//   import { sendMail, sendAdminMail, extractMailFlags, shouldBypassThrottle } from "@/lib/mailer";
//   const flags = extractMailFlags(req); // 取得 debug/testsndr
//   if (!shouldBypassThrottle(flags)) { /* 執行節流邏輯 */ }
//   await sendAdminMail({ subject, html }, flags);

import { Resend } from "resend";

/** @type {Resend | null} */
let _resend = null;

/** 取得單例 Resend client */
function getResend() {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    _resend = new Resend(key || ""); // 若沒 key 也先建，但寄信會報錯
  }
  return _resend;
}

const DEFAULT_FROM = process.env.RESEND_FROM || "noreply@example.com";

/** 解析 ADMIN_EMAILS（支援逗號、分號、空白） */
export function parseAdminEmails() {
  const raw = process.env.ADMIN_EMAILS || "";
  return raw
    .split(/[,;\s]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 從 Request/URL/URLSearchParams 取出 debug/testsndr 旗標 */
export function extractMailFlags(reqOrUrl) {
  try {
    // Next.js App Router 的 Request 物件
    if (reqOrUrl && typeof reqOrUrl === "object" && "nextUrl" in reqOrUrl) {
      const sp = reqOrUrl.nextUrl?.searchParams;
      return {
        debug: sp?.get("debug") === "1",
        testsndr: sp?.get("testsndr") === "1",
      };
    }
    // 如果你自己傳 URL 或字串
    if (typeof reqOrUrl === "string") {
      const sp = new URL(reqOrUrl).searchParams;
      return { debug: sp.get("debug") === "1", testsndr: sp.get("testsndr") === "1" };
    }
    // 如果直接傳 URLSearchParams
    if (reqOrUrl && typeof reqOrUrl.get === "function") {
      return { debug: reqOrUrl.get("debug") === "1", testsndr: reqOrUrl.get("testsndr") === "1" };
    }
  } catch {
    // ignore
  }
  return { debug: false, testsndr: false };
}

/** debug 模式時是否建議跳過節流（供路由拿來決定） */
export function shouldBypassThrottle(flags) {
  return !!flags?.debug;
}

/** 簡易將 HTML 轉純文字（當 text 未提供時備用） */
function textFromHtml(html = "") {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

/** 選擇寄件者：testsndr=1 時用 Resend 測試寄件者 */
function resolveFrom(flags, explicitFrom) {
  if (flags?.testsndr) return "onboarding@resend.dev";
  return explicitFrom || DEFAULT_FROM;
}

/** 正規化收件陣列 */
function normalizeAddressList(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x.filter(Boolean);
  return String(x)
    .split(/[,;\s]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 建立一個簡單 HTML 模板（可選）
 * @param {{title?:string, bodyHtml?:string, footerHtml?:string}} opts
 */
export function makeBasicTemplate({ title = "", bodyHtml = "", footerHtml = "" } = {}) {
  return `
  <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
    ${title ? `<h2 style="margin:0 0 12px;font-weight:600;">${title}</h2>` : ""}
    <div style="font-size:14px;line-height:1.6;">${bodyHtml || ""}</div>
    ${footerHtml ? `<hr style="margin:16px 0;border:none;border-top:1px solid #eee;" />${footerHtml}` : ""}
  </div>
  `;
}

/**
 * 寄一般信件
 * @param {{
 *   to: string|string[],
 *   subject: string,
 *   html?: string,
 *   text?: string,
 *   cc?: string|string[],
 *   bcc?: string|string[],
 *   replyTo?: string|string[],
 *   from?: string,
 *   headers?: Record<string,string>,
 *   tags?: {name:string; value:string}[],
 * }} mail
 * @param {{debug?:boolean, testsndr?:boolean}} flags
 * @returns {Promise<{ok:boolean, id?:string, data?:any, error?:string}>}
 */
export async function sendMail(mail, flags = {}) {
  const resend = getResend();
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY 未設定" };
  }
  const to = normalizeAddressList(mail.to);
  if (to.length === 0) return { ok: false, error: "缺少收件者 (to)" };
  const from = resolveFrom(flags, mail.from);

  const payload = {
    from,
    to,
    subject: mail.subject || "",
    html: mail.html || "",
    text: mail.text || (mail.html ? textFromHtml(mail.html) : ""),
    cc: normalizeAddressList(mail.cc),
    bcc: normalizeAddressList(mail.bcc),
    reply_to: normalizeAddressList(mail.replyTo),
    headers: mail.headers || undefined,
    tags: Array.isArray(mail.tags) ? mail.tags : undefined,
  };

  try {
    const { data, error } = await resend.emails.send(payload);
    if (error) return { ok: false, error: error.message || String(error) };
    return { ok: true, id: data?.id, data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * 寄給管理員（ADMIN_EMAILS）
 * @param {{subject:string, html?:string, text?:string, from?:string, tags?:{name:string;value:string}[]}} mail
 * @param {{debug?:boolean, testsndr?:boolean}} flags
 */
export async function sendAdminMail(mail, flags = {}) {
  const adminList = parseAdminEmails();
  if (adminList.length === 0) {
    return { ok: false, error: "ADMIN_EMAILS 未設定" };
  }
  return sendMail(
    {
      to: adminList,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      from: mail.from, // 仍可覆寫
      tags: mail.tags,
    },
    flags
  );
}

// 方便在 /api/feedback/diag 之類的地方做健康檢查
export function getMailerDiagnostics() {
  return {
    hasApiKey: !!process.env.RESEND_API_KEY,
    defaultFrom: DEFAULT_FROM,
    adminEmails: parseAdminEmails(),
  };
}

export const resendClient = getResend();
