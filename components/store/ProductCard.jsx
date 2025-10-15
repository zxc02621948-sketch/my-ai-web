"use client";

import { useState } from "react";
import Image from "next/image";

export default function ProductCard({
  title,
  description,
  icon,
  price,
  originalPrice,
  isLimited,
  expiry,
  isPurchased,
  onPurchase,
  loading,
  features = [],
  isLimitedPurchase = false,
  limitMessage = "",
  type = "normal", // "normal" | "subscription"
  billingCycle = null,
  isSubscribed = false, // 是否已訂閱
  subscriptionInfo = null // 訂閱詳情（包含 expiresAt, daysRemaining 等）
}) {
  return (
    <div className="bg-zinc-800/40 border border-zinc-700/60 rounded-lg p-6 relative">
      {/* 限時標籤 */}
      {isLimited && (
        <div className="absolute -top-3 -right-3 bg-red-500 text-white text-xs px-3 py-1 rounded-full">
          限時特惠
        </div>
      )}
      
      {/* 商品圖示 */}
      <div className="flex justify-center mb-6">
        {icon && (icon.endsWith('.svg') || icon.endsWith('.png') || icon.endsWith('.jpg') || icon.endsWith('.jpeg') || icon.endsWith('.webp') || icon.endsWith('.gif')) ? (
          <Image
            src={icon}
            width={120}
            height={120}
            alt={title}
            className="rounded-lg"
          />
        ) : (
          <div className="text-6xl">{icon}</div>
        )}
      </div>
      
      {/* 商品資訊 */}
      <h3 className="text-xl font-medium text-gray-200 mb-2">{title}</h3>
      <p className="text-sm text-gray-400 mb-4">{description}</p>
      
      {/* 功能列表 */}
      {features.length > 0 && (
        <ul className="space-y-2 mb-4">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center text-sm text-gray-300">
              <span className="mr-2">✓</span>
              {feature}
            </li>
          ))}
        </ul>
      )}
      
      {/* 價格資訊 */}
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-2xl font-bold text-yellow-400">{price} 積分</span>
        {originalPrice && (
          <span className="text-sm text-gray-500 line-through">{originalPrice} 積分</span>
        )}
      </div>
      
      {/* 到期時間 */}
      {expiry && (
        <div className="text-xs text-gray-500 mb-4">
          有效期限：{expiry}
        </div>
      )}
      
      {/* 限購提示 */}
      {isLimitedPurchase && limitMessage && (
        <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-600/50 rounded-lg">
          <p className="text-yellow-400 text-sm">{limitMessage}</p>
        </div>
      )}
      
      {/* 訂閱狀態顯示 */}
      {type === "subscription" && subscriptionInfo && (
        <div className={`mb-4 p-3 border rounded-lg ${
          isSubscribed 
            ? "bg-green-900/20 border-green-600/30" 
            : "bg-gray-900/20 border-gray-600/30"
        }`}>
          <div className={`text-sm font-medium mb-1 ${
            isSubscribed ? "text-green-300" : "text-gray-300"
          }`}>
            {isSubscribed ? "✅ 訂閱中" : "📋 訂閱狀態"}
          </div>
          <div className="text-xs text-gray-400 space-y-1">
            {isSubscribed ? (
              <>
                <div>📅 到期：{new Date(subscriptionInfo.expiresAt).toLocaleDateString('zh-TW')}</div>
                <div>⏳ 剩餘：{subscriptionInfo.daysRemaining} 天</div>
                {subscriptionInfo.cancelledAt && (
                  <div className="text-red-400 mt-2">⚠️ 已取消，到期後失效</div>
                )}
              </>
            ) : (
              <div>💡 未訂閱此方案</div>
            )}
          </div>
        </div>
      )}
      
      {/* 續費說明（未訂閱時顯示） */}
      {type === "subscription" && !isSubscribed && (
        <div className="mb-4 p-3 bg-blue-900/20 border border-blue-600/30 rounded-lg">
          <div className="text-sm text-blue-300 font-medium mb-1">💡 累積制續費</div>
          <div className="text-xs text-gray-400">
            續費時剩餘時間會累積，不會浪費。例如：剩餘 3 天時續費，將變成 33 天。
          </div>
        </div>
      )}
      
      {/* 購買/續費按鈕 */}
      <button
        onClick={() => onPurchase()}
        disabled={loading || isPurchased || isLimitedPurchase}
        className={`w-full py-2 px-4 rounded-lg font-medium transition-all ${
          isPurchased || isSubscribed
            ? "bg-zinc-700 text-gray-400 cursor-not-allowed"
            : isLimitedPurchase
            ? "bg-gray-600 text-gray-400 cursor-not-allowed"
            : loading
            ? "bg-blue-600 opacity-70 cursor-wait"
            : "bg-blue-600 hover:bg-blue-700 text-white"
        }`}
      >
        {isPurchased 
          ? "已購買" 
          : isLimitedPurchase 
          ? "限購中" 
          : loading 
          ? "處理中..." 
          : type === "subscription"
          ? (isSubscribed ? "續費延長" : "開通訂閱")
          : "立即購買"}
      </button>
      
      {/* 取消訂閱按鈕（僅月租商品且已訂閱時顯示） */}
      {type === "subscription" && isSubscribed && (
        <button
          onClick={() => onPurchase({ cancel: true })}
          disabled={loading}
          className="w-full mt-2 py-2 px-4 rounded-lg font-medium transition-all bg-red-600/20 border border-red-600/50 text-red-400 hover:bg-red-600/30"
        >
          取消訂閱
        </button>
      )}
    </div>
  );
}