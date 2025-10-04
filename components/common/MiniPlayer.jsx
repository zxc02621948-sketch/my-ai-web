"use client";

import { usePlayer } from "@/components/context/PlayerContext";
import { useState, useRef, useEffect } from "react";
import MiniPlayerArt from "@/components/common/MiniPlayerArt";

export default function MiniPlayer() {
  const player = usePlayer();
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isExpanded, setIsExpanded] = useState(false);
  const [dragStartTime, setDragStartTime] = useState(0);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const justDraggedRef = useRef(false);
  const [isVolumeSliding, setIsVolumeSliding] = useState(false);
  const [isVolumeHovering, setIsVolumeHovering] = useState(false);
  const volumeSliderRef = useRef(null);
  const volumeWrapperRef = useRef(null);
  const [theme, setTheme] = useState("modern");
  const [imgFailed] = useState(false);
  const showInteractiveVolume = true; // 啟用直式音量拉條（右下角偏上一點）
  // 依照 Hooks 規則：所有 hooks 必須在每次 render 都被呼叫，
  // 因此不在條件分支中提前 return；改用條件渲染控制輸出。
  const showMini = !!(player && player.miniPlayerEnabled);
  const pct = player?.duration > 0 ? Math.min(100, Math.max(0, (player.currentTime / player.duration) * 100)) : 0;

  useEffect(() => {
    try {
      const t = (localStorage.getItem("miniPlayerTheme") || "").trim();
      if (t) setTheme(t);
    } catch {}
  }, []);

  const palette = (() => {
    switch (theme) {
      case "dark":
        return {
          bg: "#1f2937",
          border: "#374151",
          accent1: "#60a5fa",
          accent2: "#3b82f6",
        };
      case "retro":
        return {
          bg: "#F8F1E4", // 米白（內層）
          border: "#F8F1E4", // 同色米白（外框）
          accent1: "#E67E22",
          accent2: "#D35400",
        };
      case "modern":
      default:
        return {
          bg: "#F8F1E4", // 米白（內層）
          border: "#F8F1E4", // 同色米白（外框）
          accent1: "#E67E22",
          accent2: "#D35400",
        };
    }
  })();

  const handleMouseDown = (e) => {
    e.preventDefault();
    setDragStartTime(Date.now());
    dragStartPosRef.current = { x: position.x, y: position.y };
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
    // 以 ref 紀錄 offset，避免在 mouseup 時計算距離時受非同步 state 影響
    dragOffsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    });
  };

  const handleMouseUp = (e) => {
    // 結束拖曳，取消任何展開/收起切換（僅由箭頭圖示控制）
    setIsDragging(false);
    // 若有明顯拖曳距離，視為拖曳而非點擊：短暫抑制點擊切換
    try {
      // 使用當前滑鼠座標推算最後位置，避免取用可能未更新完成的 state
      const finalX = e.clientX - (dragOffsetRef.current?.x || 0);
      const finalY = e.clientY - (dragOffsetRef.current?.y || 0);
      const dx = finalX - dragStartPosRef.current.x;
      const dy = finalY - dragStartPosRef.current.y;
      const moved = Math.hypot(dx, dy);
      if (moved >= 8) {
        justDraggedRef.current = true;
        setTimeout(() => { justDraggedRef.current = false; }, 250);
      }
    } catch {}
    // 儲存目前位置，供下次載入還原
    try {
      localStorage.setItem("miniPlayerPosition", JSON.stringify(position));
    } catch {}
  };

  // 保持展開狀態（避免因重新掛載而重置）
  useEffect(() => {
    try {
      const saved = localStorage.getItem("miniPlayerExpanded");
      if (saved !== null) {
        setIsExpanded(saved === "1");
      }
    } catch {}
  }, []);

  // 預設位置：右上角；若有已儲存位置則優先使用
  useEffect(() => {
    try {
      const saved = localStorage.getItem("miniPlayerPosition");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.x === "number" && typeof parsed.y === "number") {
          setPosition(parsed);
          return;
        }
      }
    } catch {}

    if (typeof window !== "undefined") {
      const margin = 16;
      const width = 140; // 與元件寬度一致
      const x = Math.max(margin, window.innerWidth - width - margin);
      const y = margin;
      setPosition({ x, y });
    }
  }, []);

  // 阻止按鈕點擊時觸發展開/收起
  const handleButtonClick = (e) => {
    e.stopPropagation();
  };

  // 音量滑桿事件處理
  const handleVolumeMouseDown = (e) => {
    e.stopPropagation();
    setIsVolumeSliding(true);
    updateVolumeFromEvent(e);
  };

  const handleVolumeMouseMove = (e) => {
    if (isVolumeSliding) {
      updateVolumeFromEvent(e);
    }
  };

  const handleVolumeMouseUp = () => {
    setIsVolumeSliding(false);
  };

  const handleVolumeMouseEnter = () => {
    setIsVolumeHovering(true);
  };

  const handleVolumeMouseLeave = () => {
    setIsVolumeHovering(false);
  };

  const updateVolumeFromEvent = (e) => {
    const host = volumeWrapperRef.current || volumeSliderRef.current;
    if (!host) return;

    const rect = host.getBoundingClientRect();
    // 以實際顯示長邊為滑桿長度，避免旋轉造成高度僅 3~4px 導致點擊幾乎等於 100%
    const isVertical = rect.height >= rect.width;
    const length = Math.max(1, isVertical ? rect.height : rect.width);
    const rel = isVertical ? (e.clientY - rect.top) : (e.clientX - rect.left);
    let percentage = isVertical ? (1 - (rel / length)) : (rel / length);
    percentage = Math.max(0, Math.min(1, percentage));

    player.setVolume(percentage);
  };

  // 全域監聽滑鼠事件
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }
    if (isVolumeSliding) {
      document.addEventListener("mousemove", handleVolumeMouseMove);
      document.addEventListener("mouseup", handleVolumeMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousemove", handleVolumeMouseMove);
      document.removeEventListener("mouseup", handleVolumeMouseUp);
    };
  }, [isDragging, isVolumeSliding]);

  // 在所有 hooks 宣告之後再根據條件決定是否輸出 UI
  if (!showMini) return null;

  return (
    <div
      className="fixed z-50 cursor-move select-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="flex flex-col items-center space-y-3">
        {/* 黑色跑馬燈（曲名 + 可點連結） */}
        <div
          className="w-[140px] h-6 rounded bg-black/80 text-white text-xs overflow-hidden flex items-center px-2 cursor-pointer"
          title={player.originUrl || player.src || "未設定來源"}
          onClick={(e) => {
            e.stopPropagation();
            const href = player.originUrl || player.src;
            if (href) window.open(href, "_blank");
          }}
        >
          <div
            className="inline-block whitespace-nowrap"
            style={{
              animation: "miniMarquee 12s linear infinite",
            }}
          >
            {(() => {
              const t = (player.trackTitle || "").trim();
              const u = (player.originUrl || player.src || "").trim();
              if (t) return t;
              if (!u) return "未設定音源";
              try {
                const url = new URL(u, typeof window !== "undefined" ? window.location.origin : undefined);
                const lastSeg = url.pathname.split("/").filter(Boolean).pop() || url.hostname;
                return decodeURIComponent(lastSeg);
              } catch {
                return u;
              }
            })()}
          </div>
        </div>

        {/* 主體以 SVG 佈景為主視覺 */}
        <div 
          className="relative cursor-pointer transition-shadow duration-200 hover:shadow-2xl"
          style={{
            width: '140px',
            height: '140px',
            borderRadius: '16px'
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (justDraggedRef.current) return;
            setIsExpanded(prev => {
              const next = !prev;
              try { localStorage.setItem("miniPlayerExpanded", next ? "1" : "0"); } catch {}
              return next;
            });
          }}
        >
          <MiniPlayerArt isPlaying={player.isPlaying} palette={palette} />

          {/* 播放進度條：置於唱片下方居中顯示 */}
          <div
            className="absolute"
            style={{
              left: '50%',
              transform: 'translateX(-50%)',
              bottom: '14px',
              width: '104px',
              height: '6px',
              background: 'rgba(0,0,0,0.10)',
              borderRadius: '3px',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.12)'
            }}
            onMouseDown={handleButtonClick}
            aria-label="播放進度"
            title={`進度: ${Math.round(pct)}%`}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                borderRadius: '3px',
                background: `linear-gradient(to right, ${palette.accent1}, ${palette.accent2})`,
                transition: 'width 0.15s ease'
              }}
            />
          </div>

          {showInteractiveVolume && (
            <div 
              className="absolute cursor-pointer" 
              style={{ 
                right: '-8px',
                bottom: '50px',
                transform: 'rotate(-90deg)', 
                transformOrigin: 'center',
                background: 'rgba(0, 0, 0, 0.6)',
                border: '0.5px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                padding: '4px 6px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                backdropFilter: 'blur(4px)'
              }}
              ref={volumeWrapperRef}
              title={`音量: ${Math.round(player.volume * 100)}%`}
              onMouseEnter={handleVolumeMouseEnter}
              onMouseLeave={handleVolumeMouseLeave}
              onMouseDown={handleButtonClick}
            >
              <div 
                ref={volumeSliderRef}
                onMouseDown={handleVolumeMouseDown}
                style={{
                  width: '30px',
                  height: isVolumeHovering || isVolumeSliding ? '4px' : '3px',
                  background: isVolumeSliding ? '#95A5A6' : (isVolumeHovering ? '#A8B5B8' : '#BDC3C7'),
                  borderRadius: '2px',
                  position: 'relative',
                  boxShadow: isVolumeHovering || isVolumeSliding 
                    ? 'inset 0 1px 3px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.1)' 
                    : 'inset 0 1px 2px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s ease'
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    width: `${player.volume * 100}%`,
                    height: '100%',
                    background: `linear-gradient(to right, ${palette.accent1}, ${palette.accent2})`,
                    borderRadius: '2px',
                    transition: isVolumeSliding ? 'none' : 'width 0.1s ease'
                  }}
                />
                 <div 
                   style={{
                     position: 'absolute',
                     top: isVolumeHovering || isVolumeSliding ? '-4px' : '-3px',
                     left: `${player.volume * 24}px`,
                     width: isVolumeSliding ? '12px' : (isVolumeHovering ? '10px' : '9px'),
                     height: isVolumeSliding ? '12px' : (isVolumeHovering ? '10px' : '9px'),
                     background: isVolumeSliding 
                       ? 'radial-gradient(circle, #2C3E50, #34495E)' 
                       : (isVolumeHovering 
                         ? 'radial-gradient(circle, #34495E, #2C3E50)' 
                         : 'radial-gradient(circle, #34495E, #2C3E50)'),
                     borderRadius: '50%',
                     border: `1px solid ${isVolumeSliding || isVolumeHovering ? '#95A5A6' : '#BDC3C7'}`,
                     boxShadow: isVolumeSliding 
                       ? '0 3px 8px rgba(0,0,0,0.5)' 
                       : (isVolumeHovering 
                         ? '0 2px 5px rgba(0,0,0,0.4)' 
                         : '0 1px 3px rgba(0,0,0,0.3)'),
                     transition: isVolumeSliding ? 'none' : 'all 0.2s ease',
                     cursor: 'pointer'
                   }}
                 />
              </div>
            </div>
          )}
        </div>

        {/* 展開按鈕移除，改為點擊唱片圖示展開/收起 */}

        {/* 外部控制面板 - 透明風格 */}
        <div 
          className={`rounded-lg transition-all duration-300 ease-in-out overflow-hidden ${
            isExpanded ? 'opacity-100 max-h-20' : 'opacity-0 max-h-0'
          }`}
          style={{
            background: 'transparent',
            padding: isExpanded ? '8px 12px' : '0 12px'
          }}
        >
          {/* 播放控制按鈕 */}
          <div className="flex justify-center items-center space-x-4">
            {/* 上一首 */}
            <button
              onClick={(e) => {
                handleButtonClick(e);
                player.previous && player.previous();
              }}
              onMouseDown={(e) => { e.stopPropagation(); }}
              className={`w-8 h-8 flex items-center justify-center text-gray-300 transition-all duration-200 rounded-full ${isDragging ? '' : 'hover:text-white hover:scale-110'}`}
              title="上一首"
              style={{
                background: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
              </svg>
            </button>

            {/* 播放/暫停 */}
            <button
              onClick={(e) => {
                handleButtonClick(e);
                player.isPlaying ? player.pause() : player.play();
              }}
              onMouseDown={(e) => { e.stopPropagation(); }}
              className={`w-10 h-10 flex items-center justify-center text-orange-400 transition-all duration-200 ${isDragging ? '' : 'hover:text-orange-300 hover:scale-110'}`}
              title={player.isPlaying ? "暫停" : "播放"}
              style={{
                background: 'rgba(0, 0, 0, 0.7)',
                backdropFilter: 'blur(8px)',
                borderRadius: '50%',
                border: '1px solid rgba(230, 126, 34, 0.4)'
              }}
            >
              {player.isPlaying ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>

            {/* 下一首 */}
            <button
              onClick={(e) => {
                handleButtonClick(e);
                player.next && player.next();
              }}
              onMouseDown={(e) => { e.stopPropagation(); }}
              className={`w-8 h-8 flex items-center justify-center text-gray-300 transition-all duration-200 rounded-full ${isDragging ? '' : 'hover:text-white hover:scale-110'}`}
              title="下一首"
              style={{
                background: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
      {/* 跑馬燈動畫樣式 */}
      <style jsx>{`
        @keyframes miniMarquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}