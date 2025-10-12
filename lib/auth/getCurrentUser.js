// lib/auth/getCurrentUser.js
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/jwt";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";

export async function getCurrentUser() {
  await dbConnect();

  try {
    const cookieStore = await cookies(); // ✅ 修正為 await 方式，避免 Next.js 15+ 警告
    const tokenCookie = cookieStore.get("token");
    const token = tokenCookie?.value;
    if (!token) {
      return null;
    }

    const decoded = verifyJWT(token);
    if (!decoded || !decoded.id) {
      return null;
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return null;
    }
    return user;
  } catch (err) {
    console.error("❌ getCurrentUser 錯誤", err);
    return null;
  }
}
