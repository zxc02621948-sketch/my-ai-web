import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { verifyToken } from "@/lib/serverAuth";
import User from "@/models/User";

export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const idFromQuery = searchParams.get("id");

    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const decoded = token ? verifyToken(token) : null;

    const userId = idFromQuery || decoded?.id;
    if (!userId) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "找不到使用者" }, { status: 404 });
    }

    return NextResponse.json({
      _id: user._id,
      email: user.email,
      username: user.username,
      image: user.image,
      isVerified: user.isVerified,
      createdAt: user.createdAt?.toISOString() ?? null,
    });

  } catch (err) {
    console.error("⚠️ 取得使用者資料錯誤", err);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
