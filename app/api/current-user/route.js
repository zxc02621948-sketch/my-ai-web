// app/api/current-user/route.js
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
    return NextResponse.json(null, { status: 200 });
  }

  const decoded = verifyJWT(token);
  if (!decoded) {
    return NextResponse.json(null, { status: 200 });
  }

  const user = await User.findById(decoded.id).select("-password");
  if (!user) {
    return NextResponse.json(null, { status: 200 });
  }

  return NextResponse.json({
    _id: user._id,
    email: user.email,
    username: user.username,
    image: user.image,
    isVerified: user.isVerified,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt?.toISOString() ?? null,
    following: user.following ?? [], // ✅ 加上這行就能讓前端知道追蹤清單！
  });
}
