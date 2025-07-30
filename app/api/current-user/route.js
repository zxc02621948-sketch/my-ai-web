import { dbConnect } from "@/lib/db";
import { verifyJWT } from "@/lib/jwt";
import User from "@/models/User";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  await dbConnect();

  const headersList = await headers();
  const cookieHeader = headersList.get("cookie") || "";
  const token = cookieHeader
    .split(";")
    .find((c) => c.trim().startsWith("token="))
    ?.split("=")[1];

  if (!token) {
    return NextResponse.json({ message: "未登入" }, { status: 401 });
  }

  const decoded = verifyJWT(token);
  if (!decoded) {
    return NextResponse.json({ message: "無效的 token" }, { status: 401 });
  }

  const user = await User.findById(decoded.id).select("-password");
  if (!user) {
    return NextResponse.json({ message: "使用者不存在" }, { status: 404 });
  }

  return NextResponse.json({
    _id: user._id,
    email: user.email,
    username: user.username,
    image: user.image,
    isVerified: user.isVerified,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt?.toISOString() ?? null, // ✅ 這一行是核心
  });
}
