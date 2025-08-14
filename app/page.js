"use client";

import { useEffect, useState, useRef } from "react";
import ImageModal from "@/components/image/ImageModal";
import { useSearchParams } from "next/navigation";
import ImageGrid from "@/components/image/ImageGrid";
import AdminPanel from "@/components/homepage/AdminPanel";
import BackToTopButton from "@/components/common/BackToTopButton";
import { useFilterContext, labelToRating } from "@/components/context/FilterContext";
import useLikeHandler from "@/hooks/useLikeHandler";
import SortSelect from "@/components/common/SortSelect";

/* ---------- 開圖前補齊 user 物件的快取 ---------- */
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

/* ---------- 產生第 1 頁快取 key ---------- */
const keyOf = (q, sort, cats, rats) => {
  const sc = (cats || []).slice().sort().join("|");
  const sr = (rats || []).slice().sort().join("|");
  return `${q || ""}__${sort}__${sc}__${sr}`;
};

/* ---------- following 名單判斷工具 ---------- */
const hasFollow = (list, uid) =>
  Array.isArray(list) &&
  list.some((f) => {
    const id = typeof f === "object" && f !== null ? f.userId : f;
    return String(id) === String(uid);
  });

export default function HomePage() {
  const searchParams = useSearchParams();

  const PAGE_SIZE = 20;

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [previewImages, setPreviewImages] = useState(null);
  const [sort, setSort] = useState("popular");
  const [selectedImage, setSelectedImage] = useState(null);
  const [currentUser, setCurrentUser] = useState(undefined);

  const [fetchedOnce, setFetchedOnce] = useState(false);

  const fetchedOnceRef = useRef(false);
  const lastUrlSearchRef = useRef(null);
  const lastSortRef = useRef("popular");
  const lastCatsRef = useRef("[]");
  const lastRatsRef = useRef("[]");
  const loadMoreRef = useRef(null);

  // request 去重
  const inFlightId = useRef(0);

  // 第 1 頁快取
  const page1CacheRef = useRef(new Map());

  // 追蹤覆蓋（Map: userId -> boolean）
  const [followOverrides, setFollowOverrides] = useState(new Map());

  // 從 Context 讀值（含 viewMode）
  const { levelFilters, categoryFilters, resetFilters, viewMode } = useFilterContext();

  const selectedRatings = Array.isArray(levelFilters)
    ? levelFilters.map((label) => labelToRating[label]).filter(Boolean)
    : [];
  const selectedCategories = Array.isArray(categoryFilters)
    ? categoryFilters.filter(Boolean)
    : [];

  // reload 時固定回頂
  useEffect(() => {
    if (typeof window === "undefined") return;

    const nav = performance.getEntriesByType?.("navigation")?.[0];
    const isReload =
      (nav && nav.type === "reload") ||
      (window.performance && window.performance.navigation && window.performance.navigation.type === 1);

    if (isReload) {
      const prev = history.scrollRestoration;
      try { history.scrollRestoration = "manual"; } catch {}
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        try { history.scrollRestoration = prev || "auto"; } catch {}
      });
    }
  }, []);

  // 預載依賴
  useEffect(() => {
    import("masonry-layout");
    import("imagesloaded");
  }, []);

  const reportClick = (id) => {
    if (!id) return;
    const key = `click:${id}`;
    const now = Date.now();
    const last = Number(localStorage.getItem(key) || 0);
    if (now - last < 30 * 1000) return;
    localStorage.setItem(key, String(now));
    fetch(`/api/images/${id}/click`, { method: "POST" }).catch(() => {});
  };

  /* ---------- 本地過濾器（先行預覽 + 保底） ---------- */
  const norm = (s) => (s ?? "").toString().toLowerCase();
  function applyLocalFilter(arr, q, cats, rats) {
    if (!Array.isArray(arr)) return [];
    const qn = norm(q);
    const hasQ = !!qn;
    const hasC = Array.isArray(cats) && cats.length > 0;
    const hasR = Array.isArray(rats) && rats.length > 0;
    if (!hasQ && !hasC && !hasR) return arr;
    return arr.filter((img) => {
      const t = norm(img?.title);
      const p = norm(img?.description || img?.positivePrompt || "");
      const u = norm(img?.user?.username || img?.user?.name || "");
      const tagList = Array.isArray(img?.tags) ? img.tags.map(norm) : [];
      const hitTag = hasQ && tagList.some((tag) => tag.includes(qn));
      const hitQ = !hasQ || t.includes(qn) || p.includes(qn) || u.includes(qn) || hitTag;

      const ic = img?.category || img?.categories;
      const imgCats = Array.isArray(ic) ? ic.map(norm) : (ic ? [norm(ic)] : []);
      const hitC = !hasC || cats.some((c) => imgCats.includes(norm(c)));

      const r = typeof img?.rating === "number" || typeof img?.rating === "string" ? String(img.rating) : null;
      const ratsStr = (rats || []).map((x) => String(x));
      const hitR = !hasR || (r !== null && ratsStr.includes(r));

      return hitQ && hitC && hitR;
    });
  }

  const mapSortForApi = (s) => {
    const v = (s || "").toLowerCase();
    if (v === "likes" || v === "mostlikes") return "mostlikes";
    return v;
  };

  /* ---------- 防跳頂守門員（溫和版） ---------- */
  const antiTopJumpRef = useRef({
    active: false,
    y: 0,
    until: 0,
    rafId: 0,
  });
  const lastYRef = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || window.pageYOffset || 0;
      const dy = y - lastYRef.current;
      lastYRef.current = y;
      if (antiTopJumpRef.current.active && dy < -8) {
        antiTopJumpRef.current.active = false;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const startAntiTopLoop = () => {
    const g = antiTopJumpRef.current;
    cancelAnimationFrame(g.rafId || 0);
    const tick = () => {
      if (!g.active) return;
      const now = performance.now();
      if (now > g.until) {
        g.active = false;
        return;
      }
      const cur = window.scrollY || window.pageYOffset || 0;
      const threshold = Math.max(240, Math.floor(window.innerHeight * 0.7));
      if (cur < g.y - threshold) {
        window.scrollTo({ top: g.y, behavior: "auto" });
      }
      g.rafId = requestAnimationFrame(tick);
    };
    g.rafId = requestAnimationFrame(tick);
  };

  function armAntiTopJumpGuard(ms = 800) {
    antiTopJumpRef.current = {
      active: true,
      y: window.scrollY || window.pageYOffset || 0,
      until: performance.now() + ms,
      rafId: 0,
    };
    startAntiTopLoop();
  }

  useEffect(() => {
    return () => cancelAnimationFrame(antiTopJumpRef.current.rafId || 0);
  }, []);

  /* ---------- 子函式：用多鍵名打一頁 ---------- */
  async function fetchOnePage(pageToFetch, q, cats, rats) {
    const apiSort = mapSortForApi(sort);
    const baseParams = {
      page: String(pageToFetch),
      limit: String(PAGE_SIZE),
      sort: apiSort,
      ...(cats.length ? { categories: cats.join(",") } : {}),
      ...(rats.length ? { ratings: rats.join(",") } : {}),
    };

    const keys = q ? ["search", "q", "query", "keyword", "term"] : [null];
    let data = null;

    for (const key of keys) {
      const params = new URLSearchParams(baseParams);
      if (key) params.set(key, q);
      // eslint-disable-next-line no-console
      console.log("[fetchImages] GET /api/images?" + params.toString());

      const res = await fetch(`/api/images?${params.toString()}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));

      if (Array.isArray(json?.images)) {
        data = json;
        if (json.images.length > 0 || key === keys[keys.length - 1]) break;
      }
    }

    const serverImages = Array.isArray(data?.images) ? data.images : [];
    const filtered = q ? applyLocalFilter(serverImages, q, cats, rats) : serverImages;
    return { serverImages, filtered };
  }

  /* ---------- 核心：取圖（保底搜尋 + 連續抓頁） ---------- */
  const fetchImages = async (pageToFetch = 1, q = "", categories = [], ratings = []) => {
    setIsLoading(true);
    try {
      const cats = Array.isArray(categories) ? categories.filter(Boolean) : [];
      const rats = Array.isArray(ratings) ? ratings.filter(Boolean) : [];

      const myId = ++inFlightId.current;

      // 先抓當前這一頁
      let { serverImages, filtered } = await fetchOnePage(pageToFetch, q, cats, rats);
      if (myId !== inFlightId.current) return;

      let combined = filtered;
      let curPage = pageToFetch;
      let lastServerBatchSize = serverImages.length;

      // 若是搜尋而且這一頁沒有命中 → 連續往後抓，最多 5 頁或湊滿至少 24 張為止
      const WANT = 24;
      const MAX_PAGES = 5;
      if (q && pageToFetch === 1 && combined.length < Math.min(WANT, PAGE_SIZE)) {
        while (
          combined.length < WANT &&
          lastServerBatchSize >= PAGE_SIZE &&
          curPage < MAX_PAGES
        ) {
          const nextPage = curPage + 1;
          const r = await fetchOnePage(nextPage, q, cats, rats);
          if (myId !== inFlightId.current) return;

          lastServerBatchSize = r.serverImages.length;
          if (r.filtered.length > 0) {
            // 去重後追加
            const existingIds = new Set(combined.map((img) => String(img._id)));
            const unique = r.filtered.filter((img) => !existingIds.has(String(img._id)));
            combined = [...combined, ...unique];
          }
          curPage = nextPage;
          if (r.serverImages.length < PAGE_SIZE) break; // 伺服器沒更多
        }
      }

      if (pageToFetch === 1) {
        setImages(combined);
        setPreviewImages(null);
        setFetchedOnce(true);
        const apiSort = mapSortForApi(sort);
        const k = keyOf(q, apiSort, cats, rats);
        page1CacheRef.current.set(k, combined);
      } else {
        setImages((prev) => {
          const existingIds = new Set(prev.map((img) => String(img._id)));
          const uniqueNewImages = combined.filter((img) => !existingIds.has(String(img._id)));
          return [...prev, ...uniqueNewImages];
        });
      }

      // hasMore 以「伺服器實際回傳的數量」判斷，不被前端過濾影響
      setHasMore(serverImages.length >= PAGE_SIZE);
      setPage(pageToFetch);
    } catch (err) {
      console.error("載入圖片失敗：", err);
    } finally {
      setIsLoading(false);
    }
  };

  /* ---------- 目前登入者 ---------- */
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
    const onFocus = () => fetchCurrentUser();
    const onVisible = () => { if (document.visibilityState === "visible") fetchCurrentUser(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (selectedImage) fetchCurrentUser();
  }, [selectedImage]);

  /* ---------- Like（共用 hook） ---------- */
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

  /* ---------- 搜尋 / 排序 / 篩選 觸發 ---------- */
  useEffect(() => {
    const q =
      (
        searchParams.get("search") ||
        searchParams.get("q") ||
        searchParams.get("query") ||
        searchParams.get("keyword") ||
        searchParams.get("term") ||
        ""
      ).trim();

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

    if (cached) {
      setImages(cached);
      setPage(1);
      setHasMore(cached.length >= PAGE_SIZE);
      setFetchedOnce(true);
    } else {
      // 先用目前已載入的資料做預覽
      setPreviewImages(applyLocalFilter(images, q, selectedCategories, selectedRatings));
    }

    // ✅ 首次執行：用目前網址內的 q 直接抓，不再硬塞 ""
    if (!fetchedOnceRef.current) {
      fetchedOnceRef.current = true;
      setFetchedOnce(false);
      fetchImages(1, q, selectedCategories, selectedRatings);
      setPage(1);
      return;
    }

    if (q === "") {
      setFetchedOnce(false);
      fetchImages(1, "", selectedCategories, selectedRatings);
    } else {
      const h = setTimeout(() => {
        setFetchedOnce(false);
        fetchImages(1, q, selectedCategories, selectedRatings);
      }, 250);
      return () => clearTimeout(h);
    }
  }, [searchParams, sort, selectedCategories, selectedRatings]);

  /* ---------- 無限滾動（提早觸發） ---------- */
  const isFetchingRef = useRef(false);
  useEffect(() => {
    if (!hasMore || isLoading || !fetchedOnce) return;
    const el = loadMoreRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingRef.current) {
          isFetchingRef.current = true;
          const q =
            (
              searchParams.get("search") ||
              searchParams.get("q") ||
              searchParams.get("query") ||
              searchParams.get("keyword") ||
              searchParams.get("term") ||
              ""
            ).trim();
          armAntiTopJumpGuard(800);
          Promise.resolve(fetchImages(page + 1, q, selectedCategories, selectedRatings))
            .catch(() => {})
            .finally(() => {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  isFetchingRef.current = false;
                });
              });
            });
        }
      },
      { root: null, rootMargin: "1200px 0px", threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoading, page, sort, searchParams, selectedCategories, selectedRatings, fetchedOnce]);

  /* ---------- 造訪追蹤 ---------- */
  useEffect(() => {
    fetch("/api/track-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pathname: window.location.pathname }),
    }).catch(() => {});
  }, []);

  const openImage = async (img) => {
    const enriched = await ensureUserOnImage(img);
    setSelectedImage(enriched);
    if (enriched?._id) reportClick(enriched._id);
  };

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

    if (dir === "next" && nextIdx >= images.length - 2 && hasMore && !isLoading) {
      const q =
        (
          searchParams.get("search") ||
          searchParams.get("q") ||
          searchParams.get("query") ||
          searchParams.get("keyword") ||
          searchParams.get("term") ||
          ""
        ).trim();
      armAntiTopJumpGuard(800);
      fetchImages(page + 1, q, selectedCategories, selectedRatings);
    }
  };

  /* ---------- 追蹤同步 ---------- */
  const handleFollowChange = (ownerId, isNowFollowing) => {
    const uid = String(ownerId);

    setCurrentUser((prev) => {
      if (!prev) return prev;
      const list = Array.isArray(prev.following) ? prev.following : [];
      const isObjectShape = list.some((f) => typeof f === "object" && f !== null);

      if (isNowFollowing) {
        if (hasFollow(list, uid)) return prev;
        const nextList = isObjectShape ? [...list, { userId: uid, note: "" }] : [...list, uid];
        return { ...prev, following: nextList };
      } else {
        const nextList = list.filter((f) => {
          const id = typeof f === "object" && f !== null ? f.userId : f;
          return String(id) !== uid;
        });
        return { ...prev, following: nextList };
      }
    });

    setFollowOverrides((old) => {
      const m = new Map(old);
      m.set(uid, !!isNowFollowing);
      return m;
    });
  };

  useEffect(() => {
    const onFollowChanged = (e) => {
      const { targetUserId, isFollowing } = e.detail || {};
      if (!targetUserId) return;
      handleFollowChange(String(targetUserId), Boolean(isFollowing));
    };
    window.addEventListener("follow-changed", onFollowChanged);
    return () => window.removeEventListener("follow-changed", onFollowChanged);
  }, []);

  /* ---------- render ---------- */
  const selectedIndex = selectedImage
    ? images.findIndex((img) => String(img._id) === String(selectedImage._id))
    : -1;

  const prevImage = selectedIndex > 0 ? images[selectedIndex - 1] : undefined;
  const nextImage =
    selectedIndex >= 0 && selectedIndex < images.length - 1
      ? images[selectedIndex + 1]
      : undefined;

  return (
    <main className="min-h-screen bg-zinc-950 text白 px-4 pb-4 pt-0 -mt-2 md:-mt-17">
      {currentUser?.isAdmin && (
        <div className="mb-4">
          <AdminPanel />
        </div>
      )}

      <div className="max-w-6xl mx-auto mb-3 flex items-center justify-end">
        <SortSelect value={sort} onChange={setSort} />
      </div>

      <ImageGrid
        images={previewImages ?? images}
        viewMode={viewMode}
        isLoading={isLoading}
        hasMore={hasMore}
        onSelectImage={openImage}
        loadMoreRef={loadMoreRef}
        currentUser={currentUser}
        isLikedByCurrentUser={isLikedByCurrentUser}
        onToggleLike={handleToggleLike}
        gutter={15}
        onLikeUpdate={(updated) => {
          onLikeUpdateHook(updated);
        }}
      />

      <div ref={loadMoreRef} className="py-6 text-center text-zinc-400 text-sm">
        {!fetchedOnce && isLoading && "載入中..."}
        {fetchedOnce && hasMore && "載入更多中..."}
        {fetchedOnce && !isLoading && images.length === 0 && "目前沒有符合條件的圖片"}
        {fetchedOnce && !hasMore && images.length > 0 && "已經到底囉"}
      </div>

      {selectedImage && currentUser !== undefined && (
        <ImageModal
          key={selectedImage?._id + "_" + (selectedImage?._forceSync || "")}
          imageData={selectedImage}
          prevImage={prevImage}
          nextImage={nextImage}
          onClose={() => {
            setSelectedImage(null);
          }}
          currentUser={currentUser}
          onLikeUpdate={(updated) => {
            onLikeUpdateHook(updated);
          }}
          onNavigate={(dir) => navigateFromSelected(dir)}
          onFollowChange={handleFollowChange}
          followOverrides={followOverrides}
        />
      )}

      <BackToTopButton />
    </main>
  );
}
