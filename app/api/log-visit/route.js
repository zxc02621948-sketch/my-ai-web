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

    // 檢查是否在最近 30 秒內有相同的訪問記錄（避免重複記錄）
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
    const existingVisit = await VisitorLog.findOne({
      path: path || "/",
      ip,
      userAgent,
      userId,
      createdAt: { $gte: thirtySecondsAgo }
    });

    if (existingVisit) {
      console.log(`🔄 跳過重複訪問記錄: ${path} - IP: ${ip.substring(0, 10)}... - User: ${userId || 'anonymous'}`);
      return NextResponse.json({ 
        success: true, 
        visitId: existingVisit.visitId,
        message: "訪問記錄已存在（跳過重複記錄）" 
      });
    }

    // 額外檢查：防止同一 IP 在 5 秒內的任何重複記錄
    const fiveSecondsAgo = new Date(Date.now() - 5 * 1000);
    const recentSameIpVisit = await VisitorLog.findOne({
      ip,
      createdAt: { $gte: fiveSecondsAgo }
    });

    if (recentSameIpVisit) {
      console.log(`🔄 跳過同 IP 短時間重複訪問: ${ip.substring(0, 10)}...`);
      return NextResponse.json({ 
        success: true, 
        visitId: recentSameIpVisit.visitId,
        message: "同 IP 短時間內重複訪問（跳過記錄）" 
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
      message: "訪問記錄成功" 
    });

  } catch (error) {
    console.error("記錄訪問失敗:", error);
    return NextResponse.json(
      { success: false, error: "記錄訪問失敗" },
      { status: 500 }
    );
  }
}