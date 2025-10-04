// components/homepage/AdminPanel.jsx
"use client";

import { useState } from "react";
import Link from "next/link";

export default function AdminPanel() {
  const [dryRun, setDryRun] = useState(true);
  const [missingOnly, setMissingOnly] = useState(false);
  const [batch, setBatch] = useState(500);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleCreateTestUser = async () => {
    const res = await fetch("/api/dev-create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "tester2@example.com",
        username: "tester2",
        password: "123456",
        isAdmin: false,
      }),
    });

    const data = await res.json();
    alert(
      data.success
        ? `✅ 建立成功：${data.user.email}`
        : `❌ 失敗：${data.message || data.error}`
    );
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

  const handleRecomputeCompleteness = async () => {
    try {
      setLoading(true);
      setResult(null);

      let res = await callRecomputeCompleteness();
      if (res.status === 401) {
        const secret = window.prompt("需要管理密鑰（x-admin-secret）：");
        if (!secret) {
          setLoading(false);
          return;
        }
        res = await callRecomputeCompleteness(secret);
      }

      const data = await res.json();
      setResult(data);
      if (!res.ok || data?.ok === false) {
        alert(`❌ 執行失敗：${data?.message || "Unknown error"}`);
      } else {
        const mode = data?.mode === "missingOnly" ? "只補缺的" : "全部";
        const write = dryRun ? "（Dry-run：未寫入）" : "（已寫入）";
        const stats = data?.stats
          ? `平均 ${data.stats.avg}，最小 ${data.stats.min}，最大 ${data.stats.max}`
          : "";
        alert(`✅ 重算完成：模式【${mode}】${write}\n掃描 ${data.totalScanned} 筆，更新 ${data.updated} 筆。\n${stats}`);
      }
    } catch (e) {
      console.error("recompute error:", e);
      alert("❌ 伺服器錯誤，請稍後再試");
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
        // ✅ 修正：這裡原本反引號收尾造成字串未結束
        const secret = window.prompt("需要管理密鑰（x-admin-secret）：");
        if (!secret) {
          setLoading(false);
          return;
        }
        res = await callRecomputePop(secret);
      }

      const data = await res.json();
      setResult(data);
      if (!res.ok || data?.ok === false) {
        alert(`❌ 執行失敗：${data?.message || "Unknown error"}`);
      } else {
        alert(`✅ 熱門度重算完成：共掃描 ${data.total} 筆，更新 ${data.updated} 筆。`);
      }
    } catch (e) {
      console.error("recompute pop error:", e);
      alert("❌ 伺服器錯誤，請稍後再試");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 bg-zinc-800 p-4 rounded text-sm border border-zinc-700 space-y-3">
      <p className="text-gray-300 font-semibold">🧪 測試工具（限管理員）</p>

      {/* 建立測試帳號 & 快速連結 */}
      <div className="flex items-center gap-3">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          onClick={handleCreateTestUser}
          disabled={loading}
        >
          ➕ 建立測試帳號
        </button>

        <div className="text-yellow-400 underline hover:text-yellow-300">
          <Link href="/admin/analytics">📊 查看流量紀錄</Link>
        </div>
        <div className="text-yellow-400 underline hover:text-yellow-300">
          <Link href="/admin/ad-analytics">💰 廣告收益統計</Link>
        </div>
        <div className="text-yellow-400 underline hover:text黃-300">
          <Link href="/admin/feedbacks">📩 使用者回報</Link>
        </div>
        <div className="text-yellow-400 underline hover:text-yellow-300">
          <Link href="/admin/reports">🚨 檢舉列表</Link>
        </div>
        <div className="text-yellow-400 underline hover:text-yellow-300">
          <Link href="/admin/suspensions">🔒 鎖號列表</Link>
        </div>
        {/* 新增：警告管理 */}
        <div className="text-yellow-400 underline hover:text-yellow-300">
          <Link href="/admin/warnings">⚠️ 警告管理</Link>
        </div>
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
    </div>
  );
}
