// /lib/serverAuth.js
import jwt from "jsonwebtoken";
import User from "@/models/User";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("❌ JWT_SECRET 未定義，請檢查 .env.local 是否正確載入");
}
console.log("[JWT] Using secret:", JWT_SECRET);

// 建立 JWT
export function generateToken(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
}

// 驗證 JWT
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// ✅ 使用 req.headers 解析 Cookie（新版 Next.js 相容）
export async function getCurrentUser(req) {
  const cookie = req.headers.get("cookie");
  if (!cookie) return null;

  const tokenMatch = cookie.match(/token=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : null;
  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded?.id) return null;

  const user = await User.findById(decoded.id);
  return user || null;
}
