import mongoose from "mongoose";
import { notFound } from "next/navigation";
import { dbConnect } from "@/lib/db";
import Music from "@/models/Music";
import { getCurrentUser } from "@/lib/serverAuth";
import MusicDetailClient from "./MusicDetailClient";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://www.aicreateaworld.com";

export async function generateMetadata({ params }) {
  const { id } = await params || {};

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return {
      title: "音樂不存在 | AI 創界",
      description: "找不到指定的音樂",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  await dbConnect();

  const music = await Music.findById(id)
    .populate("author", "username")
    .lean();

  if (!music) {
    return {
      title: "音樂不存在 | AI 創界",
      description: "找不到指定的音樂",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const isAdult = music.rating === "18";

  const title = music.title || "未命名音樂";
  const descriptionSource =
    music.description ||
    music.prompt ||
    "AI 生成的音樂創作";
  const description =
    descriptionSource.length > 160
      ? `${descriptionSource.slice(0, 157)}...`
      : descriptionSource;

  const coverUrl = music.coverImageUrl || "";

  const keywords = [
    "AI 音樂",
    "AI BGM",
    ...(Array.isArray(music.genre) ? music.genre : []),
    music.language || "",
    ...(Array.isArray(music.tags) ? music.tags : []),
    music.authorName || music.author?.username || "",
  ].filter(Boolean);

  const isIndexable = !isAdult && music.isPublic !== false;

  return {
    title: `${title} | 音樂專區`,
    description,
    keywords,
    openGraph: {
      type: "music.song",
      title,
      description,
      url: `${BASE_URL}/music/${id}`,
      images: coverUrl
        ? [
            {
              url: coverUrl,
              width: 1200,
              height: 630,
              alt: title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: coverUrl ? [coverUrl] : undefined,
    },
    robots: {
      index: isIndexable,
      follow: isIndexable,
      googleBot: {
        index: isIndexable,
        follow: isIndexable,
        "max-snippet": -1,
        "max-image-preview": "large",
      },
    },
    alternates: {
      canonical: `${BASE_URL}/music/${id}`,
    },
  };
}

export default async function MusicDetailPage({ params }) {
  const { id } = await params || {};

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    notFound();
  }

  await dbConnect();

  const [currentUser, music] = await Promise.all([
    getCurrentUser().catch(() => null),
    Music.findById(id)
      .populate("author", "_id username image currentFrame frameSettings")
      .lean(),
  ]);

  if (!music) {
    notFound();
  }

  // 18+ 內容僅登入用戶可見
  if (music.rating === "18" && !currentUser) {
    return (
      <main className="min-h-screen bg-zinc-950 -mt-2 md:-mt-16 flex items-center justify-center px-4">
        <div className="max-w-md text-center text-zinc-200">
          <h1 className="text-2xl font-bold mb-3">此音樂為 18+ 內容</h1>
          <p className="text-sm text-zinc-400 mb-4">
            請先登入帳號後再播放此音樂。
          </p>
          <p className="text-xs text-zinc-500">
            若你是搜尋引擎或未登入訪客，這個頁面不會被索引。
          </p>
        </div>
      </main>
    );
  }

  const coverUrl = music.coverImageUrl || "";
  const streamUrl = `/api/music/stream/${music._id}`;

  // ✅ 序列化数据，确保 ObjectId 等 MongoDB 对象被正确转换
  const serializedMusic = JSON.parse(JSON.stringify(music));
  const serializedUser = currentUser ? JSON.parse(JSON.stringify(currentUser)) : undefined;

  return (
    <main className="min-h-screen bg-zinc-950 -mt-2 md:-mt-16">
      {/* 簡單的非 JS 版本內容，確保搜尋引擎與無 JS 環境也能看到主要資訊 */}
      <section className="max-w-4xl mx-auto px-4 py-10 md:py-14">
        <h1 className="text-xl md:text-2xl font-bold text-white mb-3">
          {music.title || "未命名音樂"}
        </h1>
        {music.authorName && (
          <p className="text-sm text-zinc-400 mb-2">
            作者：{music.authorName}
          </p>
        )}
        <p className="text-xs text-zinc-500 mb-4">
          分級：{music.rating === "18" ? "18+" : music.rating === "15" ? "15+" : "一般"} 音樂
        </p>

        {coverUrl && (
          <div className="mb-4 w-full max-w-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt={music.title || "AI 音樂封面"}
              className="w-full h-auto rounded-xl border border-zinc-800 object-cover"
              loading="eager"
            />
          </div>
        )}

        <div className="mb-4">
          <audio
            src={streamUrl}
            controls
            className="w-full"
          />
        </div>

        {music.description && (
          <p className="text-sm text-zinc-300 whitespace-pre-line">
            {music.description}
          </p>
        )}
      </section>

      {/* JS 啟用時會看到完整的彈窗體驗 */}
      <MusicDetailClient
        musicId={serializedMusic._id}
        musicData={serializedMusic}
        currentUser={serializedUser}
      />
    </main>
  );
}


