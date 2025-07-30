// lib/cookie.js
import jwt from "jsonwebtoken";

// 從 cookie 取出 token（client 專用）
export function getTokenFromCookie() {
  const match = document.cookie.match(/token=([^;]+)/);
  return match ? match[1] : "";
}

// 若真的需要解出基本使用者資料（⚠️ 僅供展示用，安全驗證請用 server）
export function decodeToken(token) {
  try {
    const decoded = jwt.decode(token); // ⚠️ 不驗證，只解開 payload
    return {
      _id: decoded?._id,
      email: decoded?.email,
      username: decoded?.username,
      isAdmin: decoded?.isAdmin || false,
    };
  } catch (error) {
    console.error("JWT 解碼失敗：", error);
    return null;
  }
}
