// lib/rateLimit.js
/**
 * 簡單的記憶體內速率限制器
 * 生產環境建議使用 Redis 或其他持久化存儲
 */

const rateLimit = new Map();

/**
 * 清理過期的記錄
 */
function cleanup() {
  const now = Date.now();
  for (const [key, data] of rateLimit.entries()) {
    if (now > data.resetTime) {
      rateLimit.delete(key);
    }
  }
}

// 每分鐘清理一次過期記錄
setInterval(cleanup, 60000);

/**
 * 速率限制中間件
 * @param {Object} options - 配置選項
 * @param {number} options.interval - 時間窗口（毫秒）
 * @param {number} options.uniqueTokenPerInterval - 時間窗口內允許的唯一標識數量
 * @returns {Function} 速率限制檢查函數
 */
export function rateLimiter(options = {}) {
  const interval = options.interval || 60000; // 默認 1 分鐘
  const limit = options.uniqueTokenPerInterval || 10; // 默認 10 次

  return {
    check: (identifier, limitOverride = limit) => {
      const now = Date.now();
      const tokenData = rateLimit.get(identifier) || {
        count: 0,
        resetTime: now + interval,
      };

      // 檢查時間窗口是否過期
      if (now > tokenData.resetTime) {
        tokenData.count = 0;
        tokenData.resetTime = now + interval;
      }

      tokenData.count++;
      rateLimit.set(identifier, tokenData);

      const isAllowed = tokenData.count <= limitOverride;
      const remaining = Math.max(0, limitOverride - tokenData.count);
      const resetTime = tokenData.resetTime;

      return {
        success: isAllowed,
        limit: limitOverride,
        remaining,
        reset: resetTime,
      };
    },
  };
}

/**
 * 預設的速率限制配置
 */
export const defaultLimiter = rateLimiter({
  interval: 60000, // 1 分鐘
  uniqueTokenPerInterval: 60, // 60 次/分鐘
});

export const strictLimiter = rateLimiter({
  interval: 60000, // 1 分鐘
  uniqueTokenPerInterval: 10, // 10 次/分鐘
});

export const uploadLimiter = rateLimiter({
  interval: 300000, // 5 分鐘
  uniqueTokenPerInterval: 5, // 5 次/5分鐘
});

export const authLimiter = rateLimiter({
  interval: 900000, // 15 分鐘
  uniqueTokenPerInterval: 5, // 5 次/15分鐘
});

/**
 * 從請求中獲取標識符（IP 或用戶 ID）
 */
export function getIdentifier(req, userId = null) {
  if (userId) return `user:${userId}`;
  
  // 嘗試從各種標頭獲取真實 IP
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  
  const ip = cfConnectingIp || realIp || forwarded?.split(",")[0] || "unknown";
  return `ip:${ip}`;
}

/**
 * 速率限制響應處理
 */
export function rateLimitResponse(result) {
  const headers = {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": new Date(result.reset).toISOString(),
  };

  if (!result.success) {
    return new Response(
      JSON.stringify({
        ok: false,
        message: "請求過於頻繁，請稍後再試",
        error: "RATE_LIMIT_EXCEEDED",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": Math.ceil((result.reset - Date.now()) / 1000).toString(),
          ...headers,
        },
      }
    );
  }

  return { headers };
}

/**
 * API 路由包裝器，自動應用速率限制
 */
export function withRateLimit(handler, limiter = defaultLimiter, options = {}) {
  return async (req, context) => {
    try {
      // 獲取標識符
      const userId = options.getUserId ? await options.getUserId(req, context) : null;
      const identifier = getIdentifier(req, userId);

      // 檢查速率限制
      const result = limiter.check(identifier, options.limit);

      // 如果超過限制，返回 429
      if (!result.success) {
        return rateLimitResponse(result);
      }

      // 執行原始處理器
      const response = await handler(req, context);

      // 如果響應是 Response 對象，添加速率限制標頭
      if (response instanceof Response) {
        const rateLimitHeaders = rateLimitResponse(result).headers;
        Object.entries(rateLimitHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      }

      return response;
    } catch (error) {
      console.error("Rate limit error:", error);
      // 如果速率限制出錯，仍然允許請求通過
      return handler(req, context);
    }
  };
}

