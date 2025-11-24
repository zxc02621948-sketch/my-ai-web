"use client";

import { useState, useEffect } from "react";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { useRouter } from "next/navigation";
import { notify } from "@/components/common/GlobalNotificationManager";

export default function PrivacySettingsPage() {
  const { currentUser, setCurrentUser } = useCurrentUser();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [preferences, setPreferences] = useState({
    allowMarketingEmails: true,
    allowDataAnalytics: true,
    allowPersonalization: true,
    allowProfileIndexing: true,
  });

  // 載入用戶偏好
  useEffect(() => {
    if (currentUser === null) {
      router.push("/");
      return;
    }
    
    if (currentUser) {
      const prefs = currentUser.privacyPreferences || {};
      // ✅ 正確處理隱私設定：如果明確設置為 false，則為 false；否則為 true（默認值）
      setPreferences({
        allowMarketingEmails: prefs.allowMarketingEmails !== false,
        allowDataAnalytics: prefs.allowDataAnalytics !== false,
        allowPersonalization: prefs.allowPersonalization !== false,
        allowProfileIndexing: prefs.allowProfileIndexing !== false,
      });
      setIsLoading(false);
    }
  }, [currentUser, router]);

  const handleSave = async () => {
    if (!currentUser) return;
    
    setIsSaving(true);
    try {
      const res = await fetch("/api/user/privacy-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences }),
      });

      if (res.ok) {
        const data = await res.json();
        // ✅ 更新 currentUser 狀態，包含新的隱私設定
        if (data.success && data.preferences && currentUser) {
          setCurrentUser({
            ...currentUser,
            privacyPreferences: data.preferences
          });
        }
        notify.success("成功", "隱私設定已保存");
      } else {
        notify.error("保存失敗", "請稍後再試");
      }
    } catch (error) {
      console.error("保存隱私設定錯誤：", error);
      notify.error("錯誤", "發生錯誤");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p>載入中...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">隱私設定</h1>
          <p className="text-zinc-400">管理您的資料使用偏好</p>
        </div>

        <div className="space-y-6">
          {/* 行銷郵件 */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">📧 行銷郵件</h3>
                <p className="text-sm text-zinc-400">
                  接收平台的最新功能、活動通知和推廣資訊
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  （系統必要通知如帳號安全、警告通知不受此設定影響）
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.allowMarketingEmails}
                  onChange={(e) => setPreferences({ ...preferences, allowMarketingEmails: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* 數據分析 */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">📊 數據分析</h3>
                <p className="text-sm text-zinc-400">
                  允許我們分析您的使用行為以改善平台功能和用戶體驗
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  （關閉後您的資料將不會被納入統計分析）
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.allowDataAnalytics}
                  onChange={(e) => setPreferences({ ...preferences, allowDataAnalytics: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* 個人化推薦 */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">🎯 個人化推薦</h3>
                <p className="text-sm text-zinc-400">
                  根據您的喜好和瀏覽記錄提供個人化的內容推薦
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  （關閉後將顯示一般性內容，不會根據您的偏好調整）
                </p>
                <div className="mt-2 px-3 py-2 bg-amber-900/20 border border-amber-500/30 rounded text-xs text-amber-200">
                  💡 此功能將在未來版本中推出，目前設定會先保存以備將來使用
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.allowPersonalization}
                  onChange={(e) => setPreferences({ ...preferences, allowPersonalization: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* 搜尋引擎索引 */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">🔍 個人頁面索引</h3>
                <p className="text-sm text-zinc-400">
                  允許搜尋引擎（Google、Bing 等）索引您的個人頁面
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  （關閉後您的個人頁面將不會出現在搜尋結果中）
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.allowProfileIndexing}
                  onChange={(e) => setPreferences({ ...preferences, allowProfileIndexing: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* 說明區 */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <p className="text-blue-200 text-sm font-semibold mb-2">
              💡 關於「反對權」
            </p>
            <p className="text-zinc-300 text-sm">
              根據隱私法規，您有權反對我們將您的資料用於特定用途。
              透過以上開關，您可以隨時調整您的隱私偏好。
            </p>
          </div>

          {/* 保存按鈕 */}
          <div className="flex gap-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all"
            >
              {isSaving ? "保存中..." : "💾 保存設定"}
            </button>
            <button
              onClick={() => router.push("/settings")}
              className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-all"
            >
              ← 返回設定
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

