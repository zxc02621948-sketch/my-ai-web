// app/api/account/deletion/cancel/route.js
// 步驟 5: 取消註銷請求

import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import { sendAccountDeletionCancelledEmail } from "@/lib/email";

export async function POST(req) {
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

    // 檢查是否有待刪除的請求
    if (!user.deletionRequestedAt || !user.deletionScheduledAt) {
      return NextResponse.json(
        { success: false, message: "沒有待刪除的請求" },
        { status: 400 }
      );
    }

    // 檢查是否已經過了刪除時間
    const now = new Date();
    if (user.deletionScheduledAt < now) {
      return NextResponse.json(
        { success: false, message: "帳號已過刪除時間，無法取消" },
        { status: 400 }
      );
    }

    // ✅ 取消刪除請求
    user.deletionRequestedAt = null;
    user.deletionScheduledAt = null;
    user.deletionCode = null;
    user.deletionCodeExpiresAt = null;
    await user.save();

    // 發送取消確認郵件
    try {
      await sendAccountDeletionCancelledEmail({ email: user.email });
    } catch (emailError) {
      console.error("發送取消確認郵件失敗：", emailError);
      // 即使郵件發送失敗，也返回成功
    }

    return NextResponse.json(
      { success: true, message: "帳號註銷已取消" },
      { status: 200 }
    );
  } catch (error) {
    console.error("取消註銷錯誤：", error);
    return NextResponse.json(
      { success: false, message: "伺服器錯誤" },
      { status: 500 }
    );
  }
}

