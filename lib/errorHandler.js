// lib/errorHandler.js
/**
 * 統一的錯誤處理工具
 * 提供API錯誤響應和客戶端錯誤處理的標準化方法
 */

import { NextResponse } from "next/server";

/**
 * API錯誤響應格式
 * @param {string} message - 錯誤消息
 * @param {number} status - HTTP狀態碼
 * @param {Object} additionalData - 額外數據
 * @returns {NextResponse} 格式化的錯誤響應
 */
export function apiError(message, status = 500, additionalData = {}) {
  console.error(`API錯誤 [${status}]: ${message}`);
  return NextResponse.json(
    { 
      ok: false, 
      error: message,
      ...additionalData
    }, 
    { status }
  );
}

/**
 * API成功響應格式
 * @param {Object} data - 響應數據
 * @param {number} status - HTTP狀態碼
 * @returns {NextResponse} 格式化的成功響應
 */
export function apiSuccess(data = {}, status = 200) {
  return NextResponse.json(
    { 
      ok: true, 
      ...data 
    }, 
    { status }
  );
}

/**
 * 處理API請求中的異常
 * @param {Function} handler - API處理函數
 * @returns {Function} 包裝後的處理函數
 */
export function withErrorHandling(handler) {
  return async (req, context) => {
    try {
      return await handler(req, context);
    } catch (error) {
      console.error("API請求處理錯誤:", error);
      
      // 處理特定類型的錯誤
      if (error.message === "UNAUTH") {
        return apiError("未授權訪問", 401);
      }
      if (error.message === "FORBIDDEN") {
        return apiError("無權限執行此操作", 403);
      }
      
      // 一般錯誤
      return apiError(error.message || "伺服器錯誤", 500);
    }
  };
}

/**
 * 客戶端錯誤處理工具
 */
export const clientErrorHandler = {
  /**
   * 處理API響應錯誤
   * @param {Response} response - Fetch API響應
   * @returns {Promise<Object>} 處理後的響應數據
   * @throws {Error} 如果響應不成功
   */
  async handleResponse(response) {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || `HTTP錯誤 ${response.status}`);
    }
    return response.json();
  },

  /**
   * 處理客戶端錯誤並顯示用戶友好的消息
   * @param {Error} error - 錯誤對象
   * @param {Function} setError - 設置錯誤狀態的函數
   * @param {string} fallbackMessage - 默認錯誤消息
   */
  handleClientError(error, setError, fallbackMessage = "操作失敗，請稍後再試") {
    console.error("客戶端錯誤:", error);
    const errorMessage = error.response?.data?.error || 
                         error.response?.data?.message || 
                         error.message || 
                         fallbackMessage;
    
    if (typeof setError === "function") {
      setError(errorMessage);
    } else if (typeof window !== "undefined") {
      // 如果沒有提供setError函數，使用alert作為後備
      alert(errorMessage);
    }
  }
};