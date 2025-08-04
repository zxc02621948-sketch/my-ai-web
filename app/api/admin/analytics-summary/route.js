// app/api/admin/analytics-summary/route.js
import { dbConnect } from "@/lib/db";
import VisitorLog from "@/models/VisitorLog";
import User from "@/models/User";
import Image from "@/models/Image";
import Comment from "@/models/Comment";
import LikeLog from "@/models/LikeLog";
import { verifyToken } from "@/lib/serverAuth";

export async function GET(req) {
  await dbConnect();

  const cookie = req.headers.get("cookie");
  const token = cookie?.match(/token=([^;]+)/)?.[1];
  const tokenData = token ? verifyToken(token) : null;

  if (!tokenData?.isAdmin) {
    return new Response("Forbidden", { status: 403 });
  }

  const summary = [];

  for (let i = 0; i < 7; i++) {
    const localDate = new Date();
    localDate.setDate(localDate.getDate() - i);

    // 取出當地年月日
    const dateLabel = localDate.toISOString().split("T")[0];

    // 明確建構 UTC 時區的當天 00:00:00 ～ 23:59:59
    const start = new Date(`${dateLabel}T00:00:00.000Z`);
    const end = new Date(`${dateLabel}T23:59:59.999Z`);

    const [visitGroup, newUsers, uploads, likes, comments] = await Promise.all([
      VisitorLog.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: {
              $cond: [
                { $ifNull: ["$visitId", false] },
                "$visitId",
                "$ip",
              ],
            },
            count: { $sum: 1 },
          },
        },
      ]),
      User.countDocuments({ createdAt: { $gte: start, $lte: end } }),
      Image.countDocuments({ createdAt: { $gte: start, $lte: end } }),
      LikeLog.countDocuments({ createdAt: { $gte: start, $lte: end } }),
      Comment.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    ]);

    summary.push({
      date: dateLabel,
      uniqueIps: visitGroup.length,
      totalVisits: visitGroup.reduce((sum, v) => sum + v.count, 0),
      newUsers,
      imagesUploaded: uploads,
      likesGiven: likes,
      commentsPosted: comments,
    });
  }

  return new Response(JSON.stringify({ summary }), { status: 200 });
}
