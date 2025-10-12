'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

export default function UnpinReminderModal({ 
  pageUserId, 
  pageUsername, 
  pageHasPlayer, 
  currentPinnedUserId,
  currentPinnedUsername,
  onUnpin 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [showReminder, setShowReminder] = useState(true);

  useEffect(() => {
    // 獲取用戶的提醒設置
    const fetchSettings = async () => {
      try {
        const res = await axios.get('/api/current-user');
        const userData = res.data.user || res.data;
        setShowReminder(userData.pinnedPlayerSettings?.showReminder !== false);
      } catch (error) {
        console.error('獲取設置失敗:', error);
      }
    };

    fetchSettings();
  }, []);

  useEffect(() => {
    // 檢查是否需要顯示提示
    // 1. 用戶已釘選播放器
    // 2. 當前頁面不是釘選的用戶頁面
    // 3. 當前頁面有播放器
    // 4. 用戶沒有選擇不再提醒
    if (
      currentPinnedUserId && 
      pageUserId !== currentPinnedUserId && 
      pageHasPlayer && 
      showReminder
    ) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [currentPinnedUserId, pageUserId, pageHasPlayer, showReminder]);

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleUnpin = async () => {
    try {
      if (dontShowAgain) {
        // 保存不再提醒設置
        await axios.patch('/api/player/pin-settings', {
          showReminder: false
        });
      }

      // 解除釘選
      await onUnpin();
      setIsOpen(false);
    } catch (error) {
      console.error('解除釘選失敗:', error);
      alert('解除釘選失敗，請稍後再試');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-md w-full p-6">
        {/* 標題 */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">💡</span>
          <h3 className="text-xl font-semibold text-white">釘選播放器提示</h3>
        </div>

        {/* 內容 */}
        <div className="mb-6 text-gray-300 space-y-3">
          <p>
            你正在釘選 <span className="text-blue-400 font-semibold">@{currentPinnedUsername}</span> 的播放器
          </p>
          <p>
            是否要關閉釘選，使用當前頁面 <span className="text-blue-400 font-semibold">@{pageUsername}</span> 的播放器？
          </p>
        </div>

        {/* 不再提醒選項 */}
        <label className="flex items-center gap-2 mb-6 text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-zinc-800 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm">不再提醒</span>
        </label>

        {/* 按鈕 */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleUnpin}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold"
          >
            關閉釘選
          </button>
        </div>
      </div>
    </div>
  );
}



