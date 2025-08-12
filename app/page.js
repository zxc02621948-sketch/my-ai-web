"use client";

import { useEffect, useState, useRef } from "react";
import ImageModal from "@/components/image/ImageModal";
import { useRouter, useSearchParams } from "next/navigation";
import ImageGrid from "@/components/image/ImageGrid";
import AdminPanel from "@/components/homepage/AdminPanel";
import BackToTopButton from "@/components/common/BackToTopButton";
import { useFilterContext, labelToRating } from "@/components/context/FilterContext";
import useLikeHandler from "@/hooks/useLikeHandler";
import SortSelect from "@/components/common/SortSelect";

/* 使用者快取：開彈窗前補齊 user 物件 */
const userCache = new Map();
async function fetchUserById(id) {
  if (!id) return null;
  if (userCache.has(id)) return userCache.get(id);
  try {
    const res = await fetch(`/api/user/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const user = data?.user || data?.data || null;
    if (user) userCache.set(id, user);
    return user;
  } catch {
    return null;
  }
}
async function ensureUserOnImage(img) {
  if (!img) return img;
  const u = img.user ?? img.userId;
  if (u && typeof u === "string") {
    const user = await fetchUserById(u);
    if (user) return { ...img, user };
  }
  return img;
}

// 產生「第 1 頁」快取 key
const keyOf = (q, sort, cats, rats) => {
  const sc = (cats || []).slice().sort().join("|");
  const sr = (rats || []).slice().sort().join("|");
  return `${q || ""}__${sort}__${sc}__${sr}`;
};

// 工具：判斷 following 是否含某 uid（支援字串或 {userId, note} ）
const hasFollow = (list, uid) =>
  Array.isArray(list) &&
  list.some((f) => {
    const id = typeof f === "object" && f !== null ? f.userId : f;
    return String(id) === String(uid);
  });

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const PAGE_SIZE = 20;

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [sort, setSort] = useState("popular");
  const [selectedImage, setSelectedImage] = useState(null);
  const [currentUser, setCurrentUser] = useState(undefined);

  const fetchedOnceRef = useRef(false);
  const lastUrlSearchRef = useRef(null);
  const lastSortRef = useRef("popular");
  const lastCatsRef = useRef("[]");
  const lastRatsRef = useRef("[]");
  const loadMoreRef = useRef(null);
  const inFlight = useRef(0);
  const mapSortForApi = (s) => {
    const v = (s || "").toLowerCase();
    if (v === "likes" || v === "mostlikes") return "mostlikes";
    return v;
  };

  // ⭐ 第 1 頁快取（key = q|sort|cats|rats）
  const page1CacheRef = useRef(new Map());

  // ⬇️ 記錄與還原滾動位置（避免載入新圖後跳頂）
  const pendingScrollYRef = useRef(0);
  const needRestoreScrollRef = useRef(false);

  // ✅ 追蹤覆蓋（Map: userId -> boolean），優先於 currentUser.following
  const [followOverrides, setFollowOverrides] = useState(new Map());

  // 從 Context 讀值（含 viewMode）
  const { levelFilters, categoryFilters, resetFilters, viewMode } = useFilterContext();

  const selectedRatings = Array.isArray(levelFilters)
    ? levelFilters.map((label) => labelToRating[label]).filter(Boolean)
    : [];
  const selectedCategories = Array.isArray(categoryFilters)
    ? categoryFilters.filter(Boolean)
    : [];

  const reportClick = (id) => {
    if (!id) return;
    const key = `click:${id}`;
    const now = Date.now();
    const last = Number(localStorage.getItem(key) || 0);
    if (now - last < 30 * 1000) return;
    localStorage.setItem(key, String(now));
    fetch(`/api/images/${id}/click`, { method: "POST" }).catch(() => {});
  };

  const fetchImages = async (pageToFetch = 1, q = "", categories = [], ratings = []) => {
    // 抓下一頁時記錄滾動位置
    if (pageToFetch > 1) {
      pendingScrollYRef.current = window.scrollY || window.pageYOffset || 0;
      needRestoreScrollRef.current = true;
    }

    setIsLoading(true);
    try {
      const cats = Array.isArray(categories) ? categories.filter(Boolean) : [];
      const rats = Array.isArray(ratings) ? ratings.filter(Boolean) : [];
      const myCall = ++inFlight.current;

      const apiSort = mapSortForApi(sort);
      const params = new URLSearchParams({
        page: String(pageToFetch),
        limit: String(PAGE_SIZE),
        sort: apiSort,
        ...(q ? { q } : {}),
        ...(cats.length ? { categories: cats.join(",") } : {}),
        ...(rats.length ? { ratings: rats.join(",") } : {}),
      });

      const res = await fetch(`/api/images?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (myCall !== inFlight.current) return;

      if (res.ok && Array.isArray(data.images)) {
        const newImages = data.images;
        if (pageToFetch === 1) {
          setImages(newImages);
          // ✅ 存到第 1 頁快取
          const k = keyOf(q, apiSort, cats, rats);
          page1CacheRef.current.set(k, newImages);
        } else {
          setImages((prev) => {
            const existingIds = new Set(prev.map((img) => String(img._id)));
            const uniqueNewImages = newImages.filter((img) => !existingIds.has(String(img._id)));
            return [...prev, ...uniqueNewImages];
          });
        }
        setHasMore(newImages.length >= PAGE_SIZE);
        setPage(pageToFetch);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("載入圖片失敗：", err);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  };

  // images 變動後還原滾動位置（覆蓋 Masonry 的重排）
  useEffect(() => {
    if (!needRestoreScrollRef.current) return;
    const y = pendingScrollYRef.current || 0;

    const rafId = requestAnimationFrame(() => {
      window.scrollTo({ top: y, behavior: "auto" });
    });
    const t1 = setTimeout(() => {
      window.scrollTo({ top: y, behavior: "auto" });
    }, 120);
    const t2 = setTimeout(() => {
      window.scrollTo({ top: y, behavior: "auto" });
    }, 260);

    needRestoreScrollRef.current = false;
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [images]);

  // ⬅⬅⬅ 永遠抓最新 currentUser（避免吃舊快取）
  const fetchCurrentUser = async () => {
    try {
      const ts = Date.now();
      const res = await fetch(`/api/current-user?ts=${ts}`, { cache: "no-store" });
      if (!res.ok) throw new Error("未登入");
      const user = await res.json();
      setCurrentUser(user);
    } catch {
      setCurrentUser(null);
    }
  };

  useEffect(() => {
    fetchCurrentUser();

    // 回到分頁或視窗聚焦時，刷新 currentUser
    const onFocus = () => fetchCurrentUser();
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchCurrentUser();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // 開啟/切換大圖時，也抓一次最新 currentUser（確保初次顯示準確）
  useEffect(() => {
    if (selectedImage) fetchCurrentUser();
  }, [selectedImage]);

  const { handleToggleLike, onLikeUpdate: onLikeUpdateHook } = useLikeHandler({
    setUploadedImages: setImages,
    setLikedImages: null,
    selectedImage,
    setSelectedImage,
    currentUser,
  });

  const isLikedByCurrentUser = (img) => {
    if (!currentUser || !img.likes) return false;
    const userId = currentUser._id || currentUser.id;
    return img.likes.includes(userId);
  };

  // 🔁 搜尋 / 排序 / 分類 / 分級：任何一項變動都觸發
  useEffect(() => {
    const q = (searchParams.get("search") || "").trim();
    const byLogo = sessionStorage.getItem("homepageReset") === "1";

    const catsStr = JSON.stringify(selectedCategories);
    const ratsStr = JSON.stringify(selectedRatings);

    const nothingChanged =
      fetchedOnceRef.current &&
      q === lastUrlSearchRef.current &&
      sort === lastSortRef.current &&
      catsStr === lastCatsRef.current &&
      ratsStr === lastRatsRef.current;

    if (nothingChanged) {
      if (byLogo && q === "") {
        fetchImages(1, "", selectedCategories, selectedRatings);
        resetFilters();
        sessionStorage.removeItem("homepageReset");
      }
      return;
    }

    lastUrlSearchRef.current = q;
    lastSortRef.current = sort;
    lastCatsRef.current = catsStr;
    lastRatsRef.current = ratsStr;

    const k = keyOf(q, mapSortForApi(sort), selectedCategories, selectedRatings);
    const cached = page1CacheRef.current.get(k);

    // ⭐ 先用快取（如果有）立即顯示
    if (cached) {
      setImages(cached);
      setPage(1);
      setHasMore(cached.length >= PAGE_SIZE);
    }

    if (!fetchedOnceRef.current) {
      fetchedOnceRef.current = true;
      fetchImages(1, "", selectedCategories, selectedRatings);
      setPage(1);
      return;
    }

    if (q === "") {
      fetchImages(1, "", selectedCategories, selectedRatings);
    } else {
      const h = setTimeout(() => {
        fetchImages(1, q, selectedCategories, selectedRatings);
      }, 250);
      return () => clearTimeout(h);
    }
  }, [searchParams, sort, selectedCategories, selectedRatings]);

  // 無限滾動
  useEffect(() => {
    if (!hasMore || isLoading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const q = (searchParams.get("search") || "").trim();
          fetchImages(page + 1, q, selectedCategories, selectedRatings);
        }
      },
      { root: null, rootMargin: "0px", threshold: 1.0 }
    );
    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasMore, isLoading, page, sort, searchParams, selectedCategories, selectedRatings]);

  // 造訪追蹤
  useEffect(() => {
    fetch("/api/track-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pathname: window.location.pathname }),
    }).catch(() => {});
  }, []);

  // 開圖：補齊作者資訊
  const openImage = async (img) => {
    const enriched = await ensureUserOnImage(img);
    setSelectedImage(enriched);
    if (enriched?._id) reportClick(enriched._id);
  };

  // ← / → 導航：在目前 images 陣列內移動（不循環）
  const navigateFromSelected = async (dir) => {
    if (!selectedImage) return;
    const idx = images.findIndex((img) => String(img._id) === String(selectedImage._id));
    if (idx < 0) return;

    const nextIdx = dir === "next" ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= images.length) return;

    const target = images[nextIdx];
    const enriched = await ensureUserOnImage(target);
    setSelectedImage(enriched);
    if (enriched?._id) reportClick(enriched._id);

    // 靠近尾端提前拉下一頁
    if (dir === "next" && nextIdx >= images.length - 2 && hasMore && !isLoading) {
      const q = (searchParams.get("search") || "").trim();
      fetchImages(page + 1, q, selectedCategories, selectedRatings);
    }
  };

  // ✅ 追蹤狀態變更：同步 currentUser + 更新覆蓋（並保留 following 的原本資料形態）
  const handleFollowChange = (ownerId, isNowFollowing) => {
    const uid = String(ownerId);

    // 1) 同步 currentUser.following（維持原本陣列形態）
    setCurrentUser((prev) => {
      if (!prev) return prev;
      const list = Array.isArray(prev.following) ? prev.following : [];
      const isObjectShape = list.some((f) => typeof f === "object" && f !== null);

      if (isNowFollowing) {
        // 已存在就不重複加
        if (hasFollow(list, uid)) return prev;
        const nextList = isObjectShape
          ? [...list, { userId: uid, note: "" }]
          : [...list, uid];
        return { ...prev, following: nextList };
      } else {
        const nextList = list.filter((f) => {
          const id = typeof f === "object" && f !== null ? f.userId : f;
          return String(id) !== uid;
        });
        return { ...prev, following: nextList };
      }
    });

    // 2) 更新覆蓋表（換新 Map 觸發子元件重新計算）
    setFollowOverrides((old) => {
      const m = new Map(old);
      m.set(uid, !!isNowFollowing);
      return m;
    });
  };

  // ✅ 計算前/後一張（給手機拖曳預覽）
  const selectedIndex = selectedImage
    ? images.findIndex((img) => String(img._id) === String(selectedImage._id))
    : -1;

  const prevImage =
    selectedIndex > 0 ? images[selectedIndex - 1] : undefined;
  const nextImage =
    selectedIndex >= 0 && selectedIndex < images.length - 1
      ? images[selectedIndex + 1]
      : undefined;

  return (
    <main className="min-h-screen bg-zinc-950 text-white px-4 pb-4 pt-0 -mt-2 md:-mt-17">
      {currentUser?.isAdmin && (
        <div className="mb-4">
          <AdminPanel />
        </div>
      )}

      {/* 工具列：只保留排序（篩選面板在 Header） */}
      <div className="max-w-6xl mx-auto mb-3 flex items-center justify-end">
        <SortSelect value={sort} onChange={setSort} />
      </div>

      <ImageGrid
        images={images}
        viewMode={viewMode}
        isLoading={isLoading}
        hasMore={hasMore}
        onSelectImage={openImage}
        loadMoreRef={loadMoreRef}
        currentUser={currentUser}
        isLikedByCurrentUser={isLikedByCurrentUser}
        onToggleLike={handleToggleLike}
        onLikeUpdate={(updated) => {
          onLikeUpdateHook(updated);
        }}
      />

      <div ref={loadMoreRef} className="py-6 text-center text-zinc-400 text-sm">
        {hasMore ? "載入更多中..." : "已經到底囉"}
      </div>

      {selectedImage && currentUser !== undefined && (
        <ImageModal
          key={selectedImage?._id + "_" + (selectedImage?._forceSync || "")}
          imageData={selectedImage}
          prevImage={prevImage}
          nextImage={nextImage}
          onClose={() => {
            // 僅關閉，不重抓列表、不重設分頁，避免版面重排導致跳頂
            setSelectedImage(null);
          }}
          currentUser={currentUser}
          onLikeUpdate={(updated) => {
            onLikeUpdateHook(updated);
          }}
          onNavigate={(dir) => navigateFromSelected(dir)}
          onFollowChange={handleFollowChange}
          followOverrides={followOverrides}   // ⬅️ 傳入覆蓋表
        />
      )}

      <BackToTopButton />
    </main>
  );
}
