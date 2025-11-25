"use client";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import axios from "axios";
import { notify } from "@/components/common/GlobalNotificationManager";
import AdminPanel from "@/components/homepage/AdminPanel";

export default function SettingsPage() {
  const { currentUser, subscriptions, updateSubscriptions } = useCurrentUser();
  const [loading, setLoading] = useState(false);
  
  // 將 subscriptions 對象轉換為數組，顯示所有有效的訂閱（包括已取消但未到期的）
  const subscriptionsArray = Object.values(subscriptions).filter(s => {
    // 必須是活躍狀態
    return s.isActive;
  });
  
  // 檢查播放器體驗券狀態
  const hasPlayerCoupon = currentUser?.playerCouponUsed && 
                          currentUser?.miniPlayerExpiry && 
                          new Date(currentUser.miniPlayerExpiry) > new Date();

  
  const cancelSubscription = async (subscriptionType, name) => {
    const confirmed = await notify.confirm(
      "確認取消訂閱",
      `確定要取消「${name}」訂閱嗎？\n\n⚠️ 取消後不會立即失效，您可以繼續使用到本期到期日。`
    );
    if (!confirmed) {
      return;
    }
    
    setLoading(true);
    try {
      const res = await axios.post("/api/subscriptions/cancel", {
        subscriptionType
      });
      
      if (res.data.success) {
        const expiresAt = res.data.expiresAt ? new Date(res.data.expiresAt).toLocaleDateString('zh-TW') : '';
        notify.success("訂閱已取消", `您可以繼續使用到 ${expiresAt}\n到期後將自動失效，不會再續費。`);
        updateSubscriptions();
      }
    } catch (error) {
      notify.error("取消失敗", "取消訂閱時發生錯誤，請稍後再試");
    } finally {
      setLoading(false);
    }
  };


         const SUBSCRIPTION_NAMES = {
           pinPlayer: "釘選播放器",
           pinPlayerTest: "釘選播放器（測試）",
           uploadQuota: "上傳配額",
           premiumFeatures: "高級功能"
         };

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">設置</h1>
        
        {/* 快速導航 */}
        <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <a 
            href="/settings/privacy"
            className="bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700 rounded-lg p-4 transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🔒</span>
              <h3 className="font-semibold text-lg group-hover:text-blue-400 transition">隱私設定</h3>
            </div>
            <p className="text-sm text-zinc-400">管理資料使用偏好和隱私權利</p>
          </a>
          
          <a 
            href="/settings/account/deletion"
            className="bg-zinc-800/60 hover:bg-zinc-800 border border-red-700/50 rounded-lg p-4 transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🗑️</span>
              <h3 className="font-semibold text-lg group-hover:text-red-400 transition">帳號註銷</h3>
            </div>
            <p className="text-sm text-zinc-400">永久刪除帳號和所有數據</p>
          </a>
        </div>
        
        {/* 管理員工具 */}
        {currentUser?.isAdmin && (
          <div className="mb-8 space-y-6">
            {/* 管理頁面連結 */}
            <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-700/50 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span className="text-2xl">🛠️</span>
                <span>管理員工具</span>
                <span className="text-xs px-2 py-1 bg-purple-600/30 border border-purple-500/50 rounded text-purple-300">
                  僅管理員可見
                </span>
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* 統計分析 */}
              <a 
                href="/admin/analytics"
                className="bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700 rounded-lg p-4 transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">📊</span>
                  <h3 className="font-semibold text-lg group-hover:text-blue-400 transition">流量統計</h3>
                </div>
                <p className="text-sm text-zinc-400">查看網站流量和訪問記錄</p>
              </a>
              
              <a 
                href="/admin/ad-analytics"
                className="bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700 rounded-lg p-4 transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">💰</span>
                  <h3 className="font-semibold text-lg group-hover:text-green-400 transition">廣告統計</h3>
                </div>
                <p className="text-sm text-zinc-400">查看廣告收益和點擊數據</p>
              </a>
              
              {/* 內容分析 */}
              <a 
                href="/admin/content-analytics/music"
                className="bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700 rounded-lg p-4 transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">🎧</span>
                  <h3 className="font-semibold text-lg group-hover:text-purple-400 transition">音樂分析</h3>
                </div>
                <p className="text-sm text-zinc-400">音樂播放器監控和分析</p>
              </a>
              
              <a 
                href="/admin/content-analytics/images"
                className="bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700 rounded-lg p-4 transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">🖼️</span>
                  <h3 className="font-semibold text-lg group-hover:text-pink-400 transition">圖片分析</h3>
                </div>
                <p className="text-sm text-zinc-400">圖片瀏覽深度和互動分析</p>
              </a>
              
              <a 
                href="/admin/content-analytics/videos"
                className="bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700 rounded-lg p-4 transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">🎬</span>
                  <h3 className="font-semibold text-lg group-hover:text-orange-400 transition">影片分析</h3>
                </div>
                <p className="text-sm text-zinc-400">影片播放和卡頓分析</p>
              </a>
              
              {/* 內容管理 */}
              <a 
                href="/admin/reports"
                className="bg-zinc-800/60 hover:bg-zinc-800 border border-red-700/50 rounded-lg p-4 transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">🚨</span>
                  <h3 className="font-semibold text-lg group-hover:text-red-400 transition">檢舉管理</h3>
                </div>
                <p className="text-sm text-zinc-400">處理用戶檢舉內容</p>
              </a>
              
              <a 
                href="/admin/feedbacks"
                className="bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700 rounded-lg p-4 transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">💬</span>
                  <h3 className="font-semibold text-lg group-hover:text-yellow-400 transition">意見反饋</h3>
                </div>
                <p className="text-sm text-zinc-400">查看用戶意見和建議</p>
              </a>
              
              {/* 用戶管理 */}
              <a 
                href="/admin/warnings"
                className="bg-zinc-800/60 hover:bg-zinc-800 border border-yellow-700/50 rounded-lg p-4 transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">⚠️</span>
                  <h3 className="font-semibold text-lg group-hover:text-yellow-400 transition">警告管理</h3>
                </div>
                <p className="text-sm text-zinc-400">管理用戶警告記錄</p>
              </a>
              
              <a 
                href="/admin/suspensions"
                className="bg-zinc-800/60 hover:bg-zinc-800 border border-red-700/50 rounded-lg p-4 transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">🔒</span>
                  <h3 className="font-semibold text-lg group-hover:text-red-400 transition">封鎖管理</h3>
                </div>
                <p className="text-sm text-zinc-400">管理用戶封鎖狀態</p>
              </a>
              
              <a 
                href="/admin/account-deletion"
                className="bg-zinc-800/60 hover:bg-zinc-800 border border-red-700/50 rounded-lg p-4 transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">🗑️</span>
                  <h3 className="font-semibold text-lg group-hover:text-red-400 transition">帳號註銷管理</h3>
                </div>
                <p className="text-sm text-zinc-400">管理待刪除帳號</p>
              </a>
              </div>
            </div>
            
            {/* 功能工具 */}
            <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-700/50 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span className="text-2xl">⚙️</span>
                <span>功能工具</span>
              </h2>
              <AdminPanel />
            </div>
          </div>
        )}
        
        {/* 訂閱管理 */}
        <div className="mb-8 bg-zinc-800/40 border border-zinc-700/60 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">📋 我的訂閱與權益</h2>
          
          {subscriptionsArray.length === 0 && !hasPlayerCoupon ? (
            <div className="text-gray-400 text-center py-8">
              <p className="mb-4">尚無訂閱項目</p>
              <a 
                href="/store" 
                className="inline-block px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                前往積分商店
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 播放器體驗券 */}
              {hasPlayerCoupon && (
                <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/40 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-lg">🎧 播放器完整功能體驗券 (3天)</h3>
                      <p className="text-sm text-gray-400 mt-1">
                        🎁 免費體驗（限時權益）
                      </p>
                    </div>
                    <span className="px-3 py-1 text-sm rounded-full bg-purple-600/20 border border-purple-600/50 text-purple-400">
                      體驗中
                    </span>
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">到期時間：</span>
                      <span className="text-white font-medium">
                        {new Date(currentUser.miniPlayerExpiry).toLocaleString('zh-TW', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">剩餘時間：</span>
                      <span className="text-yellow-400 font-medium">
                        {Math.ceil((new Date(currentUser.miniPlayerExpiry) - new Date()) / (1000 * 60 * 60))} 小時
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-gray-500">
                    ⚠️ 體驗券到期後將自動失效。如需繼續使用，請前往積分商店購買完整版播放器或訂閱釘選播放器功能。
                  </div>
                </div>
              )}
              
              {/* 正式訂閱列表 */}
              {subscriptionsArray.map((sub, index) => (
                <div 
                  key={index}
                  className="bg-zinc-900/50 border border-zinc-700/40 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-lg">{SUBSCRIPTION_NAMES[sub.type] || sub.type}</h3>
                      <p className="text-sm text-gray-400 mt-1">
                        💰 {sub.monthlyCost} 積分/月
                      </p>
                    </div>
                    <span className={`px-3 py-1 text-sm rounded-full ${
                      sub.cancelledAt 
                        ? "bg-yellow-600/20 border border-yellow-600/50 text-yellow-400"
                        : "bg-green-600/20 border border-green-600/50 text-green-400"
                    }`}>
                      {sub.cancelledAt ? "已取消" : "訂閱中"}
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-300 mb-4">
                    {(() => {
                      const expiresAtValue = sub.expiresAt || sub.nextBillingDate;
                      const expiresAt = expiresAtValue ? new Date(expiresAtValue) : null;
                      const isPermanent = expiresAt && expiresAt > new Date('2099-01-01');
                      const daysRemaining = expiresAt ? Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24)) : 0;
                      
                      return (
                        <>
                          {expiresAt && (
                            <>
                              <p>📅 到期時間：{isPermanent ? <span className="text-yellow-400 font-semibold">🎉 永久訂閱</span> : expiresAt.toLocaleDateString('zh-TW')}</p>
                              {!isPermanent && (
                                <p>⏳ 剩餘天數：{daysRemaining > 0 ? daysRemaining : 0} 天</p>
                              )}
                            </>
                          )}
                          <p>📆 開始日期：{new Date(sub.startDate).toLocaleDateString('zh-TW')}</p>
                          {sub.cancelledAt && !isPermanent && (
                            <p className="text-red-400">⚠️ 已取消，到期後失效</p>
                          )}
                          {isPermanent && (
                            <p className="text-green-400">✨ 等級獎勵 - 永久免費</p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  
                  {/* 累積制說明 */}
                  <div className="mb-4 p-3 bg-blue-900/10 border border-blue-600/20 rounded-lg">
                    <div className="text-sm font-medium text-blue-300 mb-1">💡 累積制續費</div>
                    <div className="text-xs text-gray-400">
                      續費時剩餘時間會累積延長。例如：剩餘 3 天時續費，將變成 33 天。
                    </div>
                  </div>
                  
                  {/* 取消訂閱按鈕 - 只有未取消的訂閱才顯示 */}
                  {!sub.cancelledAt && (
                    <button
                      onClick={() => cancelSubscription(sub.type, SUBSCRIPTION_NAMES[sub.type])}
                      disabled={loading}
                      className="w-full py-2 px-4 bg-red-600/20 border border-red-600/50 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors disabled:opacity-50"
                    >
                      取消訂閱
                    </button>
                  )}
                  
                  {/* 已取消的訂閱顯示說明 */}
                  {sub.cancelledAt && (
                    <div className="w-full py-2 px-4 bg-gray-600/20 border border-gray-600/50 text-gray-400 rounded-lg text-center text-sm">
                      訂閱已取消，將於到期後失效
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}