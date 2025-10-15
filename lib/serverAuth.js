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
  const cookie = req.headers.get("cookie") || "";
  let token = cookie.match(/token=([^;]+)/)?.[1] || null;

  // Fallback：若 Cookie 沒有 token，改讀 Authorization: Bearer <token>
  if (!token) {
    const auth = req.headers.get("authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    token = m?.[1] || null;
  }

  if (!token) return null;

  const decoded = verifyToken(token);
  const userId = decoded?.id || decoded?._id; // ← 支援兩種欄位
  if (!userId) return null;

  await dbConnect();
  const user = await User.findById(userId);
  if (!user) return null;

  // ✅ 自動修復 totalEarnedPoints（如果為 0 但 pointsBalance > 0）
  if ((user.totalEarnedPoints === 0 || !user.totalEarnedPoints) && user.pointsBalance > 0) {
    console.log(`🔧 自動修復用戶 ${user.username} 的 totalEarnedPoints: ${user.pointsBalance}`);
    user.totalEarnedPoints = user.pointsBalance;
    await user.save();
  }

  // ✅ 清理後再回傳
  return {
    _id: user._id.toString(),
    username: user.username,
    email: user.email,
    image: user.image,
    isAdmin: user.isAdmin,
    level: user.level,
    // ✅ 添加商店需要的字段
    pointsBalance: user.pointsBalance || 0,
    totalEarnedPoints: user.totalEarnedPoints || 0,
    frameColorEditorUnlocked: user.frameColorEditorUnlocked || false,
    playerCouponUsed: user.playerCouponUsed || false,
    miniPlayerExpiry: user.miniPlayerExpiry || null,
  };
}

// ✅ 用於 Server Component / layout.js：讀 cookies()
export async function getCurrentUser() {
  const cookieStore = await cookies(); // 改成 await
  const token = cookieStore.get("token")?.value;
  if (!token) return null;

  const decoded = verifyToken(token);
  const userId = decoded?.id || decoded?._id; // ← 支援兩種欄位
  if (!userId) return null;

  await dbConnect();
  const user = await User.findById(userId);
  if (!user) return null;

  // ✅ 自動修復 totalEarnedPoints（如果為 0 但 pointsBalance > 0）
  if ((user.totalEarnedPoints === 0 || !user.totalEarnedPoints) && user.pointsBalance > 0) {
    console.log(`🔧 自動修復用戶 ${user.username} 的 totalEarnedPoints: ${user.pointsBalance}`);
    user.totalEarnedPoints = user.pointsBalance;
    await user.save();
  }

  // ✅ 同樣清理後回傳
  return {
    _id: user._id.toString(),
    username: user.username,
    email: user.email,
    image: user.image,
    isAdmin: user.isAdmin,
    level: user.level,
    // ✅ 添加頭像框和播放器相關字段
    currentFrame: user.currentFrame || 'default',
    ownedFrames: user.ownedFrames || [],
    miniPlayerPurchased: user.miniPlayerPurchased || false,
    pointsBalance: user.pointsBalance || 0,
    totalEarnedPoints: user.totalEarnedPoints || 0,
    frameColorEditorUnlocked: user.frameColorEditorUnlocked || false,
    playerCouponUsed: user.playerCouponUsed || false,
    miniPlayerExpiry: user.miniPlayerExpiry || null,
  };
}
