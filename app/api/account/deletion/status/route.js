// app/api/account/deletion/status/route.js
// 獲取帳號註銷狀態

import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";

export async function GET(req) {
  try {
    // 從 cookie 獲取用戶信息
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, message: "請先登入" },
        { status: 401 }
      );
    }

    await dbConnect();

    // 驗證 token 並獲取用戶
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

    const user = await User.findById(decoded.id);
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

