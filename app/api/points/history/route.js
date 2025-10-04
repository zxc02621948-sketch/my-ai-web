// app/api/points/history/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import PointsTransaction from "@/models/PointsTransaction";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await dbConnect();

    const current = await getCurrentUserFromRequest(req);
    if (!current?._id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") || 50), 100);
    const days = Math.min(Number(searchParams.get("days") || 30), 180);

    const since = new Date();
    since.setDate(since.getDate() - days);

    const list = await PointsTransaction.find({
      userId: current._id,
      createdAt: { $gte: since },
    })
      .sort({ createdAt: -1 })
      .limit(limit);

    const mapped = list.map((tx) => ({
      _id: tx._id,
      type: tx.type,
      points: tx.points,
      createdAt: tx.createdAt,
      dateKey: tx.dateKey,
      sourceId: tx.sourceId,
      actorUserId: tx.actorUserId,
      meta: tx.meta || {},
    }));

    return NextResponse.json({ ok: true, data: mapped });
  } catch (err) {
    console.error("[points] history 失敗:", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}