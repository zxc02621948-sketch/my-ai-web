// app/admin/warnings/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";

const REASON_LABELS = {
  policy_violation: "站規違規",
  category_wrong: "分類錯誤",
  rating_wrong: "分級錯誤",
  duplicate_content: "重複內容",
};
const REASON_OPTIONS = Object.entries(REASON_LABELS).map(([value, label]) => ({ value, label }));

function formatDate(ts) {
  try { return new Date(ts).toLocaleString(); } catch { return "-"; }
}
function daysLeft(expiresAt) {
  const now = Date.now();
  const exp = new Date(expiresAt).getTime();
  return Math.ceil((exp - now) / (24 * 60 * 60 * 1000));
}

export default function AdminWarningsPage() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [userIdQuery, setUserIdQuery] = useState("");

  // 新增警告彈窗狀態
  const [createOpen, setCreateOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [reasonCode, setReasonCode] = useState("policy_violation");
  const [days, setDays] = useState(60);
  const [note, setNote] = useState("");

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  // 頂部統計（僅針對目前頁面資料）
  const stats = useMemo(() => {
    const now = Date.now();
    let active = 0, revoked = 0, expired = 0;
    for (const w of items) {
      if (w.isRevoked) { revoked++; continue; }
      if (new Date(w.expiresAt).getTime() > now) active++;
      else expired++;
    }
    return { active, revoked, expired };
  }, [items]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
        if (userIdQuery.trim()) params.set("userId", userIdQuery.trim());

        const r = await fetch(`/api/warnings?${params.toString()}`, { cache: "no-store" });
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
  }, [page, pageSize, userIdQuery]);

  const refresh = () => {
    const p = page; setPage(p === 1 ? 2 : 1); setPage(p);
  };

  async function revokeWarning(id) {
    if (!confirm("確定要撤銷這則警告嗎？")) return;
    try {
      const r = await fetch(`/api/warnings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ revoke: true }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok === false) throw new Error(j?.message || `HTTP ${r.status}`);
      refresh();
    } catch (e) {
      alert(e.message || "撤銷失敗");
    }
  }

  // 直接新增警告（支援一次送多筆）
  async function createWarnings(times = 1) {
    if (!email.trim()) return alert("請輸入 Email");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return alert("Email 格式不正確");
    try {
      setLoading(true);
      const token = document.cookie.match(/token=([^;]+)/)?.[1];
      if (!token) throw new Error("找不到登入憑證（token）");

      for (let i = 1; i <= times; i++) {
        const r = await fetch("/api/warnings", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            reasonCode,
            days: Math.max(1, Number(days) || 60),
            note: note ? `${note}${times > 1 ? ` #${i}` : ""}` : "",
            sendMessage: false,
          }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j?.ok === false) throw new Error(j?.message || `HTTP ${r.status}`);
      }
      alert(`✅ 已新增 ${times} 次警告${times >= 3 ? "（應已觸發永久鎖）" : ""}`);
      setCreateOpen(false);
      // 若你正在用 userId 過濾別人，可直接把搜尋改為該使用者（此步可選）
      refresh();
    } catch (e) {
      alert(e.message || "新增失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 text-zinc-100">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">⚠️ 警告管理</h1>
        <button
          className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500"
          onClick={() => {
            setEmail("");
            setReasonCode("policy_violation");
            setDays(60);
            setNote("");
            setCreateOpen(true);
          }}
        >
          ➕ 新增警告
        </button>
      </div>

      {/* 篩選列 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 w-[360px]"
          placeholder="以 User ID 篩選（留空=全部）"
          value={userIdQuery}
          onChange={(e) => { setPage(1); setUserIdQuery(e.target.value); }}
        />
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

      {/* 統計 */}
      <div className="flex flex-wrap gap-3 mb-4">
        <StatCard label="有效" value={stats.active} />
        <StatCard label="已撤銷" value={stats.revoked} />
        <StatCard label="已到期" value={stats.expired} />
      </div>

      {/* 表格 */}
      <div className="overflow-auto rounded-xl border border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-900">
            <tr className="[&>th]:px-3 [&>th]:py-2 text-left">
              <th>使用者</th>
              <th>理由</th>
              <th>建立時間</th>
              <th>到期</th>
              <th>狀態</th>
              <th>來源</th>
              <th>備註</th>
              <th className="w-48">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="text-center py-6 text-zinc-400">沒有資料</td>
              </tr>
            )}
            {items.map((w) => {
              const left = daysLeft(w.expiresAt);
              const now = Date.now();
              const isExpired = new Date(w.expiresAt).getTime() <= now;

              let statusBadge = null;
              if (w.isRevoked) {
                statusBadge = <Badge text="已撤銷" tone="neutral" />;
              } else if (isExpired) {
                statusBadge = <Badge text="已到期" tone="neutral" />;
              } else {
                statusBadge = <Badge text="有效" tone="active" />;
              }

              return (
                <tr key={w._id} className="border-t border-zinc-800 hover:bg-zinc-900/50 align-top">
                  <td className="px-3 py-2">
                    <div className="text-xs break-all font-mono">{String(w.userId)}</div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="px-2 py-1 rounded bg-zinc-800">
                      {REASON_LABELS[w.reasonCode] || w.reasonCode}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(w.createdAt)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatDate(w.expiresAt)}
                    {!w.isRevoked && !isExpired && (
                      <div className="text-xs text-zinc-400">{left} 天後到期</div>
                    )}
                  </td>
                  <td className="px-3 py-2">{statusBadge}</td>
                  <td className="px-3 py-2 text-xs">
                    <div className="text-zinc-300">
                      {w.imageId ? <>Image: <span className="font-mono">{String(w.imageId)}</span></> : <span className="text-zinc-500">無</span>}
                    </div>
                    <div className="text-zinc-300">
                      {w.reportId ? <>Report: <span className="font-mono">{String(w.reportId)}</span></> : <span className="text-zinc-500">無</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs whitespace-pre-wrap break-words max-w-[320px]">
                    {w.note || <span className="text-zinc-500">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600"
                        onClick={() => navigator.clipboard.writeText(String(w.userId))}
                      >
                        複製UserID
                      </button>
                      <button
                        className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500"
                        onClick={() => navigator.clipboard.writeText(String(w._id))}
                      >
                        複製WarningID
                      </button>
                      <button
                        className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 disabled:opacity-50"
                        onClick={() => revokeWarning(w._id)}
                        disabled={w.isRevoked}
                        title="撤銷此警告（修正誤判用）"
                      >
                        撤銷
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
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
            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
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

      {/* 新增警告彈窗 */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-zinc-900 rounded-2xl p-4 w-full max-w-md border border-zinc-800">
            <div className="text-lg font-semibold mb-3">新增警告</div>

            <div className="space-y-3">
              <label className="block">
                <div className="text-sm text-zinc-300 mb-1">Email</div>
                <input
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>

              <label className="block">
                <div className="text-sm text-zinc-300 mb-1">理由</div>
                <select
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2"
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                >
                  {REASON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>

              <div className="flex items-center gap-2">
                <div className="text-sm text-zinc-300">有效天數</div>
                <input
                  type="number"
                  min={1}
                  className="w-24 bg-zinc-800 border border-zinc-700 rounded px-2 py-1"
                  value={days}
                  onChange={(e) => setDays(Math.max(1, parseInt(e.target.value || "60", 10)))}
                />
                <span className="text-sm text-zinc-400">天（預設 60）</span>
              </div>

              <label className="block">
                <div className="text-sm text-zinc-300 mb-1">備註（可選）</div>
                <textarea
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2"
                  rows={2}
                  placeholder="例如：違規重複上傳廣告圖"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            </div>

            <div className="flex justify-between gap-2 mt-4">
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-2 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50"
                  disabled={loading}
                  onClick={() => createWarnings(1)}
                  title="新增一支警告"
                >
                  送出
                </button>
                <button
                  className="px-3 py-2 rounded bg-rose-600 hover:bg-rose-500 disabled:opacity-50"
                  disabled={loading}
                  onClick={() => {
                    if (confirm("確定要一次新增 3 支警告？（將可能直接觸發永久鎖）")) {
                      createWarnings(3);
                    }
                  }}
                  title="一次新增三支（用於測試封鎖）"
                >
                  一鍵 +3
                </button>
              </div>
              <button
                className="px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600"
                onClick={() => setCreateOpen(false)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({ text, tone }) {
  const cls = tone === "active" ? "bg-emerald-600" : "bg-zinc-700";
  return (
    <span className={`inline-block text-white text-xs px-2 py-1 rounded ${cls}`}>
      {text}
    </span>
  );
}
function StatCard({ label, value }) {
  return (
    <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
      <div className="text-zinc-400 text-sm">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}
