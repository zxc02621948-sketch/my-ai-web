// app/api/admin/analytics-summary/route.js
import { dbConnect } from "@/lib/db";
import VisitorLog from "@/models/VisitorLog";
import User from "@/models/User";
import Image from "@/models/Image";
import Comment from "@/models/Comment";
import LikeLog from "@/models/LikeLog";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await dbConnect();

    // 從數據庫獲取用戶信息（而不是從 JWT token）
    const currentUser = await getCurrentUserFromRequest(req);
    
    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
    }

  const summary = [];

  // 使用台灣時區（UTC+8）
  const timezone = '+08:00';

  for (let i = 6; i >= 0; i--) {
    // 計算本地日期（從6天前到今天）
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - i);
    targetDate.setHours(0, 0, 0, 0);
    
    // 取出當地年月日（使用本地時間格式化）
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const dateLabel = `${year}-${month}-${day}`;

    // 建構台灣時區的開始和結束時間（轉換為 UTC）
    // 台灣時區 UTC+8，所以需要減去 8 小時
    const localStart = new Date(`${dateLabel}T00:00:00${timezone}`);
    const localEnd = new Date(`${dateLabel}T23:59:59.999${timezone}`);
    
    // 轉換為 UTC 時間進行數據庫查詢
    const start = new Date(localStart.getTime());
    const end = new Date(localEnd.getTime());

    const [uniqueUsersResult, totalVisitsResult, newUsers, uploads, likes, comments] = await Promise.all([
      // 計算獨立用戶數（混合識別：已登錄用戶按 userId，匿名用戶按 IP+UserAgent）
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
      ]),
      // 計算總訪問次數（按 visitId 計算）
      VisitorLog.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: "$visitId",
          },
        },
        {
          $count: "totalVisits"
        }
      ]),
      User.countDocuments({ createdAt: { $gte: start, $lte: end } }),
      Image.countDocuments({ createdAt: { $gte: start, $lte: end } }),
      LikeLog.countDocuments({ createdAt: { $gte: start, $lte: end } }),
      Comment.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    ]);

    summary.push({
      date: dateLabel,
      uniqueUsers: uniqueUsersResult[0]?.uniqueUsers || 0,
      totalVisits: totalVisitsResult[0]?.totalVisits || 0,
      newUsers,
      imagesUploaded: uploads,
      likesGiven: likes,
      commentsPosted: comments,
    });
  }

  // 按日期排序（從最新到最舊）
  summary.sort((a, b) => new Date(b.date) - new Date(a.date));

  return NextResponse.json({ summary }, { status: 200 });
  } catch (error) {
    console.error('[ANALYTICS-SUMMARY] Error:', error);
    return NextResponse.json(
      { error: "獲取流量統計失敗" },
      { status: 500 }
    );
  }
}
