// app/api/admin/account-deletion/list/route.js
// 獲取所有待刪除的帳號列表（管理員專用）

import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";

export async function GET(req) {
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

