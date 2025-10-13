"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function TutorialMenu({ onGuideClick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (open && ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="group inline-flex items-center gap-1.5 md:gap-2 px-2 py-1.5 md:px-3 md:py-2 rounded-xl
                   bg-gradient-to-r from-indigo-400 to-fuchsia-500 text-white font-semibold
                   shadow-[0_6px_20px_-6px_rgba(99,102,241,0.55)]
                   hover:shadow-[0_8px_28px_-6px_rgba(217,70,239,0.7)]
                   transition-all active:translate-y-[1px] text-xs md:text-sm"
      >
        <span className="w-4 h-4 shrink-0 transition-transform group-hover:-translate-y-0.5" aria-hidden>📚</span>
        <span className="hidden sm:inline">教學</span>
        <span className="hidden sm:inline" aria-hidden>▼</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-48 bg-zinc-800 text-white border border-white/10 rounded-lg shadow-lg py-1 z-50"
        >
          <Link
            href="/qa"
            role="menuitem"
            className="block px-4 py-2 hover:bg-zinc-700 text-sm"
            onClick={() => setOpen(false)}
          >
            新手生成 Q&A
          </Link>
          <Link
            href="/models"
            role="menuitem"
            className="block px-4 py-2 hover:bg-zinc-700 text-sm"
            onClick={() => setOpen(false)}
          >
            獲取模型
          </Link>
          <button
            role="menuitem"
            className="block w-full text-left px-4 py-2 hover:bg-zinc-700 text-sm"
            onClick={() => { setOpen(false); onGuideClick?.(); }}
          >
            安裝教學
          </button>
        </div>
      )}
    </div>
  );
}
