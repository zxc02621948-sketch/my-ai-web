// lib/auth/getCurrentUser.js
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/jwt";
import { dbConnect } from "@/lib/db";
import User from "@/models/User";

export async function getCurrentUser() {
  await dbConnect();

  try {
    const cookieStore = await cookies(); // ✅ 修正為 await 方式，避免 Next.js 15+ 警告
    console.log("🔧 cookieStore:", cookieStore);
    const tokenCookie = cookieStore.get("token");
    console.log("🔧 tokenCookie:", tokenCookie);
    const token = tokenCookie?.value;
    console.log("🔧 找到 token:", token ? "是" : "否");
    if (!token) {
      console.log("❌ getCurrentUser: 沒有找到 token");
      return null;
    }

    const decoded = verifyJWT(token);
    console.log("🔧 JWT 解碼結果:", decoded);
    if (!decoded || !decoded.id) {
      console.log("❌ getCurrentUser: JWT 解碼失敗或沒有 id");
      return null;
    }

    const user = await User.findById(decoded.id);
    console.log("🔧 查找用戶結果:", user ? "找到用戶" : "未找到用戶");
    if (!user) {
      console.log("❌ getCurrentUser: 找不到用戶", decoded.id);
      return null;
    }
    
    console.log("✅ getCurrentUser: 找到用戶", user.username);
    return user;
  } catch (err) {
    console.error("❌ getCurrentUser 錯誤", err);
    return null;
  }
}
