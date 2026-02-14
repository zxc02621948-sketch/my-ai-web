// components/homepage/AdminPanel.jsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { notify } from "@/components/common/GlobalNotificationManager";
import Modal from "@/components/common/Modal";

export default function AdminPanel() {
  const [dryRun, setDryRun] = useState(true);
  const [missingOnly, setMissingOnly] = useState(false);
  const [batch, setBatch] = useState(500);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  // 積分發送相關狀態
  const [pointsAmount, setPointsAmount] = useState(1000);
  const [pointsLoading, setPointsLoading] = useState(false);
  
  // 發送積分給其他用戶
  const [targetUsername, setTargetUsername] = useState("");
  const [sendPointsAmount, setSendPointsAmount] = useState(1000);
  const [sendReason, setSendReason] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  
  // 重置體驗券相關狀態
  const [resetCouponUsername, setResetCouponUsername] = useState("");
  const [resetCouponLoading, setResetCouponLoading] = useState(false);
  
  // Prompt 相關狀態
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptTitle, setPromptTitle] = useState("");
  const [promptMessage, setPromptMessage] = useState("");
  const [promptValue, setPromptValue] = useState("");
  const [promptResolve, setPromptResolve] = useState(null);

  const handleCreateTestUser = async () => {
    const tempPassword = `T${Math.random().toString(36).slice(2, 10)}!9a`;
    const res = await fetch("/api/dev-create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "tester2@example.com",
        username: "tester2",
        password: tempPassword,
        isAdmin: false,
      }),
    });

    const data = await res.json();
    if (data.success) {
      notify.success("成功", `建立成功：${data.user.email}（密碼：${tempPassword}）`);
    } else {
      notify.error("失敗", data.message || data.error);
    }
  };

  // 給自己發送積分
  const handleGiveMePoints = async () => {
    setPointsLoading(true);
    try {
      const res = await fetch("/api/admin/give-me-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: pointsAmount }),
      });

      const data = await res.json();
      
      if (data.success) {
        // 將成功狀態保存到 sessionStorage，刷新後顯示提示
        if (typeof window !== "undefined") {
          sessionStorage.setItem("actionSuccess", JSON.stringify({
            title: "成功",
            message: `成功獲得 ${pointsAmount} 積分！\n原積分: ${data.data.oldBalance}\n新積分: ${data.data.newBalance}`
          }));
        }
        // 刷新頁面以更新顯示
        window.location.reload();
      } else {
        notify.error("失敗", data.message);
      }
    } catch (error) {
      console.error("發送積分失敗:", error);
      notify.error("發送失敗", error.message);
    } finally {
      setPointsLoading(false);
    }
  };

  // 發送積分給指定用戶
  const handleSendPoints = async () => {
    if (!targetUsername.trim()) {
      notify.warning("提示", "請輸入目標用戶名");
      return;
    }

    setSendLoading(true);
    try {
      // 先查詢用戶 ID
      const userRes = await fetch(`/api/user-info?id=${encodeURIComponent(targetUsername)}`);
      const userData = await userRes.json();
      
      if (!userData._id) {
        notify.error("錯誤", `找不到用戶：${targetUsername}`);
        setSendLoading(false);
        return;
      }

      // 發送積分
      const res = await fetch("/api/admin/send-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          targetUserId: userData._id,
          amount: sendPointsAmount,
          reason: sendReason || "管理員測試發送"
        }),
      });

      const data = await res.json();
      
      if (data.success) {
        notify.success("成功", `成功發送 ${sendPointsAmount} 積分給 ${targetUsername}！\n原餘額：${data.data.targetUser.oldBalance}\n新餘額：${data.data.targetUser.newBalance}`);
        // 清空輸入
        setTargetUsername("");
        setSendReason("");
      } else {
        notify.error("失敗", data.message);
      }
    } catch (error) {
      console.error("發送積分錯誤:", error);
      notify.error("錯誤", "發送積分時發生錯誤");
    } finally {
      setSendLoading(false);
    }
  };

  // ===== 重算完整度 =====
  const callRecomputeCompleteness = async (secret) => {
    const params = new URLSearchParams({
      missingOnly: missingOnly ? "1" : "0",
      batch: String(batch || 500),
      dryRun: dryRun ? "1" : "0",
    });
    const headers = { "Content-Type": "application/json" };
    if (secret) headers["x-admin-secret"] = secret;

    const res = await fetch(`/api/admin/recompute-scores?${params.toString()}`, {
      method: "POST",
      headers,
    });
    return res;
  };

  // 自定義 prompt 函數
  const customPrompt = (title, message, defaultValue = "") => {
    return new Promise((resolve) => {
      setPromptTitle(title);
      setPromptMessage(message);
      setPromptValue(defaultValue);
      setShowPrompt(true);
      setPromptResolve(() => resolve);
    });
  };

  const handlePromptConfirm = () => {
    if (promptResolve) {
      promptResolve(promptValue);
      setPromptResolve(null);
    }
    setShowPrompt(false);
    setPromptValue("");
  };

  const handlePromptCancel = () => {
    if (promptResolve) {
      promptResolve(null);
      setPromptResolve(null);
    }
    setShowPrompt(false);
    setPromptValue("");
  };

  const handleRecomputeCompleteness = async () => {
    try {
      setLoading(true);
      setResult(null);

      let res = await callRecomputeCompleteness();
      if (res.status === 401) {
        const secret = await customPrompt("需要管理密鑰", "請輸入管理密鑰（x-admin-secret）：");
        if (!secret) {
          setLoading(false);
          return;
        }
        res = await callRecomputeCompleteness(secret);
      }

      const data = await res.json();
      setResult(data);
      if (!res.ok || data?.ok === false) {
        notify.error("執行失敗", data?.message || "Unknown error");
      } else {
        const mode = data?.mode === "missingOnly" ? "只補缺的" : "全部";
        const write = dryRun ? "（Dry-run：未寫入）" : "（已寫入）";
        const stats = data?.stats
          ? `平均 ${data.stats.avg}，最小 ${data.stats.min}，最大 ${data.stats.max}`
          : "";
        notify.success("重算完成", `模式【${mode}】${write}\n掃描 ${data.totalScanned} 筆，更新 ${data.updated} 筆。\n${stats}`);
      }
    } catch (e) {
      console.error("recompute error:", e);
      notify.error("伺服器錯誤", "請稍後再試");
    } finally {
      setLoading(false);
    }
  };

  // ===== 重算熱門度 =====
  const callRecomputePop = async (secret) => {
    const headers = { "Content-Type": "application/json" };
    if (secret) headers["x-admin-secret"] = secret;

    const res = await fetch(`/api/admin/recompute-pop`, {
      method: "POST",
      headers,
    });
    return res;
  };

  const handleRecomputePop = async () => {
    try {
      setLoading(true);
      setResult(null);

      let res = await callRecomputePop();
      if (res.status === 401) {
        const secret = await customPrompt("需要管理密鑰", "請輸入管理密鑰（x-admin-secret）：");
        if (!secret) {
          setLoading(false);
          return;
        }
        res = await callRecomputePop(secret);
      }

      const data = await res.json();
      setResult(data);
      if (!res.ok || data?.ok === false) {
        notify.error("執行失敗", data?.message || "Unknown error");
      } else {
        notify.success("重算完成", `熱門度重算完成：共掃描 ${data.total} 筆，更新 ${data.updated} 筆。`);
      }
    } catch (e) {
      console.error("recompute pop error:", e);
      notify.error("伺服器錯誤", "請稍後再試");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* 建立測試帳號 */}
      <div className="flex items-center gap-3">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          onClick={handleCreateTestUser}
          disabled={loading}
        >
          ➕ 建立測試帳號
        </button>
      </div>

      {/* 重算完整度 */}
      <div className="mt-3 p-3 rounded border border-zinc-700 bg-zinc-900/50">
        <div className="font-semibold mb-2 text-zinc-200">🧮 重算作品完整度（completenessScore）</div>

        <div className="flex flex-wrap items-center gap-3 mb-3">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              className="accent-indigo-500"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />
            <span className="text-zinc-300">Dry-run（不寫入，只看分佈）</span>
          </label>

          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              className="accent-indigo-500"
              checked={missingOnly}
              onChange={(e) => setMissingOnly(e.target.checked)}
            />
            <span className="text-zinc-300">只補缺的（已有分數的略過）</span>
          </label>

          <label className="inline-flex items-center gap-2">
            <span className="text-zinc-300">批次大小</span>
            <input
              type="number"
              min={100}
              step={100}
              className="w-24 bg-zinc-900 border border-white/10 rounded px-2 py-1 text-zinc-200"
              value={batch}
              onChange={(e) => setBatch(Number(e.target.value) || 500)}
            />
          </label>
        </div>

        <button
          onClick={handleRecomputeCompleteness}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "計算中…" : "⚡ 重算完整度"}
        </button>
      </div>

      {/* 重算熱門度 */}
      <div className="mt-3 p-3 rounded border border-zinc-700 bg-zinc-900/50">
        <div className="font-semibold mb-2 text-zinc-200">🔥 重算熱門度（popularScore）</div>
        <button
          onClick={handleRecomputePop}
          disabled={loading}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "計算中…" : "⚡ 重算熱門度"}
        </button>
      </div>

      {/* 積分發送 */}
      <div className="mt-3 p-3 rounded border border-yellow-700 bg-yellow-900/20">
        <div className="font-semibold mb-3 text-yellow-200">💰 積分管理（測試用）</div>
        
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <label className="text-zinc-300 text-sm">積分數量:</label>
            <input
              type="number"
              value={pointsAmount}
              onChange={(e) => setPointsAmount(parseInt(e.target.value) || 0)}
              className="px-3 py-1 bg-zinc-800 text-white rounded border border-zinc-600 w-32"
              min="0"
              step="100"
            />
            <button
              onClick={handleGiveMePoints}
              disabled={pointsLoading}
              className="px-4 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
            >
              {pointsLoading ? "發送中..." : "💰 給我積分"}
            </button>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setPointsAmount(100)}
              className="px-3 py-1 bg-zinc-700 text-white rounded hover:bg-zinc-600 text-sm"
            >
              100
            </button>
            <button
              onClick={() => setPointsAmount(500)}
              className="px-3 py-1 bg-zinc-700 text-white rounded hover:bg-zinc-600 text-sm"
            >
              500
            </button>
            <button
              onClick={() => setPointsAmount(1000)}
              className="px-3 py-1 bg-zinc-700 text-white rounded hover:bg-zinc-600 text-sm"
            >
              1000
            </button>
            <button
              onClick={() => setPointsAmount(5000)}
              className="px-3 py-1 bg-zinc-700 text-white rounded hover:bg-zinc-600 text-sm"
            >
              5000
            </button>
            <button
              onClick={() => setPointsAmount(10000)}
              className="px-3 py-1 bg-zinc-700 text-white rounded hover:bg-zinc-600 text-sm"
            >
              10000
            </button>
          </div>
          
          {/* 發送給其他用戶 */}
          <div className="border-t border-yellow-700/30 pt-3 mt-2">
            <div className="text-sm text-yellow-200 mb-2">🎁 發送給測試員</div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={targetUsername}
                  onChange={(e) => setTargetUsername(e.target.value)}
                  className="px-3 py-1 bg-zinc-800 text-white rounded border border-zinc-600 flex-1"
                  placeholder="用戶名（例如：tester1）"
                />
                <input
                  type="number"
                  value={sendPointsAmount}
                  onChange={(e) => setSendPointsAmount(parseInt(e.target.value) || 1000)}
                  className="px-3 py-1 bg-zinc-800 text-white rounded border border-zinc-600 w-28"
                  placeholder="積分"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={sendReason}
                  onChange={(e) => setSendReason(e.target.value)}
                  className="px-3 py-1 bg-zinc-800 text-white rounded border border-zinc-600 flex-1 text-sm"
                  placeholder="原因（選填）"
                />
                <button
                  onClick={handleSendPoints}
                  disabled={sendLoading || !targetUsername.trim()}
                  className="px-4 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                >
                  {sendLoading ? "發送中..." : "🚀 發送"}
                </button>
              </div>
            </div>
          </div>
          
          <div className="text-xs text-zinc-400">
            ⚠️ 僅限管理員使用，用於測試積分系統
          </div>
        </div>
      </div>

      {/* 重置體驗券 */}
      <div className="mt-3 p-3 rounded border border-green-700 bg-green-900/20">
        <div className="font-semibold mb-2 text-green-200">🎫 重置播放器體驗券</div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={resetCouponUsername}
              onChange={(e) => setResetCouponUsername(e.target.value)}
              className="px-3 py-1 bg-zinc-800 text-white rounded border border-zinc-600 flex-1"
              placeholder="用戶名（留空則重置自己的帳號）"
            />
            <button
              onClick={async () => {
                setResetCouponLoading(true);
                try {
                  const body = resetCouponUsername.trim() 
                    ? { targetUsername: resetCouponUsername.trim() }
                    : {};
                  
                  const res = await fetch("/api/admin/reset-player-coupon", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                  });
                  
                  const data = await res.json();
                  
                  if (data.success) {
                    notify.success("重置成功", data.message || "體驗券標記已重置！現在可以再次使用體驗券了。");
                    // 清空輸入
                    setResetCouponUsername("");
                    // 刷新頁面以更新顯示（如果是重置自己的）
                    if (!resetCouponUsername.trim()) {
                      setTimeout(() => {
                        window.location.reload();
                      }, 1000);
                    }
                  } else {
                    notify.error("重置失敗", data.error || "重置失敗，請稍後再試");
                  }
                } catch (error) {
                  console.error("重置體驗券失敗:", error);
                  notify.error("重置失敗", "發生錯誤，請稍後再試");
                } finally {
                  setResetCouponLoading(false);
                }
              }}
              disabled={resetCouponLoading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {resetCouponLoading ? "重置中..." : "🔄 重置體驗券標記"}
            </button>
          </div>
          <div className="text-xs text-zinc-400">
            ⚠️ 清除 playerCouponUsed 和 miniPlayerExpiry，移除 pinPlayerTest 訂閱。留空則重置自己的帳號。
          </div>
        </div>
      </div>

      {result && (
        <div className="mt-3 text-zinc-300">
          <div>狀態：{result.ok ? "成功" : "失敗"}</div>
          {"mode" in result && <div>模式：{result.mode === "missingOnly" ? "只補缺的" : "全部"}</div>}
          {"totalScanned" in result && <div>掃描：{result.totalScanned}</div>}
          {"updated" in result && <div>更新：{result.updated}</div>}
          {result.stats && (
            <div>分佈：平均 {result.stats.avg} · 最小 {result.stats.min} · 最大 {result.stats.max}</div>
          )}
        </div>
      )}

      {/* Prompt 彈窗 */}
      <Modal
        isOpen={showPrompt}
        onClose={handlePromptCancel}
        title={promptTitle}
      >
        <div className="space-y-4">
          <p className="text-gray-300">{promptMessage}</p>
          <input
            type="text"
            value={promptValue}
            onChange={(e) => setPromptValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handlePromptConfirm();
              } else if (e.key === "Escape") {
                handlePromptCancel();
              }
            }}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
            placeholder="請輸入..."
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <button
              onClick={handlePromptCancel}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
            >
              取消
            </button>
            <button
              onClick={handlePromptConfirm}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              確定
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
