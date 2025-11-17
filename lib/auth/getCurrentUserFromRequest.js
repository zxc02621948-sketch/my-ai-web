// lib/auth/getCurrentUserFromRequest.js
import { dbConnect } from "@/lib/db";
import { verifyToken } from "@/lib/serverAuth";
import User from "@/models/User"; // ✅ 用 default export 比較穩

export async function getCurrentUserFromRequest(req) {
  await dbConnect();

  try {
    const cookieHeader = req.headers.get("cookie") || "";
    
    // 更精確的 cookie 解析
    let token = null;
    const cookies = cookieHeader.split(";").map(c => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith("token=")) {
        token = cookie.substring(6); // 移除 "token=" 前綴
        break;
      }
    }
    
    // 如果還是沒有，嘗試正則匹配
    if (!token) {
      const tokenMatch = cookieHeader.match(/token=([^;]+)/);
      token = tokenMatch?.[1];
    }

    if (!token) {
      // 嘗試從 Authorization header 獲取
      const authHeader = req.headers.get("authorization") || "";
      const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
      const bearerToken = bearerMatch?.[1];
      if (!bearerToken) {
        return null;
      }
      const decoded = verifyToken(bearerToken);
      if (!decoded?.id) return null;
      const user = await User.findById(decoded.id);
      return user || null;
    }

    // 解碼 URL 編碼的 token（如果有的話）
    try {
      token = decodeURIComponent(token);
    } catch (e) {
      // 如果解碼失敗，使用原始 token
    }

    const decoded = verifyToken(token);
    if (!decoded?.id) {
      // 靜默處理：token 無效是正常情況（例如未登入用戶）
      return null;
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      // 靜默處理：用戶不存在也是正常情況
      return null;
    }
    return user;
  } catch (err) {
    console.error("❌ getCurrentUserFromRequest 錯誤", err);
    return null;
  }
}
