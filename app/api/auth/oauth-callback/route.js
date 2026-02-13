// app/api/auth/oauth-callback/route.js
// ✅ OAuth 登入後生成 JWT token 的 API endpoint（與現有系統兼容）
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";
import { generateToken } from "@/lib/serverAuth";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    const sessionEmail = session?.user?.email;
    const body = await req.json().catch(() => ({}));
    const requestedEmail = body?.email;

    if (!sessionEmail) {
      return NextResponse.json(
        { ok: false, error: "OAuth session 無效，請重新登入" },
        { status: 401 }
      );
    }

    // 防止透過偽造 body email 取得他人 token
    if (requestedEmail && String(requestedEmail).toLowerCase() !== String(sessionEmail).toLowerCase()) {
      return NextResponse.json(
        { ok: false, error: "OAuth 驗證失敗" },
        { status: 403 }
      );
    }

    await dbConnect();
    const user = await User.findOne({ email: sessionEmail });

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
      httpOnly: true,
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

