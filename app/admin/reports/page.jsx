// app/admin/reports/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import CATEGORIES from "@/constants/categories"; // ← 分類清單（統一來源）

// === Added helpers: 中文理由與模板選擇（最小改動） ===
const REASON_LABELS = {
  policy_violation: "站規違規",
  category_wrong: "分類錯誤",
  rating_wrong:   "分級錯誤",
  duplicate:      "重複/洗版",
  broken:         "壞圖/無法顯示",
  other:          "其他",
};

function buildChineseReason(report, note = "") {
  const types = Array.isArray(report?.types) ? report.types : (report?.type ? [report.type] : []);
  const labels = types.map(t => REASON_LABELS[t] || t);
  const parts = [];
  if (labels.length) parts.push(`檢舉人舉報原因：${labels.join("、")}`);
  const extra = (note || report?.message || "").trim();
  if (extra) parts.push(`違規說明：${extra}`);
  return parts.join("\n");
}

function chooseActionKey(report, action) {
  const types = Array.isArray(report?.types) ? report.types : (report?.type ? [report.type] : []);
  const set = new Set(types);
  if (action === "delete") {
    if (set.has("category_wrong"))   return "takedown.category_wrong";
    if (set.has("rating_wrong"))     return "takedown.rating_wrong";
    if (set.has("duplicate"))        return "takedown.duplicate";
    if (set.has("broken"))           return "takedown.broken";
    if (set.has("policy_violation")) return "takedown.policy_violation";
    return "takedown.generic";
  }
  if (action === "reclassify") return "recat.nsfw_to_sfw";
  if (action === "rerate")     return "rerate.fix_label";
  return "takedown.generic";
}

// 你的模板白名單（先含你確定可用的 key；不存在就退回 nsfw_in_sfw）
const KNOWN_TEMPLATES = new Set([
  "takedown.nsfw_in_sfw",
  "takedown.generic",
  "takedown.category_wrong",
  "takedown.rating_wrong",
  "takedown.duplicate",
  "takedown.broken",
  "takedown.policy_violation",
  "recat.nsfw_to_sfw",
  "rerate.fix_label",
]);
function ensureKnownTemplate(key) {
  return KNOWN_TEMPLATES.has(key) ? key : "takedown.nsfw_in_sfw";
}
// === /Added helpers ===


/** 分級：與站內一致 */
const RATING_OPTIONS = ["一般", "15", "18"];

/** 類型/狀態中文對照 */
const TYPE_OPTIONS = [
  { value: "",                 label: "全部類型" },
  { value: "category_wrong",   label: "分類錯誤" },
  { value: "rating_wrong",     label: "分級錯誤" },
  { value: "duplicate",        label: "重複/洗版" },
  { value: "broken",           label: "壞圖/無法顯示" },
  { value: "policy_violation", label: "站規違規" },
  { value: "other",            label: "其他" },
  { value: "discussion_post",    label: "💬 討論帖子" },
  { value: "discussion_comment", label: "💬 討論評論" },
  { value: "image_comment",      label: "💬 圖片留言" },
];
const TYPE_LABELS = TYPE_OPTIONS.reduce((m, o) => (o.value && (m[o.value] = o.label), m), {});

const STATUS_OPTIONS = [
  { value: "",               label: "全部狀態" },
  { value: "open",           label: "待處理" },
  { value: "action_taken",   label: "已處置" },
  { value: "rejected",       label: "已駁回" },
  { value: "closed",         label: "已結案" },
];
const STATUS_LABELS = STATUS_OPTIONS.reduce((m, o) => (o.value && (m[o.value] = o.label), m), {});

// 嘗試抓圖片詳細資料（縮圖/作者等）
async function fetchImageInfo(imageId) {
  try {
    const r = await fetch(`/api/images/${imageId}`, { cache: "no-store" });
    const j = await r.json();
    return j?.image || null; // 期望包含 imageUrl / category / rating / userId or user._id
  } catch {
    return null;
  }
}

// 獲取討論區內容詳細資料
async function fetchDiscussionContent(targetId, type) {
  try {
    if (type === 'discussion_post') {
      const r = await fetch(`/api/discussion/posts/${targetId}`, { cache: "no-store" });
      const j = await r.json();
      if (j?.data) {
        // 添加 authorName 以便顯示
        return {
          ...j.data,
          authorName: j.data.author?.username || '未知用戶'
        };
      }
      return null;
    } else if (type === 'discussion_comment') {
      const r = await fetch(`/api/discussion/comments/${targetId}`, { cache: "no-store" });
      const j = await r.json();
      return j?.comment || null;
    } else if (type === 'image_comment') {
      // 獲取圖片留言內容 - 使用專用的單個留言 API
      const r = await fetch(`/api/comments/single/${targetId}`, { cache: "no-store" });
      const j = await r.json();
      return j?.comment || null;
    }
    return null;
  } catch {
    return null;
  }
}

export default function AdminReportsPage() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [type, setType] = useState("");
  const [status, setStatus] = useState("open");
  const [imageIdQuery, setImageIdQuery] = useState("");
  const [imgCache, setImgCache] = useState({}); // imageId -> imageInfo
  const [discussionCache, setDiscussionCache] = useState({}); // targetId -> discussion content

  // 彈窗（含刪除/改分類/改分級）
  const [editModal, setEditModal] = useState({ open: false, mode: null, report: null });
  const [newCategory, setNewCategory] = useState("");
  const [newRating, setNewRating] = useState("18");
  
  // 通用確認/通知彈窗
  const [notificationModal, setNotificationModal] = useState({ 
    open: false, 
    type: 'info', // 'info' | 'success' | 'error' | 'confirm'
    title: '', 
    message: '', 
    onConfirm: null 
  });

  // 警告選項（彈窗內可調整）
  const [sendWarning, setSendWarning] = useState(false);
  const [warningDays, setWarningDays] = useState(60);
  const [warningNote, setWarningNote] = useState("");

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
        if (type) params.set("type", type);
        if (status) params.set("status", status);
        if (imageIdQuery) params.set("imageId", imageIdQuery);

        const r = await fetch(`/api/reports?${params.toString()}`, { cache: "no-store" });
        const j = await r.json();
        if (!r.ok || !j?.ok) throw new Error(j?.message || `HTTP ${r.status}`);
        setItems(j.items || []);
        setTotal(j.total || 0);

        // 抓縮圖/基本資料快取
        const needFetch = (j.items || [])
          .filter(it => it.imageId)
          .map(it => String(it.imageId))
          .filter(id => !(id in imgCache));
        if (needFetch.length) {
          const newCache = { ...imgCache };
          await Promise.all(needFetch.map(async (id) => {
            const info = await fetchImageInfo(id);
            if (info) newCache[id] = info;
          }));
          setImgCache(newCache);
        }

        // 抓討論區和留言內容快取
        const needFetchDiscussion = (j.items || [])
          .filter(it => (it.type === 'discussion_post' || it.type === 'discussion_comment' || it.type === 'image_comment') && it.targetId)
          .map(it => ({ id: String(it.targetId), type: it.type }))
          .filter(({ id }) => !(id in discussionCache));
        if (needFetchDiscussion.length) {
          const newCache = { ...discussionCache };
          await Promise.all(needFetchDiscussion.map(async ({ id, type }) => {
            const content = await fetchDiscussionContent(id, type);
            if (content) newCache[id] = content;
          }));
          setDiscussionCache(newCache);
        }
      } catch (e) {
        showNotification('error', '載入失敗', e.message || '載入檢舉列表失敗');
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, type, status, imageIdQuery]);

  const refresh = () => {
    const p = page; setPage(p === 1 ? 2 : 1); setPage(p);
  };

  // 彈窗輔助函數
  const showNotification = (type, title, message) => {
    setNotificationModal({ open: true, type, title, message, onConfirm: null });
  };

  const showConfirm = (title, message, onConfirm) => {
    setNotificationModal({ open: true, type: 'confirm', title, message, onConfirm });
  };

  const closeNotification = () => {
    setNotificationModal({ open: false, type: 'info', title: '', message: '', onConfirm: null });
  };

  function resetWarningOptions() {
    setSendWarning(false);
    setWarningDays(60);
    setWarningNote("");
  }
  function closeModal() {
    setEditModal({ open: false, mode: null, report: null });
    resetWarningOptions();
  }

  async function updateReportStatus(reportId, newStatus) {
    try {
      const r = await fetch(`/api/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ status: newStatus }),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.message || `HTTP ${r.status}`);
      return true;
    } catch (e) {
      showNotification('error', '更新失敗', e.message || '更新狀態失敗');
      return false;
    }
  }

  // 既有管理 API：/api/delete-image
  async function doModerationAction({ imageId, reportId, action, reasonCode, newCategory, newRating, note = "", notify = true, actionKey }) {
    const token = document.cookie.match(/token=([^;]+)/)?.[1];

    if (!token) throw new Error("找不到登入憑證（token）");
    // 對應模板 key（與後端 notifTemplates 一致，可依實際需求調整）
    const actionKeyMap = {
      delete: "takedown.nsfw_in_sfw",
      reclassify: "recat.nsfw_to_sfw",
      rerate: "rerate.fix_label",
    };

    const payload = {
      imageId,
      reportId,
      notify,                                   // 是否同時寄站內信（後端 v9）
      actionKey: actionKey || actionKeyMap[action] || "takedown.generic",
      reason: note, // 我們會在呼叫端用 buildChineseReason() 組成中文再丟進來
      // 向後相容舊後端欄位（保留，不影響 v9）
      adminModeration: true,
      adminAction: action, // 'delete' | 'reclassify' | 'rerate'
      reasonCode,          // 'policy_violation' | 'category_wrong' | 'rating_wrong'
      note,
    };
    if (action === "reclassify") payload.newCategory = newCategory;
    if (action === "rerate") payload.newRating = newRating;

    const r = await fetch("/api/delete-image", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      cache: "no-store",
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.ok === false) throw new Error(j?.message || `HTTP ${r.status}`);
    return j;
  }

  // 發警告（Strike）
  async function postWarning({ userId, reasonCode, imageId, reportId, days = 60, note = "" }) {
    const token = document.cookie.match(/token=([^;]+)/)?.[1];
    if (!token) throw new Error("找不到登入憑證（token）");
    const r = await fetch("/api/warnings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ userId, reasonCode, imageId, reportId, days, note, sendMessage: true }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.ok === false) throw new Error(j?.message || `HTTP ${r.status}`);
    return j;
  }

  // 取得圖片作者 ID
  function getAuthorId(imageId) {
    const info = imgCache[String(imageId)];
    return info?.userId || info?.user?._id || null;
  }

  // 刪除：改為先開彈窗（可勾選是否寄警告）
  function openDelete(report) {
    setEditModal({ open: true, mode: "delete", report });
    resetWarningOptions();
  }
  async function confirmDelete() {
    const report = editModal.report;
    if (!report) return;
    try {
      await doModerationAction({
        imageId: report.imageId,
        reportId: report._id,
        action: "delete",
        reasonCode: "policy_violation",
        notify: true,
        note: buildChineseReason(report, warningNote),
        actionKey: ensureKnownTemplate(chooseActionKey(report, "delete")),
      });
      if (sendWarning) {
        const userId = getAuthorId(report.imageId);
        if (userId) {
          await postWarning({
            userId,
            reasonCode: "policy_violation",
            imageId: report.imageId,
            reportId: report._id,
            days: warningDays,
            note: warningNote,
          });
        }
      }
      await updateReportStatus(report._id, "已處置");
      await updateReportStatus(report._id, "action_taken"); // 顯示中文，但實際值用英文
      showNotification('success', '刪除成功', '圖片已刪除並標記為已處置');
      closeModal();
      refresh();
    } catch (e) {
      showNotification('error', '刪除失敗', e.message || '刪除操作失敗');
    }
  }

  // 改分類
  function openReclassify(report) {
    const current = imgCache[String(report.imageId)];
    const merged = Array.from(new Set([...(current?.category ? [current.category] : []), ...CATEGORIES]));
    setNewCategory(merged[0] || "");
    setEditModal({ open: true, mode: "reclassify", report });
    resetWarningOptions();
  }
  async function confirmReclassify() {
    const report = editModal.report;
    if (!report || !newCategory) return;
    try {
      await doModerationAction({
        imageId: report.imageId,
        reportId: report._id,
        action: "reclassify",
        reasonCode: "category_wrong",
        newCategory,
        notify: true,
        note: buildChineseReason(report, warningNote),
        actionKey: ensureKnownTemplate(chooseActionKey(report, "reclassify")),
      });
      if (sendWarning) {
        const userId = getAuthorId(report.imageId);
        if (userId) {
          await postWarning({
            userId,
            reasonCode: "category_wrong",
            imageId: report.imageId,
            reportId: report._id,
            days: warningDays,
            note: warningNote,
          });
        }
      }
      await updateReportStatus(report._id, "action_taken");
      showNotification('success', '分類成功', '圖片已重新分類並標記為已處置');
      closeModal();
      refresh();
    } catch (e) {
      showNotification('error', '分類失敗', e.message || '重新分類操作失敗');
    }
  }

  // 改分級
  function openRerate(report) {
    const current = imgCache[String(report.imageId)];
    const initial = RATING_OPTIONS.includes(current?.rating) ? current.rating : "18";
    setNewRating(initial);
    setEditModal({ open: true, mode: "rerate", report });
    resetWarningOptions();
  }
  async function confirmRerate() {
    const report = editModal.report;
    if (!report || !newRating) return;
    try {
      await doModerationAction({
        imageId: report.imageId,
        reportId: report._id,
        action: "rerate",
        reasonCode: "rating_wrong",
        newRating,
        notify: true,
        note: buildChineseReason(report, warningNote),
        actionKey: ensureKnownTemplate(chooseActionKey(report, "rerate")),
      });
      if (sendWarning) {
        const userId = getAuthorId(report.imageId);
        if (userId) {
          await postWarning({
            userId,
            reasonCode: "rating_wrong",
            imageId: report.imageId,
            reportId: report._id,
            days: warningDays,
            note: warningNote,
          });
        }
      }
      await updateReportStatus(report._id, "action_taken");
      showNotification('success', '分級成功', '圖片已調整分級並標記為已處置');
      closeModal();
      refresh();
    } catch (e) {
      showNotification('error', '分級失敗', e.message || '調整分級操作失敗');
    }
  }

  async function onReject(report) {
    showConfirm(
      '確認駁回',
      '確定要駁回這則檢舉嗎？',
      async () => {
        const ok = await updateReportStatus(report._id, "rejected");
        if (ok) {
          showNotification('success', '已駁回', '檢舉已標記為駁回');
          refresh();
        }
        closeNotification();
      }
    );
  }

  // 刪除討論區內容或圖片留言（帖子/評論/留言）
  async function deleteDiscussionContent(report) {
    const contentType = report.type === 'discussion_post' ? '帖子' : 
                        report.type === 'discussion_comment' ? '評論' : '留言';
    
    showConfirm(
      '確認刪除',
      `確定要刪除這則${contentType}嗎？此操作無法復原。`,
      async () => {
        try {
          const token = document.cookie.match(/token=([^;]+)/)?.[1];
          if (!token) throw new Error("找不到登入憑證");

          let endpoint = '';
          if (report.type === 'discussion_post') {
            endpoint = `/api/discussion/posts/${report.targetId}`;
          } else if (report.type === 'discussion_comment') {
            endpoint = `/api/discussion/comments/${report.targetId}`;
          } else if (report.type === 'image_comment') {
            endpoint = `/api/delete-comment/${report.targetId}`;
          }

          const r = await fetch(endpoint, {
            method: "DELETE",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            cache: "no-store"
          });

          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j?.error || j?.message || `HTTP ${r.status}`);

          // 更新檢舉狀態為已處置
          await updateReportStatus(report._id, "action_taken");
          closeNotification();
          showNotification('success', '刪除成功', `${contentType}已刪除並標記為已處置`);
          refresh();
        } catch (e) {
          closeNotification();
          showNotification('error', '刪除失敗', e.message || '刪除操作失敗');
        }
      }
    );
  }

  return (
    <div className="p-4 text-zinc-100">
      <h1 className="text-2xl font-bold mb-4">檢舉列表</h1>

      {/* 篩選列 */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <select
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2"
          value={type}
          onChange={(e) => { setPage(1); setType(e.target.value); }}
        >
          {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2"
          value={status}
          onChange={(e) => { setPage(1); setStatus(e.target.value); }}
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <input
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 w-64"
          placeholder="以 Image ID 篩選"
          value={imageIdQuery}
          onChange={(e) => setImageIdQuery(e.target.value)}
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

      {/* 表格 */}
      <div className="overflow-auto rounded-xl border border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-900">
            <tr className="[&>th]:px-3 [&>th]:py-2 text-left">
              <th>圖片</th>
              <th>類型</th>
              <th>狀態</th>
              <th>說明</th>
              <th>建立時間</th>
              <th className="w-64">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="text-center py-6 text-zinc-400">沒有符合條件的檢舉</td>
              </tr>
            )}
            {items.map((r) => {
              const isDiscussion = r.type === 'discussion_post' || r.type === 'discussion_comment' || r.type === 'image_comment';
              const imgInfo = imgCache[String(r.imageId)];
              const thumb = imgInfo?.imageUrl || "";
              const discussionContent = isDiscussion ? discussionCache[String(r.targetId)] : null;
              
              return (
                <tr key={r._id} className="border-t border-zinc-800 hover:bg-zinc-900/50">
                  <td className="px-3 py-2">
                    {isDiscussion ? (
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 bg-zinc-800 rounded overflow-hidden flex items-center justify-center">
                          <span className="text-2xl">💬</span>
                        </div>
                        <div className="text-xs text-zinc-400 max-w-[200px]">
                          <div className="font-semibold text-zinc-200 mb-1">
                            {r.type === 'discussion_post' ? '討論帖子' : r.type === 'discussion_comment' ? '討論評論' : '圖片留言'}
                          </div>
                          {discussionContent ? (
                            <>
                              {r.type === 'discussion_post' && (
                                <>
                                  <div className="text-zinc-300 font-medium truncate">
                                    標題: {discussionContent.title || '無標題'}
                                  </div>
                                  <div className="text-zinc-400 text-xs line-clamp-2 mt-1">
                                    {discussionContent.content?.substring(0, 80) || '無內容'}...
                                  </div>
                                </>
                              )}
                              {r.type === 'discussion_comment' && (
                                <div className="text-zinc-400 text-xs line-clamp-3">
                                  {discussionContent.content?.substring(0, 100) || '無內容'}...
                                </div>
                              )}
                              {r.type === 'image_comment' && (
                                <div className="text-zinc-400 text-xs line-clamp-3">
                                  {discussionContent.text?.substring(0, 100) || '無內容'}...
                                </div>
                              )}
                              <div className="text-zinc-500 text-xs mt-1">
                                作者: {discussionContent.userName || discussionContent.authorName || discussionContent.author?.username || '未知'}
                              </div>
                            </>
                          ) : (
                            <div className="text-red-400 text-xs">⚠️ 內容已被刪除或不存在</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 bg-zinc-800 rounded overflow-hidden flex items-center justify-center">
                          {thumb ? (
                            <img src={thumb} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs text-zinc-400 px-1">#{String(r.imageId).slice(-6)}</span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-400">
                          <div>ID: <span className="font-mono">{String(r.imageId)}</span></div>
                          {imgInfo && (
                            <>
                              <div>分類：{imgInfo.category ?? "-"}</div>
                              <div>分級：{imgInfo.rating ?? "-"}</div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-1 rounded bg-zinc-800">
                      {TYPE_LABELS[r.type] || r.type}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-1 rounded bg-zinc-800">
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 max-w-[320px]">
                    <div className="space-y-2">
                      {/* 被檢舉的內容（留言/討論區） */}
                      {isDiscussion && discussionContent && (
                        <>
                          <div className="text-sm text-rose-400 font-semibold">被檢舉的內容:</div>
                          <div className="text-zinc-300 text-sm line-clamp-2 bg-zinc-800/50 p-2 rounded border-l-2 border-rose-500">
                            {r.type === 'discussion_post' && discussionContent.title && (
                              <div className="font-medium mb-1">「{discussionContent.title}」</div>
                            )}
                            {r.type === 'discussion_post' && discussionContent.content && (
                              <div className="text-xs">{discussionContent.content.substring(0, 80)}...</div>
                            )}
                            {r.type === 'discussion_comment' && discussionContent.content && (
                              <div className="text-xs">{discussionContent.content.substring(0, 100)}...</div>
                            )}
                            {r.type === 'image_comment' && discussionContent.text && (
                              <div className="text-xs">「{discussionContent.text.substring(0, 100)}」</div>
                            )}
                          </div>
                        </>
                      )}
                      
                      {/* 檢舉原因 */}
                      <div className="text-sm text-amber-400 font-semibold">檢舉原因:</div>
                      <div className="text-zinc-300 text-sm line-clamp-3">
                        {r.message || r.details || <span className="text-zinc-500">—</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      {isDiscussion ? (
                        <>
                          {/* 討論區檢舉：直接刪除 */}
                          <button
                            className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500"
                            onClick={() => deleteDiscussionContent(r)}
                            disabled={loading || !discussionContent}
                            title={discussionContent ? "刪除此內容並標記為已處置" : "內容已不存在"}
                          >
                            刪除
                          </button>
                          <button
                            className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-500"
                            onClick={() => {
                              // 對於評論，需要找到所屬的帖子
                              let url = '';
                              if (r.type === 'discussion_post') {
                                url = `/discussion/${r.targetId}`;
                              } else if (r.type === 'discussion_comment' && discussionContent?.postId) {
                                url = `/discussion/${discussionContent.postId}`;
                              } else {
                                showNotification('error', '無法定位', '無法定位到討論頁面');
                                return;
                              }
                              window.open(url, '_blank');
                            }}
                            disabled={loading}
                            title="在新視窗查看完整討論"
                          >
                            查看
                          </button>
                          <button
                            className="px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600"
                            onClick={() => onReject(r)}
                            disabled={loading}
                            title="駁回此檢舉"
                          >
                            駁回
                          </button>
                        </>
                      ) : (
                        <>
                          {/* 圖片檢舉：原有的操作 */}
                          <button
                            className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500"
                            onClick={() => openDelete(r)}
                            disabled={loading}
                            title="刪除圖片（可選擇是否寄出警告）"
                          >
                            刪除
                          </button>
                          <button
                            className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500"
                            onClick={() => openReclassify(r)}
                            disabled={loading}
                            title="重新分類（可選擇是否寄出警告）"
                          >
                            改分類
                          </button>
                          <button
                            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500"
                            onClick={() => openRerate(r)}
                            disabled={loading}
                            title="調整分級（可選擇是否寄出警告）"
                          >
                            改分級
                          </button>
                          <button
                            className="px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600"
                            onClick={() => onReject(r)}
                            disabled={loading}
                            title="駁回此檢舉"
                          >
                            駁回
                          </button>
                        </>
                      )}
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

      {/* 刪除 / 改分類 / 改分級：統一彈窗（含警告選項） */}
      {editModal.open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-zinc-900 rounded-2xl p-4 w-full max-w-md">
            <div className="text-lg font-semibold mb-3">
              {editModal.mode === "reclassify"
                ? "重新分類"
                : editModal.mode === "rerate"
                ? "調整分級"
                : "刪除圖片"}
            </div>

            {/* 內容：依模式顯示選單 */}
            {editModal.mode === "reclassify" && (
              <select
                className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 mb-3"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              >
                {Array.from(new Set([
                  ...(imgCache[String(editModal.report?.imageId)]?.category
                    ? [imgCache[String(editModal.report?.imageId)].category]
                    : []),
                  ...CATEGORIES,
                ])).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}

            {editModal.mode === "rerate" && (
              <select
                className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 mb-3"
                value={newRating}
                onChange={(e) => setNewRating(e.target.value)}
              >
                {RATING_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            )}

            {editModal.mode === "delete" && (
              <div className="text-sm text-zinc-300 mb-3">
                你正要刪除這張圖片。此動作無法復原。
              </div>
            )}

            {/* 警告選項（共用） */}
            <div className="mt-2 space-y-2 border-t border-zinc-700 pt-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sendWarning}
                  onChange={(e) => setSendWarning(e.target.checked)}
                />
                同時寄出警告（兩個月內累積滿 3 支將永久鎖帳）
              </label>
              {sendWarning && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-300">有效天數</span>
                    <input
                      type="number"
                      min={1}
                      className="w-24 bg-zinc-800 border border-zinc-700 rounded px-2 py-1"
                      value={warningDays}
                      onChange={(e) => setWarningDays(Math.max(1, parseInt(e.target.value || "60", 10)))}
                    />
                    <span className="text-sm text-zinc-400">天（預設 60）</span>
                  </div>
                  <textarea
                    className="w-full p-2 rounded bg-zinc-800 border border-zinc-700"
                    rows={2}
                    placeholder="管理員備註（可選）"
                    value={warningNote}
                    onChange={(e) => setWarningNote(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-3">
              <button
                className="px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600"
                onClick={closeModal}
              >
                取消
              </button>
              {editModal.mode === "reclassify" ? (
                <button
                  className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500"
                  onClick={confirmReclassify}
                >
                  確認
                </button>
              ) : editModal.mode === "rerate" ? (
                <button
                  className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500"
                  onClick={confirmRerate}
                >
                  確認
                </button>
              ) : (
                <button
                  className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500"
                  onClick={confirmDelete}
                >
                  確認刪除
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 通用通知/確認彈窗 */}
      {notificationModal.open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-zinc-700">
            {/* 圖示 */}
            <div className="flex justify-center mb-4">
              {notificationModal.type === 'success' && (
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                  <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              {notificationModal.type === 'error' && (
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                  <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}
              {notificationModal.type === 'confirm' && (
                <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              )}
              {notificationModal.type === 'info' && (
                <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}
            </div>

            {/* 標題 */}
            <div className="text-xl font-bold mb-2 text-center text-white">
              {notificationModal.title}
            </div>

            {/* 訊息 */}
            <div className="text-sm text-zinc-300 mb-6 text-center">
              {notificationModal.message}
            </div>

            {/* 按鈕 */}
            <div className="flex justify-center gap-3">
              {notificationModal.type === 'confirm' ? (
                <>
                  <button
                    className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white font-medium transition-colors"
                    onClick={closeNotification}
                  >
                    取消
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium transition-colors"
                    onClick={() => {
                      if (notificationModal.onConfirm) {
                        notificationModal.onConfirm();
                      }
                    }}
                  >
                    確認
                  </button>
                </>
              ) : (
                <button
                  className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                  onClick={closeNotification}
                >
                  確定
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
