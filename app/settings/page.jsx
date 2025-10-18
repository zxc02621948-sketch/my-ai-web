"use client";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import axios from "axios";

export default function SettingsPage() {
  const { subscriptions, updateSubscriptions } = useCurrentUser();
  const [loading, setLoading] = useState(false);
  
  // 將 subscriptions 對象轉換為數組，顯示所有有效的訂閱（包括已取消但未到期的）
  const subscriptionsArray = Object.values(subscriptions).filter(s => {
    // 必須是活躍狀態
    return s.isActive;
  });

  
  const cancelSubscription = async (subscriptionType, name) => {
    if (!confirm(`確定要取消「${name}」訂閱嗎？\n\n⚠️ 取消後不會立即失效，您可以繼續使用到本期到期日。`)) {
      return;
    }
    
    setLoading(true);
    try {
      const res = await axios.post("/api/subscriptions/cancel", {
        subscriptionType
      });
      
      if (res.data.success) {
        const expiresAt = res.data.expiresAt ? new Date(res.data.expiresAt).toLocaleDateString('zh-TW') : '';
        alert(`訂閱已取消\n\n您可以繼續使用到 ${expiresAt}\n到期後將自動失效，不會再續費。`);
        updateSubscriptions();
      }
    } catch (error) {
      alert("取消失敗");
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
        </div>
        
        {/* 訂閱管理 */}
        <div className="mb-8 bg-zinc-800/40 border border-zinc-700/60 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">📋 我的訂閱</h2>
          
          {subscriptionsArray.length === 0 ? (
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