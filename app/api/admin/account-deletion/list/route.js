// app/api/admin/account-deletion/list/route.js
// 獲取所有待刪除的帳號列表（管理員專用）

import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import { getCurrentUserFromRequest } from "@/lib/serverAuth";

export async function GET(req) {
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

    // 查找所有有刪除請求的用戶
    const users = await User.find({
      deletionRequestedAt: { $ne: null },
    })
      .select("_id username email deletionRequestedAt deletionScheduledAt")
      .sort({ deletionScheduledAt: 1 }); // 按刪除時間排序

    return NextResponse.json(
      {
        success: true,
        users: users.map((user) => ({
          _id: user._id.toString(),
          username: user.username,
          email: user.email,
          deletionRequestedAt: user.deletionRequestedAt?.toISOString() || null,
          deletionScheduledAt: user.deletionScheduledAt?.toISOString() || null,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("獲取待刪除帳號列表錯誤：", error);
    return NextResponse.json(
      { success: false, message: "伺服器錯誤" },
      { status: 500 }
    );
  }
}

