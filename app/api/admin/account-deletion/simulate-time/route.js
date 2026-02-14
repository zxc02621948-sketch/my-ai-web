// app/api/admin/account-deletion/simulate-time/route.js
// 模擬時間調整（管理員專用，用於測試）

import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";

export async function POST(req) {
  try {
    const currentUser = await getCurrentUserFromRequest(req).catch(() => null);
    if (!currentUser?._id) {
      return NextResponse.json(
        { success: false, message: "請先登入" },
        { status: 401 }
      );
    }
    if (!currentUser.isAdmin) {
      return NextResponse.json(
        { success: false, message: "權限不足" },
        { status: 403 }
      );
    }

    await dbConnect();

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

