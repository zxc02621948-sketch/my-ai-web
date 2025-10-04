// app/api/points/daily-login/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import { creditPoints } from "@/services/pointsService";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    await dbConnect();
    const current = await getCurrentUserFromRequest(req);
    if (!current?._id) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const result = await creditPoints({ userId: current._id, type: "daily_login", actorUserId: current._id });

    // 若已達上限或重複，回傳 ok:false 但不視為錯
    if (!result.ok) {
      return NextResponse.json({ ok: false, reason: result.reason || "unknown" }, { status: 200 });
    }

    return NextResponse.json({ ok: true, added: result.added });
  } catch (err) {
    console.error("[points] daily-login 失敗:", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}