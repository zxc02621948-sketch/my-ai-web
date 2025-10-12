// app/test-exposure/page.jsx
"use client";

import { useState, useEffect } from "react";
import axios from "axios";

export default function TestExposurePage() {
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const response = await axios.get("/api/user-info");
      setUserInfo(response.data);
    } catch (error) {
      console.error("獲取用戶信息失敗:", error);
    }
  };

  // 曝光分數是訂閱專屬，不可積分購買

  const handleActivateSubscription = async (type, duration, bonus) => {
    setLoading(true);
    try {
      const response = await axios.post("/api/subscription/activate", {
        type: type,
        duration: duration,
        bonus: bonus
      });

      if (response.data.success) {
        alert("訂閱激活成功！已獲得曝光分數加成！");
        fetchUserInfo();
      } else {
        alert(response.data.message || "訂閱激活失敗");
      }
    } catch (error) {
      console.error("訂閱激活失敗:", error);
      alert("訂閱激活失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseCoupon = async (type) => {
    setLoading(true);
    try {
      const response = await axios.post("/api/power-coupon/purchase", {
        type: type,
        quantity: 1
      });

      if (response.data.success) {
        alert("權力券購買成功！");
        fetchUserInfo();
      } else {
        alert(response.data.message || "購買失敗");
      }
    } catch (error) {
      console.error("購買失敗:", error);
      alert("購買失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">曝光分數系統測試</h1>
        
        {/* 用戶信息 */}
        <div className="bg-zinc-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">用戶信息</h2>
          {userInfo ? (
            <div className="space-y-2">
              <p>積分餘額: {userInfo.pointsBalance}</p>
              <p>曝光倍數: {userInfo.exposureMultiplier || 1.0}</p>
              <p>曝光額外分數: {userInfo.exposureBonus || 0}</p>
              <p>曝光過期時間: {userInfo.exposureExpiry ? new Date(userInfo.exposureExpiry).toLocaleString() : '無'}</p>
              <p>權力券數量: {userInfo.powerCoupons || 0}</p>
              <p>活躍權力圖片: {userInfo.activePowerImages?.length || 0}</p>
            </div>
          ) : (
            <p>載入中...</p>
          )}
        </div>

        {/* 訂閱系統 */}
        <div className="bg-zinc-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">訂閱系統（曝光分數加成）</h2>
          <div className="text-gray-300 mb-4">
            <p className="mb-2">📈 曝光分數加成是訂閱專屬功能</p>
            <p className="mb-2">✅ 訂閱用戶自動獲得 1.2倍曝光分數加成</p>
            <p className="mb-2">🎯 所有圖片都會受益於曝光加成</p>
            <p className="text-sm text-gray-400">曝光分數 = (基礎分數 + 額外分數) × 1.2倍</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleActivateSubscription('monthly', 30, 0)}
              disabled={loading}
              className="p-4 bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50"
            >
              <div className="font-medium">月訂閱 +0分</div>
              <div className="text-sm">30天</div>
            </button>
            <button
              onClick={() => handleActivateSubscription('monthly', 30, 50)}
              disabled={loading}
              className="p-4 bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50"
            >
              <div className="font-medium">月訂閱 +50分</div>
              <div className="text-sm">30天</div>
            </button>
            <button
              onClick={() => handleActivateSubscription('yearly', 365, 0)}
              disabled={loading}
              className="p-4 bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
            >
              <div className="font-medium">年訂閱 +0分</div>
              <div className="text-sm">365天</div>
            </button>
            <button
              onClick={() => handleActivateSubscription('yearly', 365, 100)}
              disabled={loading}
              className="p-4 bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
            >
              <div className="font-medium">年訂閱 +100分</div>
              <div className="text-sm">365天</div>
            </button>
          </div>
        </div>

        {/* 權力券購買 */}
        <div className="bg-zinc-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">權力券購買</h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handlePurchaseCoupon('7day')}
              disabled={loading}
              className="p-4 bg-yellow-600 hover:bg-yellow-700 rounded-lg disabled:opacity-50"
            >
              <div className="font-medium">7天權力券</div>
              <div className="text-sm">30積分</div>
              <div className="text-xs text-gray-300">3天限購1張</div>
            </button>
            <button
              onClick={() => handlePurchaseCoupon('30day')}
              disabled={loading}
              className="p-4 bg-yellow-600 hover:bg-yellow-700 rounded-lg disabled:opacity-50"
            >
              <div className="font-medium">30天權力券</div>
              <div className="text-sm">100積分</div>
              <div className="text-xs text-gray-300">7天限購1張</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
