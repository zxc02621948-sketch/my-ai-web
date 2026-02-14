// lib/authUtils.js
/**
 * 加強的認證和授權工具
 */
import { apiError } from "./errorHandler";
import { signJWT, verifyJWT } from "@/lib/jwt";
import {
  getCurrentUserFromRequest as getCurrentUserFromRequestCompat,
  getCurrentUser as getCurrentUserCompat,
} from "@/lib/serverAuth";

const TOKEN_EXPIRY = "7d";

/**
 * 生成安全的JWT令牌
 * @param {Object} payload - 令牌負載
 * @returns {string} JWT令牌
 */
export function generateToken(payload) {
  return signJWT(payload, {
    expiresIn: TOKEN_EXPIRY,
    algorithm: "HS256", // 明確指定算法
  });
}

/**
 * 驗證JWT令牌
 * @param {string} token - JWT令牌
 * @returns {Object|null} 解碼的令牌負載或null
 */
export function verifyToken(token) {
  return verifyJWT(token);
}

/**
 * 從請求中獲取當前用戶
 * @returns {Promise<Object>} 用戶對象
 * @throws {Error} 如果未授權或用戶不存在
 */
export async function getCurrentUser() {
  // 統一走 serverAuth，避免與其他路由的驗證分叉
  const user = await getCurrentUserCompat().catch(() => null);
  if (!user) {
    throw new Error("UNAUTH");
  }
  return user;
}

/**
 * 檢查用戶是否有管理員權限
 * @param {Object} user - 用戶對象
 * @returns {boolean} 是否為管理員
 */
export function isAdmin(user) {
  return user && user.isAdmin === true;
}

/**
 * 檢查用戶是否為資源擁有者
 * @param {Object} user - 用戶對象
 * @param {string} resourceUserId - 資源擁有者ID
 * @returns {boolean} 是否為資源擁有者
 */
export function isResourceOwner(user, resourceUserId) {
  return user && resourceUserId && String(user._id) === String(resourceUserId);
}

/**
 * 要求用戶已認證的中間件
 * @param {Function} handler - API處理函數
 * @returns {Function} 包裝後的處理函數
 */
export function requireAuth(handler) {
  return async (req, context) => {
    try {
      // API Route 優先使用 request-based 驗證（支援 HttpOnly/OAuth）
      const user =
        (await getCurrentUserFromRequestCompat(req).catch(() => null)) ||
        (await getCurrentUser().catch(() => null));
      if (!user) {
        throw new Error("UNAUTH");
      }
      // 將用戶信息添加到請求上下文
      context.user = user;
      return await handler(req, context);
    } catch (error) {
      if (error.message === "UNAUTH") {
        return apiError("未授權訪問", 401);
      }
      throw error; // 其他錯誤交給全局錯誤處理
    }
  };
}

/**
 * 要求用戶具有管理員權限的中間件
 * @param {Function} handler - API處理函數
 * @returns {Function} 包裝後的處理函數
 */
export function requireAdmin(handler) {
  return async (req, context) => {
    try {
      // API Route 優先使用 request-based 驗證（支援 HttpOnly/OAuth）
      const user =
        (await getCurrentUserFromRequestCompat(req).catch(() => null)) ||
        (await getCurrentUser().catch(() => null));
      if (!user) {
        throw new Error("UNAUTH");
      }
      
      if (!isAdmin(user)) {
        return apiError("需要管理員權限", 403);
      }
      
      // 將用戶信息添加到請求上下文
      context.user = user;
      return await handler(req, context);
    } catch (error) {
      if (error.message === "UNAUTH") {
        return apiError("未授權訪問", 401);
      }
      throw error; // 其他錯誤交給全局錯誤處理
    }
  };
}