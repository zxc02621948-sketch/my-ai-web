"use client";

import { useState, useEffect } from "react";
import { STORE_PRODUCTS } from "@/constants/store-products";
import ProductCard from "@/components/store/ProductCard";
import axios from "axios";
import { getLevelInfo } from "@/utils/pointsLevels";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { notify } from "@/components/common/GlobalNotificationManager";

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
  const { currentUser, subscriptions, updateSubscriptions, setCurrentUser } = useCurrentUser(); // 使用 Context
  const [activeCategory, setActiveCategory] = useState("features");
  const [activeSubCategory, setActiveSubCategory] = useState("all"); // 子分類：all, frames, skins
  const [loading, setLoading] = useState(false);
  const [purchaseStatus, setPurchaseStatus] = useState({});
  const [purchasedItems, setPurchasedItems] = useState(new Set());
  const [userOwnedFrames, setUserOwnedFrames] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const [powerCouponLimits, setPowerCouponLimits] = useState({});
  const [isLoadingUserInfo, setIsLoadingUserInfo] = useState(true);
  
  // 自定義彈窗狀態
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseModalContent, setPurchaseModalContent] = useState({});


  // 檢查權力券限購狀態（一次查詢所有類型）
  const checkPowerCouponLimits = async () => {
    // 未登入時跳過查詢（API 需要授權）
    if (!currentUser) return;
    try {
      const res = await axios.post(
        "/api/power-coupon/check-limit",
        { types: ["7day", "30day"] },
        { withCredentials: true }
      );
      
      if (res.data.success && res.data.limits) {
        setPowerCouponLimits(res.data.limits);
      }
    } catch (error) {
      // 未登入或授權失敗時忽略
      if (error?.response?.status !== 401) {
        console.warn("檢查權力券限購狀態失敗:", error?.message || error);
      }
    }
  };

  // 獲取用戶信息和已購買的商品
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        setIsLoadingUserInfo(true);
        // 獲取用戶基本信息
        const userResponse = await axios.get("/api/user-info", {
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (userResponse.data) {
          setUserInfo(userResponse.data);
          
          // 根據用戶信息設置已購買的商品
          const purchasedSet = new Set();
          if (userResponse.data.playerCouponUsed) {
            purchasedSet.add("player-1day-coupon");
          }
          if (userResponse.data.premiumPlayerSkin) {
            purchasedSet.add("premium-player-skin");
          }
          setPurchasedItems(purchasedSet);
        }

        // 獲取用戶已擁有的頭像框（需登入）
        if (currentUser) {
          try {
            const framesResponse = await axios.get("/api/user/owned-frames", {
              withCredentials: true
            });
            if (framesResponse.data.success) {
              setUserOwnedFrames(framesResponse.data.data || []);
            }
          } catch (err) {
            if (err?.response?.status !== 401) {
              console.warn("獲取已擁有頭像框失敗:", err?.message || err);
            }
          }
        }
        
      } catch (error) {
        console.error("獲取用戶信息失敗:", error);
      } finally {
        setIsLoadingUserInfo(false);
      }
    };
    fetchUserInfo();
    checkPowerCouponLimits();
  }, [currentUser]);

  const handlePurchase = async (productId, options) => {
    setLoading(true);
    setPurchaseStatus(prev => ({ ...prev, [productId]: true }));
    
    try {
      // 處理播放清單擴充
      if (productId === "playlist-expansion") {
        try {
          const res = await axios.post("/api/player/expand-playlist");
          
          if (res?.data?.success) {
            const { oldMax, newMax, addSlots, cost, newBalance, nextExpansion } = res.data.data;
            
            // 設置購買成功彈窗內容
            setPurchaseModalContent({
              type: 'success',
              title: '✅ 擴充成功！',
              details: {
                oldMax,
                newMax,
                addSlots,
                cost,
                newBalance,
                nextExpansion
              }
            });
            setShowPurchaseModal(true);
            
            // 刷新用戶信息
            const info = await axios.get("/api/user-info", {
              headers: { 'Cache-Control': 'no-cache' }
            });
            setUserInfo(info.data);
            
            // 廣播積分更新事件
            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event("points-updated"));
            }
          } else {
            setPurchaseModalContent({
              type: 'error',
              title: '❌ 擴充失敗',
              message: res?.data?.error || "擴充失敗，請稍後再試。"
            });
            setShowPurchaseModal(true);
          }
        } catch (error) {
          setPurchaseModalContent({
            type: 'error',
            title: '❌ 擴充失敗',
            message: error.response?.data?.error || "擴充失敗，請檢查積分是否足夠"
          });
          setShowPurchaseModal(true);
        }
        setLoading(false);
        setPurchaseStatus(prev => ({ ...prev, [productId]: false }));
        return;
      }
      
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
            notify.success("已取消釘選播放器訂閱", `您可以繼續使用到 ${expiresAt}\n到期後將自動失效，不會再續費。`);
            // 重新獲取訂閱狀態（確保前端狀態同步）
            await updateSubscriptions();
            // 重新加載用戶信息
            const info = await axios.get("/api/user-info", {
              headers: { 'Cache-Control': 'no-cache' }
            });
            setUserInfo(info.data);
            // ✅ 更新 currentUser（確保 MiniPlayer 能獲取最新的狀態）
            const currentUserInfo = await axios.get("/api/current-user", {
              headers: { 'Cache-Control': 'no-cache' }
            });
            if (currentUserInfo.data) {
              setCurrentUser(currentUserInfo.data);
            }
          } else {
            notify.error("取消訂閱失敗", res.data.error || "取消訂閱失敗");
          }
        } 
        // 開通/續費訂閱
        else {
          // ✅ 檢查是否為續費（使用 subscriptions 狀態，而不是 userInfo）
          const pinPlayerSub = subscriptions?.pinPlayer;
          const isRenewal = pinPlayerSub?.isActive && pinPlayerSub?.expiresAt && new Date(pinPlayerSub.expiresAt) > new Date();
          
          // 如果是續費，顯示確認對話框
          if (isRenewal) {
            const expiresAt = pinPlayerSub.expiresAt 
              ? new Date(pinPlayerSub.expiresAt).toLocaleDateString('zh-TW')
              : '';
            
            // 計算剩餘天數
            const now = new Date();
            const expiresAtDate = new Date(pinPlayerSub.expiresAt);
            const daysRemaining = Math.ceil((expiresAtDate - now) / (1000 * 60 * 60 * 24));
            const newDaysRemaining = daysRemaining + 30;
            
            const confirmed = await notify.confirm(
              "確認續費釘選播放器訂閱",
              `💰 費用：200 積分\n\n` +
              `📅 目前到期：${expiresAt}\n` +
              `⏳ 剩餘天數：${daysRemaining} 天\n\n` +
              `✨ 續費後剩餘時間會累積，將變成 ${newDaysRemaining} 天\n\n` +
              `是否確認續費？`
            );
            
            if (!confirmed) {
              setLoading(false);
              setPurchaseStatus(prev => ({ ...prev, [productId]: false }));
              return;
            }
          }
          
          let res;
          try {
            res = await axios.post("/api/subscriptions/subscribe", {
              subscriptionType
            });
          } catch (error) {
            // ✅ 處理 API 錯誤（例如積分不足）
            if (error.response?.status === 400) {
              const errorMessage = error.response?.data?.error || "訂閱失敗";
              notify.error("訂閱失敗", errorMessage);
            } else {
              notify.error("訂閱失敗", error.response?.data?.error || "訂閱失敗，請稍後再試");
            }
            setLoading(false);
            setPurchaseStatus(prev => ({ ...prev, [productId]: false }));
            return;
          }
          
          if (res.data.success) {
            const expiresDate = new Date(res.data.expiresAt);
            const isPermanent = expiresDate > new Date('2099-01-01');
            const daysRemaining = res.data.daysRemaining || 0;
            const expiresAt = expiresDate.toLocaleDateString('zh-TW');
            
            if (isPermanent) {
              notify.success("訂閱成功！", `🎉 有效期：永久訂閱\n📅 到期時間：${expiresAt}\n\n💡 恭喜獲得永久釘選播放器！`);
            } else {
              notify.success("訂閱成功！", `📅 到期時間：${expiresAt}\n⏳ 剩餘天數：${daysRemaining} 天\n\n💡 續費時剩餘時間會累積，不會浪費。`);
            }
            // 重新獲取訂閱狀態（確保前端狀態同步）
            await updateSubscriptions();
            // 重新加載用戶信息
            const info = await axios.get("/api/user-info", {
              headers: { 'Cache-Control': 'no-cache' }
            });
            setUserInfo(info.data);
            
            // ✅ 更新 currentUser（確保 MiniPlayer 能獲取最新的 pinnedPlayer.expiresAt）
            const currentUserInfo = await axios.get("/api/current-user", {
              headers: { 'Cache-Control': 'no-cache' }
            });
            if (currentUserInfo.data) {
              setCurrentUser(currentUserInfo.data);
              console.log('🔄 [Store] 已更新 currentUser，pinnedPlayer.expiresAt:', currentUserInfo.data?.pinnedPlayer?.expiresAt);
            }
            
            // ✅ 更新 subscriptions（確保 MiniPlayer 能獲取最新的 subscriptions.pinPlayer.expiresAt）
            if (updateSubscriptions) {
              await updateSubscriptions();
              console.log('🔄 [Store] 已更新 subscriptions');
            }
            
            // ✅ 觸發全局事件，通知 MiniPlayer 更新 pinnedPlayer 數據
            if (typeof window !== "undefined") {
              const expiresAtToSend = res.data.expiresAt || currentUserInfo.data?.pinnedPlayer?.expiresAt;
              console.log('🔄 [Store] 觸發 subscriptionRenewed 事件，expiresAt:', expiresAtToSend);
              window.dispatchEvent(new CustomEvent("subscriptionRenewed", {
                detail: {
                  subscriptionType: "pinPlayer",
                  expiresAt: expiresAtToSend
                }
              }));
            }
          } else {
            notify.error("訂閱失敗", res.data.error || "訂閱失敗，請檢查積分是否足夠");
          }
        }
        setLoading(false);
        setPurchaseStatus(prev => ({ ...prev, [productId]: false }));
        return;
      }
      
      // 根據商品 ID 調用對應的購買 API
      if (productId === "premium-player-skin") {
        const res = await axios.post("/api/store/purchase-premium-skin");
        
        if (res?.data?.success) {
          notify.success("購買成功！", `您現在擁有高階播放器造型了！\n\n✨ 前往播放器頁面即可自定義顏色設定\n💰 剩餘積分：${res.data.newBalance}`);
          // 更新用戶信息
          const info = await axios.get("/api/user-info", {
            headers: { 'Cache-Control': 'no-cache' }
          });
          setUserInfo(info.data);
          
          // 重新計算已購買商品
          const purchasedSet = new Set();
          if (info.data.playerCouponUsed) {
            purchasedSet.add("player-1day-coupon");
          }
          if (info.data.premiumPlayerSkin) {
            purchasedSet.add("premium-player-skin");
          }
          setPurchasedItems(purchasedSet);
        } else {
          notify.error("購買失敗", res?.data?.error || "購買失敗，請稍後再試。");
        }
      } else if (productId === "player-1day-coupon") {
        // 未登入直接中止（按鈕層已提示並開啟登入窗）
        if (!currentUser) {
          setLoading(false);
          setPurchaseStatus(prev => ({ ...prev, [productId]: false }));
          return;
        }
        const res = await axios.post(
          "/api/points/purchase-feature",
          { productId: "player-1day-coupon", cost: 0 },
          { withCredentials: true }
        );
        
        if (res?.data?.success) {
          notify.success("體驗券已激活！", res?.data?.message || "播放器完整功能體驗券已激活！");
          setPurchasedItems(prev => new Set([...prev, productId]));
          // ✅ 更新訂閱狀態（重要：體驗券會創建 pinPlayerTest 訂閱）
          if (updateSubscriptions) {
            await updateSubscriptions();
          }
          // 更新用戶信息
          const info = await axios.get("/api/user-info", {
            headers: { 'Cache-Control': 'no-cache' }
          });
          setUserInfo(info.data);
          // ✅ 更新當前用戶狀態（確保訂閱狀態同步）
          const currentUserInfo = await axios.get("/api/current-user", {
            headers: { 'Cache-Control': 'no-cache' }
          });
          if (setCurrentUser && currentUserInfo.data) {
            setCurrentUser(currentUserInfo.data);
          }
          // 刷新頁面以顯示播放器
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          notify.error("購買失敗", res?.data?.error || "購買失敗，請稍後再試。");
        }
      } else if (productId === "ai-generated-frame") {
        const res = await axios.post("/api/user/purchase-frame", { 
          frameId: "ai-generated", 
          cost: 300 
        });
        if (res?.data?.success) {
          notify.success("購買成功！", "已獲得 AI 生成頭像框！");
          setPurchasedItems(prev => new Set([...prev, productId]));
          // 更新已擁有的頭像框列表
          setUserOwnedFrames(prev => [...prev, "ai-generated"]);
          // 刷新頁面以更新用戶數據
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          notify.error("購買失敗", res?.data?.error || "購買失敗，請稍後再試。");
        }
      } else if (productId === "animals-frame") {
        const res = await axios.post("/api/user/purchase-frame", { 
          frameId: "animals", 
          cost: 200 
        });
        if (res?.data?.success) {
          notify.success("購買成功！", "已獲得動物頭像框！");
          setPurchasedItems(prev => new Set([...prev, productId]));
          // 更新已擁有的頭像框列表
          setUserOwnedFrames(prev => [...prev, "animals"]);
          // 刷新頁面以更新用戶數據
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          notify.error("購買失敗", res?.data?.error || "購買失敗，請稍後再試。");
        }
      } else if (productId === "magic-circle-frame") {
        const res = await axios.post("/api/user/purchase-frame", { 
          frameId: "magic-circle", 
          cost: 300 
        });
        if (res?.data?.success) {
          notify.success("購買成功！", "已獲得魔法陣頭像框！");
          setPurchasedItems(prev => new Set([...prev, productId]));
          // 更新已擁有的頭像框列表
          setUserOwnedFrames(prev => [...prev, "magic-circle"]);
          // 不需要刷新頁面，狀態已經更新
        } else {
          notify.error("購買失敗", res?.data?.error || "購買失敗，請稍後再試。");
        }
      } else if (productId === "magic-circle-2-frame") {
        const res = await axios.post("/api/user/purchase-frame", { 
          frameId: "magic-circle-2", 
          cost: 300 
        });
        if (res?.data?.success) {
          notify.success("購買成功！", "已獲得魔法陣2頭像框！");
          setPurchasedItems(prev => new Set([...prev, productId]));
          // 更新已擁有的頭像框列表
          setUserOwnedFrames(prev => [...prev, "magic-circle-2"]);
          // 不需要刷新頁面，狀態已經更新
        } else {
          notify.error("購買失敗", res?.data?.error || "購買失敗，請稍後再試。");
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
          notify.success("購買成功！", "權力券購買成功！");
          setPurchasedItems(prev => new Set([...prev, productId]));
          // 更新用戶信息
          const info = await axios.get("/api/user-info", {
            headers: { 'Cache-Control': 'no-cache' }
          });
          setUserInfo(info.data);
        } else {
          notify.error("購買失敗", res?.data?.message || "購買失敗，請稍後再試。");
        }
      }
      // 其他商品的購買邏輯...
      
    } catch (error) {
      console.error("Purchase failed:", error);
    } finally {
      setLoading(false);
    }
  };

  // 根據主分類和子分類過濾產品
  const allProducts = STORE_PRODUCTS[activeCategory] || [];
  const products = activeCategory === "personalization" 
    ? allProducts.filter(p => {
        if (activeSubCategory === "all") return true;
        if (activeSubCategory === "frames") return p.id.includes("frame");
        if (activeSubCategory === "skins") return p.id.includes("skin");
        return true;
      })
    : allProducts;

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 頁面標題 */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">積分商店</h1>
          <p className="text-gray-400 mb-4">使用積分兌換豐富獎勵</p>
          
          {/* 可用積分顯示 */}
          {userInfo && (
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-600/20 to-yellow-500/20 border-2 border-yellow-500/50 rounded-xl">
              <span className="text-2xl">💰</span>
              <div className="text-left">
                <div className="text-xs text-gray-400">可用積分</div>
                <div className="text-2xl font-bold text-yellow-400">
                  {userInfo.pointsBalance?.toLocaleString() || 0}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 分類導航 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {STORE_CATEGORIES.map(category => (
            <button
              key={category.id}
              onClick={() => {
                setActiveCategory(category.id);
                setActiveSubCategory("all"); // 切換主分類時重置子分類
              }}
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

        {/* 個性化子分類 */}
        {activeCategory === "personalization" && (
          <div className="flex justify-center gap-3 mb-8">
            <button
              onClick={() => setActiveSubCategory("all")}
              className={`px-6 py-2 rounded-lg border transition-all ${
                activeSubCategory === "all"
                  ? "bg-purple-600 border-purple-500 text-white"
                  : "bg-zinc-800 border-zinc-700 text-gray-300 hover:bg-zinc-700"
              }`}
            >
              🎨 全部
            </button>
            <button
              onClick={() => setActiveSubCategory("frames")}
              className={`px-6 py-2 rounded-lg border transition-all ${
                activeSubCategory === "frames"
                  ? "bg-purple-600 border-purple-500 text-white"
                  : "bg-zinc-800 border-zinc-700 text-gray-300 hover:bg-zinc-700"
              }`}
            >
              🖼️ 頭像框
            </button>
            <button
              onClick={() => setActiveSubCategory("skins")}
              className={`px-6 py-2 rounded-lg border transition-all ${
                activeSubCategory === "skins"
                  ? "bg-purple-600 border-purple-500 text-white"
                  : "bg-zinc-800 border-zinc-700 text-gray-300 hover:bg-zinc-700"
              }`}
            >
              🎧 播放器造型
            </button>
          </div>
        )}

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
            
            // 處理播放清單擴充的動態價格和狀態
            let dynamicPrice = product.price;
            let dynamicFeatures = product.features;
            let playlistExpansionInfo = null;
            
            if (product.id === "playlist-expansion") {
              const currentMax = userInfo?.playlistMaxSize || 5;
              const currentSize = userInfo?.playlist?.length || 0;
              const isMaxed = currentMax >= 50;
              
              // 計算下次擴充的資訊
              const expansionConfig = [
                { fromSize: 5, toSize: 10, addSlots: 5, cost: 50 },
                { fromSize: 10, toSize: 15, addSlots: 5, cost: 100 },
                { fromSize: 15, toSize: 20, addSlots: 5, cost: 200 },
                { fromSize: 20, toSize: 30, addSlots: 10, cost: 400 },
                { fromSize: 30, toSize: 40, addSlots: 10, cost: 600 },
                { fromSize: 40, toSize: 50, addSlots: 10, cost: 800 },
              ];
              
              const nextExpansion = expansionConfig.find(e => e.fromSize === currentMax);
              
              if (nextExpansion) {
                dynamicPrice = nextExpansion.cost;
                playlistExpansionInfo = {
                  currentMax,
                  currentSize,
                  nextExpansion,
                  isMaxed: false
                };
              } else {
                playlistExpansionInfo = {
                  currentMax,
                  currentSize,
                  nextExpansion: null,
                  isMaxed: true
                };
                isPurchased = true; // 已達上限，視為已購買
              }
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
                  const isPermanent = expiresAt > new Date('2099-01-01');
                  
                  // 計算剩餘天數
                  const daysRemaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
                  
                  subscriptionInfo = {
                    expiresAt: expiresAtValue,
                    daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
                    cancelledAt: sub.cancelledAt,
                    isPermanent: isPermanent
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
                price={dynamicPrice}
                isLoggedIn={!!userInfo?._id}
                loading={loading && purchaseStatus[product.id]}
                isPurchased={isPurchased}
                isLimitedPurchase={isLimited}
                limitMessage={limitMessage}
                isSubscribed={isSubscribed}
                subscriptionInfo={subscriptionInfo}
                playlistExpansionInfo={playlistExpansionInfo}
                onPurchase={(options) => handlePurchase(product.id, options)}
              />
            );
          }))
          }
        </div>
      </div>

      {/* 自定義購買結果彈窗 */}
      {showPurchaseModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100001]">
          <div className="bg-zinc-800 rounded-xl p-6 max-w-md mx-4 border-2 border-purple-500/50 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4 text-center">
              {purchaseModalContent.title}
            </h3>
            
            {purchaseModalContent.type === 'success' && purchaseModalContent.details ? (
              <div className="space-y-3 mb-6">
                <div className="bg-zinc-700/50 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300">播放清單上限</span>
                    <span className="text-purple-400 font-semibold">
                      {purchaseModalContent.details.oldMax} → {purchaseModalContent.details.newMax} 首
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300">新增容量</span>
                    <span className="text-green-400 font-semibold">+{purchaseModalContent.details.addSlots} 首</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300">消費積分</span>
                    <span className="text-yellow-400 font-semibold">{purchaseModalContent.details.cost} 積分</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">剩餘積分</span>
                    <span className="text-white font-semibold">{purchaseModalContent.details.newBalance} 積分</span>
                  </div>
                </div>
                
                {purchaseModalContent.details.nextExpansion ? (
                  <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-3">
                    <div className="text-sm text-blue-300 mb-1">下次擴充資訊</div>
                    <div className="text-xs text-gray-300">
                      <div>+{purchaseModalContent.details.nextExpansion.addSlots} 首（{purchaseModalContent.details.nextExpansion.newMax} 首）</div>
                      <div>需要：{purchaseModalContent.details.nextExpansion.cost} 積分</div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-900/20 border border-green-600/30 rounded-lg p-3 text-center">
                    <div className="text-green-400 font-semibold">🎉 已達最大上限（50 首）！</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-6">
                <p className="text-gray-300 text-center">{purchaseModalContent.message}</p>
              </div>
            )}
            
            <div className="flex justify-center">
              <button
                onClick={() => setShowPurchaseModal(false)}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
              >
                確定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}