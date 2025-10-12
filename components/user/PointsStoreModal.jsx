"use client";

import { useState } from "react";
import Modal from "@/components/common/Modal";
import axios from "axios";

export default function PointsStoreModal({ isOpen, onClose, userData }) {
  const userId = String(userData?._id || "");
  const currentPoints = Number(userData?.pointsBalance ?? 0);
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemMessage, setRedeemMessage] = useState("");
  const [activeTab, setActiveTab] = useState("items"); // "items" 或 "frames"
  const [frameLoading, setFrameLoading] = useState({});
  const [frameMessage, setFrameMessage] = useState("");

  // 頭像框商品
  const FRAME_ITEMS = [
    {
      id: "ai-generated",
      name: "AI 生成",
      preview: "/frames/ai-generated-7899315_1280.png",
      description: "AI 生成的藝術頭像框",
      cost: 0
    },
    {
      id: "animals",
      name: "動物",
      preview: "/frames/animals-5985896_1280.png",
      description: "動物主題頭像框",
      cost: 0
    },
  {
    id: "magic-circle",
    name: "魔法陣",
    preview: "/frames/魔法陣1.png",
    description: "神秘的魔法陣頭像框",
    cost: 0
  },
  {
    id: "magic-circle-2",
    name: "魔法陣2",
    preview: "/frames/魔法陣2.png",
    description: "進階版魔法陣頭像框",
    cost: 0
  }
  ];

  // 購買頭像框
  const handlePurchaseFrame = async (frameId) => {
    console.log("🔧 點擊購買頭像框:", frameId, "userId:", userId);
    if (!userId) {
      console.log("❌ 沒有 userId");
      return;
    }
    setFrameLoading(prev => ({ ...prev, [frameId]: true }));
    setFrameMessage("");
    
    const frame = FRAME_ITEMS.find(f => f.id === frameId);
    if (!frame) {
      console.log("❌ 找不到頭像框:", frameId);
      setFrameMessage("找不到該頭像框");
      setFrameLoading(prev => ({ ...prev, [frameId]: false }));
      return;
    }
    
    console.log("🔧 準備購買:", { frameId, cost: frame.cost, frame });
    
    try {
      const res = await axios.post("/api/user/purchase-frame", { frameId, cost: frame.cost });
      console.log("🔧 API 響應:", res.data);
      if (res?.data?.success) {
        setFrameMessage(`已獲得 ${FRAME_ITEMS.find(f => f.id === frameId)?.name} 頭像框！`);
        // 刷新頁面以更新用戶數據
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setFrameMessage(res?.data?.message || "購買失敗，請稍後再試。");
      }
    } catch (e) {
      setFrameMessage("伺服器錯誤，請稍後再試。");
    } finally {
      setFrameLoading(prev => ({ ...prev, [frameId]: false }));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="積分商店">
      <div className="space-y-4">
        {/* 目前積分 */}
        <div className="flex items-center justify-between bg-zinc-800/40 border border-zinc-700/60 rounded-lg p-3">
          <div className="text-sm text-gray-300">目前積分</div>
          <div className="text-xl font-bold text-yellow-400">{currentPoints}</div>
        </div>

        {/* 分頁標籤 */}
        <div className="flex border-b border-zinc-700">
          <button
            onClick={() => setActiveTab("items")}
            className={`flex-1 px-4 py-3 font-medium transition-colors ${
              activeTab === "items"
                ? "bg-blue-600 text-white border-b-2 border-blue-400"
                : "bg-zinc-700 text-gray-300 hover:bg-zinc-600"
            }`}
          >
            🎁 商品
          </button>
          <button
            onClick={() => setActiveTab("frames")}
            className={`flex-1 px-4 py-3 font-medium transition-colors ${
              activeTab === "frames"
                ? "bg-purple-600 text-white border-b-2 border-purple-400"
                : "bg-zinc-700 text-gray-300 hover:bg-zinc-600"
            }`}
          >
            🎨 頭像框
          </button>
        </div>

        {/* 商品分頁內容 */}
        {activeTab === "items" && (
          <div className="bg-zinc-800/40 border border-zinc-700/60 rounded-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-gray-200">迷你播放器（永久解鎖）</div>
                <div className="text-xs text-gray-400">測試版：0 積分直接開通，在個人頁啟用專屬播放器。</div>
              </div>
              <button
                onClick={async () => {
                  if (!userId) return;
                  setRedeemLoading(true);
                  setRedeemMessage("");
                  try {
                    const res = await axios.post("/api/points/redeem-mini-player");
                    if (res?.data?.ok) {
                      setRedeemMessage("已開通迷你播放器！");
                      try {
                        const info = await axios.get(`/api/user-info?id=${encodeURIComponent(userId)}`);
                        const purchased = !!info?.data?.miniPlayerPurchased;
                        const theme = String(info?.data?.miniPlayerTheme || "modern");
                        if (purchased) {
                          if (typeof window !== "undefined") {
                            window.dispatchEvent(new CustomEvent("mini-player-purchased", { detail: { userId, theme } }));
                          }
                        }
                      } catch {}
                    } else {
                      setRedeemMessage("開通失敗，稍後再試。");
                    }
                  } catch (e) {
                    setRedeemMessage("伺服器錯誤，請稍後再試。");
                  } finally {
                    setRedeemLoading(false);
                  }
                }}
                disabled={redeemLoading || userData?.miniPlayerPurchased}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${redeemLoading ? "opacity-60 cursor-not-allowed" : ""} ${userData?.miniPlayerPurchased ? "bg-zinc-700 text-gray-400 border-zinc-600 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white border-blue-500"}`}
              >
                {userData?.miniPlayerPurchased ? "已開通" : (redeemLoading ? "處理中..." : "立即開通")}
              </button>
            </div>
            {redeemMessage ? <p className="mt-2 text-xs text-gray-300">{redeemMessage}</p> : null}
          </div>
        )}

        {/* 頭像框分頁內容 */}
        {activeTab === "frames" && (
          <div className="space-y-4">
            {FRAME_ITEMS.map((frame) => {
              const isLoading = frameLoading[frame.id];
              const canAfford = currentPoints >= frame.cost;
              
              return (
                <div
                  key={frame.id}
                  className="bg-zinc-800/40 border border-zinc-700/60 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* 頭像框預覽 */}
                      <div className="w-16 h-16 relative">
                        <img
                          src={frame.preview}
                          alt={frame.name}
                          className="w-full h-full object-contain rounded-lg"
                        />
                      </div>
                      
                      {/* 頭像框信息 */}
                      <div>
                        <div className="font-medium text-gray-200">{frame.name}</div>
                        <div className="text-xs text-gray-400">{frame.description}</div>
                        <div className="text-yellow-400 font-bold text-sm mt-1">
                          {frame.cost === 0 ? "免費" : `${frame.cost} 積分`}
                        </div>
                      </div>
                    </div>
                    
                    {/* 購買按鈕 */}
                    <button
                      onClick={() => handlePurchaseFrame(frame.id)}
                      disabled={isLoading || !canAfford}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                        isLoading 
                          ? "opacity-60 cursor-not-allowed" 
                          : canAfford 
                            ? "bg-purple-600 hover:bg-purple-700 text-white border-purple-500"
                            : "bg-zinc-700 text-gray-400 border-zinc-600 cursor-not-allowed"
                      }`}
                    >
                      {isLoading ? "處理中..." : "購買"}
                    </button>
                  </div>
                </div>
              );
            })}
            
            {frameMessage && (
              <div className="bg-zinc-800/40 border border-zinc-700/60 rounded-lg p-3">
                <p className="text-sm text-gray-300">{frameMessage}</p>
              </div>
            )}
          </div>
        )}

        {/* 關閉 */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border bg-zinc-800 hover:bg-zinc-700 text-gray-200 border-zinc-600"
          >
            關閉
          </button>
        </div>
      </div>
    </Modal>
  );
}