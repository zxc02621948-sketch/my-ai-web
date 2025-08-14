import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUser } from "@/lib/serverAuth";
import Warning from "@/models/Warning";
import User from "@/models/User";
import Image from "@/models/Image";
import { applyPermanentLockIfNeeded } from "@/lib/warnings";

async function sendSystemNotice(userId, subject, body) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/messages/system`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserId: userId, subject, body }),
    });
  } catch {}
}

export async function POST(req) {
  await dbConnect();
  const admin = await getCurrentUser();
  if (!admin || !admin.isAdmin) {
    return NextResponse.json({ ok: false, message: "沒有權限" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { userId, email, reasonCode, imageId, reportId, note, days = 60, sendMessage = true } = body || {};
  if (!["policy_violation","category_wrong","rating_wrong","duplicate_content"].includes(reasonCode)) {
    return NextResponse.json({ ok: false, message: "參數錯誤（reasonCode）" }, { status: 400 });
  }

  // 允許用 email 或 userId 指定對象（擇一）
  let targetUserId = userId || null;
  if (!targetUserId && email) {
    const byEmail = await User.findOne({ email: String(email).toLowerCase() }).select("_id").lean();
    if (!byEmail) return NextResponse.json({ ok: false, message: "找不到此 Email 的使用者" }, { status: 404 });
    targetUserId = byEmail._id;
  }
  if (!targetUserId) {
    return NextResponse.json({ ok: false, message: "必須提供 userId 或 email" }, { status: 400 });
  }

  const user = await User.findById(targetUserId).select("_id").lean();
  if (!user) return NextResponse.json({ ok: false, message: "找不到使用者" }, { status: 404 });
  if (imageId) {
    const img = await Image.findById(imageId).select("_id").lean();
    if (!img) return NextResponse.json({ ok: false, message: "找不到圖片" }, { status: 404 });
  }

  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const warn = await Warning.create({
    userId: targetUserId, reasonCode, imageId, reportId, note: (note || "").slice(0, 2000), expiresAt });

  const { activeWarnings, isSuspended, isPermanentSuspension } = await applyPermanentLockIfNeeded(targetUserId);

  if (sendMessage) {
    const subject = "帳號警告通知";
    const bodyText =
`你收到一次警告（理由：${reasonCode}）。
本次警告將於 ${expiresAt.toLocaleDateString()} 自動失效。
目前有效警告數：${activeWarnings}（兩個月內累積滿 3 支將永久鎖帳）。`;
    await sendSystemNotice(targetUserId, subject, bodyText);
  }

  return NextResponse.json({ ok: true, warningId: warn._id, activeWarnings, isSuspended, isPermanentSuspension });
}

export async function GET(req) {
  await dbConnect();
  const admin = await getCurrentUser();
  if (!admin || !admin.isAdmin) {
    return NextResponse.json({ ok: false, message: "沒有權限" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const email = searchParams.get("email");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));

  let q = {};
  if (email) {
    const u = await User.findOne({ email: String(email).toLowerCase() }).select("_id").lean();
    if (!u) return NextResponse.json({ ok: true, items: [], total: 0, page, pageSize }); // 沒找到就回空結果
    q.userId = u._id;
  } else if (userId) {
    q.userId = userId;
  }
  const [items, total] = await Promise.all([
    Warning.find(q).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Warning.countDocuments(q),
  ]);

  return NextResponse.json({ ok: true, items, total, page, pageSize });
}
