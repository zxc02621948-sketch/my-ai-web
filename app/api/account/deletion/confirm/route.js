// app/api/account/deletion/confirm/route.js
// 步驟 3: 驗證驗證碼並啟動刪除流程

import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";

export async function POST(req) {
  try {
    const { code } = await req.json();

    if (!code || code.length !== 6) {
      return NextResponse.json(
        { success: false, message: "請輸入 6 位數驗證碼" },
        { status: 400 }
      );
    }

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

    // ✅ 步驟 3: 驗證驗證碼
    if (!user.deletionCode) {
      return NextResponse.json(
        { success: false, message: "請先申請註銷並獲取驗證碼" },
        { status: 400 }
      );
    }

    if (user.deletionCode !== code) {
      return NextResponse.json(
        { success: false, message: "驗證碼錯誤" },
        { status: 401 }
      );
    }

    const now = new Date();
    if (!user.deletionCodeExpiresAt || user.deletionCodeExpiresAt < now) {
      return NextResponse.json(
        { success: false, message: "驗證碼已過期，請重新申請" },
        { status: 401 }
      );
    }

    // ✅ 驗證成功，確認刪除流程已啟動
    // deletionScheduledAt 已在發送驗證碼時設置，這裡只需要確認
    // 實際刪除將由定時任務執行

    return NextResponse.json(
      {
        success: true,
        message: "帳號註銷已確認",
        deletionScheduledAt: user.deletionScheduledAt.toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("確認註銷錯誤：", error);
    return NextResponse.json(
      { success: false, message: "伺服器錯誤" },
      { status: 500 }
    );
  }
}

