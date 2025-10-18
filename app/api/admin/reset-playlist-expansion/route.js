// 重置播放清單擴充購買記錄
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";
import User from "@/models/User";
import PointsTransaction from "@/models/PointsTransaction";

export async function GET(req) {
  try {
    await dbConnect();
    const authUser = await getCurrentUserFromRequest(req);
    
    if (!authUser) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }
    
    const user = await User.findById(authUser._id);
    
    if (!user) {
      return NextResponse.json({ error: "用戶不存在" }, { status: 404 });
    }
    
    // 重置播放清單上限到 5
    const oldMaxSize = user.playlistMaxSize || 5;
    user.playlistMaxSize = 5;
    
    // 計算需要退回的積分
    const expansionTransactions = await PointsTransaction.find({
      userId: user._id,
      type: "playlist_expansion"
    }).sort({ createdAt: -1 });
    
    let totalRefund = 0;
    for (const transaction of expansionTransactions) {
      totalRefund += Math.abs(transaction.points); // 因為是負數，所以用 abs
    }
    
    // 退回積分
    if (totalRefund > 0) {
      user.pointsBalance += totalRefund;
    }
    
    await user.save();
    
    // 刪除播放清單擴充的交易記錄
    await PointsTransaction.deleteMany({
      userId: user._id,
      type: "playlist_expansion"
    });
    
    return NextResponse.json({
      success: true,
      message: `重置成功！播放清單上限已重置為 5 首，退回 ${totalRefund} 積分`,
      data: {
        oldMaxSize,
        newMaxSize: 5,
        refundedPoints: totalRefund,
        newBalance: user.pointsBalance,
        deletedTransactions: expansionTransactions.length
      }
    });
    
  } catch (error) {
    console.error("重置播放清單擴充失敗:", error);
    return NextResponse.json({ error: "重置失敗" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const authUser = await getCurrentUserFromRequest(req);
    
    if (!authUser) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }
    
    const user = await User.findById(authUser._id);
    
    if (!user) {
      return NextResponse.json({ error: "用戶不存在" }, { status: 404 });
    }
    
    // 重置播放清單上限到 5
    const oldMaxSize = user.playlistMaxSize || 5;
    user.playlistMaxSize = 5;
    
    // 計算需要退回的積分
    const expansionTransactions = await PointsTransaction.find({
      userId: user._id,
      type: "playlist_expansion"
    }).sort({ createdAt: -1 });
    
    let totalRefund = 0;
    for (const transaction of expansionTransactions) {
      totalRefund += Math.abs(transaction.points); // 因為是負數，所以用 abs
    }
    
    // 退回積分
    if (totalRefund > 0) {
      user.pointsBalance += totalRefund;
    }
    
    await user.save();
    
    // 刪除播放清單擴充的交易記錄
    await PointsTransaction.deleteMany({
      userId: user._id,
      type: "playlist_expansion"
    });
    
    return NextResponse.json({
      success: true,
      message: `重置成功！播放清單上限已重置為 5 首，退回 ${totalRefund} 積分`,
      data: {
        oldMaxSize,
        newMaxSize: 5,
        refundedPoints: totalRefund,
        newBalance: user.pointsBalance,
        deletedTransactions: expansionTransactions.length
      }
    });
    
  } catch (error) {
    console.error("重置播放清單擴充失敗:", error);
    return NextResponse.json({ error: "重置失敗" }, { status: 500 });
  }
}
