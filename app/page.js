"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ImageIcon,
  MusicIcon,
  VideoIcon,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import ShowcaseImageModal from "@/components/homepage/ShowcaseImageModal";
import ShowcaseVideoModal from "@/components/homepage/ShowcaseVideoModal";
import ImageModal from "@/components/image/ImageModal";
import VideoModal from "@/components/video/VideoModal";
import BackToTopButton from "@/components/common/BackToTopButton";
import { useCurrentUser } from "@/contexts/CurrentUserContext";

const SHOWCASE_LIMIT = 12;
const CF_IMAGE_BASE = "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A";

const SECTION_CONFIG = [
  {
    id: "images",
    title: "圖片專區",
    description: "精選最新熱門的 AI 圖像創作，帶你從靈感到實作。",
    href: "/images",
    accent: {
      badge: "from-pink-500/80 to-purple-500/80",
      // 參考 ContentMenuButtons 圖片專區按鈕顏色：深紫藍漸層
      ring: "from-[#6a11cb] to-[#2575fc]",
      border: "border-pink-400/60",
    },
    duration: 48,
  },
  {
    id: "music",
    title: "音樂專區",
    description: "以音樂陪伴創作旅程，立即試聽人氣 AI 曲目。",
    href: "/music",
    accent: {
      // 統一使用圖片區的 badge 顏色
      badge: "from-pink-500/80 to-purple-500/80",
      // 參考 ContentMenuButtons 音樂專區按鈕顏色：靛紫粉漸層
      ring: "from-indigo-500 via-purple-500 to-pink-500",
      border: "border-purple-400/60",
    },
    duration: 52,
  },
  {
    id: "videos",
    title: "影片專區",
    description: "探索動態視覺的 AI 實驗，收錄前衛的創作影片。",
    href: "/videos",
    accent: {
      // 統一使用圖片區的 badge 顏色
      badge: "from-pink-500/80 to-purple-500/80",
      // 參考 ContentMenuButtons 影片專區按鈕顏色：橙粉紅漸層
      ring: "from-orange-500 via-pink-500 to-red-500",
      border: "border-sky-400/60",
    },
    duration: 56,
  },
];

function resolveImageUrl(image) {
  if (!image) return "";
  if (image.imageUrl) return image.imageUrl;
  if (image.imageId) {
    const variant = image.variant || "public";
    return `${CF_IMAGE_BASE}/${image.imageId}/${variant}`;
  }
  if (Array.isArray(image.files) && image.files[0]?.url) {
    return image.files[0].url;
  }
  return "";
}

async function fetchImages(signal) {
  const params = new URLSearchParams({
    page: "1",
    limit: String(SHOWCASE_LIMIT),
    sort: "popular",
    ratings: "sfw,15",
  });
  const res = await fetch(`/api/images?${params.toString()}`, {
    signal,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Images request failed: ${res.status}`);
  }
  const data = await res.json();
  const list = Array.isArray(data?.images) ? data.images : [];
  return list.map((item) => {
    const userObj =
      typeof item.user === "object" && item.user
        ? item.user
        : null;
    const fallbackAuthor =
      typeof item.author === "string" && item.author.trim()
        ? item.author.trim()
        : null;
    const authorName =
      userObj?.nickname ||
      userObj?.displayName ||
      userObj?.username ||
      item.username ||
      fallbackAuthor ||
      "匿名創作者";

    return {
      id: item._id || item.id,
      title: item.title || "未命名作品",
      author: authorName,
      imageUrl: resolveImageUrl(item),
      likesCount:
        typeof item.likesCount === "number"
          ? item.likesCount
          : Array.isArray(item.likes)
            ? item.likes.length
            : 0,
      createdAt: item.createdAt || item.uploadDate || null,
    };
  });
}

async function fetchMusic(signal) {
  const params = new URLSearchParams({
    page: "1",
    limit: String(SHOWCASE_LIMIT),
    sort: "popular",
    live: "1",
  });
  const res = await fetch(`/api/music?${params.toString()}`, {
    signal,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Music request failed: ${res.status}`);
  }
  const data = await res.json();
  const list = Array.isArray(data?.music) ? data.music : [];
  const sorted = [...list].sort((a, b) => {
    const scoreA = typeof a.livePopScore === "number" ? a.livePopScore : 0;
    const scoreB = typeof b.livePopScore === "number" ? b.livePopScore : 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    const timeA = new Date(a.createdAt || a.uploadDate || 0).getTime();
    const timeB = new Date(b.createdAt || b.uploadDate || 0).getTime();
    if (timeB !== timeA) return timeB - timeA;
    const idA = (a._id || a.id || "").toString();
    const idB = (b._id || b.id || "").toString();
    return idB.localeCompare(idA);
  });

  return sorted.map((item) => {
    const id = item._id || item.id;
    const authorName =
      item.authorName ||
      item.author?.nickname ||
      item.author?.displayName ||
      item.author?.username ||
      "匿名創作者";
    const cover =
      item.coverImageUrl ||
      (Array.isArray(item.coverCandidates) ? item.coverCandidates[0] : "") ||
      "";
    const likesCount =
      typeof item.likesCount === "number"
        ? item.likesCount
        : Array.isArray(item.likes)
          ? item.likes.length
          : 0;

    return {
      ...item,
      id,
      displayTitle: item.title || "未命名歌曲",
      displayAuthor: authorName,
      cover,
      previewUrl:
        item.previewUrl ||
        item.previewAudioUrl ||
        (Array.isArray(item.previewUrls) ? item.previewUrls[0] : "") ||
        "",
      likesCount,
      duration: item.duration || 0,
      createdAt: item.uploadDate || item.createdAt || null,
    };
  });
}

async function fetchVideos(signal) {
  const params = new URLSearchParams({
    page: "1",
    limit: String(SHOWCASE_LIMIT),
    sort: "popular",
    ratings: "sfw,15",
  });
  const res = await fetch(`/api/videos?${params.toString()}`, {
    signal,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Videos request failed: ${res.status}`);
  }
  const data = await res.json();
  const list = Array.isArray(data?.videos) ? data.videos : [];
  return list.map((item) => {
    const id = item._id || item.id;
    const authorName =
      item.authorName ||
      item.author?.nickname ||
      item.author?.displayName ||
      item.author?.username ||
      "匿名創作者";
    const likesCount =
      typeof item.likesCount === "number"
        ? item.likesCount
        : Array.isArray(item.likes)
          ? item.likes.length
          : 0;
    return {
      ...item,
      id,
      displayTitle: item.title || "未命名影片",
      displayAuthor: authorName,
      thumbnail: item.thumbnailUrl || item.previewUrl || "",
      duration: item.duration || 0,
      likesCount,
      createdAt: item.uploadDate || item.createdAt || null,
    };
  });
}

function formatDuration(seconds) {
  if (!seconds || Number.isNaN(seconds)) return "";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function ShowcaseHeader({ title, description, href, accent }) {
  return (
    <Link
      href={href}
      className={`group block w-full rounded-xl bg-gradient-to-r ${accent.ring} p-6 md:p-8 transition-all hover:opacity-90 cursor-pointer`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1">
          <div
            className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${accent.badge} px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            精選內容
          </div>
          <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl group-hover:text-white/90 transition-colors">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-300 sm:text-base group-hover:text-zinc-200 transition-colors">
            {description}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-white/60 group-hover:text-white transition-colors">
          <span>前往專區</span>
          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  );
}

function EmptyNotice({ href }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center text-sm text-zinc-300">
      目前沒有可顯示的內容，前往{" "}
      <Link href={href} className="text-emerald-300 underline">
        專區頁面
      </Link>{" "}
      查看更多。
    </div>
  );
}

function ShowcaseSkeletonRow({ accent }) {
  const placeholders = Array.from({ length: 6 });
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${accent.border} bg-gradient-to-r ${accent.ring} px-6 py-10`}
    >
      <div className="flex gap-4">
        {placeholders.map((_, idx) => (
          <div
            key={`skeleton-${idx}`}
            className="h-56 w-72 flex-shrink-0 rounded-xl bg-zinc-800/40"
          >
            <div className="h-full w-full animate-pulse rounded-xl bg-zinc-700/40" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ImageShowcaseCard({ item, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group/card relative flex h-56 w-full flex-col overflow-hidden rounded-xl border border-white/5 bg-black/60 shadow-lg shadow-black/30 transition hover:border-white/20 hover:shadow-black/50"
    >
      <div className="relative h-40 w-full overflow-hidden">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-700 group-hover/card:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-zinc-500">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
      </div>
      <div className="flex flex-1 flex-col justify-between px-4 pb-3 pt-2">
        <div>
          <p className="line-clamp-2 text-sm font-semibold text-white">
            {item.title}
          </p>
          <p className="mt-1 text-xs text-zinc-400">by {item.author}</p>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400">
          <span className="inline-flex items-center gap-1">
            <ImageIcon className="h-3.5 w-3.5 text-pink-300" />
            圖片專區
          </span>
          {typeof item.likesCount === "number" && (
            <span>♥ {item.likesCount}</span>
          )}
        </div>
      </div>
    </button>
  );
}

function MusicShowcaseCard({ item, onSelect, isActive }) {
  const title = item.displayTitle || item.title || "未命名歌曲";
  const author = item.displayAuthor || item.author || item.authorName || "匿名創作者";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group/card relative flex h-56 w-full flex-col overflow-hidden rounded-xl border bg-gradient-to-br from-purple-500/10 via-black/70 to-black shadow-lg shadow-black/40 transition hover:border-white/20 hover:shadow-black/60 ${
        isActive
          ? "border-purple-400/70 shadow-purple-500/50"
          : "border-white/5"
      }`}
    >
      <div className="relative h-40 w-full overflow-hidden">
        {item.cover ? (
          <img
            src={item.cover}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-700 group-hover/card:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-600/40 to-blue-600/30 text-purple-100">
            <MusicIcon className="h-9 w-9" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
      </div>
      <div className="flex flex-1 flex-col justify-between px-4 pb-3 pt-2">
        <div>
          <p className="line-clamp-2 text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-xs text-zinc-300">by {author}</p>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-300">
          <span className="inline-flex items-center gap-1">
            <MusicIcon className="h-3.5 w-3.5 text-purple-300" />
            音樂專區
          </span>
          <span>
            {formatDuration(item.duration)} · ♥ {item.likesCount ?? 0}
          </span>
        </div>
      </div>
    </button>
  );
}

function VideoShowcaseCard({ item, onSelect }) {
  const title = item.displayTitle || item.title || "未命名影片";
  const author =
    item.displayAuthor ||
    item.author ||
    item.authorName ||
    item.author?.username ||
    "匿名創作者";
  const thumb =
    item.thumbnail ||
    item.thumbnailUrl ||
    item.previewUrl ||
    (Array.isArray(item.previewImages) ? item.previewImages[0] : "");

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group/card relative flex h-56 w-full flex-col overflow-hidden rounded-xl border border-white/5 bg-gradient-to-br from-sky-500/15 via-black/70 to-black shadow-lg shadow-black/40 transition hover:border-white/20 hover:shadow-black/60"
    >
      <div className="relative h-40 w-full overflow-hidden">
        {thumb ? (
          <img
            src={thumb}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-700 group-hover/card:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-500/40 to-emerald-500/30 text-sky-100">
            <VideoIcon className="h-9 w-9" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
      </div>
      <div className="flex flex-1 flex-col justify-between px-4 pb-3 pt-2">
        <div>
          <p className="line-clamp-2 text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-xs text-zinc-300">by {author}</p>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-300">
          <span className="inline-flex items-center gap-1">
            <VideoIcon className="h-3.5 w-3.5 text-sky-300" />
            影片專區
          </span>
          <span>
            {formatDuration(item.duration)} · ♥ {item.likesCount ?? 0}
          </span>
        </div>
      </div>
    </button>
  );
}

function ShowcaseMarquee({ items, renderItem, accent, duration, loading, href }) {
  if (loading) {
    return <ShowcaseSkeletonRow accent={accent} />;
  }

  if (!items.length) {
    return <EmptyNotice href={href} />;
  }

  const marqueeItems = items.length >= 6 ? [...items, ...items] : [...items];

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border ${accent.border} bg-zinc-900/50`}
    >
      <div
        className="marquee-track flex gap-4 px-6 py-10 md:pr-10"
        style={{ "--marquee-duration": `${duration}s` }}
      >
        {marqueeItems.map((item, index) => (
          <div
            key={`${item.id ?? index}-${index}`}
            className="w-64 flex-shrink-0"
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroSection() {
  return (
    <header className="border-b border-white/10 bg-gradient-to-br from-emerald-500/10 via-purple-600/5 to-sky-500/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-16 sm:px-10 sm:py-20">
        {/* Logo 和標題 */}
        <Link
          href="/"
          className="flex items-center gap-3 md:gap-4 shrink-0 mb-6"
          aria-label="回首頁"
        >
          <Image
            src="/ai_logo_icon.png"
            alt="AI 創界 Logo"
            width={64}
            height={64}
            className="rounded-lg md:w-[80px] md:h-[80px]"
            priority
          />
          <span className="text-white text-2xl md:text-4xl font-extrabold tracking-wide">
            AI 創界
          </span>
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
              創作、靈感與音樂的交會處
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-zinc-200 sm:text-base">
              我們將圖片、音樂與影片三大內容專區匯聚於此，一頁掌握最新精選作品，
              滑過即可瀏覽，點擊即可探索每個專區的完整體驗。
            </p>
          </div>
          <div className="flex flex-shrink-0 gap-3">
            <Link
              href="/images"
              className="rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/20"
            >
              圖片專區
            </Link>
            <Link
              href="/music"
              className="rounded-full border border-purple-300/40 bg-purple-500/20 px-5 py-2 text-sm font-semibold text-purple-100 transition hover:border-purple-300/60 hover:bg-purple-500/30"
            >
              音樂專區
            </Link>
            <Link
              href="/videos"
              className="rounded-full border border-sky-300/40 bg-sky-500/20 px-5 py-2 text-sm font-semibold text-sky-100 transition hover:border-sky-300/60 hover:bg-sky-500/30"
            >
              影片專區
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
            <ImageIcon className="h-7 w-7 text-pink-300" />
            <p className="mt-3 text-sm font-medium text-white">圖片 · 靈感資料庫</p>
            <p className="mt-2 text-xs text-zinc-300">
              包含參數與模型資訊的 AI 圖像，協助你快速再現喜歡的風格。
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
            <MusicIcon className="h-7 w-7 text-purple-300" />
            <p className="mt-3 text-sm font-medium text-white">音樂 · 全天候播放</p>
            <p className="mt-2 text-xs text-zinc-300">
              可預覽、釘選的個人化播放器，播放你的 AI 音樂收藏。
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
            <VideoIcon className="h-7 w-7 text-sky-300" />
            <p className="mt-3 text-sm font-medium text-white">影片 · 動態呈現</p>
            <p className="mt-2 text-xs text-zinc-300">
              將創意延伸為動態敘事，瀏覽 AI 影片的多元應用案例。
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function LandingPage() {
  const { currentUser } = useCurrentUser();
  const [sectionData, setSectionData] = useState(() =>
    SECTION_CONFIG.reduce((acc, section) => {
      acc[section.id] = {
        items: [],
        loading: true,
        error: null,
      };
      return acc;
    }, {}),
  );
const [selectedImageId, setSelectedImageId] = useState(null);
const [expandedImage, setExpandedImage] = useState(null);
const [selectedVideo, setSelectedVideo] = useState(null);
const [expandedVideo, setExpandedVideo] = useState(null);
const [activeMusicPreviewId, setActiveMusicPreviewId] = useState(null);
const musicPreviewStateRef = useRef({
  audio: null,
  timeoutId: null,
  endedHandler: null,
  pauseHandler: null,
});

  useEffect(() => {
    const controllers = {
      images: new AbortController(),
      music: new AbortController(),
      videos: new AbortController(),
    };
    let isMounted = true;

    async function load() {
      setSectionData((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          next[key] = { ...next[key], loading: true, error: null };
        }
        return next;
      });

      try {
        const [images, music, videos] = await Promise.all([
          fetchImages(controllers.images.signal),
          fetchMusic(controllers.music.signal),
          fetchVideos(controllers.videos.signal),
        ]);

        if (!isMounted) return;

        setSectionData({
          images: { items: images, loading: false, error: null },
          music: { items: music, loading: false, error: null },
          videos: { items: videos, loading: false, error: null },
        });
      } catch (error) {
        if (!isMounted) return;
        console.warn("首頁精選載入失敗", error);
        setSectionData((prev) => ({
          images: {
            items: prev.images.items,
            loading: false,
            error:
              prev.images.error ??
              (controllers.images.signal.aborted ? null : error),
          },
          music: {
            items: prev.music.items,
            loading: false,
            error:
              prev.music.error ??
              (controllers.music.signal.aborted ? null : error),
          },
          videos: {
            items: prev.videos.items,
            loading: false,
            error:
              prev.videos.error ??
              (controllers.videos.signal.aborted ? null : error),
          },
        }));
      }
    }

    load();

    return () => {
      isMounted = false;
      controllers.images.abort();
      controllers.music.abort();
      controllers.videos.abort();
    };
  }, []);

  const handleOpenImage = useCallback((item) => {
    setSelectedImageId(item.id);
  }, []);

  const handleCloseShowcaseModal = useCallback(() => {
    setSelectedImageId(null);
  }, []);

  const handleExpandImage = useCallback((imageData) => {
    setSelectedImageId(null);
    setExpandedImage(imageData);
  }, []);

  const handleCloseExpandedModal = useCallback(() => {
    setExpandedImage(null);
  }, []);

  const stopMusicPreview = useCallback(() => {
    const { audio, timeoutId, endedHandler, pauseHandler } =
      musicPreviewStateRef.current;
    if (timeoutId) {
      clearTimeout(timeoutId);
      musicPreviewStateRef.current.timeoutId = null;
    }
    if (audio) {
      if (endedHandler) {
        audio.removeEventListener("ended", endedHandler);
        musicPreviewStateRef.current.endedHandler = null;
      }
      if (pauseHandler) {
        audio.removeEventListener("pause", pauseHandler);
        musicPreviewStateRef.current.pauseHandler = null;
      }
      try {
        audio.pause();
      } catch {}
      audioManager.release(audio);
    }
    setActiveMusicPreviewId(null);
  }, []);

  const computePreviewWindow = useCallback((durationSeconds) => {
    const duration = Math.max(durationSeconds || 60, 8);
    const minStartPercent = 0.3;
    const maxStartPercent = 0.7;
    const randomStartPercent =
      minStartPercent + Math.random() * (maxStartPercent - minStartPercent);
    const start = duration * randomStartPercent;
    const end = Math.min(start + 8, duration);
    return { start, end };
  }, []);

  const startMusicPreview = useCallback(
    async (item) => {
      if (!item) return;
      const musicId = item._id || item.id;
      const previewSrc =
        item.previewUrl ||
        item.previewAudioUrl ||
        (Array.isArray(item.previewUrls) ? item.previewUrls[0] : "") ||
        "";
      const fallbackSrc = item.musicUrl || "";
      const src = previewSrc || fallbackSrc;
      if (!src) return;

      if (activeMusicPreviewId && String(activeMusicPreviewId) === String(musicId)) {
        stopMusicPreview();
        return;
      }

      stopMusicPreview();

      let audio = musicPreviewStateRef.current.audio;
      if (!audio) {
        audio = new Audio();
        audio.preload = "auto";
        musicPreviewStateRef.current.audio = audio;
      }

      audio.src = src;
      audio.loop = false;
      audio.muted = false;
      audio.dataset.musicPreview = "true";

      try {
        const savedVolume = localStorage.getItem("playerVolume");
        if (savedVolume) {
          const vol = parseFloat(savedVolume);
          if (!Number.isNaN(vol) && vol >= 0 && vol <= 1) {
            audio.volume = vol;
          }
        }
      } catch {}

      try {
        if (audio.readyState < 2) {
          await new Promise((resolve, reject) => {
            const onLoaded = () => {
              audio.removeEventListener("canplaythrough", onLoaded);
              audio.removeEventListener("loadedmetadata", onLoaded);
              audio.removeEventListener("error", onError);
              resolve();
            };
            const onError = (e) => {
              audio.removeEventListener("canplaythrough", onLoaded);
              audio.removeEventListener("loadedmetadata", onLoaded);
              audio.removeEventListener("error", onError);
              reject(e);
            };
            audio.addEventListener("canplaythrough", onLoaded);
            audio.addEventListener("loadedmetadata", onLoaded);
            audio.addEventListener("error", onError);
            try {
              audio.load();
            } catch {}
          });
        }
      } catch (err) {
        console.warn("音樂預覽載入失敗:", err);
        return;
      }

      const effectiveDuration =
        (audio.duration && Number.isFinite(audio.duration)
          ? audio.duration
          : item.duration || 60) || 60;
      const { start, end } = computePreviewWindow(effectiveDuration);

      try {
        audio.currentTime = start;
      } catch (error) {
        console.warn("設定音樂預覽起點失敗:", error);
      }

      const canPlay = audioManager.requestPlay(audio, 2);
      if (!canPlay) {
        return;
      }

      try {
        await audio.play();
      } catch (error) {
        console.warn("音樂預覽播放失敗:", error);
        audioManager.release(audio);
        return;
      }

      setActiveMusicPreviewId(musicId);

      const handleEnded = () => {
        stopMusicPreview();
      };
      const handlePause = () => {
        if (!audio.ended && activeMusicPreviewId === musicId) {
          stopMusicPreview();
        }
      };
      audio.addEventListener("ended", handleEnded);
      audio.addEventListener("pause", handlePause);
      musicPreviewStateRef.current.endedHandler = handleEnded;
      musicPreviewStateRef.current.pauseHandler = handlePause;

      const remaining = Math.max((end - start) * 1000, 0);
      musicPreviewStateRef.current.timeoutId = setTimeout(() => {
        stopMusicPreview();
      }, remaining);
    },
    [activeMusicPreviewId, computePreviewWindow, stopMusicPreview],
  );

  useEffect(() => {
    return () => {
      stopMusicPreview();
    };
  }, [stopMusicPreview]);

  const handleOpenVideo = useCallback((item) => {
    setSelectedVideo(item);
  }, []);

  const handleCloseVideoModal = useCallback(() => {
    setSelectedVideo(null);
  }, []);

  const handleExpandVideo = useCallback((videoData) => {
    setSelectedVideo(null);
    setExpandedVideo(videoData);
  }, []);

  const handleCloseExpandedVideo = useCallback(() => {
    setExpandedVideo(null);
  }, []);

  const handleVideoLikeToggle = useCallback(
    async (videoId) => {
      if (!videoId) return null;
      try {
        const response = await fetch(`/api/videos/${videoId}/like`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        });

        if (!response.ok) {
          return null;
        }

        const data = await response.json();

        if (Array.isArray(data?.likes)) {
          setSectionData((prev) => {
            const prevVideos = prev.videos || {
              items: [],
              loading: false,
              error: null,
            };
            const items = Array.isArray(prevVideos.items)
              ? prevVideos.items.map((video) => {
                  const vid = video._id || video.id;
                  if (String(vid) !== String(videoId)) return video;
                  return {
                    ...video,
                    likes: data.likes,
                    likesCount: data.likes.length,
                  };
                })
              : prevVideos.items;
            return {
              ...prev,
              videos: {
                ...prevVideos,
                items,
              },
            };
          });

          setSelectedVideo((prev) =>
            prev && String((prev._id || prev.id)) === String(videoId)
              ? { ...prev, likes: data.likes, likesCount: data.likes.length }
              : prev,
          );

          setExpandedVideo((prev) =>
            prev && String((prev._id || prev.id)) === String(videoId)
              ? { ...prev, likes: data.likes, likesCount: data.likes.length }
              : prev,
          );
        }

        return data;
      } catch (error) {
        console.warn("首頁影片愛心切換失敗:", error);
        return null;
      }
    },
    [setSectionData],
  );

  const sectionCards = useMemo(
    () => ({
      images: (item, idx) => (
        <ImageShowcaseCard
          key={item.id ?? idx}
          item={item}
          onSelect={() => handleOpenImage(item)}
        />
      ),
      music: (item, idx) => (
        <MusicShowcaseCard
          key={item.id ?? item._id ?? idx}
          item={item}
          onSelect={() => startMusicPreview(item)}
          isActive={
            activeMusicPreviewId &&
            String(activeMusicPreviewId) === String(item._id || item.id)
          }
        />
      ),
      videos: (item, idx) => (
        <VideoShowcaseCard
          key={item.id ?? item._id ?? idx}
          item={item}
          onSelect={() => handleOpenVideo(item)}
        />
      ),
    }),
    [handleOpenImage, startMusicPreview, handleOpenVideo],
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <HeroSection />
      <main className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-16 sm:px-10 sm:py-20">
        {SECTION_CONFIG.map((section) => {
          const data = sectionData[section.id] || {
            items: [],
            loading: true,
            error: null,
          };

          return (
            <section key={section.id} className="space-y-6">
              <ShowcaseHeader
                title={section.title}
                description={section.description}
                href={section.href}
                accent={section.accent}
              />
              {data.error ? (
                <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-200">
                  無法取得最新內容，請稍後再試。
                </div>
              ) : (
                <div className="overflow-x-auto md:overflow-visible">
                  <ShowcaseMarquee
                    items={data.items}
                    renderItem={(item, idx) =>
                      sectionCards[section.id]?.(item, idx)
                    }
                    accent={section.accent}
                    duration={section.duration}
                    loading={data.loading}
                    href={section.href}
                  />
                </div>
              )}
            </section>
          );
        })}
      </main>
      {selectedImageId && (
        <ShowcaseImageModal
          imageId={selectedImageId}
          isOpen={!!selectedImageId}
          onClose={handleCloseShowcaseModal}
          onExpand={handleExpandImage}
          currentUser={currentUser}
        />
      )}
      {expandedImage && (
        <ImageModal
          imageData={expandedImage}
          onClose={handleCloseExpandedModal}
          currentUser={currentUser}
          displayMode="gallery"
        />
      )}
  {selectedVideo && (
    <ShowcaseVideoModal
      video={selectedVideo}
      isOpen={!!selectedVideo}
      onClose={handleCloseVideoModal}
      onExpand={handleExpandVideo}
      onToggleLike={handleVideoLikeToggle}
      currentUser={currentUser}
    />
  )}
  {expandedVideo && (
    <VideoModal
      video={expandedVideo}
      onClose={handleCloseExpandedVideo}
      currentUser={currentUser}
      isLiked={
        !!(
          currentUser?._id &&
          Array.isArray(expandedVideo?.likes) &&
          expandedVideo.likes.some(
            (id) => String(id) === String(currentUser._id || currentUser.id),
          )
        )
      }
      onToggleLike={handleVideoLikeToggle}
    />
  )}
  <BackToTopButton />
    </div>
  );
}
