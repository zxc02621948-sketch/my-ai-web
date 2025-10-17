'use client';

import { useState, useEffect } from 'react';

export default function MiniPlayerArt({ isPlaying, theme = 'default' }) {
  const [colorShift, setColorShift] = useState(0);

  // 溫和的彩色變換效果 - 只在透明區域
  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setColorShift(prev => (prev + 8) % 360); // 放慢變色速度，更溫和
      }, 200); // 更慢的變色節奏，更流順
      return () => clearInterval(interval);
    } else {
      setColorShift(0);
    }
  }, [isPlaying]);

  // 主題色彩配置
  const themeFilters = {
    default: 'hue-rotate(0deg) saturate(1) brightness(1)',
    pink: 'hue-rotate(300deg) saturate(1.3) brightness(1.1)',
    blue: 'hue-rotate(200deg) saturate(1.2) brightness(1.05)',
    green: 'hue-rotate(120deg) saturate(1.1) brightness(1.05)',
    purple: 'hue-rotate(250deg) saturate(1.4) brightness(1.1)',
    rainbow: `hue-rotate(${colorShift}deg) saturate(1.2) brightness(1.1)`
  };

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible' }}>
      {/* 貓咪耳機主體 */}
      <div className="relative w-full h-full" style={{ overflow: 'visible' }}>
          {/* 貓咪耳機容器 - 包含 RGB 流光和耳機圖片 */}
          <div 
            className="absolute left-1/2 top-1/2 transition-all duration-300 ease-out"
            style={{ 
              transform: `translate(-50%, -50%) ${isPlaying ? 'scale(0.7)' : 'scale(1)'}`,
              isolation: 'isolate',
              overflow: 'visible',
              width: '80px',
              height: '80px'
            }}
          >
          {/* 貓咪耳機圖片 - 根據播放狀態切換 */}
          <img 
            src={isPlaying ? "/cat-headphone-animated.png" : "/cat-headphone.png"}
            alt="貓咪耳機"
            className="w-full h-full relative object-contain"
            style={{ 
              filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.2))',
              zIndex: 1
            }}
          />
        </div>
        
      </div>

      {/* 音符動畫 - 只在播放時顯示 */}
      {isPlaying && (
        <>
          {/* 音符 1 - 右上飄動 */}
          <div 
            className="absolute text-2xl animate-float-1"
            style={{ 
              top: '10px', 
              right: '15px',
              color: '#FF6B9D',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}
          >
            ♪
          </div>
          
          {/* 音符 2 - 左上飄動 */}
          <div 
            className="absolute text-xl animate-float-2"
            style={{ 
              top: '35px', 
              left: '5px',
              color: '#4ECDC4',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}
          >
            ♫
          </div>
          
          {/* 音符 3 - 右下飄動 */}
          <div 
            className="absolute text-lg animate-float-3"
            style={{ 
              bottom: '45px', 
              right: '8px',
              color: '#FFD93D',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}
          >
            ♬
          </div>
          
          {/* 音符 4 - 左中飄動 */}
          <div 
            className="absolute text-sm animate-float-4"
            style={{ 
              top: '60px', 
              left: '8px',
              color: '#FF9FF3',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}
          >
            ♩
          </div>
        </>
      )}

      {/* 音波效果 - 播放時的動態圓圈 */}
      {isPlaying && (
        <div className="absolute left-[70px] top-[70px]">
          <div className="absolute w-2 h-2 bg-pink-400 rounded-full animate-ping opacity-75" />
          <div className="absolute w-2 h-2 bg-pink-400 rounded-full animate-ping opacity-50" 
            style={{ animationDelay: '0.5s' }} />
          <div className="absolute w-2 h-2 bg-pink-400 rounded-full animate-ping opacity-25" 
            style={{ animationDelay: '1s' }} />
        </div>
      )}
    </div>
  );
}
