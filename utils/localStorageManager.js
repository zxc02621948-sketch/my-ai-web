/**
 * localStorage 管理工具
 * 
 * 功能：
 * 1. 版本号检查机制 - 自动清理过时的数据
 * 2. 数量限制 - 保留最多 20 笔（针对特定 key）
 * 3. 自动清理 - 清理旧数据和无效数据
 */

const STORAGE_VERSION = "1.0.0";
const STORAGE_VERSION_KEY = "__app_version__";
const MAX_STORAGE_ITEMS = 20; // 保留最多 20 笔（针对列表类型的数据）

// ✅ 需要限制数量的 key 模式（匹配后会自动清理，保留最新 N 笔）
const LIMITED_KEYS_PATTERNS = [
  /^playlist_\w+$/,      // 播放列表：playlist_xxx
  /^playlist_\w+_.+$/,   // 播放列表相关：playlist_xxx_xxx
];

// ✅ 需要检查版本的 key（版本不匹配时会自动清理）
const VERSION_CHECKED_KEYS = [
  "playlist_",
  "playerVolume",
  "levelFilters",
  "categoryFilters",
  "typeFilters",
  "languageFilters",
  "viewMode",
  "miniPlayerPosition",
  "miniPlayerExpanded",
  "miniPlayerTheme",
  "galleryMode",
  "galleryGuideShown",
];

/**
 * 初始化并检查版本
 * 如果版本不匹配，清理所有需要检查版本的 key
 */
export function initStorageManager() {
  if (typeof window === "undefined") return;

  try {
    const storedVersion = localStorage.getItem(STORAGE_VERSION_KEY);
    
    // 如果版本不匹配，清理所有需要检查版本的 key
    if (storedVersion !== STORAGE_VERSION) {
      console.log(`[StorageManager] 版本更新：${storedVersion || 'unknown'} -> ${STORAGE_VERSION}，清理过时数据`);
      
      // 清理所有需要检查版本的 key
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || key === STORAGE_VERSION_KEY) continue;
        
        // 检查是否需要清理
        const needsCleanup = VERSION_CHECKED_KEYS.some(prefix => 
          key.startsWith(prefix)
        );
        
        if (needsCleanup) {
          keysToRemove.push(key);
        }
      }
      
      // 删除需要清理的 key
      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.warn(`[StorageManager] 清理 key "${key}" 失败:`, e);
        }
      });
      
      // 更新版本号
      localStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
    }
    
    // 清理超过限制的项目
    cleanupExcessItems();
  } catch (error) {
    console.warn("[StorageManager] 初始化失败:", error);
  }
}

/**
 * 清理超过限制的项目
 * 只针对符合 LIMITED_KEYS_PATTERNS 的 key
 */
function cleanupExcessItems() {
  if (typeof window === "undefined") return;

  try {
    const keysToCheck = [];
    
    // 收集需要检查的 key
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || key === STORAGE_VERSION_KEY) continue;
      
      // 检查是否符合限制模式
      const shouldLimit = LIMITED_KEYS_PATTERNS.some(pattern => 
        pattern.test(key)
      );
      
      if (shouldLimit) {
        keysToCheck.push(key);
      }
    }
    
    // 如果超过限制，按最后修改时间排序，删除最旧的
    if (keysToCheck.length > MAX_STORAGE_ITEMS) {
      // 收集每个 key 的最后修改时间（使用 key 本身的存储时间估算）
      const keyTimestamps = keysToCheck.map(key => {
        try {
          // 尝试从值中提取时间戳（如果有）
          const value = localStorage.getItem(key);
          let timestamp = Date.now(); // 默认使用当前时间
          
          // 如果是 JSON 对象，尝试获取时间戳
          try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed.timestamp === 'number') {
              timestamp = parsed.timestamp;
            } else if (parsed && parsed.createdAt) {
              timestamp = new Date(parsed.createdAt).getTime() || Date.now();
            }
          } catch {
            // 不是 JSON，使用默认时间戳
          }
          
          return { key, timestamp };
        } catch (e) {
          return { key, timestamp: Date.now() };
        }
      });
      
      // 按时间戳排序（最旧的在前）
      keyTimestamps.sort((a, b) => a.timestamp - b.timestamp);
      
      // 删除最旧的，保留最新的 MAX_STORAGE_ITEMS 个
      const keysToRemove = keyTimestamps.slice(0, keyTimestamps.length - MAX_STORAGE_ITEMS);
      
      keysToRemove.forEach(({ key }) => {
        try {
          localStorage.removeItem(key);
          console.log(`[StorageManager] 清理过时项目: ${key}`);
        } catch (e) {
          console.warn(`[StorageManager] 清理 key "${key}" 失败:`, e);
        }
      });
    }
  } catch (error) {
    console.warn("[StorageManager] 清理超过限制的项目失败:", error);
  }
}

/**
 * 安全的 setItem（带版本检查和数量限制）
 */
export function setItem(key, value) {
  if (typeof window === "undefined") return;

  try {
    // 检查是否需要添加时间戳
    const shouldAddTimestamp = LIMITED_KEYS_PATTERNS.some(pattern => 
      pattern.test(key)
    );
    
    let valueToStore = value;
    
    // 如果是列表类型，添加时间戳
    if (shouldAddTimestamp && typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && !parsed.timestamp) {
          parsed.timestamp = Date.now();
          valueToStore = JSON.stringify(parsed);
        }
      } catch {
        // 不是 JSON，不添加时间戳
      }
    }
    
    localStorage.setItem(key, valueToStore);
    
    // 定期清理超过限制的项目（避免每次都清理，降低性能影响）
    if (Math.random() < 0.1) { // 10% 的概率清理
      cleanupExcessItems();
    }
  } catch (error) {
    console.warn(`[StorageManager] setItem 失败 (key: ${key}):`, error);
  }
}

/**
 * 安全的 getItem（自动处理版本检查）
 */
export function getItem(key) {
  if (typeof window === "undefined") return null;

  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`[StorageManager] getItem 失败 (key: ${key}):`, error);
    return null;
  }
}

/**
 * 安全的 removeItem
 */
export function removeItem(key) {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`[StorageManager] removeItem 失败 (key: ${key}):`, error);
  }
}

/**
 * 清理所有应用相关的 localStorage（保留系统 key）
 */
export function clearAppStorage() {
  if (typeof window === "undefined") return;

  try {
    const keysToRemove = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      // 保留版本号 key
      if (key === STORAGE_VERSION_KEY) continue;
      
      keysToRemove.push(key);
    }
    
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn(`[StorageManager] 清理 key "${key}" 失败:`, e);
      }
    });
    
    console.log("[StorageManager] 已清理所有应用数据");
  } catch (error) {
    console.warn("[StorageManager] 清理失败:", error);
  }
}

// ✅ 页面加载时自动初始化
if (typeof window !== "undefined") {
  // 延迟初始化，避免阻塞页面加载
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStorageManager);
  } else {
    // 如果 DOM 已经加载完成，立即初始化
    initStorageManager();
  }
}

