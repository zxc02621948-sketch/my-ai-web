// /app/api/auth/register/route.js

import { connectToDatabase } from "@/lib/mongodb";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { db } = await connectToDatabase();
    const body = await req.json();
    const { email, password, username } = body;

    // 基本欄位檢查
    if (!email || !password || !username) {
      return NextResponse.json(
        { success: false, message: "缺少必要欄位" },
        { status: 400 }
      );
    }

    // 檢查 email 是否已存在
    const existingUser = await db.collection("users").findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "此 Email 已被註冊" },
        { status: 409 }
      );
    }

    // 加密密碼
    const hashedPassword = await bcrypt.hash(password, 10);

    // 建立新使用者資料
    const newUser = {
      email,
      username,
      password: hashedPassword,
      createdAt: new Date(),
    };

    const result = await db.collection("users").insertOne(newUser);

    console.log("✅ 註冊成功！ID：", result.insertedId);

    return NextResponse.json(
      { success: true, message: "註冊成功", userId: result.insertedId },
      { status: 201 }
    );
  } catch (err) {
    console.error("❌ 註冊錯誤：", err);
    return NextResponse.json(
      { success: false, message: "伺服器錯誤" },
      { status: 500 }
    );
  }
}
