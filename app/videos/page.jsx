// app/videos/page.jsx - 服务端包装器，用于生成 SEO metadata
import { dbConnect } from "@/lib/db";
import Video from "@/models/Video";
import ClientVideosPage from "./ClientVideosPage";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.aicreateaworld.com";

export async function generateMetadata({ searchParams }) {
  // ✅ Next.js 15: searchParams 需要 await
  const params = await searchParams;
  const videoId = params?.video;
  
  // 如果没有 video 参数，返回列表页的 metadata
  if (!videoId) {
    return {
      title: "AI 影片專區 | AI 創界",
      description: "探索 AI 生成的動態視覺創作，包含 Runway、Pika、Stable Video Diffusion 等平台的精彩影片作品。",
      keywords: ["AI 影片", "AI 視頻", "Runway", "Pika", "Stable Video Diffusion", "AI 動畫", "AI 創作"],
      openGraph: {
        title: "AI 影片專區 | AI 創界",
        description: "探索 AI 生成的動態視覺創作，包含 Runway、Pika、Stable Video Diffusion 等平台的精彩影片作品。",
        type: "website",
        url: `${BASE_URL}/videos`,
      },
      robots: {
        index: true,
        follow: true,
      },
    };
  }

  // 如果有 video 参数，获取视频详情并生成 metadata
  try {
    await dbConnect();
    
    const video = await Video.findById(videoId)
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

    // 18+ 內容不允許被索引
    const isIndexable = video.rating !== "18" && video.isPublic !== false;
    
    // 生成描述
    const description = video.description 
      ? video.description.substring(0, 160).replace(/\n/g, " ").trim()
      : `${video.title || "未命名影片"} - AI 創界影片專區`;

    return {
      title: `${video.title || "未命名影片"} | AI 創界影片專區`,
      description,
      keywords: [
        "AI 影片",
        "AI 視頻",
        video.category || "",
        ...(Array.isArray(video.tags) ? video.tags : []),
        video.author?.username || "",
      ].filter(Boolean),
      authors: video.author?.username ? [{ name: video.author.username }] : undefined,
      openGraph: {
        type: "video.other",
        title: video.title || "未命名影片",
        description,
        url: `${BASE_URL}/videos?video=${videoId}`,
        siteName: "AI 創界",
        authors: video.author?.username ? [video.author.username] : undefined,
        publishedTime: video.createdAt ? new Date(video.createdAt).toISOString() : undefined,
        modifiedTime: video.updatedAt ? new Date(video.updatedAt).toISOString() : undefined,
        images: video.thumbnailUrl || video.thumbnail
          ? [
              {
                url: video.thumbnailUrl || video.thumbnail,
                width: video.width || 1200,
                height: video.height || 630,
                alt: video.title || "影片縮圖",
              },
            ]
          : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title: video.title || "未命名影片",
        description,
        images: video.thumbnailUrl || video.thumbnail
          ? [video.thumbnailUrl || video.thumbnail]
          : undefined,
      },
      robots: {
        index: isIndexable,
        follow: isIndexable,
        googleBot: {
          index: isIndexable,
          follow: isIndexable,
          'max-video-preview': -1,
          'max-image-preview': 'large',
          'max-snippet': -1,
        },
      },
      alternates: {
        canonical: `${BASE_URL}/videos?video=${videoId}`,
      },
    };
  } catch (error) {
    console.error("生成影片 metadata 失敗:", error);
    return {
      title: "AI 影片專區 | AI 創界",
      description: "探索 AI 生成的動態視覺創作",
    };
  }
}

export default function VideosPage() {
  return <ClientVideosPage />;
}
