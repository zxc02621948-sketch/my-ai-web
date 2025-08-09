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

const ImageModal = dynamic(() => import("@/components/image/ImageModal"), { ssr: false });

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

  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState(null);

  const filterButtonRef = useRef(null);
  const inputRef = useRef(null);
  const filterPanelRef = useRef(null);
  const userMenuRef = useRef(null);
  const portalContainer = usePortalContainer();

  // ✅ 搜尋下拉用的容器，用來偵測點外關閉
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

  // ✅ 標記是「使用者打字」而非 URL 回寫，避免雙向同步回圈
  const isUserTypingRef = useRef(false);
  const debounceTimerRef = useRef(null);

  // ✅ 就地搜尋／清空：一律以目前頁面 pathname 作為基底
  const buildHref = (term) => {
    const q = (term || "").trim();
    return q ? `${pathname}?search=${encodeURIComponent(q)}` : pathname;
  };

  // URL → 輸入框（只讀 search；這是「外部同步」，要清掉使用者輸入旗標）
  useEffect(() => {
    const q = searchParams.get("search")?.trim() || "";
    setSearchQuery(q);
    isUserTypingRef.current = false; // 外部同步，不觸發輸入路徑
  }, [searchParams]);

  // 🟢 即時搜尋：輸入框 → URL（僅在「使用者正在輸入」且非組字中時執行）
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

  // 🔒 點空白處關閉「篩選面板」
  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (!filterMenuOpen) return;
      const panel = filterPanelRef.current;
      const btn = filterButtonRef.current;
      if (panel && !panel.contains(e.target) && btn && !btn.contains(e.target)) {
        setFilterMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [filterMenuOpen]);

  // 🔒 點空白 / Esc / 捲動 → 關閉「搜尋建議下拉」
  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (!showDropdown) return;
      const box = searchBoxRef.current;
      if (box && !box.contains(e.target)) setShowDropdown(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setShowDropdown(false);
    };
    const onAnyScroll = () => {
      if (showDropdown) setShowDropdown(false);
    };

    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    // 第三個參數 true：在捕獲階段也接收（包含可滾容器）
    window.addEventListener("scroll", onAnyScroll, true);

    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onAnyScroll, true);
    };
  }, [showDropdown]);

  // ✅ 使用者選單：點外面 + Esc 關閉
  useEffect(() => {
    const handleOutside = (e) => {
      if (!userMenuOpen) return;
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") setUserMenuOpen(false);
    };
    document.addEventListener("pointerdown", handleOutside, true);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("pointerdown", handleOutside, true);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [userMenuOpen]);

  // ✅ 路由切換自動關閉使用者選單（點「我的頁面」導頁時）
  useEffect(() => {
    setUserMenuOpen(false);
  }, [pathname]);

  // 下拉建議（純顯示，不動 URL）
  useEffect(() => {
    const delay = setTimeout(async () => {
      const input = searchQuery.toLowerCase().trim();
      if (!input) {
        setFilteredSuggestions([]);
        setShowDropdown(false);
        return;
      }
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(input)}`);
        if (!res.ok) throw new Error("API 錯誤");
        const data = await res.json();
        setFilteredSuggestions(data.slice(0, 6));
        setShowDropdown(data.length > 0);
      } catch {
        setShowDropdown(false);
      }
    }, 200);
    return () => clearTimeout(delay);
  }, [searchQuery]);

  const logSearch = async (keyword) => {
    const level =
      currentUser?.isAdmin || currentUser?.level === "18"
        ? "18"
        : currentUser?.level === "15"
        ? "15"
        : "all";
    try {
      await fetch("/api/log-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, level }),
      });
    } catch {}
  };

  const handleInputChange = (e) => {
    isUserTypingRef.current = true; // 標記這是「使用者輸入」路徑
    setSearchQuery(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    await logSearch(trimmed);
    isUserTypingRef.current = false; // 接下來交給 URL → state
    router.push(buildHref(trimmed));
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const clearSearch = () => {
    setShowDropdown(false);
    setSearchQuery("");              // 先清 UI
    isUserTypingRef.current = false; // 避免立刻又進入輸入路徑
    router.push(buildHref(""));      // 就地清空：變成當前 pathname
  };

  const handleLogoClick = (e) => {
    e.preventDefault();

    setShowDropdown(false);
    setFilterMenuOpen(false);
    setSearchQuery("");
    isUserTypingRef.current = false;

    // ✅ 直接清篩選
    resetFilters();

    if (pathname !== "/") {
      router.push("/");
    } else {
      const hasSearch = !!(searchParams.get("search") || "");
      if (hasSearch) router.replace("/");
      // 否則已經是乾淨首頁了，不需要再動
    }

    window.scrollTo(0, 0);
  };

  const handleSuggestionClick = async (s) => {
    await logSearch(s);
    isUserTypingRef.current = false; // 這是選擇建議，不是輸入中
    router.push(buildHref(s));       // 就地帶入搜尋
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  // 其他與搜尋無關：開圖 modal 事件
  useEffect(() => {
    const handleOpenImage = (e) => {
      const { imageId } = e.detail;
      if (imageId === selectedImageId && showImageModal) return;
      setSelectedImageId(imageId);
      setShowImageModal(true);
    };
    window.addEventListener("openImageModal", handleOpenImage);
    return () => window.removeEventListener("openImageModal", handleOpenImage);
  }, [selectedImageId, showImageModal]);

  return (
    <>
      <header className="fixed top-0 left-0 w-full z-50 px-6 py-3 bg-zinc-900 border-b border-zinc-700 flex flex-wrap items-center justify-between gap-3 shadow-md">
        {/* Logo */}
        <div className="flex items-center gap-4 ml-8">
          <Link href="/" onClick={handleLogoClick} className="flex items-center space-x-3">
            <Image src="/ai_logo_icon.png" alt="AI 創界 Logo" width={64} height={64} className="rounded-lg" priority />
            <span className="text-white text-4xl font-extrabold tracking-wide">AI 創界</span>
          </Link>
        </div>

        {/* 篩選＋搜尋 */}
        <div className="flex-1 flex items-center justify-center max-w-6xl w-full min-w-[600px]">
          <div className="flex items-center gap-2 w-full max-w-md">
            {/* 篩選按鈕 */}
            <div className="w-[80px] shrink-0">
              <button
                ref={filterButtonRef}
                onClick={() => setFilterMenuOpen((prev) => !prev)}
                className="w-full px-4 py-2 rounded text-white text-base font-medium transition duration-200 bg-blue-600 hover:bg-blue-700"
              >
                篩選
              </button>
            </div>

            {/* 搜尋列 */}
            <div className="relative w-full" ref={searchBoxRef}>
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
                  className="flex-1 pl-4 pr-2 py-2 rounded-l bg-zinc-800 text-white placeholder-gray-400 focus:outline-none"
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

          {/* 篩選面板 */}
          {filterMenuOpen &&
            createPortal(
              <div
                ref={filterPanelRef}
                className="fixed top-[72px] left-[calc(405px)] z-[99999]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-zinc-900 border border-zinc-700 shadow-xl rounded-xl p-4">
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

        {/* 右側操作區 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!currentUser) {
                toast("請先登入才能上傳圖片", { icon: "🔒", id: "login-required", duration: 1000 });
                return;
              }
              onUploadClick();
            }}
            className="px-4 py-2 text-base rounded bg-green-600 text-white hover:bg-green-700 font-medium"
          >
            上傳圖片
          </button>
          <Link href="/models">
            <button className="px-4 py-2 text-base rounded bg-sky-600 text-white hover:bg-sky-700 font-medium">
              獲取模型
            </button>
          </Link>
          <button
            onClick={onGuideClick}
            className="px-4 py-2 text-base rounded bg-purple-600 text-white hover:bg-purple-700 font-medium"
          >
            安裝教學
          </button>

          {currentUser && <NotificationBell currentUser={currentUser} />}

          {/* 使用者選單 */}
          <div className="relative" ref={userMenuRef}>
            {currentUser === undefined ? (
              <div className="px-4 py-2 bg-zinc-800 text-gray-400 rounded text-sm">🔄 載入中...</div>
            ) : (
              <>
                <button
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  className="px-4 py-2 bg-zinc-800 text-white rounded-full hover:bg-zinc-700 text-sm font-medium min-w-[140px] text-left"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                >
                  {currentUser?.username ? `👤 ${currentUser.username} ▼` : "🔑 登入 / 註冊 ▼"}
                </button>

                {userMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-40 bg-zinc-800 text-white rounded shadow-md py-1 z-50"
                    role="menu"
                  >
                    {currentUser?.username ? (
                      <>
                        <Link
                          href={`/user/${currentUser._id}`}
                          className="block px-4 py-2 hover:bg-zinc-700 text-sm"
                          onClick={() => setUserMenuOpen(false)} // ← 點連結就關
                          role="menuitem"
                        >
                          我的頁面
                        </Link>
                        <button
                          onClick={async () => {
                            setUserMenuOpen(false); // ← 先關菜單
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
      </header>

      {showImageModal && selectedImageId && (
        <ImageModal
          imageId={selectedImageId}
          onClose={() => setShowImageModal(false)}
          currentUser={currentUser}
        />
      )}
    </>
  );
}
