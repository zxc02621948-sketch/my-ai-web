"use client";

import { useState } from "react";
import Modal from "@/components/common/Modal";
import axios from "axios";

export default function PointsStoreModal({ isOpen, onClose, userData }) {
  const userId = String(userData?._id || "");
  const currentPoints = Number(userData?.pointsBalance ?? 0);
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemMessage, setRedeemMessage] = useState("");

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="積分商店">
      <div className="space-y-4">
        {/* 目前積分 */}
        <div className="flex items-center justify-between bg-zinc-800/40 border border-zinc-700/60 rounded-lg p-3">
          <div className="text-sm text-gray-300">目前積分</div>
          <div className="text-xl font-bold text-yellow-400">{currentPoints}</div>
        </div>

        {/* 迷你播放器 */}
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