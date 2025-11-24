// app/api/admin/account-deletion/simulate-time/route.js
// 模擬時間調整（管理員專用，用於測試）

import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";

export async function POST(req) {
  try {
    // 驗證管理員權限
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, message: "請先登入" },
        { status: 401 }
      );
    }

    await dbConnect();

    const jwt = require("jsonwebtoken");
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return NextResponse.json(
        { success: false, message: "無效的登入狀態" },
        { status: 401 }
      );
    }

    const admin = await User.findById(decoded.id);
    if (!admin || !admin.isAdmin) {
      return NextResponse.json(
        { success: false, message: "權限不足" },
        { status: 403 }
      );
    }

    const { userId, hours } = await req.json();
    if (!userId || hours === undefined) {
      return NextResponse.json(
        { success: false, message: "缺少必要參數" },
        { status: 400 }
      );
    }

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "找不到用戶" },
        { status: 404 }
      );
    }

    if (!user.deletionScheduledAt) {
      return NextResponse.json(
        { success: false, message: "該用戶沒有待刪除的請求" },
        { status: 400 }
      );
    }

    // 調整刪除時間
    const currentTime = new Date(user.deletionScheduledAt);
    const newTime = new Date(currentTime.getTime() + hours * 60 * 60 * 1000);
    user.deletionScheduledAt = newTime;
    await user.save();

    return NextResponse.json(
      {
        success: true,
        message: "時間已調整",
        newDeletionScheduledAt: newTime.toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("調整刪除時間錯誤：", error);
    return NextResponse.json(
      { success: false, message: "伺服器錯誤" },
      { status: 500 }
    );
  }
}

