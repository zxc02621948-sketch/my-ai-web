// app/api/admin/analytics/route.js
import { dbConnect } from "@/lib/db";
import VisitorLog from "@/models/VisitorLog";
import { verifyToken } from "@/lib/serverAuth";
import User from "@/models/User";

export async function GET(req) {
  await dbConnect();

  // 解析 cookie 並驗證 token
  const cookie = req.headers.get("cookie");
  const token = cookie?.match(/token=([^;]+)/)?.[1];
  const tokenData = token ? verifyToken(token) : null;

  if (!tokenData || !tokenData.isAdmin) {
    return new Response("Forbidden", { status: 403 });
  }

  const logs = await VisitorLog.find({})
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("userId", "name email");

  return new Response(JSON.stringify({ logs }), { status: 200 });
}
