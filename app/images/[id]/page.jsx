import mongoose from "mongoose";
import { notFound } from "next/navigation";
import { dbConnect } from "@/lib/db";
import Image from "@/models/Image";
import { getCurrentUser } from "@/lib/serverAuth";
import { stripComfyIfNotAllowed } from "@/lib/sanitizeComfy";
import ImageModal from "@/components/image/ImageModal";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://www.aicreateaworld.com";
const CF_IMAGE_BASE =
  "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A";

function resolveImageUrl(image) {
  if (!image) return "";
  if (image.imageUrl) return image.imageUrl;
  if (image.imageId) {
    return `${CF_IMAGE_BASE}/${image.imageId}/public`;
  }
  return "";
}

export async function generateMetadata({ params }) {
  const { id } = params || {};

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return {
      title: "圖片不存在 | AI 創界",
      description: "找不到指定的圖片",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  await dbConnect();

  const image = await Image.findById(id)
    .populate("user", "username")
    .lean();

  if (!image) {
    return {
      title: "圖片不存在 | AI 創界",
      description: "找不到指定的圖片",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const isAdult = image.rating === "18";

  const title = image.title || "未命名圖片";
  const descriptionSource =
    image.description ||
    image.positivePrompt ||
    "AI 生成的圖像創作";
  const description =
    descriptionSource.length > 160
      ? `${descriptionSource.slice(0, 157)}...`
      : descriptionSource;

  const imageUrl = resolveImageUrl(image);

  const keywords = [
    "AI 圖片",
    "AI 繪圖",
    image.platform || "",
    image.modelName || "",
    ...(Array.isArray(image.tags) ? image.tags : []),
    image.user?.username || image.username || image.author || "",
  ].filter(Boolean);

  const isIndexable = !isAdult;

  return {
    title: `${title} | 圖片專區`,
    description,
    keywords,
    openGraph: {
      type: "website",
      title,
      description,
      url: `${BASE_URL}/images/${id}`,
      images: imageUrl
        ? [
            {
              url: imageUrl,
              width: image.width || 1200,
              height: image.height || 630,
              alt: title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
    robots: {
      index: isIndexable,
      follow: isIndexable,
      googleBot: {
        index: isIndexable,
        follow: isIndexable,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    alternates: {
      canonical: `${BASE_URL}/images/${id}`,
    },
  };
}

export default async function ImageDetailPage({ params }) {
  const { id } = params || {};

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    notFound();
  }

  await dbConnect();

  const [currentUser, doc] = await Promise.all([
    getCurrentUser().catch(() => null),
    Image.findById(id)
      .populate("user", "_id username image currentFrame frameSettings")
      .lean(),
  ]);

  if (!doc) {
    notFound();
  }

  // 18+ 內容僅登入用戶可見
  if (doc.rating === "18" && !currentUser) {
    return (
      <main className="min-h-screen bg-zinc-950 -mt-2 md:-mt-16 flex items-center justify-center px-4">
        <div className="max-w-md text-center text-zinc-200">
          <h1 className="text-2xl font-bold mb-3">此圖片為 18+ 內容</h1>
          <p className="text-sm text-zinc-400 mb-4">
            請先登入帳號後再查看此圖片。
          </p>
          <p className="text-xs text-zinc-500">
            若你是搜尋引擎或未登入訪客，這個頁面不會被索引。
          </p>
        </div>
      </main>
    );
  }

  const normalized = {
    ...doc,
    author: typeof doc.author === "string" ? doc.author : "",
    userId: doc.user?._id || doc.userId || null,
  };

  const isOwner =
    !!currentUser &&
    normalized.user &&
    String(normalized.user._id) === String(currentUser._id);
  const isAdmin = !!currentUser?.isAdmin;
  const isOwnerOrAdmin = isOwner || isAdmin;

  const sanitized = stripComfyIfNotAllowed(normalized, { isOwnerOrAdmin });

  const publicUrl = resolveImageUrl(sanitized);

  return (
    <main className="min-h-screen bg-zinc-950 -mt-2 md:-mt-16">
      {/* 簡單的非 JS 版本內容，確保搜尋引擎與無 JS 環境也能看到主要資訊 */}
      <section className="max-w-5xl mx-auto px-4 py-10 md:py-14">
        <h1 className="text-xl md:text-2xl font-bold text-white mb-3">
          {sanitized.title || "未命名圖片"}
        </h1>
        {sanitized.user?.username && (
          <p className="text-sm text-zinc-400 mb-4">
            作者：{sanitized.user.username}
          </p>
        )}
        {publicUrl && (
          <div className="mb-4 border border-zinc-800 rounded-xl overflow-hidden bg-black">
            {/* 使用原生 img，確保即使 JS 關閉也能顯示圖片 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={publicUrl}
              alt={sanitized.title || "AI 圖像創作"}
              className="w-full h-auto object-contain bg-black"
              loading="eager"
            />
          </div>
        )}
        {sanitized.description && (
          <p className="text-sm text-zinc-300 whitespace-pre-line">
            {sanitized.description}
          </p>
        )}
      </section>

      {/* JS 啟用時會看到完整的彈窗體驗 */}
      <ImageModal
        imageId={sanitized._id.toString()}
        imageData={sanitized}
        currentUser={currentUser || undefined}
        displayMode="gallery"
      />
    </main>
  );
}


