'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useCurrentUser } from '@/contexts/CurrentUserContext';

export default function PinPlayerButton({ targetUserId, targetUserPlaylist, targetUsername }) {
  const router = useRouter();
  const { currentUser, setCurrentUser, hasValidSubscription } = useCurrentUser(); // 使用 Context
  const [isPinned, setIsPinned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasPinFeature, setHasPinFeature] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false); // Hover 提示
  
  // 使用 Context 中的訂閱狀態
  const hasSubscription = hasValidSubscription('pinPlayer') || hasValidSubscription('pinPlayerTest');

  useEffect(() => {
    // 檢查是否已釘選（使用 Context 中的 currentUser）
    if (!currentUser) return;
    
    const checkPinStatus = async () => {
      try {
        const userData = currentUser;
        
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
        
        setHasPinFeature(true);
        
        // 如果訂閱過期且當前已釘選，自動解除釘選
        if (!hasSubscription && isPinned) {
          console.log('⚠️ [PinButton] 訂閱已過期，自動解除釘選');
          setIsPinned(false);
          
          // 調用 API 真正解除釘選
          try {
            await axios.delete('/api/player/pin');
            console.log('✅ [PinButton] 訂閱過期，已自動解除釘選');
          } catch (error) {
            console.error('❌ [PinButton] 自動解除釘選失敗:', error);
          }
          
          // 更新 CurrentUserContext
          if (setCurrentUser) {
            setCurrentUser(prevUser => {
              if (!prevUser) return prevUser;
              const { pinnedPlayer, ...rest } = prevUser;
              return rest;
            });
          }
          
          // 觸發解除釘選事件
          window.dispatchEvent(new CustomEvent('pinnedPlayerChanged', { 
            detail: { isPinned: false } 
          }));
        }
        
        console.log('🔍 [PinButton] 訂閱狀態:', {
          hasSubscription,
          isPinned,
          autoUnpinned: !hasSubscription && isPinned
        });
        
      } catch (error) {
        console.error('檢查釘選狀態失敗:', error);
      }
    };

    checkPinStatus();
  }, [currentUser, targetUserId, hasSubscription]);

  // 監聽全局釘選事件，更新按鈕狀態
  useEffect(() => {
    const handlePinnedChange = (event) => {
      const { isPinned: newIsPinned, userId } = event.detail;
      
      console.log('📌 [PinButton-Event] 收到釘選事件:', {
        newIsPinned,
        eventUserId: userId,
        targetUserId,
        shouldUpdate: !userId || userId === targetUserId
      });
      
      // 如果解除釘選（isPinned = false），所有按鈕都要更新
      if (!newIsPinned) {
        setIsPinned(false);
      } 
      // 如果釘選（isPinned = true），只更新對應的按鈕
      else if (userId === targetUserId) {
        setIsPinned(true);
      }
    };

    window.addEventListener('pinnedPlayerChanged', handlePinnedChange);
    return () => window.removeEventListener('pinnedPlayerChanged', handlePinnedChange);
  }, [targetUserId]);

  const handlePin = async () => {
    if (!currentUser) {
      alert('請先登入');
      return;
    }

    setLoading(true);
    try {
      console.log('📌 [PinButton] 開始釘選:', {
        targetUserId,
        targetUsername,
        playlistLength: targetUserPlaylist?.length
      });
      
      const res = await axios.post('/api/player/pin', {
        targetUserId,
        targetUsername,
        playlist: targetUserPlaylist
      });

      console.log('📌 [PinButton] API 回應:', {
        success: res.data.success,
        hasPinnedPlayer: !!res.data.pinnedPlayer,
        playlistLength: res.data.pinnedPlayer?.playlist?.length
      });

      if (res.data.success) {
        setIsPinned(true);
        alert(`已釘選 @${targetUsername} 的播放器！\n將在全站持續播放，直到解除釘選。`);
        
        // 更新 CurrentUserContext，添加釘選數據
        if (setCurrentUser) {
          setCurrentUser(prevUser => {
            if (!prevUser) return prevUser;
            console.log('🔄 [PinPlayerButton] 更新 CurrentUser，添加釘選數據:', {
              userId: targetUserId,
              username: targetUsername,
              playlistLength: res.data.pinnedPlayer?.playlist?.length
            });
            return {
              ...prevUser,
              pinnedPlayer: res.data.pinnedPlayer
            };
          });
        }
        
        console.log('📡 [PinButton] 觸發 pinnedPlayerChanged 事件:', {
          isPinned: true,
          pinnedPlayer: res.data.pinnedPlayer,
          playlistLength: res.data.pinnedPlayer?.playlist?.length
        });
        
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
        
        console.log('✅ [PinButton] 事件觸發完成');
      }
    } catch (error) {
      console.error('❌ [PinButton] 釘選失敗:', error);
      
      // 檢查是否需要訂閱
      if (error.response?.data?.needSubscription) {
        const goToStore = confirm(
          '釘選播放器需要訂閱才能使用。\n\n' +
          '💰 每月僅需 200 積分（可通過互動免費獲得）\n' +
          '✨ 累積制續費，剩餘時間會延長\n\n' +
          '是否前往積分商店開通訂閱？'
        );
        
        if (goToStore) {
          router.push('/store');
        }
      } 
      // 檢查是否需要續費
      else if (error.response?.data?.needRenew) {
        const goToStore = confirm(
          '您的釘選播放器訂閱已過期！\n\n' +
          '💰 續費僅需 200 積分\n' +
          '✨ 累積制續費，剩餘時間會延長\n\n' +
          '是否前往積分商店續費？'
        );
        
        if (goToStore) {
          router.push('/store');
        }
      } 
      else {
        alert(error.response?.data?.error || '釘選失敗，請稍後再試');
      }
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
        
        // 更新 CurrentUserContext，移除釘選數據
        if (setCurrentUser) {
          setCurrentUser(prevUser => {
            if (!prevUser) return prevUser;
            const { pinnedPlayer, ...rest } = prevUser;
            console.log('🔄 [PinPlayerButton] 更新 CurrentUser，移除釘選數據');
            return rest;
          });
        }
        
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

  // 未訂閱時顯示鎖定按鈕
  if (!hasSubscription && !isPinned) {
    return (
      <div 
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <button
          onClick={() => {
            if (confirm('釘選播放器需要訂閱才能使用。\n\n💰 每月僅需 200 積分（可通過互動免費獲得）\n✨ 累積制續費，剩餘時間會延長\n\n是否前往積分商店開通訂閱？')) {
              router.push('/store');
            }
          }}
          className="w-6 h-6 rounded-full text-xs font-bold transition-all duration-200 flex items-center justify-center bg-gray-600 hover:bg-gray-500 text-gray-300 shadow-lg opacity-60"
          title="需要訂閱"
        >
          🔒
        </button>
        
        {/* Hover 提示框 */}
        {showTooltip && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-600 rounded-lg p-3 w-56 shadow-xl z-50 pointer-events-none">
            <p className="text-xs text-gray-200 font-medium mb-1">
              💡 釘選播放器
            </p>
            <p className="text-xs text-gray-400 mb-2">
              全站播放你喜歡的音樂！
            </p>
            <div className="text-xs text-blue-400">
              點擊前往訂閱 (200 積分/月)
            </div>
          </div>
        )}
      </div>
    );
  }

  // 已訂閱或已釘選時顯示正常按鈕
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

