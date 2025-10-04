import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import Image from "@/models/Image";
import LikeLog from "@/models/LikeLog";
import Comment from "@/models/Comment";
import VisitorLog from "@/models/VisitorLog";

export async function GET() {
  try {
    await dbConnect();

    // 今天 0 點
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days = [];

    // 取最近 7 天
    for (let i = 6; i >= 0; i--) {
      const start = new Date(today);
      start.setDate(today.getDate() - i);
      const end = new Date(start);
      end.setDate(start.getDate() + 1);

      // 註冊
      const registrations = await User.countDocuments({
        createdAt: { $gte: start, $lt: end },
      });

      // 上傳（Image 集合）
      const uploads = await Image.countDocuments({
        createdAt: { $gte: start, $lt: end },
      });

      // 愛心（LikeLog 集合）
      const likes = await LikeLog.countDocuments({
        createdAt: { $gte: start, $lt: end },
      });

      // 留言
      const comments = await Comment.countDocuments({
        createdAt: { $gte: start, $lt: end },
      });

      // 訪問次數
      const visits = await VisitorLog.countDocuments({
        createdAt: { $gte: start, $lt: end },
      });

      // 訪問人數 (混合識別：已登錄用戶按 userId，匿名用戶按 IP+UserAgent)
      const uniqueUsersResult = await VisitorLog.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lt: end },
          },
        },
        {
          $group: {
            _id: {
              $cond: [
                { $and: [{ $ne: ["$userId", null] }, { $ne: ["$userId", undefined] }] },
                { type: "user", id: "$userId" },
                { type: "anonymous", id: { $concat: ["$ip", "|", "$userAgent"] } }
              ]
            },
          },
        },
        {
          $count: "uniqueUsers"
        }
      ]);

      days.push({
        date: start.toISOString().split("T")[0], // YYYY-MM-DD
        registrations,
        uploads,
        likes,
        comments,
        people: uniqueUsersResult[0]?.uniqueUsers || 0,
        visits,
      });
    }

    return NextResponse.json({ ok: true, summary: days });
  } catch (err) {
    console.error("Analytics summary error:", err);
    return NextResponse.json(
      { ok: false, error: "伺服器錯誤" },
      { status: 500 }
    );
  }
}
