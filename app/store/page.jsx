"use client";

import { useState } from "react";
import { STORE_PRODUCTS } from "@/constants/store-products";
import ProductCard from "@/components/store/ProductCard";
import axios from "axios";

const STORE_CATEGORIES = [
  {
    id: "features",
    name: "功能解鎖",
    icon: "🚀",
    description: "解鎖進階功能，提升使用體驗"
  },
  {
    id: "personalization",
    name: "個性化",
    icon: "✨",
    description: "自訂您的個人風格"
  },
  {
    id: "premium",
    name: "特權服務",
    icon: "👑",
    description: "尊享會員專屬權益"
  },
  {
    id: "limited",
    name: "限時特惠",
    icon: "⏰",
    description: "限時限量的特別優惠"
  }
];

export default function StorePage() {
  const [activeCategory, setActiveCategory] = useState("features");
  const [loading, setLoading] = useState(false);
  const [purchaseStatus, setPurchaseStatus] = useState({});

  const handlePurchase = async (productId) => {
    setLoading(true);
    setPurchaseStatus(prev => ({ ...prev, [productId]: true }));
    
    try {
      // 根據商品 ID 調用對應的購買 API
      if (productId === "mini-player") {
        const res = await axios.post("/api/points/redeem-mini-player");
        if (res?.data?.ok) {
          // 更新用戶資訊和觸發事件
          const info = await axios.get(`/api/user-info`);
          const purchased = !!info?.data?.miniPlayerPurchased;
          const theme = String(info?.data?.miniPlayerTheme || "modern");
          if (purchased && typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("mini-player-purchased", { 
                detail: { userId: info?.data?._id, theme } 
              })
            );
          }
        }
      }
      // 其他商品的購買邏輯...
      
    } catch (error) {
      console.error("Purchase failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const products = STORE_PRODUCTS[activeCategory] || [];

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 頁面標題 */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">積分商店</h1>
          <p className="text-gray-400">使用積分兌換豐富獎勵</p>
        </div>

        {/* 分類導航 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {STORE_CATEGORIES.map(category => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`p-4 rounded-lg border transition-all ${
                activeCategory === category.id
                  ? "bg-yellow-600 border-yellow-500 text-white"
                  : "bg-zinc-800 border-zinc-700 text-gray-300 hover:bg-zinc-700"
              }`}
            >
              <div className="text-2xl mb-2">{category.icon}</div>
              <div className="font-medium mb-1">{category.name}</div>
              <div className="text-xs opacity-80">{category.description}</div>
            </button>
          ))}
        </div>

        {/* 商品列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(product => (
            <ProductCard
              key={product.id}
              {...product}
              loading={loading && purchaseStatus[product.id]}
              onPurchase={() => handlePurchase(product.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}