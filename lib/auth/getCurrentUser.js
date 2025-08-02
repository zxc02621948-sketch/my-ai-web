// lib/auth/getCurrentUser.js
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/jwt";
import { dbConnect } from "@/lib/db";
import { User } from "@/models/User";

export async function getCurrentUser() {
  await dbConnect();

  try {
    const cookieStore = cookies(); // ✅ 正確方式：不需要 await，但也不能亂寫 .get().value
    const tokenCookie = cookieStore.get("token");
    const token = tokenCookie?.value;
    if (!token) return null;

    const decoded = verifyJWT(token);
    if (!decoded || !decoded.id) return null;

    const user = await User.findById(decoded.id);
    return user || null;
  } catch (err) {
    console.error("❌ getCurrentUser 錯誤", err);
    return null;
  }
}
