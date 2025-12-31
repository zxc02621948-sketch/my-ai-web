'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { useCurrentUser } from '@/contexts/CurrentUserContext';
import { notify } from '@/components/common/GlobalNotificationManager';

const UploadDropdown = () => {
  const { currentUser } = useCurrentUser();
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isMobile, setIsMobile] = useState(false); // 使用 state 避免 hydration mismatch
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && menuRef.current && 
          !dropdownRef.current.contains(event.target) && 
          !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // 檢測是否為手機版（避免 hydration mismatch）
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(typeof window !== 'undefined' && window.innerWidth < 768);
    };
    
    // 初始檢查
    checkMobile();
    
    // 監聽窗口大小變化
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 計算下拉選單位置（手機版使用 fixed 定位）
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      requestAnimationFrame(() => {
        const rect = buttonRef.current.getBoundingClientRect();
        setMenuPosition({
          top: rect.bottom + 8,
          left: Math.max(8, rect.right - 192),
        });
      });
    }
  }, [isOpen]);

  const handleUpload = (type) => {
    // ✅ 檢查是否已登錄
    if (!currentUser) {
      setIsOpen(false);
      notify.warning("請先登錄", "您需要先登錄才能上傳內容。");
      // 延遲一下再打開登錄彈窗，讓提示先顯示
      setTimeout(() => {
        window.dispatchEvent(new Event('openLoginModal'));
      }, 300);
      return;
    }
    
    setIsOpen(false);
    
    if (type === 'image') {
      // 圖片使用 Modal 彈窗（原有功能）
      // 手機版：簡化流程，跳過元數據填寫
      window.dispatchEvent(new CustomEvent('openUploadModal', { 
        detail: { user: null, mobileSimple: isMobile }
      }));
    } else if (type === 'video') {
      // 影片使用 Modal 彈窗
      window.dispatchEvent(new Event('openVideoUploadModal'));
    } else if (type === 'music') {
      // 音樂使用 Modal 彈窗
      window.dispatchEvent(new Event('openMusicUploadModal'));
    }
  };

  // 手機版：直接觸發圖片上傳，不顯示下拉選單
  const handleMobileUpload = () => {
    // ✅ 檢查是否已登錄
    if (!currentUser) {
      notify.warning("請先登錄", "您需要先登錄才能上傳內容。");
      // 延遲一下再打開登錄彈窗，讓提示先顯示
      setTimeout(() => {
        window.dispatchEvent(new Event('openLoginModal'));
      }, 300);
      return;
    }
    
    window.dispatchEvent(new CustomEvent('openUploadModal', { 
      detail: { user: null, mobileSimple: true }
    }));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // 手機版：直接觸發圖片上傳
          if (isMobile) {
            handleMobileUpload();
          } else {
            // 桌面版：顯示下拉選單
            setIsOpen(!isOpen);
          }
        }}
        className="group flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold
                   bg-gradient-to-r from-green-500 to-green-600 text白
                   shadow-[0_4px_12px_-4px_rgba(34,197,94,0.4)]
                   hover:shadow-[0_6px_16px_-4px_rgba(34,197,94,0.6)]
                   transition-all active:translate-y-[1px] shrink-0 whitespace-nowrap
                   md:gap-2 md:px-4 md:py-2 md:text-base md:rounded-xl
                   md:shadow-[0_6px_20px_-6px_rgba(34,197,94,0.55)]
                   md:hover:shadow-[0_8px_28px_-6px_rgba(34,197,94,0.7)]"
        title="上傳"
      >
        <Upload className="w-4 h-4 shrink-0 transition-transform group-hover:-translate-y-0.5" />
        <span>{isMobile ? '上傳圖片' : '上傳'}</span>
        {!isMobile && (
          <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {isOpen && !isMobile && (
        <div 
          ref={menuRef}
          className="absolute top-full left-0 mt-2 w-48 bg-zinc-800 rounded-lg shadow-lg border border-zinc-600 py-2 z-[9999]"
        >
          <button
            onClick={() => handleUpload('image')}
            className="w-full px-4 py-3 text-left hover:bg-zinc-700 flex items-center gap-3 transition-colors"
          >
            <span className="text-2xl">📷</span>
            <div>
              <div className="font-medium text-white">上傳圖片</div>
              <div className="text-sm text-gray-400">AI 生成圖片 (20MB)</div>
            </div>
          </button>
          
          <button
            onClick={() => handleUpload('video')}
            className="w-full px-4 py-3 text-left hover:bg-zinc-700 flex items-center gap-3 transition-colors"
          >
            <span className="text-2xl">🎬</span>
            <div>
              <div className="font-medium text-white">上傳影片</div>
              <div className="text-sm text-gray-400">10-20秒短影片 (100MB)</div>
            </div>
          </button>
          
          <button
            onClick={() => handleUpload('music')}
            className="w-full px-4 py-3 text-left hover:bg-zinc-700 flex items-center gap-3 transition-colors"
          >
            <span className="text-2xl">🎵</span>
            <div>
              <div className="font-medium text-white">上傳音樂</div>
              <div className="text-sm text-gray-400">2-5分鐘音樂 (20MB)</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

export default UploadDropdown;
