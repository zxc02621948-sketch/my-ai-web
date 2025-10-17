"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function TutorialMenu({ onGuideClick }) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const ref = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { 
      if (open && ref.current && menuRef.current && 
          !ref.current.contains(e.target) && 
          !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // 計算下拉選單位置（手機版使用 fixed 定位）
  useEffect(() => {
    if (open && buttonRef.current) {
      // 使用 requestAnimationFrame 確保 DOM 更新完成後再計算位置
      requestAnimationFrame(() => {
        const rect = buttonRef.current.getBoundingClientRect();
        setMenuPosition({
          top: rect.bottom + 8, // 按鈕下方 8px
          left: Math.max(8, rect.right - 192), // 右對齊，但至少離左邊界 8px
        });
      });
    }
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="group inline-flex items-center gap-1.5 md:gap-2 px-3 py-2 md:px-3 md:py-2 rounded-xl
                   bg-gradient-to-r from-indigo-400 to-fuchsia-500 text-white font-semibold
                   shadow-[0_6px_20px_-6px_rgba(99,102,241,0.55)]
                   hover:shadow-[0_8px_28px_-6px_rgba(217,70,239,0.7)]
                   transition-all active:translate-y-[1px] text-xs md:text-sm whitespace-nowrap"
      >
        <span className="w-4 h-4 shrink-0 transition-transform group-hover:-translate-y-0.5" aria-hidden>📚</span>
        <span className="hidden lg:inline">教學</span>
        <span aria-hidden className="hidden lg:inline">▼</span>
      </button>

      {open && typeof window !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed w-48 bg-zinc-800 text-white border border-white/10 rounded-lg shadow-xl py-1 z-[9999]"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
          }}
        >
          <Link
            href="/qa"
            role="menuitem"
            className="block px-4 py-3 hover:bg-zinc-700 text-sm"
            onClick={() => setOpen(false)}
          >
            新手生成 Q&A
          </Link>
          <Link
            href="/models"
            role="menuitem"
            className="block px-4 py-3 hover:bg-zinc-700 text-sm"
            onClick={() => setOpen(false)}
          >
            獲取模型
          </Link>
          <button
            role="menuitem"
            className="block w-full text-left px-4 py-3 hover:bg-zinc-700 text-sm"
            onClick={() => { setOpen(false); onGuideClick?.(); }}
          >
            安裝教學
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
