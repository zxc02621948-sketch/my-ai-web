// app/api/auth/oauth-callback/route.js
// ✅ OAuth 登入後生成 JWT token 的 API endpoint（與現有系統兼容）
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import { generateToken } from "@/lib/serverAuth";

export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { ok: false, error: "缺少 email 參數" },
        { status: 400 }
      );
    }

    await dbConnect();
    const user = await User.findOne({ email });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "用戶不存在" },
        { status: 404 }
      );
    }

    const payload = {
      id: user._id,
      email: user.email,
      username: user.username,
      isAdmin: user.isAdmin || false,
    };

    const token = generateToken(payload);

    const responseData = {
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        image: user.image,
        isAdmin: user.isAdmin || false,
      },
      message: "登入成功",
    };

    // 設置 cookie
    const cookieOptions = {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 天
    };

    const response = NextResponse.json({
      ok: true,
      ...responseData
    }, { status: 200 });
    
    response.cookies.set("token", token, cookieOptions);
    return response;
  } catch (error) {
    console.error("❌ OAuth callback 錯誤:", error);
    return NextResponse.json(
      { ok: false, error: "伺服器錯誤" },
      { status: 500 }
    );
  }
}

