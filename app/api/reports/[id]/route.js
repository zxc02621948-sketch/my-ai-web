// /app/api/reports/[id]/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Report from "@/models/Report";
import { getCurrentUser } from "@/lib/serverAuth";
import mongoose from "mongoose";

export async function PATCH(req, { params }) {
  try {
    await dbConnect();
    const user = await getCurrentUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json({ ok: false, message: "沒有權限" }, { status: 403 });
    }

    const id = params?.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, message: "無效的 report id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { status } = body || {};
    const ALLOWED_STATUS = ["open","action_taken","rejected","closed"];
    if (!ALLOWED_STATUS.includes(status)) {
      return NextResponse.json({ ok: false, message: "無效的狀態" }, { status: 400 });
    }

    const updated = await Report.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ ok: false, message: "找不到報告" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item: updated });
  } catch (err) {
    console.error("PATCH /api/reports/[id] error:", err);
    return NextResponse.json({ ok: false, message: "伺服器錯誤" }, { status: 500 });
  }
}
