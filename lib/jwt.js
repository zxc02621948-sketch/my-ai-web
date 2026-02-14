import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET must be set in production");
}
const JWT_SECRET_FINAL = JWT_SECRET || "development-only-jwt-secret";

// 建立 JWT（登入時使用）
export function signJWT(payload, options = {}) {
  return jwt.sign(payload, JWT_SECRET_FINAL, {
    expiresIn: "7d",
    ...options,
  });
}

// 驗證 JWT（登入後檢查用戶身份）
export function verifyJWT(token) {
  try {
    return jwt.verify(token, JWT_SECRET_FINAL);
  } catch (error) {
    return null;
  }
}
