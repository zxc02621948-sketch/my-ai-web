// components/power-coupon/PowerCouponButton.jsx
"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { notify } from "@/components/common/GlobalNotificationManager";
import { getApiErrorMessage, isAuthError } from "@/lib/clientAuthError";

/**
 * 通用加成券按鈕組件
 * @param {Object} props
 * @param {string} props.contentType - 内容类型: 'image' | 'video' | 'music'
 * @param {string} props.contentId - 内容ID
 * @param {string} props.contentTitle - 内容标题
 * @param {Function} props.onSuccess - 使用成功后的回调
 * @param {string} props.className - 自定义样式类
 */
export default function PowerCouponButton({ 
  contentType, 
  contentId, 
  contentTitle, 
  onSuccess,
  className = ""
}) {
  const [userCoupons, setUserCoupons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedCouponId, setSelectedCouponId] = useState(null);
  const [isUsingCoupon, setIsUsingCoupon] = useState(false);

  // 獲取用戶加成券 - 組件掛載時獲取一次，彈窗打開時重新獲取
  useEffect(() => {
    fetchUserCoupons();
  }, []);

  // 彈窗打開時重新獲取券列表，確保數據最新
  useEffect(() => {
    if (showModal) {
      fetchUserCoupons();
    }
  }, [showModal]);

  const fetchUserCoupons = async () => {
    try {
      const response = await axios.get("/api/power-coupon/user-coupons", {
        withCredentials: true
      });
      if (response.data.success) {
        setUserCoupons(response.data.coupons || []);
        return response.data.coupons || [];
      }
      return [];
    } catch (error) {
      if (!isAuthError(error)) {
        console.error("獲取加成券失敗:", error);
      }
      return [];
    }
  };

  // 處理按鈕點擊
  const handleButtonClick = async () => {
    // 重新獲取最新的券列表
    const coupons = await fetchUserCoupons();
    
    // 檢查是否有可用券
    const availableCoupons = coupons.filter(coupon => 
      !coupon.used && 
      (!coupon.expiry || new Date() < new Date(coupon.expiry))
    );
    
    if (availableCoupons.length === 0) {
      notify.warning('提示', '你沒有可用的加成券！請先到積分商店購買。');
      return;
    }
    
    setShowModal(true);
    setSelectedCouponId(null);
  };

  // 使用權力券
  const handleUseCoupon = async () => {
    if (!selectedCouponId) {
      notify.warning('提示', '請選擇要使用的加成券');
      return;
    }
    
    setIsUsingCoupon(true);
    try {
      const response = await axios.post("/api/power-coupon/use", {
        contentType,
        contentId,
        couponId: selectedCouponId
      }, {
        withCredentials: true
      });

      if (response.data.success) {
        const contentTypeNames = {
          image: '圖片',
          video: '影片',
          music: '音樂'
        };
        notify.success("成功", `加成券使用成功！${contentTypeNames[contentType]}曝光度已提升。`);
        setShowModal(false);
        if (onSuccess) onSuccess();
        // 重新獲取加成券列表
        await fetchUserCoupons();
      } else {
        notify.error("使用失敗", response.data.message || "請稍後再試");
      }
    } catch (error) {
      if (!isAuthError(error)) {
        console.error("使用加成券失敗:", error);
      }
      notify.error("使用失敗", getApiErrorMessage(error, "請稍後再試"));
    } finally {
      setIsUsingCoupon(false);
    }
  };

  // 合併相同類型的券
  const groupedCoupons = userCoupons
    .filter(coupon => 
      !coupon.used && 
      (!coupon.expiry || new Date() < new Date(coupon.expiry))
    )
    .reduce((acc, coupon) => {
      const key = coupon.type;
      if (!acc[key]) {
        acc[key] = {
          type: coupon.type,
          coupons: [],
          count: 0
        };
      }
      acc[key].coupons.push(coupon);
      acc[key].count++;
      return acc;
    }, {});

  const hasAvailableCoupons = Object.keys(groupedCoupons).length > 0;

  // 如果沒有可用券，不顯示按鈕
  if (!hasAvailableCoupons) {
    return null;
  }

  return (
    <>
      <button
        onClick={handleButtonClick}
        className={`flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded shadow transition ${className}`}
        title="使用加成券增加曝光度"
        disabled={loading}
      >
        🎫 加成券
      </button>

      {/* 加成券選擇模態框 */}
      {showModal && (
        <div 
          className="fixed inset-0 z-[100000] flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowModal(false);
            }
          }}
        >
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-zinc-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">選擇加成券</h3>
            <p className="text-gray-400 mb-4">
              為「{contentTitle || `${contentType === 'image' ? '圖片' : contentType === 'video' ? '影片' : '音樂'}`}」使用加成券，讓它重新獲得新作品加成效果
            </p>
            
            <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
              {Object.values(groupedCoupons).map((group, index) => (
                <div
                  key={group.type}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedCouponId && group.coupons.some(c => c._id === selectedCouponId)
                      ? "bg-purple-700 border-purple-500"
                      : "bg-zinc-700 border-zinc-600 hover:bg-zinc-600"
                  }`}
                  onClick={() => {
                    setSelectedCouponId(group.coupons[0]._id);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">🎫</div>
                      <div>
                        <p className="font-medium text-white">
                          {group.type === '7day' ? '7天曝光加成券' : 
                           group.type === '30day' ? '30天曝光加成券' : 
                           group.type === 'rare' ? '稀有曝光加成券' : group.type}
                          {group.count > 1 && (
                            <span className="ml-2 bg-yellow-600 text-yellow-100 text-xs px-2 py-1 rounded-full">
                              x{group.count}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">
                          購買日期: {new Date(group.coupons[0].createdAt).toLocaleDateString()}
                        </p>
                        {group.coupons[0].expiry && (
                          <p className="text-xs text-gray-400">
                            過期日期: {new Date(group.coupons[0].expiry).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    {selectedCouponId && group.coupons.some(c => c._id === selectedCouponId) && (
                      <span className="text-green-400 text-sm">已選擇</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleUseCoupon}
                disabled={!selectedCouponId || isUsingCoupon}
                className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                  !selectedCouponId || isUsingCoupon
                    ? "bg-gray-500 text-gray-300 cursor-not-allowed"
                    : "bg-purple-600 hover:bg-purple-700 text-white"
                }`}
              >
                {isUsingCoupon ? "使用中..." : "確認使用"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

