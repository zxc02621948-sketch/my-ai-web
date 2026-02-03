import mongoose from "mongoose";
import { notFound } from "next/navigation";
import { dbConnect } from "@/lib/db";
import Video from "@/models/Video";
import { getCurrentUser } from "@/lib/serverAuth";
import VideoDetailClient from "./VideoDetailClient";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://www.aicreateaworld.com";

export async function generateMetadata({ params }) {
  const { id } = await params || {};

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return {
      title: "影片不存在 | AI 創界",
      description: "找不到指定的影片",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  await dbConnect();

  const video = await Video.findById(id)
    .populate("author", "username")
    .lean();

  if (!video) {
    return {
      title: "影片不存在 | AI 創界",
      description: "找不到指定的影片",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const isAdult = video.rating === "18";

  const title = video.title || "未命名影片";
  const descriptionSource =
    video.description ||
    video.prompt ||
    "AI 生成的影片創作";
  const description =
    descriptionSource.length > 160
      ? `${descriptionSource.slice(0, 157)}...`
      : descriptionSource;

  const thumb =
    video.thumbnailUrl ||
    video.previewUrl ||
    "";

  const keywords = [
    "AI 影片",
    "AI 視頻",
    video.platform || "",
    ...(Array.isArray(video.tags) ? video.tags : []),
    video.category || "",
    video.authorName || video.author?.username || "",
  ].filter(Boolean);

  const isIndexable = !isAdult && video.isPublic !== false;

  return {
    title: `${title} | 影片專區`,
    description,
    keywords,
    openGraph: {
      type: "video.other",
      title,
      description,
      url: `${BASE_URL}/videos/${id}`,
      images: thumb
        ? [
            {
              url: thumb,
              width: video.width || 1200,
              height: video.height || 630,
              alt: title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: thumb ? [thumb] : undefined,
    },
    robots: {
      index: isIndexable,
      follow: isIndexable,
      googleBot: {
        index: isIndexable,
        follow: isIndexable,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    alternates: {
      canonical: `${BASE_URL}/videos/${id}`,
    },
  };
}

export default async function VideoDetailPage({ params }) {
  const { id } = await params || {};

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    notFound();
  }

  await dbConnect();

  const [currentUser, video] = await Promise.all([
    getCurrentUser().catch(() => null),
    Video.findById(id)
      .populate("author", "_id username image currentFrame frameSettings")
      .lean(),
  ]);

  if (!video) {
    notFound();
  }

  // 18+ 內容僅登入用戶可見
  if (video.rating === "18" && !currentUser) {
    return (
      <main className="min-h-screen bg-zinc-950 -mt-2 md:-mt-16 flex items-center justify-center px-4">
        <div className="max-w-md text-center text-zinc-200">
          <h1 className="text-2xl font-bold mb-3">此影片為 18+ 內容</h1>
          <p className="text-sm text-zinc-400 mb-4">
            請先登入帳號後再播放此影片。
          </p>
          <p className="text-xs text-zinc-500">
            若你是搜尋引擎或未登入訪客，這個頁面不會被索引。
          </p>
        </div>
      </main>
    );
  }

  // Serialize MongoDB ObjectId and other complex objects for client components
  const sanitized = JSON.parse(JSON.stringify(video));

  const thumb =
    video.thumbnailUrl ||
    video.previewUrl ||
    "";

  const videoSrc = video.streamId
    ? `https://customer-h5be4kbubhrszsgr.cloudflarestream.com/${video.streamId}/manifest/video.m3u8`
    : video.videoUrl;

  return (
    <main className="min-h-screen bg-zinc-950 -mt-2 md:-mt-16">
      {/* Server-rendered content for SEO and no-JS fallback */}
      <section className="max-w-5xl mx-auto px-4 py-10 md:py-14">
        <h1 className="text-xl md:text-2xl font-bold text-white mb-3">
          {video.title || "未命名影片"}
        </h1>
        {video.authorName && (
          <p className="text-sm text-zinc-400 mb-2">
            作者：{video.authorName}
          </p>
        )}
        <p className="text-xs text-zinc-500 mb-4">
          分級：{video.rating === "18" ? "18+" : video.rating === "15" ? "15+" : "一般"} 影片
        </p>

        {thumb && (
          <div className="mb-4 w-full max-w-3xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumb}
              alt={video.title || "AI 影片縮圖"}
              className="w-full h-auto rounded-xl border border-zinc-800 object-cover"
              loading="eager"
            />
          </div>
        )}

        <div className="mb-4 w-full max-w-3xl">
          <video
            src={videoSrc}
            controls
            className="w-full h-auto rounded-xl bg-black"
          />
        </div>

        {video.description && (
          <p className="text-sm text-zinc-300 whitespace-pre-line">
            {video.description}
          </p>
        )}
      </section>

      {/* JS 啟用時會看到完整的彈窗體驗 */}
      <VideoDetailClient
        videoData={sanitized}
        currentUser={currentUser ? JSON.parse(JSON.stringify(currentUser)) : undefined}
      />
    </main>
  );
}


