// /app/api/auth/register/route.js

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import { authLimiter, withRateLimit } from "@/lib/rateLimit";

async function registerHandler(req) {
  try {
    await dbConnect();
    const body = await req.json();
    const { email, password, username } = body;

    // 基本欄位檢查
    if (!email || !password || !username) {
      return NextResponse.json(
        { success: false, message: "缺少必要欄位" },
        { status: 400 },
      );
    }

    // 檢查 email 是否已存在
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "此 Email 已被註冊" },
        { status: 409 },
      );
    }

    // 加密密碼
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      email,
      username,
      password: hashedPassword,
      createdAt: new Date(),
    });

    console.log("✅ 註冊成功！ID：", newUser._id);

    return NextResponse.json(
      { success: true, message: "註冊成功", userId: newUser._id },
      { status: 201 },
    );
  } catch (err) {
    console.error("❌ 註冊錯誤：", err);
    return NextResponse.json(
      { success: false, message: "伺服器錯誤" },
      { status: 500 },
    );
  }
}

export const POST = withRateLimit(registerHandler, authLimiter);
