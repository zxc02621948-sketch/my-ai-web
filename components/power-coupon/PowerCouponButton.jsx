// components/power-coupon/PowerCouponButton.jsx
"use client";

import { useState, useEffect } from "react";
import axios from "axios";

export default function PowerCouponButton({ imageId, imageTitle, onSuccess }) {
  const [userCoupons, setUserCoupons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // 獲取用戶權力券
  useEffect(() => {
    const fetchUserCoupons = async () => {
      try {
        const response = await axios.get("/api/power-coupon/user-coupons");
        if (response.data.success) {
          setUserCoupons(response.data.coupons);
        }
      } catch (error) {
        console.error("獲取權力券失敗:", error);
      }
    };

    fetchUserCoupons();
  }, []);

  // 使用權力券
  const handleUseCoupon = async (couponId) => {
    setLoading(true);
    try {
      const response = await axios.post("/api/power-coupon/use", {
        imageId,
        couponId
      });

      if (response.data.success) {
        alert("權力券使用成功！圖片已重新獲得新圖加乘效果！");
        setShowModal(false);
        if (onSuccess) onSuccess();
        // 重新獲取權力券列表
        const couponsResponse = await axios.get("/api/power-coupon/user-coupons");
        if (couponsResponse.data.success) {
          setUserCoupons(couponsResponse.data.coupons);
        }
      } else {
        alert(response.data.message || "使用失敗，請稍後再試。");
      }
    } catch (error) {
      console.error("使用權力券失敗:", error);
      alert("使用失敗，請稍後再試。");
    } finally {
      setLoading(false);
    }
  };

  // 檢查是否可以使用權力券
  const canUseCoupon = userCoupons.some(coupon => 
    !coupon.used && 
    (!coupon.expiry || new Date() < new Date(coupon.expiry))
  );

  if (!canUseCoupon) {
    return null; // 沒有可用的權力券，不顯示按鈕
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded-md transition-colors"
        disabled={loading}
      >
        🎫 使用權力券
      </button>

      {/* 權力券選擇模態框 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-zinc-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">選擇權力券</h3>
            <p className="text-gray-400 mb-4">
              為「{imageTitle}」使用權力券，讓它重新獲得新圖加乘效果
            </p>
            
            <div className="space-y-2 mb-6">
              {userCoupons
                .filter(coupon => 
                  !coupon.used && 
                  (!coupon.expiry || new Date() < new Date(coupon.expiry))
                )
                .map(coupon => (
                  <div
                    key={coupon._id}
                    className="flex items-center justify-between p-3 bg-zinc-700 rounded-lg"
                  >
                    <div>
                      <div className="font-medium">
                        {coupon.type === '7day' ? '7天券' : '30天券'}
                        {coupon.isRare && ' (稀有)'}
                      </div>
                      <div className="text-sm text-gray-400">
                        {coupon.expiry ? `過期時間: ${new Date(coupon.expiry).toLocaleDateString()}` : '永不過期'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleUseCoupon(coupon._id)}
                      disabled={loading}
                      className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md transition-colors disabled:opacity-50"
                    >
                      {loading ? "使用中..." : "使用"}
                    </button>
                  </div>
                ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

