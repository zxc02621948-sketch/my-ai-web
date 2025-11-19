import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import PointsTransaction from "@/models/PointsTransaction";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";

const BASE_RULES = {
  upload: { points: 5, baseLimit: 20 },
  video_upload: { points: 10, baseLimit: 20 },
  music_upload: { points: 10, baseLimit: 20 },
  like_received: { points: 1, baseLimit: 10 },
  comment_received: { points: 1, baseLimit: 5 },
  daily_login: { points: 5, baseLimit: 5 },
  like_given: { points: 1, baseLimit: 5 },
};

export async function GET(req) {
  try {
    await dbConnect();

    const user = await getCurrentUserFromRequest(req);
    if (!user?._id) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const todayKey = new Date().toISOString().slice(0, 10);
    const userObjectId = new mongoose.Types.ObjectId(user._id);

    const list = await PointsTransaction.aggregate([
      { $match: { userId: userObjectId, dateKey: todayKey } },
      { $group: { _id: "$type", total: { $sum: "$points" } } },
    ]);

    const summary = {};

    for (const key of Object.keys(BASE_RULES)) {
      const rule = BASE_RULES[key];
      summary[key] = {
        today: 0,
        limit: rule.baseLimit,
      };
    }

    for (const item of list) {
      if (summary[item._id]) {
        summary[item._id].today = item.total;
      }
    }

    return NextResponse.json({ ok: true, data: summary });
  } catch (error) {
    console.error("[points/daily-summary] error", error);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

