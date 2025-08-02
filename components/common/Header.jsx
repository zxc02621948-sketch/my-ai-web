// Header.jsx
"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import FilterPanel from "@/components/common/FilterPanel";
import axios from "axios";
import NotificationBell from "@/components/common/NotificationBell";

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
  showFilterButton = false,
  levelFilters = [],
  categoryFilters = [],
  viewMode = "default",
  toggleLevelFilter = () => {},
  toggleCategoryFilter = () => {},
  setViewMode = () => {},
  isUserPage = false,
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const stableSuggestions = useMemo(() => suggestions, [suggestions]);

  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState(null);

  const filterButtonRef = useRef(null);
  const userMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (filterMenuOpen && filterButtonRef.current) {
      const rect = filterButtonRef.current.getBoundingClientRect();
      setPanelPos({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
      });
    }
  }, [filterMenuOpen]);

  // ✅ 即時搜尋建議下拉選單
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchQuery.trim() !== "") {
        const lower = searchQuery.toLowerCase();
        const filtered = stableSuggestions
          .filter((s) => s.toLowerCase().includes(lower))
          .slice(0, 6);
        setFilteredSuggestions(filtered);
        setShowDropdown(filtered.length > 0);
      } else {
        setShowDropdown(false);
      }
    }, 200);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery, stableSuggestions]);

  // ✅ 即時搜尋：輸入時立即觸發 onSearch
  useEffect(() => {
    if (typeof onSearch === "function") {
      onSearch(searchQuery.trim());
    }
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

    const currentPath = window.location.pathname;
    const encoded = encodeURIComponent(trimmed);

    if (currentPath === "/" || currentPath.startsWith("/user/")) {
      if (typeof onSearch === "function") onSearch(trimmed);
    } else {
      router.push(`/?q=${encoded}`);
    }

    setShowDropdown(false);
  };

  const clearSearch = () => {
    setSearchQuery("");
    if (onSearch) onSearch("");
    setShowDropdown(false);
  };

  const handleLogoClick = (e) => {
    e.preventDefault();
    clearSearch();
    window.scrollTo(0, 0);
    router.push("/");
  };

  const handleSuggestionClick = async (s) => {
    setSearchQuery(s);
    if (onSearch) onSearch(s);
    await logSearch(s);
    setShowDropdown(false);
  };

  // ✅ 接收全站觸發的圖片彈窗事件
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

        {/* 中間區塊：篩選 + 搜尋列 */}
        <div className="flex-1 flex items-center justify-center max-w-6xl w-full min-w-[600px]">
          <div className="flex items-center gap-2 w-full max-w-md">
            {/* 篩選按鈕區塊 */}
            <div className="w-[80px] shrink-0">
              <button
                ref={filterButtonRef}
                onClick={() => setFilterMenuOpen((prev) => !prev)}
                className={`w-full px-4 py-2 rounded text-white text-base font-medium transition duration-200 ${
                  showFilterButton ? "bg-blue-600 hover:bg-blue-700" : "invisible"
                }`}
              >
                篩選
              </button>
            </div>

            {/* 搜尋列區域 */}
            <div className="relative w-full">
              <form
                onSubmit={handleSubmit}
                className="flex w-full rounded-lg bg-zinc-800 border border-zinc-600 focus-within:ring-2 focus-within:ring-blue-500 overflow-hidden"
              >
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜尋標題、作者、標籤…"
                  className="flex-1 pl-4 pr-2 py-2 rounded-l bg-zinc-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-r bg-zinc-700 text-white hover:bg-zinc-600 text-sm font-medium"
                >
                  搜尋
                </button>
              </form>

              {showDropdown && (
                <ul className="absolute z-50 mt-1 w-full bg-zinc-800 border border-zinc-700 rounded shadow-md text-sm text-white max-h-60 overflow-y-auto">
                  {filteredSuggestions.map((s, i) => (
                    <li
                      key={i}
                      onClick={() => handleSuggestionClick(s)}
                      className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {showFilterButton && filterMenuOpen && (
            <div className="fixed top-[70px] left-1/2 transform -translate-x-1/2 ml-[-192px] z-50">
              <div className="bg-zinc-900 border border-zinc-700 shadow-xl rounded-xl p-4 max-w-md w-[17.5vw]">
                <FilterPanel
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
            </div>
          )}
        </div>

        {/* 右側操作區 */}
        <div className="flex items-center gap-2">
          <button onClick={onUploadClick} className="px-4 py-2 text-base rounded bg-green-600 text-white hover:bg-green-700 font-medium">
            上傳圖片
          </button>

          <Link href="/models">
            <button className="px-4 py-2 text-base rounded bg-sky-600 text-white hover:bg-sky-700 font-medium">
              獲取模型
            </button>
          </Link>

          <button onClick={onGuideClick} className="px-4 py-2 text-base rounded bg-purple-600 text-white hover:bg-purple-700 font-medium">
            安裝教學
          </button>

          {currentUser && <NotificationBell currentUser={currentUser} />}

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
                            await axios.post("/api/auth/logout", {}, { withCredentials: true });
                            setCurrentUser(null);
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
