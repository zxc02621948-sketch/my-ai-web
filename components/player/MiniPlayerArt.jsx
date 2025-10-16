'use client';

import { useState, useEffect } from 'react';

export default function MiniPlayerArt({ isPlaying, theme = 'default' }) {
  const [colorShift, setColorShift] = useState(0);

  // 彩虹色變換效果
  useEffect(() => {
    if (isPlaying && theme === 'rainbow') {
      const interval = setInterval(() => {
        setColorShift(prev => (prev + 10) % 360);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setColorShift(0);
    }
  }, [isPlaying, theme]);

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
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* 貓咪耳機主體 */}
      <div className="relative w-full h-full">
        <img 
          src="/cat-headphone.png"
          alt="貓咪耳機"
          className={`absolute left-[20px] top-[20px] w-[100px] h-[100px] 
            transition-all duration-500 ease-in-out
            ${isPlaying ? 'animate-bounce' : ''}`}
          style={{ 
            filter: themeFilters[theme],
            filterDropShadow: '0 4px 12px rgba(0,0,0,0.2)',
            transform: isPlaying ? 'scale(1.05)' : 'scale(1)'
          }}
        />
        
        {/* 播放時的彩色光暈效果 */}
        {isPlaying && (
          <div 
            className="absolute left-[15px] top-[15px] w-[110px] h-[110px] 
              rounded-full opacity-30 animate-pulse"
            style={{
              background: `radial-gradient(circle, 
                rgba(255,107,157,0.3) 0%, 
                rgba(78,205,196,0.2) 35%, 
                rgba(255,217,61,0.2) 70%, 
                transparent 100%)`,
              animation: 'pulse 2s ease-in-out infinite'
            }}
          />
        )}
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
