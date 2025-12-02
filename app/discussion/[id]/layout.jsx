// app/discussion/[id]/layout.jsx
import { dbConnect } from "@/lib/db";
import DiscussionPost from "@/models/DiscussionPost";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.aicreateaworld.com";

export async function generateMetadata({ params }) {
  try {
    await dbConnect();
    const { id } = await params;
    
    const post = await DiscussionPost.findById(id)
      .populate("author", "username")
      .lean();
    
    if (!post) {
      return {
        title: "帖子不存在 | AI 創界",
        description: "找不到指定的討論區文章",
        robots: {
          index: false,
          follow: false,
        },
      };
    }

    // 18+ 內容不允許被索引
    const isIndexable = post.rating !== "18";
    
    // 生成描述（從內容中提取前 160 個字符）
    const contentText = post.content
      .replace(/[#*`_~\[\]()]/g, "") // 移除 Markdown 語法
      .replace(/\n/g, " ") // 移除換行
      .trim()
      .substring(0, 160);
    
    const description = contentText || `${post.title} - AI 創界討論區`;

    const categoryNames = {
      announcement: "官方公告",
      technical: "技術討論",
      showcase: "作品展示",
      question: "問題求助",
      tutorial: "教學分享",
      general: "閒聊",
    };

    return {
      title: `${post.title} | AI 創界討論區`,
      description,
      keywords: [
        "AI 創作",
        "討論區",
        categoryNames[post.category] || post.category,
        post.author?.username || "",
      ].filter(Boolean),
      authors: post.author?.username ? [{ name: post.author.username }] : undefined,
      openGraph: {
        type: "article",
        title: post.title,
        description,
        url: `${BASE_URL}/discussion/${id}`,
        siteName: "AI 創界",
        authors: post.author?.username ? [post.author.username] : undefined,
        publishedTime: post.createdAt ? new Date(post.createdAt).toISOString() : undefined,
        modifiedTime: post.updatedAt ? new Date(post.updatedAt).toISOString() : undefined,
        images: post.uploadedImage?.url || post.imageRef?.imageId
          ? [
              {
                url: post.uploadedImage?.url || `${BASE_URL}/api/images/${post.imageRef?.imageId || post.imageRef?._id}`,
                width: post.uploadedImage?.width || 1200,
                height: post.uploadedImage?.height || 630,
                alt: post.title,
              },
            ]
          : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title: post.title,
        description,
        images: post.uploadedImage?.url || post.imageRef?.imageId
          ? [post.uploadedImage?.url || `${BASE_URL}/api/images/${post.imageRef?.imageId || post.imageRef?._id}`]
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
        canonical: `${BASE_URL}/discussion/${id}`,
      },
    };
  } catch (error) {
    console.error("生成討論區文章 metadata 失敗:", error);
    return {
      title: "討論區文章 | AI 創界",
      description: "AI 創界討論區文章",
    };
  }
}

export default function DiscussionPostLayout({ children }) {
  return children;
}

