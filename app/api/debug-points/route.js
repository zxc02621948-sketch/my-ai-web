// app/api/debug-points/route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import User from "@/models/User";
import PointsTransaction from "@/models/PointsTransaction";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await dbConnect();
    
    // 只有管理員可以查詢
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser?.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "Missing userId parameter" }, { status: 400 });
    }

    // 查詢使用者基本資料
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 查詢最近30天的積分交易記錄
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    const transactions = await PointsTransaction.find({
      userId: userId,
      createdAt: { $gte: last30Days }
    }).sort({ createdAt: -1 }).limit(50);

    // 計算各類型積分累計
    const pointsSummary = {};
    for (const tx of transactions) {
      pointsSummary[tx.type] = (pointsSummary[tx.type] || 0) + tx.points;
    }

    return NextResponse.json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        pointsBalance: user.pointsBalance,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt
      },
      pointsSummary,
      transactions: transactions.map(tx => ({
        _id: tx._id,
        type: tx.type,
        points: tx.points,
        dateKey: tx.dateKey,
        sourceId: tx.sourceId,
        actorUserId: tx.actorUserId,
        createdAt: tx.createdAt
      }))
    });

  } catch (err) {
    console.error("❌ debug-points 錯誤:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}