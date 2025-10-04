// lib/clientErrorHandler.js
/**
 * 前端錯誤處理工具
 * 提供統一的API請求和錯誤處理方法
 */

/**
 * 處理API響應
 * @param {Response} response - Fetch API響應
 * @returns {Promise<Object>} 處理後的響應數據
 * @throws {Error} 如果響應不成功
 */
export async function handleApiResponse(response) {
  const data = await response.json();
  
  if (!response.ok || data.ok === false) {
    const error = new Error(data.error || data.message || `HTTP錯誤 ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  
  return data;
}

/**
 * 創建API請求函數
 * @param {string} url - API端點URL
 * @param {Object} options - Fetch選項
 * @returns {Promise<Object>} API響應
 */
export async function fetchApi(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    return await handleApiResponse(response);
  } catch (error) {
    console.error(`API請求錯誤 (${url}):`, error);
    throw error;
  }
}

/**
 * 顯示錯誤消息
 * @param {Error} error - 錯誤對象
 * @param {Function} setError - 設置錯誤狀態的函數
 * @param {string} fallbackMessage - 默認錯誤消息
 */
export function showErrorMessage(error, setError, fallbackMessage = "操作失敗，請稍後再試") {
  const errorMessage = error.data?.error || 
                       error.data?.message || 
                       error.message || 
                       fallbackMessage;
  
  if (typeof setError === "function") {
    setError(errorMessage);
  } else if (typeof window !== "undefined") {
    // 如果沒有提供setError函數，使用alert作為後備
    alert(errorMessage);
  }
}

/**
 * 創建帶錯誤處理的API請求函數
 * @param {Function} apiCall - API請求函數
 * @param {Function} setError - 設置錯誤狀態的函數
 * @param {Function} setLoading - 設置加載狀態的函數
 * @param {string} fallbackMessage - 默認錯誤消息
 * @returns {Promise<Object|null>} API響應或null（如果出錯）
 */
export async function safeApiCall(apiCall, setError, setLoading, fallbackMessage) {
  try {
    if (setLoading) setLoading(true);
    if (setError) setError(null);
    
    return await apiCall();
  } catch (error) {
    showErrorMessage(error, setError, fallbackMessage);
    return null;
  } finally {
    if (setLoading) setLoading(false);
  }
}