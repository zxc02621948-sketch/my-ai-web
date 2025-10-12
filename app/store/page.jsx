"use client";

import { useState, useEffect } from "react";
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
  const [purchasedItems, setPurchasedItems] = useState(new Set());
  const [userOwnedFrames, setUserOwnedFrames] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const [powerCouponLimits, setPowerCouponLimits] = useState({});

  // 檢查權力券限購狀態
  const checkPowerCouponLimits = async () => {
    try {
      const limits = {};
      
      // 檢查7天券限購
      const res7day = await axios.post("/api/power-coupon/check-limit", { type: "7day" });
      limits["7day"] = res7day.data;
      
      // 檢查30天券限購
      const res30day = await axios.post("/api/power-coupon/check-limit", { type: "30day" });
      limits["30day"] = res30day.data;
      
      setPowerCouponLimits(limits);
    } catch (error) {
      console.error("檢查權力券限購狀態失敗:", error);
    }
  };

  // 獲取用戶信息和已購買的商品
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        // 獲取用戶基本信息
        const userResponse = await axios.get("/api/user-info");
        console.log("🔧 用戶信息響應:", userResponse.data);
        if (userResponse.data) {
          setUserInfo(userResponse.data);
          
          // 根據用戶信息設置已購買的商品
          const purchasedSet = new Set();
          if (userResponse.data.playerCouponUsed) {
            purchasedSet.add("player-1day-coupon");
            console.log("🔧 播放器 1 日體驗券已使用");
          }
          if (userResponse.data.frameColorEditorUnlocked) {
            purchasedSet.add("frame-color-editor");
            console.log("🔧 調色盤功能已解鎖");
          }
          setPurchasedItems(purchasedSet);
          console.log("🔧 設置已購買商品:", Array.from(purchasedSet));
          console.log("🔧 調色盤解鎖狀態:", userResponse.data.frameColorEditorUnlocked);
        }

        // 獲取用戶已擁有的頭像框
        const framesResponse = await axios.get("/api/user/owned-frames");
        console.log("🔧 已擁有頭像框:", framesResponse.data);
        if (framesResponse.data.success) {
          setUserOwnedFrames(framesResponse.data.data || []);
        }
      } catch (error) {
        console.error("獲取用戶信息失敗:", error);
      }
    };
    fetchUserInfo();
    checkPowerCouponLimits();
  }, []);

  const handlePurchase = async (productId) => {
    console.log("🔧 開始購買流程，商品 ID:", productId);
    setLoading(true);
    setPurchaseStatus(prev => ({ ...prev, [productId]: true }));
    
    try {
      // 根據商品 ID 調用對應的購買 API
      if (productId === "player-1day-coupon") {
        const res = await axios.post("/api/points/purchase-feature", { 
          productId: "player-1day-coupon", 
          cost: 0 
        });
        
        if (res?.data?.success) {
          alert("播放器 1 日免費體驗券已激活！");
          setPurchasedItems(prev => new Set([...prev, productId]));
          // 更新用戶信息
          const info = await axios.get("/api/user-info");
          setUserInfo(info.data);
          // 刷新頁面以顯示播放器
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          alert(res?.data?.error || "購買失敗，請稍後再試。");
        }
      } else if (productId === "ai-generated-frame") {
        const res = await axios.post("/api/user/purchase-frame", { 
          frameId: "ai-generated", 
          cost: 0 
        });
        if (res?.data?.success) {
          alert("已獲得 AI 生成頭像框！");
          setPurchasedItems(prev => new Set([...prev, productId]));
          // 更新已擁有的頭像框列表
          setUserOwnedFrames(prev => [...prev, "ai-generated"]);
          // 刷新頁面以更新用戶數據
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          alert(res?.data?.error || "購買失敗，請稍後再試。");
        }
      } else if (productId === "animals-frame") {
        const res = await axios.post("/api/user/purchase-frame", { 
          frameId: "animals", 
          cost: 0 
        });
        if (res?.data?.success) {
          alert("已獲得動物頭像框！");
          setPurchasedItems(prev => new Set([...prev, productId]));
          // 更新已擁有的頭像框列表
          setUserOwnedFrames(prev => [...prev, "animals"]);
          // 刷新頁面以更新用戶數據
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          alert(res?.data?.error || "購買失敗，請稍後再試。");
        }
      } else if (productId === "frame-color-editor") {
        console.log("🔧 開始購買調色盤功能...");
        const res = await axios.post("/api/points/purchase-feature", { 
          productId: "frame-color-editor", 
          cost: 0 
        });
        console.log("🔧 購買 API 響應:", res.data);
        
        if (res?.data?.success) {
          alert("頭像框調色盤功能解鎖成功！");
          // 更新用戶資訊狀態
          const info = await axios.get(`/api/user-info`);
          console.log("🔧 購買後用戶信息:", info.data);
          setUserInfo(info.data);
          // 更新購買狀態
          setPurchasedItems(prev => new Set([...prev, productId]));
          
          // 廣播用戶數據更新事件
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("user-data-updated", { 
                detail: { userData: info.data } 
              })
            );
          }
        } else {
          console.error("🔧 購買失敗:", res?.data?.error);
          alert(res?.data?.error || "購買失敗，請稍後再試。");
        }
      } else if (productId === "magic-circle-frame") {
        const res = await axios.post("/api/user/purchase-frame", { 
          frameId: "magic-circle", 
          cost: 0 
        });
        if (res?.data?.success) {
          alert("已獲得魔法陣頭像框！");
          setPurchasedItems(prev => new Set([...prev, productId]));
          // 更新已擁有的頭像框列表
          setUserOwnedFrames(prev => [...prev, "magic-circle"]);
          // 不需要刷新頁面，狀態已經更新
        } else {
          alert(res?.data?.error || "購買失敗，請稍後再試。");
        }
      } else if (productId === "magic-circle-2-frame") {
        const res = await axios.post("/api/user/purchase-frame", { 
          frameId: "magic-circle-2", 
          cost: 0 
        });
        if (res?.data?.success) {
          alert("已獲得魔法陣2頭像框！");
          setPurchasedItems(prev => new Set([...prev, productId]));
          // 更新已擁有的頭像框列表
          setUserOwnedFrames(prev => [...prev, "magic-circle-2"]);
          // 不需要刷新頁面，狀態已經更新
        } else {
          alert(res?.data?.error || "購買失敗，請稍後再試。");
        }
      } else if (productId.startsWith("power-coupon-")) {
        // 處理權力券購買
        console.log("權力券購買 productId:", productId);
        const [_, __, duration] = productId.split("-");
        console.log("解析後的 duration:", duration);
        const res = await axios.post("/api/power-coupon/purchase", {
          type: duration, // 直接使用 duration，不需要再加 "day"
          quantity: 1
        }, {
          withCredentials: true
        });
        
        if (res?.data?.success) {
          alert("權力券購買成功！");
          setPurchasedItems(prev => new Set([...prev, productId]));
          // 更新用戶信息
          const info = await axios.get("/api/user-info");
          setUserInfo(info.data);
        } else {
          alert(res?.data?.message || "購買失敗，請稍後再試。");
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
          {products.map(product => {
            // 檢查商品是否已購買
            let isPurchased = purchasedItems.has(product.id);
            let isLimited = false;
            let limitMessage = "";
            
            // 檢查權力券限購狀態
            if (product.id === "power-coupon-7day") {
              const limitInfo = powerCouponLimits["7day"];
              if (limitInfo && !limitInfo.canPurchase) {
                isLimited = true;
                limitMessage = `3天內只能購買一次，還需等待 ${limitInfo.remainingDays} 天`;
              }
            } else if (product.id === "power-coupon-30day") {
              const limitInfo = powerCouponLimits["30day"];
              if (limitInfo && !limitInfo.canPurchase) {
                isLimited = true;
                limitMessage = `7天內只能購買一次，還需等待 ${limitInfo.remainingDays} 天`;
              }
            }
            
            // 檢查播放器是否已購買
            if (product.id === "mini-player") {
              const playerPurchased = userInfo?.miniPlayerPurchased === true;
              isPurchased = isPurchased || playerPurchased;
              // console.log("🔧 播放器購買狀態:", { productId: product.id, isPurchased, playerPurchased });
            }
            // 檢查頭像框是否已擁有
            else if (product.id === "ai-generated-frame") {
              const frameOwned = userOwnedFrames.includes("ai-generated");
              isPurchased = isPurchased || frameOwned;
              // console.log("🔧 AI生成頭像框狀態:", { productId: product.id, isPurchased, frameOwned });
            } else if (product.id === "animals-frame") {
              const frameOwned = userOwnedFrames.includes("animals");
              isPurchased = isPurchased || frameOwned;
              // console.log("🔧 動物頭像框狀態:", { productId: product.id, isPurchased, frameOwned });
            } else if (product.id === "frame-color-editor") {
              const colorEditorUnlocked = userInfo?.frameColorEditorUnlocked === true;
              isPurchased = isPurchased || colorEditorUnlocked;
              console.log("🔧 調色盤解鎖狀態:", { productId: product.id, isPurchased, colorEditorUnlocked, userInfo: userInfo?.frameColorEditorUnlocked });
            } else if (product.id === "magic-circle-frame") {
              const frameOwned = userOwnedFrames.includes("magic-circle");
              isPurchased = isPurchased || frameOwned;
              console.log("🔧 魔法陣頭像框狀態:", { productId: product.id, isPurchased, frameOwned });
            } else if (product.id === "magic-circle-2-frame") {
              const frameOwned = userOwnedFrames.includes("magic-circle-2");
              isPurchased = isPurchased || frameOwned;
              console.log("🔧 魔法陣2頭像框狀態:", { productId: product.id, isPurchased, frameOwned });
            }
            
            return (
              <ProductCard
                key={product.id}
                {...product}
                loading={loading && purchaseStatus[product.id]}
                isPurchased={isPurchased}
                isLimitedPurchase={isLimited}
                limitMessage={limitMessage}
                onPurchase={() => handlePurchase(product.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}