// /app/api/dev-create-user/route.js
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";

export async function POST(req) {
  try {
    await connectToDatabase();

    const { email, username, password, isAdmin } = await req.json();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "帳號已存在" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      email,
      username,
      password: hashedPassword,
      isVerified: true,
      isAdmin: isAdmin === true,
      lastVerificationEmailSentAt: null,
      createdAt: new Date(), // ✅ 加上這行保證時間存在
    });

    return NextResponse.json({
      success: true,
      message: "測試帳號建立成功",
      user: {
        email: newUser.email,
        username: newUser.username,
        isAdmin: newUser.isAdmin,
        createdAt: newUser.createdAt?.toISOString() ?? null, // ✅ 如果你想讓前端也用這個可以直接帶上
      },
    });
  } catch (error) {
    console.error("建立測試帳號錯誤：", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
