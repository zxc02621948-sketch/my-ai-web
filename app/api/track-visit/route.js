// app/api/track-visit/route.js
import { dbConnect } from "@/lib/db";
import VisitorLog from "@/models/VisitorLog";
import { verifyToken } from "@/lib/serverAuth";
import { cookies } from "next/headers";
import { nanoid } from "nanoid";

export async function POST(req) {
  await dbConnect();

  const { pathname } = await req.json();
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("host");
  const userAgent = req.headers.get("user-agent") || "";
  const cookieHeader = req.headers.get("cookie") || "";
  const token = cookieHeader.match(/token=([^;]+)/)?.[1];
  const tokenData = token ? verifyToken(token) : null;
  const userId = tokenData?.id || null;

  // ✅ 讀取或產生 visitId
  const cookieStore = cookies();
  let visitId = cookieStore.get("visit_id")?.value;

  if (!visitId) {
    visitId = nanoid();
    cookieStore.set("visit_id", visitId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30天
    });
  }

  try {
    await VisitorLog.create({
      path: pathname,
      ip,
      visitId,
      userAgent,
      userId,
    });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("❌ 寫入訪問紀錄失敗", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
