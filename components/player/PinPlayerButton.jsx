'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

export default function PinPlayerButton({ targetUserId, targetUserPlaylist, targetUsername }) {
  const [isPinned, setIsPinned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [hasPinFeature, setHasPinFeature] = useState(false);

  useEffect(() => {
    // 獲取當前用戶信息，檢查是否已釘選
    const fetchCurrentUser = async () => {
      try {
        const res = await axios.get('/api/current-user');
        const userData = res.data.user || res.data;
        setCurrentUser(userData);
        
        // 檢查是否已釘選此播放器
        if (userData.pinnedPlayer) {
          const pinnedPlayer = userData.pinnedPlayer;
          
          // 檢查是否過期
          const now = new Date();
          const expiresAt = pinnedPlayer.expiresAt ? new Date(pinnedPlayer.expiresAt) : null;
          
          if (expiresAt && expiresAt > now && String(pinnedPlayer.userId) === String(targetUserId)) {
            // 未過期且是當前用戶
            setIsPinned(true);
          } else if (expiresAt && expiresAt <= now) {
            // 已過期，自動解除釘選
            try {
              await axios.delete('/api/player/pin');
              setIsPinned(false);
              
              // 觸發全局事件
              window.dispatchEvent(new CustomEvent('pinnedPlayerChanged', { 
                detail: { isPinned: false } 
              }));
            } catch (error) {
              console.error('自動解除過期釘選失敗:', error);
            }
          }
        }
        
        // TODO: 檢查是否有釘選功能權限（需要在 User 模型中添加相應字段）
        // 暫時先設為 true，後續需要根據訂閱狀態或購買記錄判斷
        setHasPinFeature(true);
        
      } catch (error) {
        console.error('獲取用戶信息失敗:', error);
      }
    };

    fetchCurrentUser();
  }, [targetUserId]);

  const handlePin = async () => {
    if (!currentUser) {
      alert('請先登入');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/player/pin', {
        targetUserId,
        targetUsername,
        playlist: targetUserPlaylist
      });

      if (res.data.success) {
        setIsPinned(true);
        alert(`已釘選 @${targetUsername} 的播放器！\n將在全站持續播放，直到解除釘選。`);
        
        // 觸發全局事件，通知其他組件，傳遞完整的 pinnedPlayer 數據
        window.dispatchEvent(new CustomEvent('pinnedPlayerChanged', { 
          detail: { 
            isPinned: true,
            userId: targetUserId,
            username: targetUsername,
            playlist: targetUserPlaylist,
            pinnedPlayer: res.data.pinnedPlayer, // 傳遞完整的釘選數據
            expiresAt: res.data.expiresAt
          } 
        }));
      }
    } catch (error) {
      console.error('釘選失敗:', error);
      alert(error.response?.data?.error || '釘選失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleUnpin = async () => {
    setLoading(true);
    try {
      const res = await axios.delete('/api/player/pin');

      if (res.data.success) {
        setIsPinned(false);
        alert('已解除釘選播放器');
        
        // 觸發全局事件，通知其他組件
        window.dispatchEvent(new CustomEvent('pinnedPlayerChanged', { 
          detail: { isPinned: false } 
        }));
      }
    } catch (error) {
      console.error('解除釘選失敗:', error);
      alert(error.response?.data?.error || '解除釘選失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 只有在有釘選功能權限時才顯示按鈕
  if (!currentUser || !hasPinFeature) {
    return null;
  }

  return (
    <button
      onClick={isPinned ? handleUnpin : handlePin}
      disabled={loading}
      className={`w-6 h-6 rounded-full text-xs font-bold transition-all duration-200 flex items-center justify-center ${
        isPinned
          ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg'
          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'
      } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={isPinned ? '解除釘選' : '釘選播放器'}
    >
      {loading ? (
        '...'
      ) : (
        <>📌</>
      )}
    </button>
  );
}

