// /app/api/dev-create-user/route.js
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";

export async function POST(req) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
    }

    const routeSecret = process.env.DEV_CREATE_USER_SECRET?.trim();
    if (routeSecret) {
      const provided = req.headers.get("x-dev-create-user-secret")?.trim();
      if (!provided || provided !== routeSecret) {
        return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
      }
    }

    await dbConnect();

    const { email, username, password } = await req.json();

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
      // Never trust client-supplied role flags on this utility endpoint.
      isAdmin: false,
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
