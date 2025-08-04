// /lib/serverAuth.js
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { dbConnect } from "./db";
import User from "@/models/User";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("❌ JWT_SECRET 未定義，請檢查 .env.local 是否正確載入");
}
console.log("[JWT] Using secret:", JWT_SECRET);

// ✅ 建立 JWT
export function generateToken(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
}

// ✅ 驗證 JWT
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// ✅ 用於 API Routes：傳入 req.headers.get("cookie")
export async function getCurrentUserFromRequest(req) {
  const cookie = req.headers.get("cookie");
  if (!cookie) return null;

  const tokenMatch = cookie.match(/token=([^;]+)/);
  const token = tokenMatch?.[1];
  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded?.id) return null;

  await dbConnect();
  const user = await User.findById(decoded.id).lean();
  return user || null;
}

// ✅ 用於 Server Component / Page：直接讀 cookies()
export async function getCurrentUser() {
  const cookieStore = cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded?.id) return null;

  await dbConnect();
  const user = await User.findById(decoded.id).lean();
  return user || null;
}
