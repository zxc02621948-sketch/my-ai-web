// app/api/admin/suspensions/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUser } from "@/lib/serverAuth";
import User from "@/models/User";
import Warning from "@/models/Warning";

/**
 * GET /api/admin/suspensions
 * query:
 *   q: string（搜尋 username 或 email 或 userId）
 *   status: "permanent" | "temporary" | ""(全部)
 *   page, pageSize
 */
export async function GET(req) {
  await dbConnect();
  const admin = await getCurrentUser();
  if (!admin || !admin.isAdmin) {
    return NextResponse.json({ ok: false, message: "沒有權限" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const email = (searchParams.get("email") || "").trim().toLowerCase();
  const status = (searchParams.get("status") || "").trim(); // permanent / temporary / ""
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));

  const filter = {};
  if (status === "permanent") {
    filter.isPermanentSuspension = true;
  } else if (status === "temporary") {
    filter.isSuspended = true;
    filter.isPermanentSuspension = { $ne: true };
  } else {
    // 全部鎖帳（包含永久 + 臨時）
    filter.$or = [{ isSuspended: true }, { isPermanentSuspension: true }];
  }

  // 若指定 email，優先用 email 精準搜尋
  if (email) {
    filter.email = email; // 你的 User.email 若已標準化為小寫，這樣最快；否則也可用 { $regex: new RegExp(`^${escapeRegExp(email)}$`, "i") }
  } else if (q) 

  if (q) {
    const maybeId = q.match(/^[a-f0-9]{24}$/i) ? q : null;
    filter.$or = [
      ...(filter.$or || []),
      { username: new RegExp(q, "i") },
      { email: new RegExp(q, "i") },
      ...(maybeId ? [{ _id: maybeId }] : []),
    ];
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .sort({ suspendedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .select("_id username email suspendedAt isSuspended isPermanentSuspension createdAt")
      .lean(),
    User.countDocuments(filter),
  ]);

  // 取每位使用者「目前有效警告數」
  const ids = items.map(u => u._id);
  let activeCounts = {};
  if (ids.length) {
    const now = new Date();
    const agg = await Warning.aggregate([
      { $match: { userId: { $in: ids }, isRevoked: false, expiresAt: { $gt: now } } },
      { $group: { _id: "$userId", c: { $sum: 1 } } },
    ]);
    activeCounts = Object.fromEntries(agg.map(r => [String(r._id), r.c]));
  }

  const data = items.map(u => ({
    ...u,
    activeWarnings: activeCounts[String(u._id)] || 0,
    suspensionType: u.isPermanentSuspension ? "permanent" : "temporary",
  }));

  return NextResponse.json({ ok: true, items: data, total, page, pageSize });
}
