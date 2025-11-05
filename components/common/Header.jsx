"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import FilterPanel from "@/components/common/FilterPanel";
import MusicFilterPanel from "@/components/common/MusicFilterPanel";
import axios from "axios";
import NotificationBell from "@/components/common/NotificationBell";
import { usePortalContainer } from "@/components/common/usePortal";
import { createPortal } from "react-dom";
import { useFilterContext } from "@/components/context/FilterContext";
import toast from "react-hot-toast";
import {
  Package2,
  Wrench,
  CircleHelp,
  Upload,
  MessageSquare,
} from "lucide-react";
import InboxButton from "@/components/common/InboxButton";
import TutorialMenu from "@/components/common/TutorialMenu";
import UploadDropdown from "@/components/common/UploadDropdown";
import ContentMenuButtons from "@/components/common/ContentMenuButtons";

export default function Header({
  currentUser,
  setCurrentUser,
  onLoginOpen,
  onRegisterOpen,
  suggestions = [],
  onUploadClick,
  onGuideClick,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const safeCall = (fn, ...args) =>
    typeof fn === "function" ? fn(...args) : undefined;

  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  const filterButtonRef = useRef(null);
  const inputRef = useRef(null);
  const filterPanelRef = useRef(null);
  const userMenuRef = useRef(null);
  const portalContainer = usePortalContainer();
  const searchBoxRefDesktop = useRef(null);
  const searchBoxRefMobile = useRef(null);

  // ====== 自動墊高（避免內容被 fixed header 壓到）======
  const headerRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  useLayoutEffect(() => {
    const measure = () => {
      if (!headerRef.current) return;
      const h = headerRef.current.getBoundingClientRect().height;
      setHeaderHeight(Math.ceil(h));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (headerRef.current) ro.observe(headerRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  // ======================================================

  // 篩選面板動態位置 + 是否定位完成（避免左上角閃一下）
  const [panelStyle, setPanelStyle] = useState({ top: 0, left: 0, width: 320 });
  const [panelReady, setPanelReady] = useState(false);

  const {
    levelFilters,
    toggleLevelFilter,
    categoryFilters,
    toggleCategoryFilter,
    typeFilters,
    languageFilters,
    toggleTypeFilter,
    toggleLanguageFilter,
    viewMode,
    setViewMode,
    resetFilters,
    setSort, // ← 新增
  } = useFilterContext();

  const isUserTypingRef = useRef(false);
  const debounceTimerRef = useRef(null);

  // ==== 新增：哪些路由支援「就地搜尋」 ====
  const LOCAL_SEARCH_PATHS = [
    /^\/$/, // 首頁（圖片搜尋）
    /^\/videos$/, // 影片頁
    /^\/music$/, // 音樂頁（如有）
    /^\/user\//, // 個人頁
    /^\/tag\//, // 標籤頁（如有）
    /^\/collection\//, // 收藏/清單頁（如有）
  ];
  const supportsLocalSearch = (p) =>
    LOCAL_SEARCH_PATHS.some((re) => re.test(p || ""));

  // ⬇️ 改成「就地或首頁」二選一
  const buildHref = (term, path = pathname || "/") => {
    const q = (term || "").trim();
    const base = supportsLocalSearch(path) ? path : "/";
    return q ? `${base}?search=${encodeURIComponent(q)}` : base;
  };

  // URL → 輸入框
  useEffect(() => {
    const q = searchParams.get("search")?.trim() || "";
    setSearchQuery(q);
    isUserTypingRef.current = false;
  }, [searchParams]);

  // 輸入框 → URL（debounce：就地或首頁）
  useEffect(() => {
    if (!isUserTypingRef.current) return;
    if (isComposing) return;
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      const target = buildHref(searchQuery, pathname);
      const currentQuery = searchParams.toString();
      const currentHref = `${typeof window !== "undefined" ? window.location.pathname : "/"}${currentQuery ? `?${currentQuery}` : ""}`;
      if (currentHref === target) return;
      router.replace(target);
    }, 200);
    return () => clearTimeout(debounceTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, isComposing, pathname]);

  const [liveSuggestions, setLiveSuggestions] = useState(suggestions || []);
  useEffect(() => {
    setLiveSuggestions(Array.isArray(suggestions) ? suggestions : []);
  }, [suggestions]);

  // 監聽首頁的廣播事件（當沒有從 props 傳入時也能更新）
  useEffect(() => {
    const onSug = (e) => {
      const list = Array.isArray(e?.detail) ? e.detail : [];
      setLiveSuggestions(list);
    };
    window.addEventListener("header-suggestions", onSug);
    return () => window.removeEventListener("header-suggestions", onSug);
  }, []);

  // 點外關閉：篩選面板 + 使用者選單 + 搜尋下拉
  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (filterMenuOpen) {
        const panel = filterPanelRef.current;
        const btn = filterButtonRef.current;
        if (
          panel &&
          !panel.contains(e.target) &&
          btn &&
          !btn.contains(e.target)
        ) {
          setFilterMenuOpen(false);
        }
      }
      if (userMenuOpen) {
        const menu = userMenuRef.current;
        if (menu && !menu.contains(e.target)) setUserMenuOpen(false);
      }
      if (showDropdown) {
        const box1 = searchBoxRefDesktop.current;
        const box2 = searchBoxRefMobile.current;
        const inDesktop = box1 && box1.contains(e.target);
        const inMobile = box2 && box2.contains(e.target);
        if (!inDesktop && !inMobile) setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [filterMenuOpen, userMenuOpen, showDropdown]);

  // 路由/查詢變更時，自動收起篩選面板
  useEffect(() => {
    setFilterMenuOpen(false);
  }, [searchParams]);

  // 搜尋建議（來自 props 或事件）
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setShowDropdown(false);
      setFilteredSuggestions([]);
      return;
    }
    const list = (liveSuggestions || [])
      .filter(
        (s) =>
          typeof s === "string" && s.toLowerCase().includes(q.toLowerCase()),
      )
      .slice(0, 8);
    setFilteredSuggestions(list);
    setShowDropdown(list.length > 0);
  }, [searchQuery, liveSuggestions]);

  // 面板動態定位（開啟/視窗大小重算）
  useLayoutEffect(() => {
    if (!filterMenuOpen) return;

    setPanelReady(false);
    const positionPanel = () => {
      const btn = filterButtonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const gap = 8;
      const panelWidth = 320;
      const padding = 12;

      const top = rect.bottom + gap;
      const desiredLeft = rect.left;
      const maxLeft = window.innerWidth - panelWidth - padding;
      const left = Math.max(padding, Math.min(desiredLeft, maxLeft));

      setPanelStyle({ top, left, width: panelWidth });
      setPanelReady(true);
    };

    positionPanel();
    window.addEventListener("resize", positionPanel);
    return () => {
      window.removeEventListener("resize", positionPanel);
    };
  }, [filterMenuOpen]);

  const handleInputChange = (e) => {
    const v = e.target.value;
    isUserTypingRef.current = true;
    setSearchQuery(v);
    if (v === "") {
      // 清空：回「就地或首頁」；只有回首頁才需要廣播顯示全部
      isUserTypingRef.current = false;
      clearTimeout(debounceTimerRef.current);
      setShowDropdown(false);

      const base = supportsLocalSearch(pathname) ? pathname : "/";
      if (base === "/") {
        sessionStorage.setItem("homepageShowAll", "1");
        window.dispatchEvent(
          new CustomEvent("homepage-show-all", { detail: { ts: Date.now() } }),
        );
      }
      router.replace(base);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    isUserTypingRef.current = false;
    setShowDropdown(false);
    const q = (searchQuery || "").trim();

    const base = supportsLocalSearch(pathname) ? pathname : "/";
    if (!q) {
      // 空字串：就地清空或回首頁；只有回首頁才廣播顯示全部
      clearTimeout(debounceTimerRef.current);
      setSearchQuery("");
      if (base === "/") {
        sessionStorage.setItem("homepageShowAll", "1");
        window.dispatchEvent(
          new CustomEvent("homepage-show-all", { detail: { ts: Date.now() } }),
        );
      }
      router.push(base);
      return;
    }

    router.push(buildHref(q, pathname));
  };

  const handleSuggestionClick = (text) => {
    isUserTypingRef.current = false;
    setSearchQuery(text);
    setShowDropdown(false);
    router.push(buildHref(text, pathname));
  };

  return (
    <>
      <header
        ref={headerRef}
        className="sticky top-0 left-0 right-0 z-50 bg-zinc-900 border-b border-zinc-700"
      >
        <div className="px-3 md:px-4 py-1 md:py-2 flex items-center justify-between gap-3">
          {/* 左：Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 md:gap-3 shrink-0"
            onClick={() => {
              // 這些在非首頁可能還沒被 Provider 提供，先安全判斷再呼叫
              safeCall(resetFilters);
              safeCall(setSort, "popular");

              sessionStorage.setItem("homepageShowAll", "1");
              window.dispatchEvent(
                new CustomEvent("homepage-show-all", {
                  detail: { ts: Date.now() },
                }),
              );

              clearTimeout(debounceTimerRef.current);
              setSearchQuery("");

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

          {/* 中：篩選 + 桌機搜尋 */}
          <div className="flex-1 min-w-0 flex items-center justify-start w-full">
            <div className="flex items-center gap-2 w-full">
              <div className="w-[92px] md:w-[110px] shrink-0">
                <button
                  ref={filterButtonRef}
                  onClick={() => setFilterMenuOpen((prev) => !prev)}
                  className="w-full px-3 py-2 md:px-4 rounded-lg text-white text-sm md:text-base font-semibold transition
                             bg-blue-600 hover:bg-blue-700 border border-blue-400/40 shadow-[0_0_0_1px_rgba(59,130,246,0.25)]"
                  title="篩選"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Wrench className="w-4 h-4" />
                    <span>篩選</span>
                  </span>
                </button>
              </div>

              {/* 桌機搜尋列 */}
              <div
                className="relative flex-1 min-w-0 hidden md:block"
                ref={searchBoxRefDesktop}
              >
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
                    className="flex-1 min-w-0 pl-4 pr-2 py-2 rounded-l bg-zinc-800 text-white placeholder-gray-400 focus:outline-none text-base"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-r bg-zinc-700 text-white hover:bg-zinc-600 text-sm font-medium"
                  >
                    搜尋
                  </button>
                </form>

                {showDropdown && !isComposing && (
                  <ul className="absolute z-50 mt-1 w-full bg-zinc-800 border border-zinc-700 rounded shadow-md text-sm text-white max-h-60 overflow-y-auto">
                    {filteredSuggestions.map((s, i) => (
                      <li
                        key={i}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSuggestionClick(s);
                        }}
                        className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* 篩選面板（Portal，動態定位） */}
            {filterMenuOpen &&
              createPortal(
                <div
                  ref={filterPanelRef}
                  style={{
                    position: "fixed",
                    top: panelStyle.top,
                    left: panelStyle.left,
                    width: panelStyle.width,
                    maxWidth: "90vw",
                    zIndex: 99999,
                    visibility: panelReady ? "visible" : "hidden",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="bg-zinc-900 border border-zinc-700 shadow-xl rounded-xl p-3 md:p-4">
                    {pathname === "/music" ? (
                      <MusicFilterPanel
                        currentUser={currentUser}
                        filterMenuOpen={filterMenuOpen}
                        setFilterMenuOpen={setFilterMenuOpen}
                        levelFilters={levelFilters}
                        categoryFilters={categoryFilters}
                        viewMode={viewMode}
                        toggleLevelFilter={toggleLevelFilter}
                        toggleCategoryFilter={toggleCategoryFilter}
                        onToggleLevel={toggleLevelFilter}
                        onToggleCategory={toggleCategoryFilter}
                        setViewMode={setViewMode}
                      />
                    ) : (
                      <FilterPanel
                        currentUser={currentUser}
                        filterMenuOpen={filterMenuOpen}
                        setFilterMenuOpen={setFilterMenuOpen}
                        levelFilters={levelFilters}
                        categoryFilters={categoryFilters}
                        viewMode={viewMode}
                        toggleLevelFilter={toggleLevelFilter}
                        toggleCategoryFilter={toggleCategoryFilter}
                        onToggleLevel={toggleLevelFilter}
                        onToggleCategory={toggleCategoryFilter}
                        setViewMode={setViewMode}
                      />
                    )}
                  </div>
                </div>,
                portalContainer || document.body,
              )}
          </div>

          {/* 右：操作區 */}
          <div className="flex items-center gap-2 md:gap-2 lg:gap-3 shrink-0">
            <div className="hidden md:block">
              <UploadDropdown />
            </div>

            <div className="hidden md:block">
              <TutorialMenu onGuideClick={onGuideClick} />
            </div>

            {currentUser && <NotificationBell />}
            {currentUser && <InboxButton />}

            {/* 使用者選單 */}
            <div className="relative" ref={userMenuRef}>
              {currentUser === undefined ? (
                <div className="px-3 md:px-4 py-2 bg-zinc-800 text-gray-400 rounded text-sm">
                  🔄
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setUserMenuOpen((prev) => !prev)}
                    className="px-3 md:px-4 py-2 bg-zinc-800 text白 rounded-full hover:bg-zinc-700 text-sm font-medium min-w-[40px] md:min-w-[140px] max-w-[160px] truncate text-left"
                    aria-haspopup="menu"
                    aria-expanded={userMenuOpen}
                    title={currentUser?.username || "登入 / 註冊"}
                  >
                    <span className="md:hidden" aria-hidden>
                      👤
                    </span>
                    <span className="hidden md:inline">
                      {currentUser?.username
                        ? `👤 ${currentUser.username} ▼`
                        : "🔑 登入 / 註冊 ▼"}
                    </span>
                  </button>

                  {userMenuOpen && (
                    <div
                      className="absolute right-0 mt-2 w-48 bg-zinc-800 text白 rounded shadow-md py-1 z-50"
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
                            👤 我的頁面
                          </Link>

                          <Link
                            href="/store"
                            className="block px-4 py-2 hover:bg-zinc-700 text-sm"
                            onClick={() => setUserMenuOpen(false)}
                            role="menuitem"
                          >
                            🛍️ 積分商店
                          </Link>

                          <Link
                            href="/settings"
                            className="block px-4 py-2 hover:bg-zinc-700 text-sm"
                            onClick={() => setUserMenuOpen(false)}
                            role="menuitem"
                          >
                            ⚙️ 設定
                          </Link>

                          <div className="border-t border-zinc-700 my-1"></div>

                          <button
                            onClick={async () => {
                              setUserMenuOpen(false);
                              localStorage.clear();
                              await axios.post(
                                "/api/auth/logout",
                                {},
                                { withCredentials: true },
                              );
                              location.reload();
                            }}
                            className="block w-full text-left px-4 py-2 hover:bg-zinc-700 text-sm text-red-400"
                            role="menuitem"
                          >
                            🚪 登出
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setUserMenuOpen(false);
                              onLoginOpen?.();
                            }}
                            className="block w-full text-left px-4 py-2 hover:bg-zinc-700 text-sm"
                            role="menuitem"
                          >
                            登入
                          </button>
                          <button
                            onClick={() => {
                              setUserMenuOpen(false);
                              onRegisterOpen?.();
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

        {/* 內容專區按鈕列（桌面版和手機版） */}
        <div className="px-3 md:px-6 py-2 border-t border-zinc-700/50 bg-zinc-900/50">
          <ContentMenuButtons />
        </div>

        {/* 第二列：📱 手機搜尋專用 */}
        <div
          className="md:hidden px-3 pb-1.5 pt-1 border-t border-zinc-700"
          ref={searchBoxRefMobile}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit(e);
            }}
            className="flex w-full rounded-lg bg-zinc-800 border border-zinc-600 focus-within:ring-2 focus-within:ring-blue-500 overflow-hidden"
          >
            <input
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder="搜尋標題、作者、標籤…"
              className="flex-1 min-w-0 pl-3 pr-2 py-2 rounded-l bg-zinc-800 text白 placeholder-gray-400 focus:outline-none text-sm"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-r bg-zinc-700 text白 hover:bg-zinc-600 text-sm font-medium"
            >
              搜尋
            </button>
          </form>

          {showDropdown && !isComposing && (
            <ul className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded shadow-md text-sm text白 max-h-60 overflow-y-auto">
              {filteredSuggestions.map((s, i) => (
                <li
                  key={i}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSuggestionClick(s);
                  }}
                  className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 第三列：📱 手機常用功能 */}
        <div className="md:hidden px-3 pb-2 border-t border-zinc-700/50">
          <div
            className="flex gap-2 overflow-x-auto overflow-y-hidden"
            style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}
          >
            <TutorialMenu onGuideClick={onGuideClick} />

            <div className="md:hidden shrink-0">
              <UploadDropdown />
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
