"use client";
import { useEffect, useRef, useState } from "react";
import { notify } from "@/components/common/GlobalNotificationManager";

function cx(...cls){ return cls.filter(Boolean).join(" "); }

/** 左側：會話列表項 **/
function LeftItem({ item, active, onClick }) {
  const last = item.last || {};
  const preview = (last.body || "").slice(0, 50).replace(/\n/g," ");
  return (
    <button
      onClick={onClick}
      className={cx(
        "w-full text-left px-3 py-2 border-b border-zinc-800 hover:bg-zinc-900/60",
        active ? "bg-zinc-900" : ""
      )}
    >
      <div className="flex items-center gap-2">
        <div className="font-medium">
          {item.subject || last.subject || "（無主旨）"}
        </div>
        {item.unread > 0 && (
          <span className="ml-auto text-xs bg-red-600 text-white rounded px-1">
            {item.unread}
          </span>
        )}
      </div>
      <div className="text-xs text-zinc-400 mt-0.5 line-clamp-1">
        {preview || "—"}
      </div>
      <div className="text-[10px] text-zinc-500 mt-0.5">
        {last.createdAt ? new Date(last.createdAt).toLocaleString() : ""}
      </div>
    </button>
  );
}

/** 右側：訊息泡泡 **/
function Bubble({ meId, m }) {
  const mine = meId && String(m.fromId) === String(meId);
  return (
    <div className={cx("flex mb-3", mine ? "justify-end" : "justify-start")}>
      <div
        className={cx(
          "max-w-[80%] rounded-2xl px-3 py-2 whitespace-pre-wrap leading-relaxed",
          mine ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-100"
        )}
      >
        {m.body}
        <div className="text-[10px] opacity-80 mt-1">
          {new Date(m.createdAt).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

/** 管理員：發新信彈窗（收件者可填暱稱或信箱，亦相容 _id） **/
function AdminComposeModal({ open, onClose, onSent }) {
  const [to, setTo] = useState(""); // username / email / _id
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [refId, setRefId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setTo(""); setSubject(""); setBody(""); setRefId(""); }
  }, [open]);

  async function send() {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      notify.warning("提示", "請填寫 收件者 / 主旨 / 內容");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim(),
          body: body.trim(),
          kind: "admin",
          ref: refId.trim() ? { type: "image", id: refId.trim() } : undefined,
        }),
      });
      let j=null; try{ j=await res.json(); }catch{ j=null; }
      if (!res.ok || !j?.ok) throw new Error((j && (j.error||j.message)) || `HTTP ${res.status}`);
      onSent?.();         // 刷新左側列表
      onClose?.();        // 關閉彈窗
      window.dispatchEvent(new CustomEvent("inbox:refresh"));
    } catch (e) {
      notify.error("發送失敗", e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <div className="text-lg font-semibold mb-3">發送站內信（管理員）</div>
        <div className="space-y-3">
          <div>
            <div className="text-sm text-zinc-400 mb-1">收件者（暱稱或信箱）</div>
            <input
              className="w-full bg-zinc-950 border border-white/10 rounded px-3 py-2"
              value={to}
              onChange={(e)=>setTo(e.target.value)}
              placeholder="輸入暱稱或 email；也支援貼 _id"
            />
          </div>
          <div>
            <div className="text-sm text-zinc-400 mb-1">主旨</div>
            <input
              className="w-full bg-zinc-950 border border-white/10 rounded px-3 py-2"
              value={subject}
              onChange={(e)=>setSubject(e.target.value)}
              placeholder="例如：作品分級已調整"
            />
          </div>
          <div>
            <div className="text-sm text-zinc-400 mb-1">內容</div>
            <textarea
              className="w-full bg-zinc-950 border border-white/10 rounded px-3 py-2 min-h-[140px]"
              value={body}
              onChange={(e)=>setBody(e.target.value)}
              placeholder={`您好 {{username}}，\n您的作品「xxx」因 xxx 已…\n若有疑義可於 7 日內申訴。`}
            />
          </div>
          <div>
            <div className="text-sm text-zinc-400 mb-1">關聯 imageId（可選）</div>
            <input
              className="w-full bg-zinc-950 border border-white/10 rounded px-3 py-2"
              value={refId}
              onChange={(e)=>setRefId(e.target.value)}
              placeholder="例如：作品 ID"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded bg-zinc-800">取消</button>
          <button
            onClick={send}
            disabled={busy}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
          >
            {busy ? "發送中…" : "發送"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const [meId, setMeId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [list, setList] = useState([]);         // 會話列表
  const [activeId, setActiveId] = useState(""); // 當前會話 id
  const [thread, setThread] = useState([]);     // 當前會話訊息
  const [input, setInput] = useState("");
  const chatEndRef = useRef(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [composeOpen, setComposeOpen] = useState(false);

  // 封存顯示/狀態（安全模式下暫不使用 showArchived）
  const [showArchived, setShowArchived] = useState(false);
  const [threadArchived, setThreadArchived] = useState(false);

  // 用於取消重複請求 & 避免競態
  const abortRef = useRef(null);

  /** 取自己（判斷是否 admin，用於顯示「發新信」按鈕） */
  async function loadMe() {
    try {
      const r = await fetch("/api/me", { cache: "no-store" });
      const j = await r.json();
      if (j.ok) { setMeId(j.id); setIsAdmin(!!j.isAdmin); }
    } catch {}
  }

  /** 取會話列表（左側） */
  async function loadList() {
    try {
      // 安全模式：永遠只抓未封存（includeArchived=0）
      const r = await fetch(`/api/messages/conversations?includeArchived=${showArchived ? "1" : "0"}`, { cache: "no-store" });
      let j=null; try{ j=await r.json(); }catch{ j=null; }
      if (!r.ok || !j?.ok) return;
      const items = (j.items || []).map(x => ({ ...x, subject: x.subject || x.last?.subject }));
      setList(items);
      
      // 檢查當前選中的會話是否還存在於新列表中
      const currentExists = items.some(item => item.cid === activeId);
      
      // 如果當前選中的會話不存在，或者沒有選中，則選擇第一個
      if (!currentExists || !activeId) {
        setActiveId(items[0]?.cid || "");
      }
    } catch {}
  }

  /** 取某會話訊息（右側聊天）；同時後端會自動把我作為收件者的未讀標成已讀 */
  async function loadThread(cid) {
    if (!cid) { setThread([]); setThreadArchived(false); setErrorMsg(""); return; }

    // 中止舊請求避免競態
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoadingThread(true);
    setErrorMsg("");

    try {
      // 安全模式：完全不帶 includeArchived，後端預設就會過濾 deletedFor
      const qs = new URLSearchParams({ id: cid });
      if (showArchived) qs.set("includeArchived", "1");
      const r = await fetch(`/api/messages/thread?${qs.toString()}`, { cache: "no-store", signal: controller.signal });

      // 有些錯誤會回傳純文字，不一定是 JSON
      let j = null;
      const text = await r.text();
      try { j = text ? JSON.parse(text) : null; } catch { j = null; }

      if (!r.ok || !j?.ok) {
        const msg = (j && (j.error || j.message)) || (text || `HTTP ${r.status}`);
        console.error("loadThread error:", msg);
        setThread([]); setThreadArchived(false);
        setErrorMsg(typeof msg === "string" ? msg : "載入失敗");
        return;
      }
      setThread(j.items || []);
      setThreadArchived(!!j.archivedForMe);

      // 既然已讀了，刷新列表（未讀數會變）並通知紅點刷新
      loadList();
      window.dispatchEvent(new CustomEvent("inbox:refresh"));
    } catch (e) {
      if (e?.name === "AbortError") return; // 被新請求中止
      console.error("loadThread fetch failed:", e);
      setThread([]); setThreadArchived(false);
      setErrorMsg(e?.message || "連線失敗");
    } finally {
      setLoadingThread(false);
      // 滾到底
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
    }
  }

  useEffect(() => { loadMe(); loadList(); }, []);
  useEffect(() => { loadThread(activeId); }, [activeId, showArchived]);
  useEffect(() => { 
    loadList(); 
    // 當取消顯示封存時，強制清空當前內容
    if (!showArchived) {
      setThread([]);
      setThreadArchived(false);
      // 如果當前沒有選中會話，選擇第一個
      if (!activeId) {
        setTimeout(() => {
          const firstItem = list.find(item => !item.archivedForMe);
          if (firstItem) setActiveId(firstItem.cid);
        }, 100);
      }
    }
  }, [showArchived]);

  /** 封存（軟刪除）當前會話：只對自己隱藏 */
  async function archiveActive() {
    if (!activeId) return;
    const confirmed = await notify.confirm("確認封存", "確定要封存這個會話嗎？（只對你自己隱藏，可再恢復）");
    if (!confirmed) return;

    const res = await fetch("/api/messages/thread/archive", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: activeId }),
    });
    let j=null; try{ j=await res.json(); }catch{ j=null; }
    if (!res.ok || !j?.ok) {
      notify.error("封存失敗", (j && (j.error||j.message)) || `HTTP ${res.status}`);
      return;
    }
    console.log("[archive] matched=", j?.matched, "modified=", j?.modified);
    if (!j?.modified) {
      notify.warning("提示", "封存 API 沒有任何訊息被更新（modified=0）。可能是 ID 沒對上或後端條件不完整。");
    }

    setThreadArchived(true);

    // 安全模式：封存後直接從列表移除並清空右側，不立刻重抓
    setList(prev => prev.filter(x => x.cid !== activeId));
    setActiveId("");
    setThread([]);
    window.dispatchEvent(new CustomEvent("inbox:refresh"));
  }

  /** 恢復封存（把 deletedFor 的我移除） */
  async function restoreActive() {
    if (!activeId) return;
    await fetch("/api/messages/thread/restore", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: activeId }),
    });
    setThreadArchived(false);
    // 列表重新抓，確保狀態同步
    loadList();
    window.dispatchEvent(new CustomEvent("inbox:refresh"));
  }

  /** 送出回覆（同一會話內回覆；收件者由後端決定） */
  async function sendReply() {
    const body = input.trim();
    if (!body || !activeId) return;
    setInput("");
    try {
      const res = await fetch("/api/messages/reply", {
        method: "POST",
        headers: { "content-type":"application/json" },
        body: JSON.stringify({ conversationId: activeId, body })
      });
      let j=null; try{ j=await res.json(); }catch{ j=null; }
      if (!res.ok || !j?.ok) {
        notify.error("發送失敗", (j && (j.error||j.message)) || `HTTP ${res.status}`);
        return;
      }
      setThread(prev => [...prev, j.message]);
      // 更新列表：把這個會話移到頂，未讀歸零
      setList(prev => {
        const idx = prev.findIndex(x => x.cid === activeId);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], last: j.message, unread: 0 };
        const [m] = next.splice(idx,1);
        next.unshift(m);
        return next;
      });
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
      window.dispatchEvent(new CustomEvent("inbox:refresh"));
    } catch (e) {
      notify.error("發送失敗", e.message);
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 text-white">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">站內信</h1>
        <div className="flex items-center gap-3">
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={e => setShowArchived(e.target.checked)}
            />
            顯示封存
          </label>
          {isAdmin && (
            <button
              onClick={()=>setComposeOpen(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500"
            >
              ✉️ 發新信
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 左：會話列表（較窄） */}
        <aside className="md:col-span-1 rounded-2xl border border-zinc-800 overflow-hidden">
          {list.length === 0 ? (
            <div className="text-zinc-400 p-6">目前沒有訊息</div>
          ) : (
            list.map(c => (
              <LeftItem
                key={c.cid}
                item={c}
                active={c.cid === activeId}
                onClick={() => setActiveId(c.cid)}
              />
            ))
          )}
        </aside>

        {/* 右：聊天視窗（同頁一體，下方可回覆） */}
        <section className="md:col-span-2 rounded-2xl border border-zinc-800 flex flex-col min-h-[60vh]">
          {/* 標題列：主旨＋封存/恢復 */}
          <div className="px-4 py-3 border-b border-zinc-800 text-zinc-200 font-medium flex items-center">
            <span className="flex-1">
              {list.find(x=>x.cid===activeId)?.subject || "（未選擇會話）"}
            </span>
            {activeId && !threadArchived && (
              <button
                onClick={archiveActive}
                className="text-sm px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
                title="封存此會話（對自己隱藏）"
              >
                封存
              </button>
            )}
            {activeId && threadArchived && (
              <button
                onClick={restoreActive}
                className="text-sm px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
                title="恢復此會話"
              >
                恢復
              </button>
            )}
          </div>

          {/* 對話內容 */}
          <div className="flex-1 overflow-auto px-4 py-4">
            {loadingThread ? (
              <div className="text-zinc-400">載入中…</div>
            ) : errorMsg ? (
              <div className="text-red-400 text-sm">載入失敗：{String(errorMsg)}</div>
            ) : thread.length === 0 ? (
              <div className="text-zinc-400">這個會話還沒有內容</div>
            ) : (
              thread.map(m => <Bubble key={m._id} m={m} meId={meId} />)
            )}
            <div ref={chatEndRef} />
          </div>

          {/* 回覆輸入區 */}
          <div className="border-t border-zinc-800 p-3">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={e=>setInput(e.target.value)}
                rows={2}
                placeholder="輸入回覆內容…"
                className="flex-1 bg-zinc-900 rounded-xl p-2 border border-white/10 focus:outline-none"
              />
              <button
                onClick={sendReply}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
                disabled={!activeId || !input.trim()}
              >
                發送
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* 管理員專用：發新信彈窗 */}
      <AdminComposeModal
        open={composeOpen}
        onClose={()=>setComposeOpen(false)}
        onSent={() => loadList()}
      />
    </main>
  );
}
