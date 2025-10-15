"use client";

import { useState, useEffect } from "react";
import { STORE_PRODUCTS } from "@/constants/store-products";
import ProductCard from "@/components/store/ProductCard";
import axios from "axios";
import { getLevelInfo } from "@/utils/pointsLevels";
import { useCurrentUser } from "@/contexts/CurrentUserContext";

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
    id: "special",
    name: "特殊物品",
    icon: "🎁",
    description: "限時優惠的特殊道具"
  },
  {
    id: "limited",
    name: "限時特惠",
    icon: "⏰",
    description: "限時限量的特別優惠"
  }
];

export default function StorePage() {
  const { subscriptions, updateSubscriptions } = useCurrentUser(); // 使用 Context
  const [activeCategory, setActiveCategory] = useState("features");
  const [loading, setLoading] = useState(false);
  const [purchaseStatus, setPurchaseStatus] = useState({});
  const [purchasedItems, setPurchasedItems] = useState(new Set());
  const [userOwnedFrames, setUserOwnedFrames] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const [powerCouponLimits, setPowerCouponLimits] = useState({});
  const [isLoadingUserInfo, setIsLoadingUserInfo] = useState(true);


  // 檢查權力券限購狀態（一次查詢所有類型）
  const checkPowerCouponLimits = async () => {
    try {
      const res = await axios.post("/api/power-coupon/check-limit", { 
        types: ["7day", "30day"] 
      });
      
      if (res.data.success && res.data.limits) {
        setPowerCouponLimits(res.data.limits);
      }
    } catch (error) {
      console.error("檢查權力券限購狀態失敗:", error);
    }
  };

  // 獲取用戶信息和已購買的商品
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        setIsLoadingUserInfo(true);
        // 獲取用戶基本信息
        const userResponse = await axios.get("/api/user-info");
        if (userResponse.data) {
          setUserInfo(userResponse.data);
          
          // 根據用戶信息設置已購買的商品
          const purchasedSet = new Set();
          if (userResponse.data.playerCouponUsed) {
            purchasedSet.add("player-1day-coupon");
          }
          setPurchasedItems(purchasedSet);
        }

        // 獲取用戶已擁有的頭像框
        const framesResponse = await axios.get("/api/user/owned-frames");
        if (framesResponse.data.success) {
          setUserOwnedFrames(framesResponse.data.data || []);
        }
        
      } catch (error) {
        console.error("獲取用戶信息失敗:", error);
      } finally {
        setIsLoadingUserInfo(false);
      }
    };
    fetchUserInfo();
    checkPowerCouponLimits();
  }, []);

  const handlePurchase = async (productId, options) => {
    setLoading(true);
    setPurchaseStatus(prev => ({ ...prev, [productId]: true }));
    
    try {
      // 處理釘選播放器訂閱
      if (productId === "pin-player-subscription") {
        const subscriptionType = "pinPlayer";
        
        // 取消訂閱
        if (options?.cancel) {
          const res = await axios.post("/api/subscriptions/cancel", {
            subscriptionType
          });
          
          if (res.data.success) {
            const expiresAt = res.data.expiresAt ? new Date(res.data.expiresAt).toLocaleDateString('zh-TW') : '';
            alert(`已取消釘選播放器訂閱\n\n您可以繼續使用到 ${expiresAt}\n到期後將自動失效，不會再續費。`);
            // 重新獲取訂閱狀態（確保前端狀態同步）
            await updateSubscriptions();
            // 重新加載用戶信息
            const info = await axios.get("/api/user-info");
            setUserInfo(info.data);
          } else {
            alert(res.data.error || "取消訂閱失敗");
          }
        } 
        // 開通/續費訂閱
        else {
          const res = await axios.post("/api/subscriptions/subscribe", {
            subscriptionType
          });
          
          if (res.data.success) {
            const daysRemaining = res.data.daysRemaining || 0;
            const expiresAt = new Date(res.data.expiresAt).toLocaleDateString('zh-TW');
            alert(`✅ 訂閱成功！\n\n📅 到期時間：${expiresAt}\n⏳ 剩餘天數：${daysRemaining} 天\n\n💡 續費時剩餘時間會累積，不會浪費。`);
            // 重新獲取訂閱狀態（確保前端狀態同步）
            await updateSubscriptions();
            // 重新加載用戶信息
            const info = await axios.get("/api/user-info");
            setUserInfo(info.data);
          } else {
            alert(res.data.error || "訂閱失敗，請檢查積分是否足夠");
          }
        }
        setLoading(false);
        setPurchaseStatus(prev => ({ ...prev, [productId]: false }));
        return;
      }
      
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
          cost: 300 
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
          cost: 200 
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
      } else if (productId === "magic-circle-frame") {
        const res = await axios.post("/api/user/purchase-frame", { 
          frameId: "magic-circle", 
          cost: 300 
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
          cost: 300 
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
        const [_, __, duration] = productId.split("-");
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
          {isLoadingUserInfo ? (
            <div className="col-span-full text-center py-12 text-gray-400">
              載入中...
            </div>
          ) : (
            products.map(product => {
            // 檢查用戶等級是否已經解鎖播放器（LV3 = 500積分）
            const userLevel = getLevelInfo(userInfo?.totalEarnedPoints || 0);
            const hasPlayerByLevel = userLevel.index >= 2; // LV3 的索引是 2 (0-based)
            const hasPlayerByCoupon = userInfo?.playerCouponUsed;
            
            // 如果用戶已經有播放器功能（等級解鎖或體驗券），且當前商品是播放器體驗券，則跳過不顯示
            if ((hasPlayerByLevel || hasPlayerByCoupon) && product.id === "player-1day-coupon") {
              return null;
            }
            
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
            } else if (product.id === "magic-circle-frame") {
              const frameOwned = userOwnedFrames.includes("magic-circle");
              isPurchased = isPurchased || frameOwned;
            } else if (product.id === "magic-circle-2-frame") {
              const frameOwned = userOwnedFrames.includes("magic-circle-2");
              isPurchased = isPurchased || frameOwned;
            }
            
            // 檢查訂閱狀態（針對月租商品）
            let isSubscribed = false;
            let subscriptionInfo = null;
            if (product.type === "subscription") {
              const now = new Date();
              let sub = null;
              
              if (product.id === "pin-player-subscription") {
                sub = subscriptions.pinPlayer;
              }
              
              if (sub) {
                // 兼容舊數據：優先使用 expiresAt，否則使用 nextBillingDate
                const expiresAtValue = sub.expiresAt || sub.nextBillingDate;
                const expiresAt = expiresAtValue ? new Date(expiresAtValue) : null;
                
                if (expiresAt) {
                  isSubscribed = sub.isActive && expiresAt > now;
                  
                  // 計算剩餘天數
                  const daysRemaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
                  
                  subscriptionInfo = {
                    expiresAt: expiresAtValue,
                    daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
                    cancelledAt: sub.cancelledAt
                  };
                }
              } else {
                // 沒有訂閱時，也提供 subscriptionInfo 以便顯示狀態
                subscriptionInfo = {
                  expiresAt: null,
                  daysRemaining: 0,
                  cancelledAt: null
                };
              }
            }
            
            return (
              <ProductCard
                key={product.id}
                {...product}
                loading={loading && purchaseStatus[product.id]}
                isPurchased={isPurchased}
                isLimitedPurchase={isLimited}
                limitMessage={limitMessage}
                isSubscribed={isSubscribed}
                subscriptionInfo={subscriptionInfo}
                onPurchase={(options) => handlePurchase(product.id, options)}
              />
            );
          }))
          }
        </div>
      </div>
    </div>
  );
}