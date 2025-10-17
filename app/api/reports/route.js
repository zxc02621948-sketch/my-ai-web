// /app/api/reports/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Report from "@/models/Report";
import { getCurrentUser } from "@/lib/serverAuth";
import Image from "@/models/Image";
import mongoose from "mongoose";

// 新增：寄信工具
import {
  extractMailFlags,
  sendAdminMail,
  makeBasicTemplate,
} from "@/lib/mailer";

// 取得目前登入者（必要：已登入＝已驗證）
async function requireUser() {
  const user = await getCurrentUser();
  if (!user || !user._id) {
    return { error: NextResponse.json({ ok: false, message: "需要登入" }, { status: 401 }) };
  }
  return { user };
}

// 節流參數
const MAX_REPORTS_PER_HOUR = 10;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(req) {
  try {
    await dbConnect();
    const { user, error } = await requireUser();
    if (error) return error;

    const body = await req.json().catch(() => ({}));
    const { imageId, type, message, targetId, reason, details } = body || {};
    
    // 檢查是否為討論區檢舉
    if (type === 'discussion_post' || type === 'discussion_comment') {
      if (!targetId) {
        return NextResponse.json({ ok: false, message: "缺少目標 ID" }, { status: 400 });
      }
      if (!reason || !reason.trim()) {
        return NextResponse.json({ ok: false, message: "請提供檢舉原因" }, { status: 400 });
      }
      
      // 檢查是否檢舉自己的內容（需要查詢目標）
      let targetAuthor = null;
      if (type === 'discussion_post') {
        const DiscussionPost = (await import('@/models/DiscussionPost')).default;
        const post = await DiscussionPost.findById(targetId).select('author').lean();
        if (post) targetAuthor = post.author;
      } else if (type === 'discussion_comment') {
        const DiscussionComment = (await import('@/models/DiscussionComment')).default;
        const comment = await DiscussionComment.findById(targetId).select('author').lean();
        if (comment) targetAuthor = comment.author;
      }
      
      if (targetAuthor && String(targetAuthor) === String(user._id)) {
        return NextResponse.json({ ok: false, message: "不能檢舉自己的內容" }, { status: 400 });
      }
      
      // 創建討論區檢舉記錄
      const doc = await Report.create({
        type,
        targetId,
        reporterId: user._id,
        message: reason.trim(),
        details: details || ''
      });
      
      return NextResponse.json({ ok: true, reportId: doc._id, message: "檢舉已提交" });
    }
    
    // 原有的圖片檢舉邏輯
    if (!imageId || !mongoose.Types.ObjectId.isValid(imageId)) {
      return NextResponse.json({ ok: false, message: "無效的圖片 ID" }, { status: 400 });
    }
    // 取得圖片，確認作者
    const img = await Image.findById(imageId).select("user title").lean();
    if (!img) {
      return NextResponse.json({ ok: false, message: "找不到圖片" }, { status: 404 });
    }
    // 禁止檢舉自己的作品
    if (String(img.user) === String(user._id)) {
      return NextResponse.json({ ok: false, message: "不能檢舉自己的作品" }, { status: 400 });
    }

    const ALLOWED = ["category_wrong","rating_wrong","duplicate","broken","policy_violation","other"];
    if (!ALLOWED.includes(type)) {
      return NextResponse.json({ ok: false, message: "無效的檢舉類型" }, { status: 400 });
    }

    // 同一使用者對同一圖、同一類型 24 小時唯一
    const since24h = new Date(Date.now() - ONE_DAY_MS);
    const exists = await Report.findOne({
      imageId,
      reporterId: user._id,
      type,
      createdAt: { $gte: since24h }
    }).lean();

    if (exists) {
      return NextResponse.json({ ok: false, message: "你已檢舉過此圖片（24 小時內同類型僅一次）" }, { status: 429 });
    }

    // 每小時最多 10 次
    const since1h = new Date(Date.now() - ONE_HOUR_MS);
    const count1h = await Report.countDocuments({
      reporterId: user._id,
      createdAt: { $gte: since1h }
    });
    if (count1h >= MAX_REPORTS_PER_HOUR) {
      return NextResponse.json({ ok: false, message: "本小時檢舉次數已達上限" }, { status: 429 });
    }

    const doc = await Report.create({
      imageId,
      reporterId: user._id,
      type,
      message: typeof message === "string" ? message.slice(0, 2000) : ""
    });

    // =============== 新增：寄信通知管理員 ===============
    try {
      const flags = extractMailFlags(req);
      const html = makeBasicTemplate({
        title: "🔔 新的圖片檢舉",
        bodyHtml: `
          <p><b>圖片 ID：</b> ${imageId}</p>
          <p><b>檢舉類型：</b> ${type}</p>
          <p><b>檢舉人：</b> ${user.email || user._id}</p>
          <p><b>備註：</b><br/>${(doc.message || "-").replace(/\n/g, "<br/>")}</p>
          <hr/>
          <p><b>圖片標題：</b> ${img.title || "-"}</p>
          <p><b>圖片作者 ID：</b> ${img.user}</p>
        `,
        footerHtml: "<p>請盡快進入管理後台審核。</p>",
      });

      await sendAdminMail(
        {
          subject: `【檢舉通知】${type} - ${imageId}`,
          html,
        },
        flags
      );
    } catch (mailErr) {
      console.error("寄送檢舉通知失敗：", mailErr);
    }
    // ====================================================

    return NextResponse.json({ ok: true, reportId: doc._id });
  } catch (err) {
    console.error("POST /api/reports error:", err);
    return NextResponse.json({ ok: false, message: "伺服器錯誤" }, { status: 500 });
  }
}

// 管理員查詢
export async function GET(req) {
  try {
    await dbConnect();
    const { user, error } = await requireUser();
    if (error) return error;
    if (!user.isAdmin) {
      return NextResponse.json({ ok: false, message: "沒有權限" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");   // open/action_taken/rejected/closed
    const type = searchParams.get("type");       // 同上 ALLOWED 之一
    const imageId = searchParams.get("imageId");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));

    const q = {};
    if (status) q.status = status;
    if (type) q.type = type;
    if (imageId && mongoose.Types.ObjectId.isValid(imageId)) q.imageId = imageId;

    const [items, total] = await Promise.all([
      Report.find(q).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      Report.countDocuments(q)
    ]);

    return NextResponse.json({ ok: true, items, total, page, pageSize });
  } catch (err) {
    console.error("GET /api/reports error:", err);
    return NextResponse.json({ ok: false, message: "伺服器錯誤" }, { status: 500 });
  }
}
