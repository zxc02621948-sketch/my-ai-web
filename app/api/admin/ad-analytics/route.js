// app/api/admin/ad-analytics/route.js
import { dbConnect } from "@/lib/db";
import AdVisitorLog from "@/models/AdVisitorLog";
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

    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days')) || 7;
    const page = parseInt(url.searchParams.get('page')) || 1;
    const limit = parseInt(url.searchParams.get('limit')) || 20;

    // 計算日期範圍
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 📊 總體統計
    const [totalStats, dailyStats, pageStats, hourlyStats] = await Promise.all([
      // 總體統計
      AdVisitorLog.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            totalAdVisits: { $sum: 1 },
            uniqueUsers: {
              $addToSet: {
                $cond: [
                  { $and: [{ $ne: ["$userId", null] }, { $ne: ["$userId", undefined] }] },
                  "$userId",
                  { $concat: ["$ip", "|", "$userAgent"] }
                ]
              }
            },
            uniqueIPs: { $addToSet: "$ip" },
            uniqueSessions: { $addToSet: "$sessionId" }
          }
        },
        {
          $project: {
            totalAdVisits: 1,
            uniqueUsers: { $size: "$uniqueUsers" },
            uniqueIPs: { $size: "$uniqueIPs" },
            uniqueSessions: { $size: "$uniqueSessions" }
          }
        }
      ]),

      // 每日統計
      AdVisitorLog.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
                timezone: "Asia/Taipei"
              }
            },
            visits: { $sum: 1 },
            uniqueUsers: {
              $addToSet: {
                $cond: [
                  { $and: [{ $ne: ["$userId", null] }, { $ne: ["$userId", undefined] }] },
                  "$userId",
                  { $concat: ["$ip", "|", "$userAgent"] }
                ]
              }
            },
            uniqueIPs: { $addToSet: "$ip" }
          }
        },
        {
          $project: {
            date: "$_id",
            visits: 1,
            uniqueUsers: { $size: "$uniqueUsers" },
            uniqueIPs: { $size: "$uniqueIPs" }
          }
        },
        { $sort: { date: -1 } }
      ]),

      // 頁面統計
      AdVisitorLog.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: "$path",
            visits: { $sum: 1 },
            uniqueUsers: {
              $addToSet: {
                $cond: [
                  { $and: [{ $ne: ["$userId", null] }, { $ne: ["$userId", undefined] }] },
                  "$userId",
                  { $concat: ["$ip", "|", "$userAgent"] }
                ]
              }
            }
          }
        },
        {
          $project: {
            path: "$_id",
            visits: 1,
            uniqueUsers: { $size: "$uniqueUsers" }
          }
        },
        { $sort: { visits: -1 } },
        { $limit: 20 }
      ]),

      // 小時分佈統計
      AdVisitorLog.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              $hour: {
                date: "$createdAt",
                timezone: "Asia/Taipei"
              }
            },
            visits: { $sum: 1 }
          }
        },
        { $sort: { "_id": 1 } }
      ])
    ]);

    // 📈 廣告收益估算（基於不同的CPM模型）
    const totalAdVisits = totalStats[0]?.totalAdVisits || 0;
    const uniqueUsers = totalStats[0]?.uniqueUsers || 0;
    
    // 不同CPM模型的收益估算
    const revenueEstimates = {
      conservative: {
        cpm: 0.5, // 保守估計 $0.5 CPM
        dailyRevenue: (totalAdVisits / days) * 0.5 / 1000,
        monthlyRevenue: (totalAdVisits / days) * 30 * 0.5 / 1000
      },
      moderate: {
        cpm: 2.0, // 中等估計 $2.0 CPM
        dailyRevenue: (totalAdVisits / days) * 2.0 / 1000,
        monthlyRevenue: (totalAdVisits / days) * 30 * 2.0 / 1000
      },
      optimistic: {
        cpm: 5.0, // 樂觀估計 $5.0 CPM
        dailyRevenue: (totalAdVisits / days) * 5.0 / 1000,
        monthlyRevenue: (totalAdVisits / days) * 30 * 5.0 / 1000
      }
    };

    // 📊 最近訪問記錄（分頁）
    const skip = (page - 1) * limit;
    const recentVisits = await AdVisitorLog.find({
      createdAt: { $gte: startDate, $lte: endDate }
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select('path ip visitId userAgent userId createdAt referrer sessionId');

    const totalRecords = await AdVisitorLog.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate }
    });

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalAdVisits,
          uniqueUsers,
          uniqueIPs: totalStats[0]?.uniqueIPs || 0,
          uniqueSessions: totalStats[0]?.uniqueSessions || 0,
          averageVisitsPerDay: Math.round(totalAdVisits / days),
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            days
          }
        },
        revenueEstimates,
        dailyStats,
        pageStats,
        hourlyStats: Array.from({ length: 24 }, (_, hour) => ({
          hour,
          visits: hourlyStats.find(h => h._id === hour)?.visits || 0
        })),
        recentVisits: {
          data: recentVisits,
          pagination: {
            page,
            limit,
            total: totalRecords,
            totalPages: Math.ceil(totalRecords / limit)
          }
        }
      }
    }, { status: 200 });

  } catch (error) {
    console.error('[AD-ANALYTICS] Error:', error);
    return NextResponse.json({
      success: false,
      error: '獲取廣告收益統計失敗'
    }, { status: 500 });
  }
}