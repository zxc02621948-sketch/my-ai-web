// components/user/PowerCouponGuideModal.jsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function PowerCouponGuideModal({ isOpen, onClose, hasNoCoupon, couponCount }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // 鎖住背景 scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const handleGoToStore = () => {
    onClose();
    router.push('/store');
  };

  return createPortal(
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999] p-2"
      onClick={onClose}
    >
      <div 
        className="bg-zinc-800 rounded-lg max-w-lg w-full max-h-[70vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 標題 */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-purple-700 px-3 py-2 flex justify-between items-center rounded-t-lg">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🎫</span>
            {hasNoCoupon ? '新圖加乘券說明' : '如何使用新圖加乘券'}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-3xl font-bold leading-none"
          >
            ×
          </button>
        </div>

        {/* 內容 */}
        <div className="p-3 space-y-2">
          {hasNoCoupon ? (
            // 無券時：說明功能和購買
            <>
              {/* 功能說明 */}
              <div className="bg-purple-900/20 border border-purple-600/30 rounded-lg p-2">
                <h3 className="text-base font-semibold text-purple-300 mb-2 flex items-center gap-2">
                  <span>📌</span>
                  什麼是新圖加乘券？
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  新圖加乘券可以讓你的<span className="text-yellow-400 font-semibold">舊圖片重新獲得「新圖加乘」效果</span>，
                  大幅提升曝光率和流量，讓更多人看到你的作品！
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  💡 券本身有有效期（7天或30天），在有效期內可以隨時使用<br/>
                  ⚡ 使用後圖片獲得新圖加乘效果，持續 <span className="text-yellow-400 font-semibold">10小時</span>
                </p>
              </div>

              {/* 使用步驟 */}
              <div>
                <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
                  <span>📖</span>
                  如何使用
                </h3>
                <div className="space-y-3">
                  {[
                    { step: 1, text: '點擊你想加乘的圖片，打開大圖彈窗' },
                    { step: 2, text: '在彈窗中找到紫色的「🎫 權力券」按鈕' },
                    { step: 3, text: '選擇券種（7天券或30天券）' },
                    { step: 4, text: '確認後，該圖片將重新獲得新圖的曝光加成！' }
                  ].map(({ step, text }) => (
                    <div key={step} className="flex items-start gap-2 bg-zinc-700/50 rounded-lg p-2">
                      <div className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-xs">
                        {step}
                      </div>
                      <p className="text-gray-300 pt-0.5">{text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 購買資訊 */}
              <div>
                <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
                  <span>💰</span>
                  券種與價格
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 7天券 */}
                  <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 border border-blue-600/30 rounded-lg p-2">
                    <div className="text-center mb-2">
                      <div className="text-2xl mb-1">🎫</div>
                      <h4 className="text-base font-bold text-blue-300">7天券</h4>
                    </div>
                    <div className="space-y-2 text-sm text-gray-300">
                      <div className="flex justify-between">
                        <span>價格</span>
                        <span className="text-yellow-400 font-semibold">30 積分</span>
                      </div>
                      <div className="flex justify-between">
                        <span>券有效期</span>
                        <span className="text-green-400">7 天</span>
                      </div>
                      <div className="flex justify-between">
                        <span>效果持續</span>
                        <span className="text-blue-400">10 小時</span>
                      </div>
                      <div className="flex justify-between">
                        <span>限購</span>
                        <span className="text-orange-400">3天內1張</span>
                      </div>
                    </div>
                  </div>

                  {/* 30天券 */}
                  <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 border border-purple-600/30 rounded-lg p-2">
                    <div className="text-center mb-2">
                      <div className="text-2xl mb-1">🎫✨</div>
                      <h4 className="text-base font-bold text-purple-300">30天券</h4>
                    </div>
                    <div className="space-y-2 text-sm text-gray-300">
                      <div className="flex justify-between">
                        <span>價格</span>
                        <span className="text-yellow-400 font-semibold">100 積分</span>
                      </div>
                      <div className="flex justify-between">
                        <span>券有效期</span>
                        <span className="text-green-400">30 天</span>
                      </div>
                      <div className="flex justify-between">
                        <span>效果持續</span>
                        <span className="text-blue-400">10 小時</span>
                      </div>
                      <div className="flex justify-between">
                        <span>限購</span>
                        <span className="text-orange-400">7天內1張</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 按鈕 */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleGoToStore}
                  className="flex-1 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-white py-1.5 px-3 rounded-lg font-semibold transition-all duration-200 shadow-lg text-xs"
                >
                  🛍️ 前往積分商店購買
                </button>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-gray-300 rounded-lg font-medium transition-all duration-200 text-xs"
                >
                  稍後再說
                </button>
              </div>
            </>
          ) : (
            // 有券時：使用教學
            <>
              {/* 券數量 */}
              <div className="bg-green-900/20 border border-green-600/30 rounded-lg p-2 text-center">
                <div className="text-2xl mb-1">✅</div>
                <h3 className="text-lg font-semibold text-green-300 mb-1">
                  你目前有 <span className="text-yellow-400 text-2xl">{couponCount}</span> 張可用的加乘券
                </h3>
                <p className="text-gray-400 text-sm">趕快為你的作品加乘吧！</p>
              </div>

              {/* 使用步驟 */}
              <div>
                <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
                  <span>📖</span>
                  使用步驟
                </h3>
                <div className="space-y-3">
                  {[
                    { 
                      step: 1, 
                      text: '前往你的作品列表',
                      detail: '在個人頁面的「上傳作品」分頁中找到想要加乘的圖片'
                    },
                    { 
                      step: 2, 
                      text: '點擊圖片，打開大圖彈窗',
                      detail: '點擊任何一張你的作品，會彈出詳細資訊視窗'
                    },
                    { 
                      step: 3, 
                      text: '找到「使用加乘券」按鈕',
                      detail: '在彈窗中找到紫色的「🎫 權力券」按鈕'
                    },
                    { 
                      step: 4, 
                      text: '選擇券種並確認',
                      detail: '選擇 7 天券或 30 天券，確認後立即生效'
                    },
                    { 
                      step: 5, 
                      text: '完成！圖片獲得加乘',
                      detail: '該圖片將重新獲得新圖的曝光加成，獲得更多流量'
                    }
                  ].map(({ step, text, detail }) => (
                    <div key={step} className="bg-zinc-700/50 rounded-lg p-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-xs">
                          {step}
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-medium mb-1">{text}</p>
                          <p className="text-gray-400 text-sm">{detail}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 提示 */}
              <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-2">
                <div className="flex items-start gap-2">
                  <span className="text-lg">💡</span>
                  <div>
                    <h4 className="text-blue-300 font-semibold mb-1">溫馨提示</h4>
                    <p className="text-gray-300 text-sm">
                      券在有效期內可以隨時使用，使用後圖片會獲得更高的曝光率和推薦權重，效果持續 <span className="text-yellow-400 font-semibold">10小時</span>。
                      建議選擇你最滿意的作品使用，效果更佳！
                    </p>
                  </div>
                </div>
              </div>

              {/* 按鈕 */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-1.5 px-3 rounded-lg font-semibold transition-all duration-200 text-xs"
                >
                  我知道了
                </button>
                <button
                  onClick={handleGoToStore}
                  className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-gray-300 rounded-lg font-medium transition-all duration-200 text-xs"
                >
                  購買更多券
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

