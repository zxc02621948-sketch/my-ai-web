"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EmergencyCleanupPage() {
  const router = useRouter();

  useEffect(() => {
    // ✅ 激進清理所有遮罩
    function aggressiveCleanup() {
      console.log('🧹 緊急清理開始...');
      
      // 1. 重置所有樣式
      if (typeof document !== 'undefined') {
        document.body.style.overflow = "";
        document.body.style.pointerEvents = "";
        document.body.style.position = "";
        document.documentElement.style.overflow = "";
        document.documentElement.style.pointerEvents = "";
        
        // 2. 移除所有固定定位的遮罩層
        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
          const style = window.getComputedStyle(el);
          if (style.position === 'fixed') {
            const rect = el.getBoundingClientRect();
            const isFullScreen = rect.width >= window.innerWidth * 0.9 && 
                               rect.height >= window.innerHeight * 0.9;
            if (isFullScreen && 
                (el.classList.contains('inset-0') || 
                 el.classList.contains('backdrop-blur-sm') ||
                 el.getAttribute('class')?.includes('bg-black'))) {
              console.log('🗑️ 移除遮罩:', el);
              if (el.parentNode) {
                el.parentNode.removeChild(el);
              }
            }
          }
          
          // 移除阻止交互的樣式
          if (el.style.pointerEvents === 'none') {
            el.style.pointerEvents = "";
          }
        });
        
        // 3. 移除所有 Dialog
        const dialogs = document.querySelectorAll('[role="dialog"]');
        dialogs.forEach(dialog => {
          if (!dialog.hasAttribute('data-keep')) {
            console.log('🗑️ 移除 Dialog:', dialog);
            if (dialog.parentNode) {
              dialog.parentNode.removeChild(dialog);
            }
          }
        });
        
        console.log('✅ 清理完成，3秒後返回首頁...');
        
        // 3秒後返回首頁
        setTimeout(() => {
          router.push('/');
        }, 3000);
      }
    }
    
    aggressiveCleanup();
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">🧹 緊急清理中...</h1>
        <p className="text-zinc-400">正在移除所有遮罩層，3秒後自動返回首頁</p>
      </div>
    </div>
  );
}







