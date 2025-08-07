"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import FilterPanel from "@/components/common/FilterPanel";
import axios from "axios";
import NotificationBell from "@/components/common/NotificationBell";
import { usePortalContainer } from "@/components/common/usePortal";
import { createPortal } from "react-dom";
import { useFilterContext } from "@/components/context/FilterContext";
import toast from "react-hot-toast"; // 🔥 若尚未引入過記得加這行

const ImageModal = dynamic(() => import("@/components/image/ImageModal"), { ssr: false });

export default function Header({
  currentUser,
  setCurrentUser,
  onSearch,
  onLogout,
  onLoginOpen,
  onRegisterOpen,
  suggestions = [],
  onUploadClick,
  onGuideClick,
  isUserPage = false,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState(null);

  const filterButtonRef = useRef(null);
  const inputRef = useRef(null);
  const filterPanelRef = useRef(null);
  const userMenuRef = useRef(null);
  const portalContainer = usePortalContainer();
  const lastQRef = useRef("");

  const stableSuggestions = useMemo(() => suggestions, [suggestions]);

  const {
    levelFilters,
    toggleLevelFilter,
    categoryFilters,
    toggleCategoryFilter,
    viewMode,
    setViewMode,
  } = useFilterContext();

  useEffect(() => {
    const trimmed = searchQuery.trim();
    // 這裡不再負責 dispatch；事件交給「URL 驅動」那個 effect
    if (trimmed === "") setShowDropdown(false);
  }, [searchQuery, pathname]); // ✅ 同時依賴 pathname

  useEffect(() => {
    const onHome = pathname === "/" || pathname?.startsWith("/user/");
    if (!onHome) return;

    const rawQ = searchParams.get("q");
    const q = rawQ?.trim() || "";

    if (q === lastQRef.current) return;
    lastQRef.current = q;

    if (pathname === "/" && !q) {
      window.dispatchEvent(new Event("reset-homepage"));
    } else if (q) {
      window.dispatchEvent(
        new CustomEvent("global-search", { detail: { keyword: q } })
      );
    }
  }, [searchParams, pathname]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
      if (
        filterMenuOpen &&
        filterPanelRef.current &&
        !filterPanelRef.current.contains(e.target) &&
        !filterButtonRef.current.contains(e.target)
      ) {
        setFilterMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [filterMenuOpen]);

  useEffect(() => {
    const qInUrl = searchParams.get("q") || "";
    if (searchQuery === qInUrl) return;

    const next = new URLSearchParams(searchParams);
    if (searchQuery) {
      next.set("q", searchQuery);
    } else {
      next.delete("q");
    } 

    const href = `${pathname}${next.toString() ? `?${next.toString()}` : ""}`;
    router.replace(href);
  }, [searchQuery, pathname, searchParams, router]);


  useEffect(() => {
    if (filterMenuOpen && filterButtonRef.current) {
      const rect = filterButtonRef.current.getBoundingClientRect();
      setPanelPos({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
      });
    }
  }, [filterMenuOpen]);

  useEffect(() => {
   const q = searchParams.get("q")?.trim() || "";
   const onHome = pathname === "/" || pathname?.startsWith("/user/");
   if (onHome) {
    
     setSearchQuery(q);
   }
  }, [searchParams, pathname]);

  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
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
      } catch (err) {
        setShowDropdown(false);
      }
    }, 200);
    return () => clearTimeout(delayDebounce);
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
    } catch (err) {
      console.warn("搜尋紀錄送出失敗", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    await logSearch(trimmed);
 
    // 維持焦點在輸入框，保持「即時輸入 → 即時搜尋」
    inputRef.current?.focus();
    
    // 若你在非首頁希望導回首頁，可保留這段：
    const currentPath = window.location.pathname;
    if (!(currentPath === "/" || currentPath.startsWith("/user/"))) {
      const encoded = encodeURIComponent(trimmed);
      router.push(`/?q=${encoded}`);
    } else {
    }
    setShowDropdown(false);
    inputRef.current?.focus?.();
  };

  const clearSearch = () => {
    setSearchQuery("");
    setShowDropdown(false);
    
    const currentPath = window.location.pathname;
    if (currentPath !== "/") {

      router.push("/");
      setTimeout(() => {
        window.dispatchEvent(new Event("reset-homepage"));
      }, 100);
    } else {
      window.dispatchEvent(new Event("reset-homepage"));
    }
  };

  const handleLogoClick = (e) => {
    e.preventDefault();
    clearSearch();
    window.scrollTo(0, 0);
  };

  const handleSuggestionClick = async (s) => {
    const currentPath = window.location.pathname;
    if (!(currentPath === "/" || currentPath.startsWith("/user/"))) {
      const encoded = encodeURIComponent(s);
      router.push(`/?q=${encoded}`);
    } else {
      setSearchQuery(s); // 會觸發即時搜尋
    }
    await logSearch(s);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  useEffect(() => {
    const handleOpenImage = (e) => {
      const { imageId } = e.detail;
      if (imageId === selectedImageId && showImageModal) return;
      setSelectedImageId(imageId);
      setShowImageModal(true);
    };
    window.addEventListener("openImageModal", handleOpenImage);
    return () => window.removeEventListener("openImageModal", handleOpenImage);
  }, []);

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
            <div className="relative w-full">
              <form
                onSubmit={handleSubmit}
                className="flex w-full rounded-lg bg-zinc-800 border border-zinc-600 focus-within:ring-2 focus-within:ring-blue-500 overflow-hidden"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
                        inputRef.current?.blur();  
                        setTimeout(() => {
                          inputRef.current?.focus();  
                        }, 0);
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
            )
          }
        </div>

        {/* 右側操作區 */}
        <div className="flex items-center gap-2">
        <button
          onClick={() => {
            if (!currentUser) {
              toast("請先登入才能上傳圖片", {
                icon: "🔒",
                id: "login-required",
                duration: 1000, // 顯示時間 1 秒
              });
              return;
            }
              onUploadClick();
          }}
          className="px-4 py-2 text-base rounded bg-green-600 text-white hover:bg-green-700 font-medium"
        >  
          上傳圖片
        </button>
          <Link href="/models">
            <button className="px-4 py-2 text-base rounded bg-sky-600 text-white hover:bg-sky-700 font-medium">獲取模型</button>
          </Link>
          <button onClick={onGuideClick} className="px-4 py-2 text-base rounded bg-purple-600 text-white hover:bg-purple-700 font-medium">安裝教學</button>

          {currentUser && <NotificationBell currentUser={currentUser} />}

          {/* ✅ 補上登入 / 註冊按鈕 */}
          <div className="relative" ref={userMenuRef}>
            {currentUser === undefined ? (
              <div className="px-4 py-2 bg-zinc-800 text-gray-400 rounded text-sm">🔄 載入中...</div>
            ) : (
              <>
                <button
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  className="px-4 py-2 bg-zinc-800 text-white rounded-full hover:bg-zinc-700 text-sm font-medium min-w-[140px] text-left"
                >
                  {currentUser?.username
          ? `👤 ${currentUser.username} ▼`
          : "🔑 登入 / 註冊 ▼"}
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-40 bg-zinc-800 text-white rounded shadow-md py-1 z-50">
                    {currentUser?.username ? (
                      <>
                        <Link href={`/user/${currentUser._id}`} className="block px-4 py-2 hover:bg-zinc-700 text-sm">
                          我的頁面
                        </Link>
                        <button
                          onClick={async () => {
                            localStorage.removeItem("ratingFilters");
                            localStorage.removeItem("categoryFilters");
                            localStorage.removeItem("viewMode");

                            window.dispatchEvent(new Event("reset-homepage"));

                            await axios.post("/api/auth/logout", {}, { withCredentials: true });
                            location.reload();
                          }}
                          className="block w-full text-left px-4 py-2 hover:bg-zinc-700 text-sm text-red-400"
                        >
                          登出
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={onLoginOpen} className="block w-full text-left px-4 py-2 hover:bg-zinc-700 text-sm">
                          登入
                        </button>
                        <button onClick={onRegisterOpen} className="block w-full text-left px-4 py-2 hover:bg-zinc-700 text-sm">
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

