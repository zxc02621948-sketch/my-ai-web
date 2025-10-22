// utils/commentLimits.js
// 留言防刷機制配置

/**
 * 留言限制配置
 * 可通過環境變數覆寫
 */

// 時間間隔限制（毫秒）
export const COMMENT_GLOBAL_INTERVAL = parseInt(process.env.COMMENT_GLOBAL_INTERVAL) || 3000;  // 全局 3 秒
export const COMMENT_IMAGE_INTERVAL = parseInt(process.env.COMMENT_IMAGE_INTERVAL) || 10000;  // 同圖 10 秒

// 每日留言上限
export const COMMENT_DAILY_LIMIT = parseInt(process.env.COMMENT_DAILY_LIMIT) || 50;      // 普通用戶 50 條
export const COMMENT_DAILY_LIMIT_VIP = parseInt(process.env.COMMENT_DAILY_LIMIT_VIP) || 100;  // VIP 100 條

// 單張圖片留言上限
export const COMMENT_PER_IMAGE_LIMIT = parseInt(process.env.COMMENT_PER_IMAGE_LIMIT) || 20;  // 單圖 20 條

// 內容長度限制
export const COMMENT_MIN_LENGTH = parseInt(process.env.COMMENT_MIN_LENGTH) || 2;    // 最少 2 字
export const COMMENT_MAX_LENGTH = parseInt(process.env.COMMENT_MAX_LENGTH) || 500;  // 最多 500 字

// 重複檢測範圍
export const COMMENT_DUPLICATE_CHECK_COUNT = parseInt(process.env.COMMENT_DUPLICATE_CHECK_COUNT) || 5;  // 檢查最近 5 條

/**
 * 取得用戶的每日留言限制
 * @param {Object} user - 用戶對象
 * @returns {number} 每日限制
 */
export function getUserDailyCommentLimit(user) {
  if (!user) return COMMENT_DAILY_LIMIT;
  
  const hasVIP = user.subscriptions?.some(
    sub => sub.isActive && sub.type === 'premiumFeatures' && sub.expiresAt > new Date()
  );
  
  return hasVIP ? COMMENT_DAILY_LIMIT_VIP : COMMENT_DAILY_LIMIT;
}

/**
 * 格式化等待時間提示
 * @param {number} milliseconds - 需要等待的毫秒數
 * @returns {string} 格式化的提示文字
 */
export function formatWaitTime(milliseconds) {
  const seconds = Math.ceil(milliseconds / 1000);
  if (seconds <= 60) {
    return `${seconds} 秒`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} 分鐘`;
}

/**
 * 檢查留言內容是否有效
 * @param {string} text - 留言內容
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateCommentContent(text) {
  if (!text || typeof text !== 'string') {
    return { valid: false, error: '留言內容不能為空' };
  }
  
  const trimmed = text.trim();
  
  if (trimmed.length < COMMENT_MIN_LENGTH) {
    return { valid: false, error: `留言至少需要 ${COMMENT_MIN_LENGTH} 個字` };
  }
  
  if (trimmed.length > COMMENT_MAX_LENGTH) {
    return { valid: false, error: `留言最多 ${COMMENT_MAX_LENGTH} 個字` };
  }
  
  // ✅ 檢查是否為純數字或純符號（避免「11」「12」「666」等無意義留言）
  // 允許：「1920x1080」「SD 1.5」「CFG 7」等包含數字的技術討論
  // 禁止：「11」「666」「!!!」等純數字或純符號
  const isPureNumberOrSymbol = /^[\d\s\.\,\!\?\~\-\_\+\=]+$/.test(trimmed);
  
  if (isPureNumberOrSymbol) {
    return { valid: false, error: '留言需要包含文字內容，不能只有數字或符號' };
  }
  
  // ❌ 移除文字黑名單 - 太嚴格，可能誤傷正常使用
  // 改用檢舉機制讓社群自行管理
  
  return { valid: true };
}

/**
 * 檢查時間間隔是否符合要求
 * @param {Date} lastCommentTime - 上次留言時間
 * @param {number} minInterval - 最小間隔（毫秒）
 * @returns {{ allowed: boolean, waitTime?: number }}
 */
export function checkTimeInterval(lastCommentTime, minInterval) {
  if (!lastCommentTime) {
    return { allowed: true };
  }
  
  const timeSince = Date.now() - new Date(lastCommentTime).getTime();
  
  if (timeSince < minInterval) {
    return { 
      allowed: false, 
      waitTime: minInterval - timeSince 
    };
  }
  
  return { allowed: true };
}

/**
 * 防刷機制的完整說明（用於前端顯示）
 */
export const COMMENT_LIMITS_INFO = {
  globalInterval: '全局留言間隔 3 秒',
  imageInterval: '同一圖片留言間隔 10 秒',
  dailyLimit: '每日最多 50 條留言（VIP 100 條）',
  perImageLimit: '單張圖片最多 20 條留言',
  minLength: '留言最少 2 個字',
  maxLength: '留言最多 500 個字',
  noDuplicate: '不能重複發送相同內容'
};

