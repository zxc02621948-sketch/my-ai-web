// lib/auth/getCurrentUserFromRequest.js
import { dbConnect } from "@/lib/db";
import { verifyJWT } from "@/lib/jwt";
import User from "@/models/User"; // ✅ 用 default export 比較穩

export async function getCurrentUserFromRequest(req) {
  await dbConnect();

  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const tokenMatch = cookieHeader.match(/token=([^;]+)/);
    const token = tokenMatch?.[1];

    if (!token) return null;

    const decoded = verifyJWT(token);
    if (!decoded?.id) return null;

    const user = await User.findById(decoded.id);
    return user || null;
  } catch (err) {
    console.error("❌ getCurrentUserFromRequest 錯誤", err);
    return null;
  }
}
