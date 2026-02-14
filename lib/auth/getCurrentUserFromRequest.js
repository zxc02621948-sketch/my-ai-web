// lib/auth/getCurrentUserFromRequest.js
import { dbConnect } from "@/lib/db";
import { getCurrentUserFromRequest as getCurrentUserFromRequestCompat } from "@/lib/serverAuth";
import User from "@/models/User"; // ✅ 用 default export 比較穩

export async function getCurrentUserFromRequest(req) {
  try {
    // 統一走 serverAuth：支援 token cookie / Bearer / NextAuth(OAuth) fallback
    const currentUser = await getCurrentUserFromRequestCompat(req).catch(() => null);
    if (!currentUser?._id) return null;

    // 保持回傳型態相容：這裡回傳資料庫使用者文件（部分舊路由會依賴）
    await dbConnect();
    const user = await User.findById(currentUser._id);
    return user || null;
  } catch (err) {
    console.error("❌ getCurrentUserFromRequest 錯誤", err);
    return null;
  }
}
