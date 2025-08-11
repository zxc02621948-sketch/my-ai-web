"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import FilterPanel from "@/components/common/FilterPanel";
import axios from "axios";
import NotificationBell from "@/components/common/NotificationBell";
import { usePortalContainer } from "@/components/common/usePortal";
import { createPortal } from "react-dom";
import { useFilterContext } from "@/components/context/FilterContext";
import toast from "react-hot-toast";
import { Package2, Wrench, CircleHelp } from "lucide-react";


const ImageModal = dynamic(() => import("@/components/image/ImageModal"), { ssr: false });

export default function Header({
  currentUser,
  setCurrentUser,
  onLoginOpen,
  onRegisterOpen,
  suggestions = [],
  onUploadClick,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const filterButtonRef = useRef(null);
  const inputRef = useRef(null);
  const filterPanelRef = useRef(null);
  const userMenuRef = useRef(null);
  const portalContainer = usePortalContainer();
  const searchBoxRef = useRef(null);

  const {
    levelFilters,
    toggleLevelFilter,
    categoryFilters,
    toggleCategoryFilter,
    viewMode,
    setViewMode,
    resetFilters,
  } = useFilterContext();

  const isUserTypingRef = useRef(false);
  const debounceTimerRef = useRef(null);

  const buildHref = (term) => {
    const q = (term || "").trim();
    return q ? `${pathname}?search=${encodeURIComponent(q)}` : pathname;
  };

  // URL → 輸入框
  useEffect(() => {
    const q = searchParams.get("search")?.trim() || "";
    setSearchQuery(q);
    isUserTypingRef.current = false;
  }, [searchParams]);

  // 輸入框 → URL（debounce）
  useEffect(() => {
    if (!isUserTypingRef.current) return;
    if (isComposing) return;
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      const target = buildHref(searchQuery);
      const currentQuery = searchParams.toString();
      const currentHref = `${pathname}${currentQuery ? `?${currentQuery}` : ""}`;
      if (currentHref === target) return;
      router.replace(target);
    }, 200);
    return () => clearTimeout(debounceTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, isComposing, pathname, searchParams]);

  // 點外關閉：篩選面板 + 使用者選單 + 搜尋下拉
  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (filterMenuOpen) {
        const panel = filterPanelRef.current;
        const btn = filterButtonRef.current;
        if (panel && !panel.contains(e.target) && btn && !btn.contains(e.target)) {
          setFilterMenuOpen(false);
        }
      }
      if (userMenuOpen) {
        const menu = userMenuRef.current;
        if (menu && !menu.contains(e.target)) setUserMenuOpen(false);
      }
      if (showDropdown) {
        const box = searchBoxRef.current;
        if (box && !box.contains(e.target)) setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [filterMenuOpen, userMenuOpen, showDropdown]);

  // 搜尋建議
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setShowDropdown(false);
      setFilteredSuggestions([]);
      return;
    }
    const list = suggestions
      .filter((s) => typeof s === "string" && s.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 8);
    setFilteredSuggestions(list);
    setShowDropdown(list.length > 0);
  }, [searchQuery, suggestions]);

  const handleInputChange = (e) => {
    isUserTypingRef.current = true;
    setSearchQuery(e.target.value);
  };
  const handleSubmit = (e) => {
    e.preventDefault();
    isUserTypingRef.current = false;
    setShowDropdown(false);
    router.push(buildHref(searchQuery));
  };
  const handleSuggestionClick = (text) => {
    isUserTypingRef.current = false;
    setSearchQuery(text);
    setShowDropdown(false);
    router.push(buildHref(text));
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-zinc-900 border-b border-zinc-700">
        {/* 左右貼齊，移除 max-w 容器，Logo 靠左 */}
        <div className="px-3 md:px-4 py-2 md:py-3 flex items-center justify-between gap-3">
          {/* 左：Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 md:gap-3 shrink-0"
            onClick={() => {
              sessionStorage.setItem("homepageReset", "1");
              router.push("/");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            aria-label="回首頁"
          >
            <Image
              src="/ai_logo_icon.png"
              alt="AI 創界 Logo"
              width={40}
              height={40}
              className="rounded-lg md:w-[56px] md:h-[56px]"
              priority
            />
            <span className="text-white text-xl md:text-3xl font-extrabold tracking-wide">
              AI 創界
            </span>
          </Link>

          {/* 中：篩選 + 搜尋（靠左、吃滿剩餘寬度） */}
          <div className="flex-1 min-w-0 flex items-center justify-start w-full">
            <div className="flex items-center gap-2 w-full">
              {/* 篩選 */}
              <div className="w-10 md:w-[80px] shrink-0">
                <button
                  ref={filterButtonRef}
                  onClick={() => setFilterMenuOpen((prev) => !prev)}
                  className="w-full px-2 py-2 md:px-4 rounded text-white text-base font-medium transition duration-200 bg-blue-600 hover:bg-blue-700"
                  title="篩選"
                >
                  <span className="md:hidden" aria-hidden>⚙︎</span>
                  <span className="hidden md:inline">篩選</span>
                </button>
              </div>

              {/* 搜尋列 */}
              <div className="relative w-full min-w-0" ref={searchBoxRef}>
                <form
                  onSubmit={handleSubmit}
                  className="flex w-full rounded-lg bg-zinc-800 border border-zinc-600 focus-within:ring-2 focus-within:ring-blue-500 overflow-hidden"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={handleInputChange}
                    onCompositionStart={() => setIsComposing(true)}
                    onCompositionEnd={() => setIsComposing(false)}
                    placeholder="搜尋標題、作者、標籤…"
                    className="flex-1 min-w-0 pl-3 md:pl-4 pr-2 py-2 rounded-l bg-zinc-800 text-white placeholder-gray-400 focus:outline-none text-sm md:text-base"
                  />
                  <button
                    type="submit"
                    className="px-3 md:px-4 py-2 rounded-r bg-zinc-700 text-white hover:bg-zinc-600 text-sm font-medium"
                  >
                    搜尋
                  </button>
                </form>

                {showDropdown && !isComposing && (
                  <ul className="absolute z-50 mt-1 w-full bg-zinc-800 border border-zinc-700 rounded shadow-md text-sm text-white max-h-60 overflow-y-auto">
                    {filteredSuggestions.map((s, i) => (
                      <li
                        key={i}
                        onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(s); }}
                        className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* 篩選面板（Portal） */}
            {filterMenuOpen &&
              createPortal(
                <div
                  ref={filterPanelRef}
                  className="fixed top-[64px] md:top:[72px] left-[calc(120px)] md:left-[calc(405px)] z-[99999]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="bg-zinc-900 border border-zinc-700 shadow-xl rounded-xl p-3 md:p-4">
                    <FilterPanel
                      currentUser={currentUser}
                      filterMenuOpen={filterMenuOpen}
                      setFilterMenuOpen={setFilterMenuOpen}
                      levelFilters={levelFilters}
                      categoryFilters={categoryFilters}
                      viewMode={viewMode}
                      toggleLevelFilter={toggleLevelFilter}
                      toggleCategoryFilter={toggleCategoryFilter}
                      setViewMode={setViewMode}
                    />
                  </div>
                </div>,
                portalContainer || document.body
              )}
          </div>

          {/* 右：操作區（緊湊排版） */}
          <div className="flex items-center gap-2 md:gap-2 lg:gap-3 shrink-0">
            {/* 上傳（桌機顯示） */}
            <button
              onClick={() => {
                if (!currentUser) {
                  toast("請先登入才能上傳圖片", { icon: "🔒", id: "login-required", duration: 1000 });
                  return;
                }
                onUploadClick();
              }}
              className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 font-medium"
              title="上傳圖片"
            >
              <span aria-hidden>⬆️</span>
              <span>上傳圖片</span>
            </button>

            {/* 獲取模型（外露） */}
            <Link
              href="/models"  // 若你的實際路徑不同再改
              className="group hidden md:inline-flex items-center gap-2 rounded-xl px-3 py-2
                         bg-gradient-to-r from-emerald-400 to-cyan-500 text-white font-semibold
                         shadow-[0_6px_20px_-6px_rgba(16,185,129,0.55)]
                         hover:shadow-[0_8px_28px_-6px_rgba(6,182,212,0.7)]
                         transition-all active:translate-y-[1px] focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-emerald-300/70"
              title="獲取模型"
            >
              <Package2 className="w-4 h-4 shrink-0 transition-transform group-hover:-translate-y-0.5" />
              <span className="hidden xl:inline">獲取模型</span>
            </Link>

            {/* 安裝教學（外露） */}
            <Link
              href="/tutorial/install"  // 若你的實際路徑不同再改
              className="group hidden md:inline-flex items-center gap-2 rounded-xl px-3 py-2
                         bg-gradient-to-r from-amber-400 to-orange-500 text-white font-semibold
                         shadow-[0_6px_20px_-6px_rgba(245,158,11,0.55)]
                         hover:shadow-[0_8px_28px_-6px_rgba(249,115,22,0.7)]
                         transition-all active:translate-y-[1px] focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-amber-300/70"
              title="安裝教學"
            >
              <Wrench className="w-4 h-4 shrink-0 transition-transform group-hover:-translate-y-0.5" />
              <span className="hidden xl:inline">安裝教學</span>
            </Link>

            {/* 新手生成 Q&A（外露） */}
            <Link
              href="/qa"
              className="group hidden md:inline-flex items-center gap-2 rounded-xl px-3 py-2
                         bg-gradient-to-r from-indigo-400 to-fuchsia-500 text-white font-semibold
                         shadow-[0_6px_20px_-6px_rgba(99,102,241,0.55)]
                         hover:shadow-[0_8px_28px_-6px_rgba(217,70,239,0.7)]
                         transition-all active:translate-y-[1px] focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-indigo-300/70"
              title="新手生成 Q&A"
            >
              <CircleHelp className="w-4 h-4 shrink-0 transition-transform group-hover:-translate-y-0.5" />
              <span className="hidden xl:inline">新手生成 Q&A</span>
            </Link>

            {currentUser && <NotificationBell currentUser={currentUser} />}

            {/* 使用者選單 */}
            <div className="relative" ref={userMenuRef}>
              {currentUser === undefined ? (
                <div className="px-3 md:px-4 py-2 bg-zinc-800 text-gray-400 rounded text-sm">🔄</div>
              ) : (
                <>
                  <button
                    onClick={() => setUserMenuOpen((prev) => !prev)}
                    className="px-3 md:px-4 py-2 bg-zinc-800 text-white rounded-full hover:bg-zinc-700 text-sm font-medium min-w-[40px] md:min-w-[140px] max-w-[160px] truncate text-left"
                    aria-haspopup="menu"
                    aria-expanded={userMenuOpen}
                    title={currentUser?.username || "登入 / 註冊"}
                  >
                    <span className="md:hidden" aria-hidden>👤</span>
                    <span className="hidden md:inline">
                      {currentUser?.username ? `👤 ${currentUser.username} ▼` : "🔑 登入 / 註冊 ▼"}
                    </span>
                  </button>

                  {userMenuOpen && (
                    <div
                      className="absolute right-0 mt-2 w-48 bg-zinc-800 text-white rounded shadow-md py-1 z-50"
                      role="menu"
                    >
                      {currentUser?.username ? (
                        <>
                          <Link
                            href={`/user/${currentUser._id}`}
                            className="block px-4 py-2 hover:bg-zinc-700 text-sm"
                            onClick={() => setUserMenuOpen(false)}
                            role="menuitem"
                          >
                            我的頁面
                          </Link>

                          {/* 📱 手機：上傳入口（登入狀態） */}
                          <button
                            role="menuitem"
                            className="md:hidden block w-full text-left px-4 py-2 hover:bg-zinc-700 text-sm"
                            onClick={() => {
                              setUserMenuOpen(false);
                              onUploadClick();
                            }}
                          >
                            📤 上傳（Beta）
                          </button>

                          <button
                            onClick={async () => {
                              setUserMenuOpen(false);
                              localStorage.clear();
                              await axios.post("/api/auth/logout", {}, { withCredentials: true });
                              location.reload();
                            }}
                            className="block w-full text-left px-4 py-2 hover:bg-zinc-700 text-sm text-red-400"
                            role="menuitem"
                          >
                            登出
                          </button>
                        </>
                      ) : (
                        <>
                          {/* 📱 手機：上傳入口（未登入 → 先開登入） */}
                          <button
                            role="menuitem"
                            className="md:hidden block w-full text-left px-4 py-2 hover:bg-zinc-700 text-sm"
                            onClick={() => {
                              setUserMenuOpen(false);
                              onLoginOpen?.();
                            }}
                          >
                            📤 上傳（需登入）
                          </button>

                          <button
                            onClick={() => {
                              setUserMenuOpen(false);
                              onLoginOpen();
                            }}
                            className="block w-full text-left px-4 py-2 hover:bg-zinc-700 text-sm"
                            role="menuitem"
                          >
                            登入
                          </button>
                          <button
                            onClick={() => {
                              setUserMenuOpen(false);
                              onRegisterOpen();
                            }}
                            className="block w-full text-left px-4 py-2 hover:bg-zinc-700 text-sm"
                            role="menuitem"
                          >
                            註冊
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {showImageModal && selectedImage && (
        <ImageModal
          imageData={selectedImage}
          onClose={() => {
            setShowImageModal(false);
            setSelectedImage(null);
          }}
          currentUser={currentUser}
        />
      )}
    </>
  );
}
