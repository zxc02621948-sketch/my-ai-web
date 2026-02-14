// app/api/account/deletion/status/route.js
// 獲取帳號註銷狀態

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

    await dbConnect();
    const user = await User.findById(currentUser._id);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "找不到用戶" },
        { status: 404 }
      );
    }

    const hasDeletionRequest =
      user.deletionRequestedAt && user.deletionScheduledAt;

    return NextResponse.json(
      {
        success: true,
        hasDeletionRequest,
        deletionRequestedAt: user.deletionRequestedAt
          ? user.deletionRequestedAt.toISOString()
          : null,
        deletionScheduledAt: user.deletionScheduledAt
          ? user.deletionScheduledAt.toISOString()
          : null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("獲取註銷狀態錯誤：", error);
    return NextResponse.json(
      { success: false, message: "伺服器錯誤" },
      { status: 500 }
    );
  }
}

