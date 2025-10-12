"use client";

import React, { useState, useEffect } from "react";

export default function FireEffect({ powerExpiry, powerType = "7day" }) {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!powerExpiry) return;

    const updateTimeRemaining = () => {
      const now = new Date();
      const expiry = new Date(powerExpiry);
      const remaining = expiry.getTime() - now.getTime();
      
      if (remaining <= 0) {
        setTimeRemaining(0);
        setIsActive(false);
        return;
      }
      
      setTimeRemaining(remaining);
      setIsActive(true);
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [powerExpiry]);

  if (!isActive) return null;

  // 計算剩餘時間比例 (10小時 = 36000000ms)
  const totalDuration = 10 * 60 * 60 * 1000; // 10小時
  const timeRatio = Math.max(0, Math.min(1, timeRemaining / totalDuration));
  
  // 根據時間比例計算火焰大小和亮度
  const size = 12 + (timeRatio * 8); // 12px - 20px (更小)
  const opacity = 0.4 + (timeRatio * 0.6); // 0.4 - 1.0

  return (
    <div 
      className="absolute left-1 bottom-1 z-20 pointer-events-none"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        opacity: opacity,
      }}
    >
      {/* 使用商店的火焰圖示 */}
      <div 
        className="w-full h-full flex items-center justify-center"
        style={{
          fontSize: `${size * 0.8}px`,
          filter: `brightness(${0.7 + timeRatio * 0.3})`,
          animation: 'flicker 1s ease-in-out infinite alternate',
        }}
      >
        🔥
      </div>
      
      <style jsx>{`
        @keyframes flicker {
          0% { 
            transform: scale(1) rotate(-1deg);
            filter: brightness(0.8);
          }
          100% { 
            transform: scale(1.05) rotate(1deg);
            filter: brightness(1.2);
          }
        }
      `}</style>
    </div>
  );
}
