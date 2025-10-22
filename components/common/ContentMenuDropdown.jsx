'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Film } from 'lucide-react';

const ContentMenuDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavigate = (path) => {
    setIsOpen(false);
    router.push(path);
  };

  const menuItems = [
    { path: '/', icon: '🖼️', label: '圖片專區', description: 'AI 生成圖片' },
    { path: '/videos', icon: '🎬', label: '影片專區', description: 'AI 生成影片' },
    { path: '/music', icon: '🎵', label: '音樂專區', description: 'AI 生成音樂' },
    { path: '/discussion', icon: '💬', label: '討論區', description: '交流討論' },
  ];

  // 找到當前頁面對應的項目，但在首頁時顯示影片按鈕
  const currentItem = (() => {
    // 如果在首頁，顯示影片按鈕（因為首頁就是圖片專區）
    if (pathname === '/') {
      return menuItems[1]; // 影片專區
    }
    // 其他頁面顯示對應的按鈕
    const item = menuItems.find(item => pathname.startsWith(item.path));
    return item || menuItems[1]; // 找不到就默認影片
  })();

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Desktop 按鈕 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group hidden md:inline-flex items-center gap-2 rounded-xl px-3 py-2
                   bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold
                   shadow-[0_6px_20px_-6px_rgba(147,51,234,0.55)]
                   hover:shadow-[0_8px_28px_-6px_rgba(236,72,153,0.7)]
                   transition-all active:translate-y-[1px]"
        title="內容專區"
      >
        <span className="text-lg">{currentItem.icon}</span>
        <span className="hidden lg:inline">{currentItem.label.replace('專區', '')}</span>
        <svg 
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Mobile 按鈕 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold
                   bg-gradient-to-r from-purple-500 to-pink-500 text-white
                   shadow-[0_4px_12px_-4px_rgba(147,51,234,0.4)]
                   hover:shadow-[0_6px_16px_-4px_rgba(236,72,153,0.6)]
                   transition-all active:translate-y-[1px] shrink-0"
        title="內容專區"
      >
        <span className="text-sm">{currentItem.icon}</span>
        <span>{currentItem.label.replace('專區', '')}</span>
        <svg 
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 下拉選單 */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-48 bg-zinc-800 rounded-lg shadow-lg border border-zinc-600 py-2 z-50">
          {menuItems.map((item, index) => (
            <button
              key={item.path}
              onClick={() => handleNavigate(item.path)}
              className={`w-full px-4 py-3 text-left hover:bg-zinc-700 flex items-center gap-3 transition-colors
                ${pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path)) ? 'bg-zinc-700' : ''}`}
            >
              <span className="text-2xl">{item.icon}</span>
              <div>
                <div className="font-medium text-white">{item.label}</div>
                <div className="text-sm text-gray-400">{item.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContentMenuDropdown;

