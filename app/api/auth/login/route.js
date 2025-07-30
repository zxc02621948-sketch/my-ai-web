import { connectToDatabase } from "@/lib/mongodb";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { generateToken } from "@/lib/serverAuth"; // ✅ 正確
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

    await connectToDatabase();
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

    if (!user.isVerified) {
      return NextResponse.json(
        { success: false, message: "帳號尚未驗證，請先至信箱點擊驗證連結" },
        { status: 403 }
      );
    }

    // ✅ 生成包含 username 的 token
    const payload = {
      id: user._id, // ✅ 改這裡，把資料庫的 _id 存成 JWT 的 id 欄位
      email: user.email,
      username: user.username,
      isAdmin: user.isAdmin || false, // ✅ 加入 isAdmin 權限資訊
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
        isAdmin: user.isAdmin || false, // ✅ 回傳給前端
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
