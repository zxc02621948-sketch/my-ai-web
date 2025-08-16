import { dbConnect } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { generateToken } from "@/lib/serverAuth";
import User from "@/models/User";

export async function POST(req) {
  try {
    const { email, password } = await req.json();
    console.log("📥 收到帳密：", { email, password });

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "請輸入帳號與密碼" },
        { status: 400 }
      );
    }

    await dbConnect();
    const user = await User.findOne({ email }).lean();
    console.log("🪪 使用者完整資料：", user);

    if (!user) {
      return NextResponse.json(
        { success: false, message: "帳號不存在" },
        { status: 401 }
      );
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return NextResponse.json(
        { success: false, message: "密碼錯誤" },
        { status: 401 }
      );
    }

    // ✅ 不再寄驗證信！只提示未驗證狀態
    if (!user.isVerified) {
      return NextResponse.json(
        { success: false, message: "尚未驗證", reason: "unverified" },
        { status: 403 }
      );
    }

    const payload = {
      id: user._id,
      email: user.email,
      username: user.username,
      isAdmin: user.isAdmin || false,
    };

    console.log("🎯 token payload：", payload);

    const token = generateToken(payload);

    const response = NextResponse.json({
      success: true,
      message: "登入成功",
      token,
      user: {
        _id: user._id,
        username: user.username,
        isAdmin: user.isAdmin || false,
      },
    });

    response.cookies.set("token", token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("❌ 登入錯誤：", error);
    return NextResponse.json(
      { success: false, message: "伺服器錯誤" },
      { status: 500 }
    );
  }
}
