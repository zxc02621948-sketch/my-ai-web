// app/api/debug/visit-test/route.js
// 调试工具：测试访问记录功能
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import VisitorLog from "@/models/VisitorLog";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";

export async function GET(req) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
    }

    // 獲取 IP 地址
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0] : 
               req.headers.get("x-real-ip") || 
               req.ip || 
               "unknown";

    const userAgent = req.headers.get("user-agent") || "unknown";
    const userId = currentUser?._id || null;

    // 獲取最近 1 小時的訪問記錄
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentVisits = await VisitorLog.find({
      $or: [
        { userId: userId },
        { ip: ip }
      ],
      createdAt: { $gte: oneHourAgo }
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

    // 獲取今天的統計
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayVisits = await VisitorLog.countDocuments({
      createdAt: { $gte: today }
    });

    const todayUniqueUsers = await VisitorLog.aggregate([
      {
        $match: {
          createdAt: { $gte: today }
        }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $and: [{ $ne: ["$userId", null] }, { $ne: ["$userId", undefined] }] },
              { type: "user", id: "$userId" },
              { type: "anonymous", id: { $concat: ["$ip", "|", "$userAgent"] } }
            ]
          }
        }
      },
      {
        $count: "uniqueUsers"
      }
    ]);

    return NextResponse.json({
      debug: {
        currentUser: {
          userId: userId?.toString(),
          ip: ip.substring(0, 20) + "...",
          userAgent: userAgent.substring(0, 50) + "..."
        },
        recentVisits: recentVisits.map(v => ({
          path: v.path,
          visitId: v.visitId,
          createdAt: v.createdAt,
          userId: v.userId?.toString() || "anonymous",
          ip: v.ip?.substring(0, 15) + "..."
        })),
        todayStats: {
          totalVisits: todayVisits,
          uniqueUsers: todayUniqueUsers[0]?.uniqueUsers || 0
        }
      }
    });
  } catch (error) {
    console.error("[DEBUG-VISIT] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

