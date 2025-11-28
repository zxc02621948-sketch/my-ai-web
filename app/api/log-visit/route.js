// app/api/log-visit/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import VisitorLog from "@/models/VisitorLog";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import { v4 as uuidv4 } from "uuid";

export async function POST(req) {
  try {
    await dbConnect();

    const { path } = await req.json();
    
    // 獲取 IP 地址
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0] : 
               req.headers.get("x-real-ip") || 
               req.ip || 
               "unknown";

    // 獲取 User Agent
    const userAgent = req.headers.get("user-agent") || "unknown";

    // 獲取當前用戶（如果已登錄）
    const currentUser = await getCurrentUserFromRequest(req);
    const userId = currentUser?._id || null;

    // ✅ 檢查隱私設定：如果用戶關閉了數據分析，則不記錄訪問
    if (currentUser && currentUser.privacyPreferences?.allowDataAnalytics === false) {
      return NextResponse.json({ 
        success: true, 
        message: "訪問記錄已跳過（用戶已關閉數據分析）",
        skipped: true
      });
    }

    // ✅ 檢查是否在最近 30 秒內有相同的訪問記錄（避免重複記錄）
    // 注意：對於不同用戶（userId），即使路徑和 IP 相同，也應該記錄
    // 對於匿名用戶，使用 IP + UserAgent 組合來識別
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
    
    // 構建查詢條件：已登錄用戶按 userId 匹配，匿名用戶按 IP + UserAgent 匹配
    let duplicateQuery;
    if (userId) {
      // 已登錄用戶：必須匹配 userId、path、ip、userAgent
      duplicateQuery = {
        path: path || "/",
        ip,
        userAgent,
        userId: userId,
        createdAt: { $gte: thirtySecondsAgo }
      };
    } else {
      // 匿名用戶：匹配 userId 為 null 或不存在，且 path、ip、userAgent 相同
      duplicateQuery = {
        path: path || "/",
        ip,
        userAgent,
        $or: [
          { userId: null },
          { userId: { $exists: false } }
        ],
        createdAt: { $gte: thirtySecondsAgo }
      };
    }
    
    const existingVisit = await VisitorLog.findOne(duplicateQuery);

    if (existingVisit) {
      return NextResponse.json({ 
        success: true, 
        visitId: existingVisit.visitId,
        message: "訪問記錄已存在（跳過重複記錄）",
        skipped: true,
        reason: "duplicate_within_30s",
        existingVisitTime: existingVisit.createdAt
      });
    }

    // ✅ 額外檢查：防止同一 IP + UserAgent 在 5 秒內的任何重複記錄（但允許不同用戶）
    // 這個檢查主要是防止同一個用戶快速刷新頁面
    const fiveSecondsAgo = new Date(Date.now() - 5 * 1000);
    let recentSameIpQuery;
    if (userId) {
      // 已登錄用戶：必須匹配 userId、ip、userAgent
      recentSameIpQuery = {
        ip,
        userAgent,
        userId: userId,
        createdAt: { $gte: fiveSecondsAgo }
      };
    } else {
      // 匿名用戶：匹配 userId 為 null 或不存在，且 ip、userAgent 相同
      recentSameIpQuery = {
        ip,
        userAgent,
        $or: [
          { userId: null },
          { userId: { $exists: false } }
        ],
        createdAt: { $gte: fiveSecondsAgo }
      };
    }
    
    const recentSameIpVisit = await VisitorLog.findOne(recentSameIpQuery);

    if (recentSameIpVisit) {
      return NextResponse.json({ 
        success: true, 
        visitId: recentSameIpVisit.visitId,
        message: "同 IP 短時間內重複訪問（跳過記錄）",
        skipped: true,
        reason: "same_ip_within_5s",
        existingVisitTime: recentSameIpVisit.createdAt
      });
    }

    // 生成唯一的訪問 ID
    const visitId = uuidv4();

    // 記錄訪問
    const visitorLog = new VisitorLog({
      path: path || "/",
      ip,
      visitId,
      userAgent,
      userId,
      createdAt: new Date()
    });

    await visitorLog.save();

    return NextResponse.json({ 
      success: true, 
      visitId,
      message: "訪問記錄成功",
      logged: true,
      timestamp: new Date().toISOString(),
      path: path || "/",
      userId: userId || null,
      ip: ip.substring(0, 10) + "..."
    });

  } catch (error) {
    console.error("記錄訪問失敗:", error);
    return NextResponse.json(
      { success: false, error: "記錄訪問失敗" },
      { status: 500 }
    );
  }
}