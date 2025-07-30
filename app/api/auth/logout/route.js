import { NextResponse } from "next/server";

export async function GET() {
  const res = NextResponse.json({ message: "Logged out" });

  // 清除 cookie：設 expired
  res.cookies.set("token", "", {
    httpOnly: true,
    path: "/",
    expires: new Date(0), // 過期
  });

  return res;
}
