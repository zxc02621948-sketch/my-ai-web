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
  const authHeader = headersList.get("authorization") || headersList.get("Authorization") || "";
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const token = bearerToken || cookieHeader
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

  const userId = decoded.id || decoded._id; // 支援 id 與 _id
  if (!userId) {
    return NextResponse.json(null, { status: 200 });
  }

  const user = await User.findById(userId).select("-password");
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
    following: user.following ?? [],
    pointsBalance: user.pointsBalance ?? 0,
    defaultMusicUrl: user.defaultMusicUrl || "",
  });
}
