'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';

const ContentMenuButtons = () => {
  const router = useRouter();
  const pathname = usePathname();

  const menuItems = [
    { 
      path: '/', 
      icon: '🖼️', 
      label: '圖片專區', 
      description: 'AI 生成圖片',
      gradient: 'from-[#6a11cb] to-[#2575fc]' // 深紫藍漸層 - 深邃感
    },
    { 
      path: '/videos', 
      icon: '🎬', 
      label: '影片專區', 
      description: 'AI 生成影片',
      gradient: 'from-orange-500 via-pink-500 to-red-500' // 橙粉紅漸層 - 活力動感
    },
    { 
      path: '/music', 
      icon: '🎵', 
      label: '音樂專區', 
      description: 'AI 生成音樂',
      gradient: 'from-indigo-500 via-purple-500 to-pink-500' // 靛紫粉漸層 - 深邃節奏感
    },
    { 
      path: '/discussion', 
      icon: '💬', 
      label: '討論區', 
      description: '交流討論',
      gradient: 'from-teal-500 via-cyan-500 to-blue-500' // 青藍漸層 - 清新交流感
    },
    { 
      path: '/store', 
      icon: '🛍️', 
      label: '積分商店', 
      description: '積分商店',
      gradient: 'from-yellow-500 via-amber-500 to-orange-500' // 金黃漸層 - 商店感
    },
  ];

  const handleNavigate = (path) => {
    router.push(path);
  };

  const isActive = (itemPath) => {
    if (itemPath === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(itemPath);
  };

  // 過濾掉當前頁面對應的按鈕
  const filteredMenuItems = menuItems.filter((item) => {
    if (item.path === '/') {
      return pathname !== '/'; // 圖片區不顯示圖片專區按鈕
    }
    return !pathname.startsWith(item.path); // 其他頁面不顯示對應的按鈕
  });

  return (
    <div className="flex items-center justify-center gap-2 overflow-x-auto overflow-y-hidden"
         style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}>
      {filteredMenuItems.map((item) => (
        <button
          key={item.path}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleNavigate(item.path);
          }}
          className={`group flex items-center gap-2 rounded-xl px-3 py-2 font-semibold
            transition-all active:translate-y-[1px] shrink-0 whitespace-nowrap text-xs md:text-sm
            bg-gradient-to-r ${item.gradient} text-white 
            shadow-[0_6px_20px_-6px_rgba(0,0,0,0.3)]
            ${isActive(item.path)
              ? 'ring-2 ring-white/70 shadow-[0_8px_24px_-6px_rgba(0,0,0,0.4)] brightness-110'
              : 'opacity-90 hover:opacity-100 hover:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.4)] hover:brightness-110'
            }`}
          title={item.label}
        >
          <span className="text-sm md:text-lg">{item.icon}</span>
          <span className="md:hidden">{item.label}</span>
          <span className="hidden md:inline lg:hidden">{item.label.replace('專區', '')}</span>
          <span className="hidden lg:inline">{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default ContentMenuButtons;

