/**
 * 音频预热工具
 * 
 * 功能：通过 HEAD 请求预热音频文件，减少首次播放延迟
 */

const WARMUP_CACHE = new Map(); // 存储已预热的 URL
const MAX_CACHE_SIZE = 50; // 最多缓存 50 个 URL

/**
 * 预热音频文件（发送 HEAD 请求）
 * @param {string} url - 音频文件 URL
 * @returns {Promise<boolean>} - 是否成功预热
 */
export async function warmupAudio(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // 如果已经预热过，直接返回
  if (WARMUP_CACHE.has(url)) {
    return true;
  }

  try {
    // 发送 HEAD 请求预热
    const response = await fetch(url, {
      method: 'HEAD',
      cache: 'no-cache',
    });

    if (response.ok) {
      // 缓存预热结果
      WARMUP_CACHE.set(url, {
        timestamp: Date.now(),
        contentLength: response.headers.get('content-length'),
        contentType: response.headers.get('content-type'),
      });

      // 限制缓存大小
      if (WARMUP_CACHE.size > MAX_CACHE_SIZE) {
        // 删除最旧的缓存
        const entries = Array.from(WARMUP_CACHE.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const oldestEntry = entries[0];
        WARMUP_CACHE.delete(oldestEntry[0]);
      }

      return true;
    }

    return false;
  } catch (error) {
    // 静默处理错误，不影响正常播放
    console.warn(`[AudioWarmup] 预热失败 (${url}):`, error.message);
    return false;
  }
}

/**
 * 批量预热音频文件
 * @param {string[]} urls - 音频文件 URL 数组
 * @returns {Promise<void>}
 */
export async function warmupAudioBatch(urls) {
  if (!Array.isArray(urls) || urls.length === 0) {
    return;
  }

  // 并行预热（限制并发数，避免过多请求）
  const CONCURRENT_LIMIT = 3;
  const chunks = [];
  
  for (let i = 0; i < urls.length; i += CONCURRENT_LIMIT) {
    chunks.push(urls.slice(i, i + CONCURRENT_LIMIT));
  }

  for (const chunk of chunks) {
    await Promise.allSettled(
      chunk.map(url => warmupAudio(url))
    );
  }
}

/**
 * 检查是否已预热
 * @param {string} url - 音频文件 URL
 * @returns {boolean}
 */
export function isWarmedUp(url) {
  return WARMUP_CACHE.has(url);
}

/**
 * 清除预热缓存
 */
export function clearWarmupCache() {
  WARMUP_CACHE.clear();
}

/**
 * 获取预热缓存统计信息
 * @returns {{ size: number, urls: string[] }}
 */
export function getWarmupStats() {
  return {
    size: WARMUP_CACHE.size,
    urls: Array.from(WARMUP_CACHE.keys()),
  };
}

