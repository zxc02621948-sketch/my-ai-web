import { dbConnect } from "@/lib/db";
import VisitorLog from "@/models/VisitorLog";
import { verifyToken } from "@/lib/serverAuth";
import { nanoid } from "nanoid";

export async function POST(req) {
  await dbConnect();

  const { pathname } = await req.json();
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("host");
  const userAgent = req.headers.get("user-agent") || "";
  const cookieHeader = req.headers.get("cookie") || "";

  // 讀取 token
  const token = cookieHeader.match(/token=([^;]+)/)?.[1];
  const tokenData = token ? verifyToken(token) : null;
  const userId = tokenData?.id || null;

  // ✅ 從 header 中讀取 visitId（cookie）
  let visitId = cookieHeader.match(/visit_id=([^;]+)/)?.[1];

  // ✅ 如果沒有就先給一個（不寫 cookie，純紀錄用）
  if (!visitId) {
    visitId = nanoid(); // 還是給統計用識別
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
