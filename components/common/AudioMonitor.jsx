"use client";

import { useState, useEffect } from 'react';

export default function AudioMonitor() {
  const [audioCount, setAudioCount] = useState(0);
  const [videoCount, setVideoCount] = useState(0);
  const [youtubeCount, setYoutubeCount] = useState(0);
  const [playingCount, setPlayingCount] = useState(0);

  useEffect(() => {
    let lastState = { audioCount: 0, videoCount: 0, youtubeCount: 0, playingCount: 0 };
    
    const checkAudioElements = () => {
      try {
        // 檢查所有音頻元素
        const audioElements = document.querySelectorAll('audio');
        const playingAudio = Array.from(audioElements).filter(audio => !audio.paused);
        
        // 檢查所有視頻元素
        const videoElements = document.querySelectorAll('video');
        const playingVideo = Array.from(videoElements).filter(video => !video.paused);
        
        // 檢查所有 YouTube iframe
        const youtubeIframes = document.querySelectorAll('iframe[src*="youtube.com"], iframe[src*="youtu.be"]');
        
        const currentState = {
          audioCount: audioElements.length,
          videoCount: videoElements.length,
          youtubeCount: youtubeIframes.length,
          playingCount: playingAudio.length + playingVideo.length
        };
        
        // 只在狀態有變化時才更新和記錄
        const hasChanged = 
          lastState.audioCount !== currentState.audioCount ||
          lastState.videoCount !== currentState.videoCount ||
          lastState.youtubeCount !== currentState.youtubeCount ||
          lastState.playingCount !== currentState.playingCount;
        
        if (hasChanged) {
          setAudioCount(currentState.audioCount);
          setVideoCount(currentState.videoCount);
          setYoutubeCount(currentState.youtubeCount);
          setPlayingCount(currentState.playingCount);
          
          // 只在有問題時才輸出詳細日誌
          if (currentState.youtubeCount > 1 || currentState.playingCount > 1) {
            console.log("🔊 聲音監控變化:", {
              audioElements: currentState.audioCount,
              playingAudio: playingAudio.length,
              videoElements: currentState.videoCount,
              playingVideo: playingVideo.length,
              youtubeIframes: currentState.youtubeCount,
              totalPlaying: currentState.playingCount
            });
          }
          
          lastState = currentState;
        }
      } catch (error) {
        console.warn("🔊 聲音監控錯誤:", error.message);
      }
    };

    // 初始檢查
    checkAudioElements();
    
    // 每 500ms 檢查一次
    const interval = setInterval(checkAudioElements, 500);
    
    // 監聽頁面變化
    const observer = new MutationObserver(checkAudioElements);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src']
    });
    
    return () => {
      clearInterval(interval);
      observer.disconnect();
    };
  }, []);

  // 只在開發環境顯示
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '8px 12px',
      borderRadius: '6px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 9999,
      border: playingCount > 1 ? '2px solid #ff4444' : '1px solid #333',
      boxShadow: playingCount > 1 ? '0 0 10px #ff4444' : '0 2px 4px rgba(0,0,0,0.3)'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
        🔊 聲音監控 {playingCount > 1 && '⚠️'}
      </div>
      <div>音頻: {audioCount} ({playingCount} 播放中)</div>
      <div>視頻: {videoCount}</div>
      <div>YouTube: {youtubeCount}</div>
      {playingCount > 1 && (
        <div style={{ color: '#ff4444', fontWeight: 'bold', marginTop: '4px' }}>
          ⚠️ 多個聲音同時播放！
        </div>
      )}
    </div>
  );
}
