// app/api/admin/suspensions/[id]/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUser } from "@/lib/serverAuth";
import User from "@/models/User";

export async function PATCH(req, ctx) {
  await dbConnect();
  const admin = await getCurrentUser();
  if (!admin || !admin.isAdmin) {
    return NextResponse.json({ ok: false, message: "沒有權限" }, { status: 403 });
  }
  const params = await ctx;
  const id = params?.id;
  const body = await req.json().catch(() => ({}));
  const { unlock = false } = body;

  const u = await User.findById(id);
  if (!u) return NextResponse.json({ ok: false, message: "找不到使用者" }, { status: 404 });

  if (unlock) {
    // 你的規則：永久鎖需人工解鎖 → 這裡就是人工解鎖
    u.isSuspended = false;
    u.isPermanentSuspension = false;
    u.suspendedAt = null;
    await u.save();
  }

  return NextResponse.json({ ok: true });
}
