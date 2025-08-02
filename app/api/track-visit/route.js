// app/api/track-visit/route.js
import { dbConnect } from "@/lib/db";
import VisitorLog from "@/models/VisitorLog";
import { verifyToken } from "@/lib/serverAuth"; // ✅ 你自己定義的驗證方法

export async function POST(req) {
  await dbConnect();

  const { pathname } = await req.json();
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("host");
  const userAgent = req.headers.get("user-agent") || "";

  const cookie = req.headers.get("cookie");
  const token = cookie?.match(/token=([^;]+)/)?.[1];
  const tokenData = token ? verifyToken(token) : null;
  const userId = tokenData?.id || null;

  try {
    await VisitorLog.create({ path: pathname, ip, userAgent, userId });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("❌ 寫入訪問紀錄失敗", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
