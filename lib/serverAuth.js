// /lib/serverAuth.js
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { dbConnect } from "./db";
import User from "@/models/User";
import { getToken as getNextAuthToken } from "next-auth/jwt";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ✅ 生產環境必須設置 JWT_SECRET，否則會拋出錯誤
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET 環境變數未設置，這在生產環境中是必需的");
}
// 開發環境使用默認值（僅用於構建時）
const JWT_SECRET_FINAL = JWT_SECRET || "default-secret-for-build";

// ✅ 建立 JWT
export function generateToken(user) {
  return jwt.sign(user, JWT_SECRET_FINAL, { expiresIn: "7d" });
}

// ✅ 驗證 JWT
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET_FINAL);
  } catch (err) {
    // 靜默處理 JWT 驗證錯誤（token 無效是正常情況，不需要報錯）
    // 例如：jwt malformed, jwt expired, invalid token 等都是預期的錯誤
    return null;
  }
}

// ✅ 用於 API Routes：傳入 req.headers.get("cookie")
export async function getCurrentUserFromRequest(req) {
  const cookie = req.headers.get("cookie") || "";
  
  // 更精確的 cookie 解析
  let token = null;
  const cookies = cookie.split(";").map(c => c.trim());
  for (const c of cookies) {
    if (c.startsWith("token=")) {
      token = c.substring(6); // 移除 "token=" 前綴
      break;
    }
  }
  
  // 如果還是沒有，嘗試正則匹配
  if (!token) {
    const tokenMatch = cookie.match(/token=([^;]+)/);
    token = tokenMatch?.[1];
  }

  // Fallback：若 Cookie 沒有 token，改讀 Authorization: Bearer <token>
  if (!token) {
    const auth = req.headers.get("authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    token = m?.[1] || null;
  }

  if (!token) return null;

  // 解碼 URL 編碼的 token（如果有的話）
  try {
    token = decodeURIComponent(token);
  } catch (e) {
    // 如果解碼失敗，使用原始 token
  }

  const decoded = token ? verifyToken(token) : null;
  let userId = decoded?.id || decoded?._id; // ← 支援兩種欄位
  let emailFromOAuth = null;

  // Fallback: 支援 NextAuth session token（OAuth 登入）
  if (!userId) {
    try {
      const nextAuthToken = await getNextAuthToken({
        req,
        secret: process.env.NEXTAUTH_SECRET,
      });
      userId = nextAuthToken?.id || nextAuthToken?.sub || null;
      emailFromOAuth = nextAuthToken?.email || null;
    } catch {
      // 靜默 fallback 失敗
    }
  }

  if (!userId && !emailFromOAuth) return null;

  await dbConnect();
  let user = null;
  if (userId) {
    user = await User.findById(userId);
  }
  if (!user && emailFromOAuth) {
    user = await User.findOne({ email: emailFromOAuth });
  }
  if (!user) return null;

  // ✅ 自動修復 totalEarnedPoints（如果為 0 但 pointsBalance > 0）
  if ((user.totalEarnedPoints === 0 || !user.totalEarnedPoints) && user.pointsBalance > 0) {
    user.totalEarnedPoints = user.pointsBalance;
    await user.save();
  }

  // ✅ 清理後再回傳
  // ✅ 確保 privacyPreferences 是普通對象，不是 Mongoose 子文檔
  const privacyPrefs = user.privacyPreferences;
  const privacyPreferences = privacyPrefs && typeof privacyPrefs.toJSON === 'function'
    ? privacyPrefs.toJSON()
    : (privacyPrefs || {
        allowMarketingEmails: true,
        allowDataAnalytics: true,
        allowPersonalization: true,
        allowProfileIndexing: true,
      });
  
  return {
    _id: user._id.toString(),
    username: user.username,
    email: user.email,
    image: user.image,
    isAdmin: user.isAdmin,
    role: user.role || (user.isAdmin ? 'admin' : 'user'), // ✅ 添加 role 字段
    level: user.level,
    // ✅ 添加商店需要的字段
    pointsBalance: user.pointsBalance || 0,
    totalEarnedPoints: user.totalEarnedPoints || 0,
    frameColorEditorUnlocked: user.frameColorEditorUnlocked || false,
    playerCouponUsed: user.playerCouponUsed || false,
    miniPlayerExpiry: user.miniPlayerExpiry ? (user.miniPlayerExpiry instanceof Date ? user.miniPlayerExpiry.toISOString() : user.miniPlayerExpiry) : null,
    // ✅ 添加隱私設定字段（確保是普通對象）
    privacyPreferences: {
      allowMarketingEmails: privacyPreferences.allowMarketingEmails !== false,
      allowDataAnalytics: privacyPreferences.allowDataAnalytics !== false,
      allowPersonalization: privacyPreferences.allowPersonalization !== false,
      allowProfileIndexing: privacyPreferences.allowProfileIndexing !== false,
    },
  };
}

// ✅ 用於 Server Component / layout.js：讀 cookies()
export async function getCurrentUser() {
  const cookieStore = await cookies(); // 改成 await
  const token = cookieStore.get("token")?.value;
  let userId = null;
  let emailFromOAuth = null;

  if (token) {
    const decoded = verifyToken(token);
    userId = decoded?.id || decoded?._id || null; // ← 支援兩種欄位
  }

  // Fallback: Server Component 環境使用 NextAuth session
  if (!userId) {
    try {
      const session = await getServerSession(authOptions);
      userId = session?.user?.id || null;
      emailFromOAuth = session?.user?.email || null;
    } catch {
      // 靜默 fallback 失敗
    }
  }

  if (!userId && !emailFromOAuth) return null;

  await dbConnect();
  let user = null;
  if (userId) {
    user = await User.findById(userId);
  }
  if (!user && emailFromOAuth) {
    user = await User.findOne({ email: emailFromOAuth });
  }
  if (!user) return null;

  // ✅ 自動修復 totalEarnedPoints（如果為 0 但 pointsBalance > 0）
  if ((user.totalEarnedPoints === 0 || !user.totalEarnedPoints) && user.pointsBalance > 0) {
    user.totalEarnedPoints = user.pointsBalance;
    await user.save();
  }

  // ✅ 同樣清理後回傳
  // ✅ 確保 privacyPreferences 是普通對象，不是 Mongoose 子文檔
  const privacyPrefs = user.privacyPreferences;
  const privacyPreferences = privacyPrefs && typeof privacyPrefs.toJSON === 'function'
    ? privacyPrefs.toJSON()
    : (privacyPrefs || {
        allowMarketingEmails: true,
        allowDataAnalytics: true,
        allowPersonalization: true,
        allowProfileIndexing: true,
      });
  
  // ✅ 確保所有值都是基本類型
  return {
    _id: user._id.toString(),
    username: user.username,
    email: user.email,
    image: user.image,
    isAdmin: user.isAdmin,
    role: user.role || (user.isAdmin ? 'admin' : 'user'), // ✅ 添加 role 字段
    level: user.level,
    // ✅ 添加頭像框和播放器相關字段
    currentFrame: user.currentFrame || 'default',
    ownedFrames: Array.isArray(user.ownedFrames) ? [...user.ownedFrames] : [],
    miniPlayerPurchased: user.miniPlayerPurchased || false,
    pointsBalance: user.pointsBalance || 0,
    totalEarnedPoints: user.totalEarnedPoints || 0,
    frameColorEditorUnlocked: user.frameColorEditorUnlocked || false,
    playerCouponUsed: user.playerCouponUsed || false,
    miniPlayerExpiry: user.miniPlayerExpiry ? (user.miniPlayerExpiry instanceof Date ? user.miniPlayerExpiry.toISOString() : user.miniPlayerExpiry) : null,
    // ✅ 添加隱私設定字段（確保是普通對象）
    privacyPreferences: {
      allowMarketingEmails: privacyPreferences.allowMarketingEmails !== false,
      allowDataAnalytics: privacyPreferences.allowDataAnalytics !== false,
      allowPersonalization: privacyPreferences.allowPersonalization !== false,
      allowProfileIndexing: privacyPreferences.allowProfileIndexing !== false,
    },
  };
}
