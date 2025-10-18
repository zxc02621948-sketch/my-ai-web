/**
 * 簡化的通知函數 - 用於替換 alert()
 * 自動解析標題和內容
 */

let notifyInstance = null;

if (typeof window !== "undefined") {
  // 動態導入通知管理器
  import("@/components/common/GlobalNotificationManager").then((module) => {
    notifyInstance = module.notify;
  });
}

/**
 * 智能通知函數 - 自動解析 alert() 的文本格式
 * @param {string} message - 通知消息（可能包含標題和內容）
 * @param {string} type - 通知類型（success, error, warning, info）
 */
export function smartNotify(message, type = "info") {
  if (!notifyInstance) {
    // 如果通知管理器還沒加載，使用原生 alert
    alert(message);
    return;
  }

  // 嘗試解析消息格式
  const lines = message.split("\n").filter(line => line.trim());
  
  if (lines.length === 0) return;
  
  // 第一行作為標題
  let title = lines[0].replace(/^[✅❌⚠️ℹ️🎉💡📅⏳💰💵📜➕📊🚀✨]+\s*/, "").trim();
  
  // 剩餘行作為內容
  let content = lines.slice(1).join("\n");
  
  // 如果沒有內容，使用標題作為內容
  if (!content && title) {
    content = title;
    title = type === "success" ? "成功" : type === "error" ? "錯誤" : type === "warning" ? "警告" : "提示";
  }
  
  // 根據內容判斷類型
  if (!type || type === "info") {
    if (message.includes("成功") || message.includes("✅") || message.includes("🎉")) {
      type = "success";
    } else if (message.includes("失敗") || message.includes("錯誤") || message.includes("❌")) {
      type = "error";
    } else if (message.includes("警告") || message.includes("⚠️")) {
      type = "warning";
    }
  }
  
  // 調用通知
  notifyInstance[type](title, content);
}

export default smartNotify;
