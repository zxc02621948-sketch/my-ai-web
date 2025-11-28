// hooks/useVisitTracking.js
// 可复用的访问记录 Hook
import { useEffect } from "react";

export default function useVisitTracking() {
  useEffect(() => {
    let isLogging = false; // 防止并发请求

    const logDualTrackVisit = async () => {
      try {
        // 防止并发请求
        if (isLogging) {
          return;
        }

        isLogging = true;
        const currentPath = window.location.pathname;

        // 🛡️ 防刷量统计 - 只做短时间防抖，依赖后端30秒防重复机制
        const logAntiSpamVisit = async () => {
          try {
            // ✅ 检查 sessionStorage 是否可用（无痕模式可能不支持）
            let lastLogTime = null;
            const now = Date.now();
            
            try {
              // ✅ 只检查最近是否刚记录过（防抖机制，1秒内不重复）
              // 移除永久标记，让后端处理30秒防重复
              lastLogTime = sessionStorage.getItem("last_visit_log_time");
            } catch (e) {
              // sessionStorage 不可用（可能是无痕模式），继续执行
            }

            if (lastLogTime && now - parseInt(lastLogTime, 10) < 1000) {
              // 1秒内不重复记录（防止快速连续请求）
              return { success: true, skipped: true, reason: "debounce" };
            }

            const response = await fetch("/api/log-visit", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              credentials: "include",
              body: JSON.stringify({
                path: currentPath,
              }),
            });

            if (response.ok) {
              // ✅ 只保存时间戳（如果 sessionStorage 可用）
              // 移除永久标记，让后端处理30秒防重复机制
              try {
                sessionStorage.setItem("last_visit_log_time", now.toString());
              } catch (e) {
                // sessionStorage 不可用，忽略
              }
              return { success: true, skipped: false };
            } else {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(`HTTP ${response.status}: ${errorData.message || errorData.error || 'Unknown error'}`);
            }
          } catch (error) {
            console.warn("🛡️ [防刷量] 访问记录失败:", error);
            return { success: false, error };
          }
        };

        // 💰 广告收益统计 - 更宽松的防重复机制
        const logAdRevenueVisit = async () => {
          try {
            // ✅ 检查 sessionStorage 是否可用（无痕模式可能不支持）
            let adLastLogTime = null;
            const now = Date.now();
            
            try {
              // 广告统计只检查很短时间内的重复（避免同一次点击产生多次记录）
              adLastLogTime = sessionStorage.getItem("last_ad_visit_log_time");
            } catch (e) {
              // sessionStorage 不可用，继续执行
            }
            
            if (adLastLogTime && now - parseInt(adLastLogTime, 10) < 200) {
              // 200ms内不重复记录
              return { success: true, skipped: true, reason: "rapid_click" };
            }

            const response = await fetch("/api/log-ad-visit", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              credentials: "include",
              body: JSON.stringify({
                path: currentPath,
              }),
            });

            if (response.ok) {
              // ✅ 保存时间戳（如果 sessionStorage 可用）
              try {
                sessionStorage.setItem("last_ad_visit_log_time", now.toString());
              } catch (e) {
                // sessionStorage 不可用，忽略
              }
              const result = await response.json();
              return {
                success: true,
                skipped: false,
                isDuplicate: result.isDuplicate,
              };
            } else {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(`HTTP ${response.status}: ${errorData.message || errorData.error || 'Unknown error'}`);
            }
          } catch (error) {
            console.warn("💰 [广告统计] 访问记录失败:", error);
            return { success: false, error };
          }
        };

        // 并行执行两个统计
        await Promise.allSettled([logAntiSpamVisit(), logAdRevenueVisit()]);
      } catch (error) {
        console.warn("📊 [双轨统计] 整体失败:", error);
      } finally {
        isLogging = false;
      }
    };

    // 使用 setTimeout 延迟执行，确保页面完全加载
    const timeoutId = setTimeout(logDualTrackVisit, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []); // 只在组件挂载时执行一次
}

