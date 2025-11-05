/**
 * 調試工具 - 控制音頻系統的日誌輸出
 * 
 * 使用方式：
 * - 在開發環境或需要調試時，設置 window.DEBUG_AUDIO = true
 * - 在瀏覽器控制台輸入：window.DEBUG_AUDIO = true 來啟用調試日誌
 * - 輸入：window.DEBUG_AUDIO = false 來禁用調試日誌
 */

// 檢查是否啟用調試模式（默認在開發環境啟用）
const isDebugMode = () => {
  if (typeof window !== 'undefined') {
    // 如果已經設置過，使用設置的值
    if (window.DEBUG_AUDIO !== undefined) {
      return window.DEBUG_AUDIO;
    }
    // 否則，在開發環境默認啟用
    return process.env.NODE_ENV === 'development';
  }
  return false;
};

/**
 * 調試日誌（只在調試模式下輸出）
 */
export const debugLog = (...args) => {
  if (isDebugMode()) {
    console.log(...args);
  }
};

/**
 * 警告日誌（始終輸出）
 */
export const debugWarn = (...args) => {
  console.warn(...args);
};

/**
 * 錯誤日誌（始終輸出）
 */
export const debugError = (...args) => {
  console.error(...args);
};

