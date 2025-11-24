"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { notify } from "@/components/common/GlobalNotificationManager";
import axios from "axios";

export default function AccountDeletionAdminPage() {
  const router = useRouter();
  const { currentUser } = useCurrentUser();
  const [pendingDeletions, setPendingDeletions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    // 等待 currentUser 加載完成（可能是 null、undefined 或對象）
    // 如果 currentUser 是 undefined，說明還在加載中，不應該跳轉
    if (currentUser === undefined) {
      return; // 還在加載中，等待
    }

    // 如果 currentUser 是 null，說明未登入
    if (currentUser === null) {
      router.push("/");
      return;
    }

    // 檢查是否為管理員
    if (!currentUser.isAdmin) {
      notify.error("錯誤", "您沒有權限訪問此頁面");
      router.push("/");
      return;
    }

    loadPendingDeletions();
  }, [currentUser, router]);

  const loadPendingDeletions = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/admin/account-deletion/list");
      if (res.data.success) {
        setPendingDeletions(res.data.users || []);
      }
    } catch (error) {
      console.error("載入待刪除帳號失敗：", error);
      notify.error("錯誤", "載入失敗");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "無";
    const date = new Date(dateString);
    return date.toLocaleString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDaysRemaining = (dateString) => {
    if (!dateString) return 0;
    const date = new Date(dateString);
    const now = new Date();
    const diff = date - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const handleProcessDeletion = async (userId) => {
    const confirmed = await notify.confirm(
      "確認執行刪除",
      `確定要立即執行用戶 ${userId} 的帳號刪除嗎？\n\n這將永久刪除該用戶的所有數據，無法恢復。`
    );

    if (!confirmed) {
      return;
    }

    setProcessing(true);
    try {
      const res = await axios.post("/api/admin/account-deletion/process", {
        userId,
      });

      if (res.data.success) {
        notify.success("成功", "帳號已刪除");
        loadPendingDeletions();
      } else {
        notify.error("錯誤", res.data.message || "刪除失敗");
      }
    } catch (error) {
      notify.error(
        "錯誤",
        error.response?.data?.message || "刪除失敗"
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleSimulateTime = async (userId, hours) => {
    const confirmed = await notify.confirm(
      "模擬時間",
      `確定要將用戶 ${userId} 的刪除時間提前 ${hours} 小時嗎？\n\n這將用於測試刪除流程。`
    );

    if (!confirmed) {
      return;
    }

    setProcessing(true);
    try {
      const res = await axios.post("/api/admin/account-deletion/simulate-time", {
        userId,
        hours,
      });

      if (res.data.success) {
        notify.success("成功", "時間已調整");
        loadPendingDeletions();
      } else {
        notify.error("錯誤", res.data.message || "調整失敗");
      }
    } catch (error) {
      notify.error(
        "錯誤",
        error.response?.data?.message || "調整失敗"
      );
    } finally {
      setProcessing(false);
    }
  };

  // 如果還在加載中，顯示加載狀態
  if (currentUser === undefined) {
    return (
      <div className="min-h-screen bg-zinc-900 text-white flex items-center justify-center">
        <div className="text-gray-400">載入中...</div>
      </div>
    );
  }

  // 如果未登入或不是管理員，不顯示內容（useEffect 會處理跳轉）
  if (!currentUser || !currentUser.isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white mb-4 flex items-center gap-2"
          >
            ← 返回
          </button>
          <h1 className="text-3xl font-bold mb-2">帳號註銷管理</h1>
          <p className="text-gray-400">
            查看和管理待刪除的帳號（管理員專用）
          </p>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400">載入中...</div>
        ) : pendingDeletions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            目前沒有待刪除的帳號
          </div>
        ) : (
          <div className="space-y-4">
            {pendingDeletions.map((user) => {
              const daysRemaining = getDaysRemaining(user.deletionScheduledAt);
              const isOverdue = daysRemaining <= 0;

              return (
                <div
                  key={user._id}
                  className={`bg-zinc-800/60 border rounded-lg p-6 ${
                    isOverdue
                      ? "border-red-600/50 bg-red-900/10"
                      : "border-zinc-700"
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold">
                          {user.username}
                        </h3>
                        <span className="px-2 py-1 text-xs rounded bg-zinc-700">
                          {user.email}
                        </span>
                        {isOverdue && (
                          <span className="px-2 py-1 text-xs rounded bg-red-600 text-white">
                            已到期
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-400">
                        <div>
                          <span className="text-gray-500">請求時間：</span>
                          <span className="text-white ml-2">
                            {formatDate(user.deletionRequestedAt)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">刪除時間：</span>
                          <span
                            className={`ml-2 ${
                              isOverdue ? "text-red-400" : "text-white"
                            }`}
                          >
                            {formatDate(user.deletionScheduledAt)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">剩餘時間：</span>
                          <span
                            className={`ml-2 font-semibold ${
                              isOverdue
                                ? "text-red-400"
                                : daysRemaining <= 1
                                ? "text-yellow-400"
                                : "text-green-400"
                            }`}
                          >
                            {isOverdue
                              ? "已過期"
                              : `${daysRemaining} 天 (${Math.round(
                                  (daysRemaining * 24) / 24
                                )} 小時)`}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">用戶ID：</span>
                          <span className="text-white ml-2 font-mono text-xs">
                            {user._id}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => handleProcessDeletion(user._id)}
                      disabled={processing}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {processing ? "處理中..." : "立即執行刪除"}
                    </button>
                    <button
                      onClick={() => handleSimulateTime(user._id, -24)}
                      disabled={processing}
                      className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      提前 24 小時
                    </button>
                    <button
                      onClick={() => handleSimulateTime(user._id, -168)}
                      disabled={processing}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      提前 7 天（立即到期）
                    </button>
                    <button
                      onClick={() => handleSimulateTime(user._id, 168)}
                      disabled={processing}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      延後 7 天
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 bg-zinc-800/40 border border-zinc-700/60 rounded-lg p-4">
          <h3 className="font-semibold mb-2">📋 使用說明</h3>
          <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
            <li>
              <strong>立即執行刪除</strong>：立即執行該用戶的帳號刪除流程
            </li>
            <li>
              <strong>提前 24 小時</strong>：將刪除時間提前 24 小時（用於測試）
            </li>
            <li>
              <strong>提前 7 天</strong>：將刪除時間提前 7 天，使其立即到期
            </li>
            <li>
              <strong>延後 7 天</strong>：將刪除時間延後 7 天
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

