// app/admin/suspensions/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";

function formatDate(ts) {
  try { return new Date(ts).toLocaleString(); } catch { return "-"; }
}

export default function AdminSuspensionsPage() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [q, setQ] = useState("");
  const [email, setEmail] = useState(""); // 新增：Email 專用欄位
  const [status, setStatus] = useState(""); // "", "permanent", "temporary"

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
        const _email = email.trim();
        const _q = q.trim();
        if (_email) {
          params.set("email", _email);
        } else if (_q) {
          params.set("q", _q);
        }
        if (status) params.set("status", status);

        const r = await fetch(`/api/admin/suspensions?${params.toString()}`, { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j?.ok === false) throw new Error(j?.message || `HTTP ${r.status}`);
        setItems(j.items || []);
        setTotal(j.total || 0);
      } catch (e) {
        alert(e.message || "載入失敗");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [page, pageSize, q, email, status]);

  const refresh = () => {
    const p = page; setPage(p === 1 ? 2 : 1); setPage(p);
  };

  async function unlockUser(userId) {
    if (!confirm("確定要解鎖這個帳號嗎？")) return;
    try {
      const r = await fetch(`/api/admin/suspensions/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unlock: true }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok === false) throw new Error(j?.message || `HTTP ${r.status}`);
      refresh();
    } catch (e) {
      alert(e.message || "解鎖失敗");
    }
  }

  return (
    <div className="p-4 text-zinc-100">
      <h1 className="text-2xl font-bold mb-4">鎖號列表</h1>

      {/* 篩選列 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 w-[280px]"
          placeholder="Email（優先）"
          value={email}
          onChange={(e) => { setPage(1); setEmail(e.target.value); }}
        />
        <input
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 w-[280px]"
          placeholder="關鍵字（UserID / 帳號 / Email）"
          value={q}
          onChange={(e) => { setPage(1); setQ(e.target.value); }}
        />
        <select
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2"
          value={status}
          onChange={(e) => { setPage(1); setStatus(e.target.value); }}
        >
          <option value="">全部（永久＋臨時）</option>
          <option value="permanent">永久鎖</option>
          <option value="temporary">臨時鎖</option>
        </select>
        <button
          className="px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600"
          onClick={() => { setPage(1); refresh(); }}
        >
          重新整理
        </button>

        <div className="ml-auto text-sm text-zinc-400">
          {loading ? "載入中…" : `共 ${total} 筆 | 第 ${page} / ${totalPages} 頁`}
        </div>
      </div>

      {/* 表格 */}
      <div className="overflow-auto rounded-xl border border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-900">
            <tr className="[&>th]:px-3 [&>th]:py-2 text-left">
              <th>使用者</th>
              <th>Email</th>
              <th>鎖定時間</th>
              <th>類型</th>
              <th>有效警告數</th>
              <th className="w-64">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="text-center py-6 text-zinc-400">沒有符合條件的資料</td>
              </tr>
            )}
            {items.map(u => (
              <tr key={u._id} className="border-t border-zinc-800 hover:bg-zinc-900/50 align-top">
                <td className="px-3 py-2">
                  <div className="font-mono text-xs break-all">{String(u._id)}</div>
                  <div className="text-zinc-300">{u.username || "（無）"}</div>
                </td>
                <td className="px-3 py-2">{u.email || "（無）"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{u.suspendedAt ? formatDate(u.suspendedAt) : "—"}</td>
                <td className="px-3 py-2">
                  {u.isPermanentSuspension ? (
                    <span className="px-2 py-1 rounded bg-rose-600 text-white">永久鎖</span>
                  ) : (
                    <span className="px-2 py-1 rounded bg-amber-600 text-white">臨時鎖</span>
                  )}
                </td>
                <td className="px-3 py-2">{u.activeWarnings}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/admin/warnings?userId=${encodeURIComponent(String(u._id))}`}
                      className="px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600 inline-block"
                    >
                      檢視警告
                    </a>
                    <button
                      className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500"
                      onClick={() => unlockUser(u._id)}
                      title="手動解鎖（僅人工核可時使用）"
                    >
                      手動解鎖
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分頁 */}
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-zinc-400">
          每頁
          <select
            className="ml-2 bg-zinc-900 border border-zinc-700 rounded px-2 py-1"
            value={pageSize}
            onChange={(e) => { setPage(1); setPageSize(parseInt(e.target.value, 10) || 20); }}
          >
            {[10,20,50,100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          筆
        </div>

        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 rounded bg-zinc-800 disabled:opacity-50"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
          >
            上一頁
          </button>
          <div className="text-sm text-zinc-400">
            第 {page} / {totalPages} 頁
          </div>
          <button
            className="px-3 py-1 rounded bg-zinc-800 disabled:opacity-50"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
          >
            下一頁
          </button>
        </div>
      </div>
    </div>
  );
}
