// app/api/admin/restore-paid-subscription/route.js
// 管理員工具：還原付費訂閱（如果被誤刪）

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
    
    const { daysToAdd = 30 } = await req.json();
    
    // 重新查詢用戶
    const currentUser = await User.findById(authUser._id);
    if (!currentUser) {
      return NextResponse.json({ error: "用戶不存在" }, { status: 404 });
    }
    
    // 檢查是否已有 pinPlayer 訂閱
    const existingSub = currentUser.subscriptions?.find(s => s.type === 'pinPlayer' && s.isActive);
    
    if (existingSub) {
      return NextResponse.json({ 
        success: false,
        message: "已有 pinPlayer 訂閱",
        subscription: existingSub
      });
    }
    
    // 添加付費訂閱
    const startDate = new Date();
    const expiresAt = new Date(startDate);
    expiresAt.setDate(expiresAt.getDate() + daysToAdd);
    
    currentUser.subscriptions.push({
      type: 'pinPlayer',
      startDate: startDate,
      expiresAt: expiresAt,
      isActive: true,
      monthlyCost: 200, // 標記為付費訂閱
      lastRenewedAt: startDate
    });
    
    await currentUser.save();
    
    return NextResponse.json({ 
      success: true,
      message: `成功還原付費訂閱（${daysToAdd} 天）`,
      subscription: {
        type: 'pinPlayer',
        startDate: startDate,
        expiresAt: expiresAt,
        monthlyCost: 200,
        daysLeft: daysToAdd
      }
    });
    
  } catch (error) {
    console.error("還原訂閱失敗:", error);
    return NextResponse.json({ 
      error: "還原失敗",
      details: error.message 
    }, { status: 500 });
  }
}

