// 事件隊列
const eventQueue = [];
const BATCH_SIZE = 20; // 每批最多20個事件
const FLUSH_INTERVAL = 5000; // 5秒自動刷新一次
let flushTimer = null;

// 生成會話ID（如果沒有）
function getSessionId() {
  if (typeof window === 'undefined') return null;
  
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
}

// 獲取設備信息
function getDeviceInfo() {
  if (typeof window === 'undefined') return null;

  const ua = navigator.userAgent;
  let deviceType = 'desktop';
  if (/mobile|android|iphone|ipad/i.test(ua)) {
    deviceType = 'mobile';
  } else if (/tablet|ipad/i.test(ua)) {
    deviceType = 'tablet';
  }

  let browser = 'unknown';
  if (ua.includes('Chrome')) browser = 'chrome';
  else if (ua.includes('Firefox')) browser = 'firefox';
  else if (ua.includes('Safari')) browser = 'safari';
  else if (ua.includes('Edge')) browser = 'edge';

  return {
    type: deviceType,
    browser,
    screenWidth: window.screen?.width || null,
    screenHeight: window.screen?.height || null,
  };
}

// 獲取網絡信息（如果可用）
function getNetworkInfo() {
  if (typeof window === 'undefined') return { type: 'unknown' };
  
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!connection) return { type: 'unknown' };

  const effectiveType = connection.effectiveType;
  let networkType = 'unknown';
  
  if (effectiveType === '4g') networkType = '4g';
  else if (effectiveType === '5g' || effectiveType === '5g-standalone') networkType = '5g';
  else if (connection.type === 'wifi') networkType = 'wifi';
  else if (effectiveType === '3g' || effectiveType === '2g') networkType = '4g'; // 降級處理

  return { type: networkType };
}

// 添加事件到隊列
export function trackEvent(type, eventData) {
  // 檢查隱私設定
  if (typeof window !== 'undefined') {
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      if (currentUser?.privacyPreferences?.allowDataAnalytics === false) {
        return; // 用戶已關閉數據分析
      }
    } catch (e) {
      // 忽略解析錯誤
    }
  }

  const sessionId = getSessionId();
  if (!sessionId) return; // 服務端渲染時跳過

  eventQueue.push({
    type, // 'image', 'video', 'music'
    data: {
      ...eventData,
      sessionId,
      deviceInfo: getDeviceInfo(),
      networkInfo: getNetworkInfo(),
    },
    timestamp: Date.now(),
  });

  // 如果隊列達到批量大小，立即發送
  if (eventQueue.length >= BATCH_SIZE) {
    flushEvents();
  } else if (!flushTimer) {
    // 否則設置定時器
    flushTimer = setTimeout(flushEvents, FLUSH_INTERVAL);
  }
}

// 發送事件批次
async function flushEvents() {
  if (eventQueue.length === 0) return;

  const events = eventQueue.splice(0, BATCH_SIZE);
  clearTimeout(flushTimer);
  flushTimer = null;

  // 按類型分組
  const grouped = {
    image: [],
    video: [],
    music: [],
  };

  events.forEach(event => {
    if (grouped[event.type]) {
      grouped[event.type].push(event.data);
    }
  });

  // 並行發送各類型事件
  const promises = [];
  if (grouped.image.length > 0) {
    promises.push(sendBatch('image', grouped.image));
  }
  if (grouped.video.length > 0) {
    promises.push(sendBatch('video', grouped.video));
  }
  if (grouped.music.length > 0) {
    promises.push(sendBatch('music', grouped.music));
  }

  await Promise.allSettled(promises);
}

// 發送批次到 API
async function sendBatch(type, events) {
  try {
    const sessionId = getSessionId();
    const response = await fetch(`/api/analytics/${type}-event`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-session-id': sessionId || '',
      },
      body: JSON.stringify({ events }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.warn(`[Analytics] Failed to send ${type} events:`, error);
    // 失敗的事件重新加入隊列（限制重試次數）
    events.forEach(event => {
      if ((event.retryCount || 0) < 3) {
        event.retryCount = (event.retryCount || 0) + 1;
        eventQueue.push({ type, data: event, timestamp: Date.now() });
      }
    });
  }
}

// 頁面卸載時強制發送
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    // 使用 sendBeacon 確保數據發送
    if (eventQueue.length > 0) {
      const events = [...eventQueue];
      eventQueue.length = 0;
      
      const grouped = {
        image: [],
        video: [],
        music: [],
      };

      events.forEach(event => {
        if (grouped[event.type]) {
          grouped[event.type].push(event.data);
        }
      });

      // 使用 sendBeacon 發送（同步，不阻塞頁面卸載）
      Object.keys(grouped).forEach(type => {
        if (grouped[type].length > 0) {
          const sessionId = getSessionId();
          const data = JSON.stringify({ events: grouped[type] });
          const blob = new Blob([data], {
            type: 'application/json',
          });
          // sendBeacon 不支持自定義 headers，所以 sessionId 需要在事件數據中
          navigator.sendBeacon(
            `/api/analytics/${type}-event`,
            blob
          );
        }
      });
    }
  });
}

