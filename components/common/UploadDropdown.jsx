'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';

const UploadDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUpload = (type) => {
    setIsOpen(false);
    
    if (type === 'image') {
      // 圖片使用 Modal 彈窗（原有功能）
      window.dispatchEvent(new CustomEvent('openUploadModal', { 
        detail: { user: null }
      }));
    } else if (type === 'video') {
      // 影片使用 Modal 彈窗
      window.dispatchEvent(new Event('openVideoUploadModal'));
    } else if (type === 'music') {
      // 音樂使用 Modal 彈窗
      window.dispatchEvent(new Event('openMusicUploadModal'));
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold
                   bg-gradient-to-r from-green-500 to-green-600 text白
                   shadow-[0_4px_12px_-4px_rgba(34,197,94,0.4)]
                   hover:shadow-[0_6px_16px_-4px_rgba(34,197,94,0.6)]
                   transition-all active:translate-y-[1px] shrink-0
                   md:gap-2 md:px-4 md:py-2 md:text-base md:rounded-xl
                   md:shadow-[0_6px_20px_-6px_rgba(34,197,94,0.55)]
                   md:hover:shadow-[0_8px_28px_-6px_rgba(34,197,94,0.7)]"
        title="上傳"
      >
        <Upload className="w-4 h-4 shrink-0 transition-transform group-hover:-translate-y-0.5" />
        <span className="hidden lg:inline">上傳</span>
        <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-48 bg-zinc-800 rounded-lg shadow-lg border border-zinc-600 py-2 z-50">
          <button
            onClick={() => handleUpload('image')}
            className="w-full px-4 py-3 text-left hover:bg-zinc-700 flex items-center gap-3 transition-colors"
          >
            <span className="text-2xl">📷</span>
            <div>
              <div className="font-medium text-white">上傳圖片</div>
              <div className="text-sm text-gray-400">AI 生成圖片</div>
            </div>
          </button>
          
          <button
            onClick={() => handleUpload('video')}
            className="w-full px-4 py-3 text-left hover:bg-zinc-700 flex items-center gap-3 transition-colors"
          >
            <span className="text-2xl">🎬</span>
            <div>
              <div className="font-medium text-white">上傳影片</div>
              <div className="text-sm text-gray-400">10-20秒短影片 (20MB)</div>
            </div>
          </button>
          
          <button
            onClick={() => handleUpload('music')}
            className="w-full px-4 py-3 text-left hover:bg-zinc-700 flex items-center gap-3 transition-colors"
          >
            <span className="text-2xl">🎵</span>
            <div>
              <div className="font-medium text-white">上傳音樂</div>
              <div className="text-sm text-gray-400">2-5分鐘音樂 (10MB)</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

export default UploadDropdown;
