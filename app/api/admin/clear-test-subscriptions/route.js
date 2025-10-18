// app/api/admin/clear-test-subscriptions/route.js
// 管理員工具：清除測試訂閱

import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";

export async function POST(req) {
  try {
    await dbConnect();
    
    const authUser = await getCurrentUserFromRequest(req);
    if (!authUser) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }
    
    // 檢查是否為管理員
    if (!authUser.isAdmin) {
      return NextResponse.json({ error: "需要管理員權限" }, { status: 403 });
    }
    
    // 重新查詢用戶以獲取 Mongoose document
    const currentUser = await User.findById(authUser._id);
    if (!currentUser) {
      return NextResponse.json({ error: "用戶不存在" }, { status: 404 });
    }
    
    const beforeCount = currentUser.subscriptions?.length || 0;
    
    // 只清除測試訂閱（monthlyCost === 0 的訂閱）
    const beforeSubs = [...(currentUser.subscriptions || [])];
    currentUser.subscriptions = beforeSubs.filter(sub => sub.monthlyCost > 0);
    
    const clearedCount = beforeCount - currentUser.subscriptions.length;
    
    await currentUser.save();
    
    return NextResponse.json({ 
      success: true,
      message: `成功清除測試訂閱（共 ${clearedCount} 個），保留付費訂閱（${currentUser.subscriptions.length} 個）`,
      clearedCount: clearedCount,
      remainingCount: currentUser.subscriptions.length
    });
    
  } catch (error) {
    console.error("清除訂閱失敗:", error);
    return NextResponse.json({ 
      error: "清除失敗",
      details: error.message 
    }, { status: 500 });
  }
}

