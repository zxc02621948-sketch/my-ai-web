// app/layout.js
import "./globals.css";
import FeedbackButton from "../components/common/FeedbackButton";
import ClientHeaderWrapper from "@/components/common/ClientHeaderWrapper";
import { CurrentUserProvider } from "@/contexts/CurrentUserContext";
import { getCurrentUser } from "@/lib/serverAuth";
import UploadModal from "@/components/upload/UploadModal";
import UploadVideoModal from "@/components/upload/UploadVideoModal";
import UploadMusicModal from "@/components/upload/UploadMusicModal";
import LoginModal from "@/components/auth/LoginModal";
import RegisterModal from "@/components/auth/RegisterModal";
import SessionProviderWrapper from "@/components/auth/SessionProviderWrapper";
import { FilterProvider } from "@/components/context/FilterContext";
import ClientToaster from "@/components/common/ClientToaster";
import { PlayerProvider } from "@/components/context/PlayerContext";
import ConditionalPlayer from "@/components/common/ConditionalPlayer";
import AdFooterPlaceholder from "@/components/common/AdFooterPlaceholder";
import GlobalNotificationManager from "@/components/common/GlobalNotificationManager";
import StorageManagerInit from "@/components/common/StorageManagerInit";
// 移除全域 MiniPlayer / YouTubeBridge 與字型變數，恢復到較乾淨的版型

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://www.aicreateaworld.com'),
  title: {
    default: "AI 創界 - AI 圖像創作分享平台",
    template: "%s | AI 創界"
  },
  description: "探索 AI 生成藝術的無限可能。分享你的 Stable Diffusion、ComfyUI 創作，學習 Prompt 技巧，獲取模型參數，加入創作者社群。",
  keywords: ["AI 圖像", "Stable Diffusion", "ComfyUI", "AI 繪圖", "Prompt", "模型分享", "LoRA", "AI 創作", "生成藝術", "AI 社群"],
  authors: [{ name: "AI 創界團隊" }],
  creator: "AI 創界",
  publisher: "AI 創界",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: { 
    icon: "/ai_logo_icon.png?v=2",
    apple: "/ai_logo_icon.png?v=2"
  },
  openGraph: {
    type: "website",
    locale: "zh_TW",
    url: "/",
    siteName: "AI 創界",
    title: "AI 創界 - AI 圖像創作分享平台",
    description: "探索 AI 生成藝術的無限可能。分享你的 Stable Diffusion、ComfyUI 創作，學習 Prompt 技巧，獲取模型參數。",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "AI 創界",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI 創界 - AI 圖像創作分享平台",
    description: "探索 AI 生成藝術的無限可能。分享創作，學習技巧，加入社群。",
    images: ["/api/og"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // google: "your-google-verification-code",
    // yandex: "your-yandex-verification-code",
    // bing: "your-bing-verification-code",
  },
};

export default async function RootLayout({ children }) {
  const currentUser = await getCurrentUser();

  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <head>
        {/* ✅ 性能優化：預先連結外部資源 */}
        <link rel="preconnect" href="https://imagedelivery.net" />
        <link rel="preconnect" href="https://media.aicreateaworld.com" />
      </head>

      <body className={`antialiased min-h-screen bg-zinc-950 text-white`}>
        <SessionProviderWrapper>
          <CurrentUserProvider>
            <FilterProvider>
              <PlayerProvider defaultShareMode="global" defaultMiniPlayerEnabled={false} defaultSeekable={false}>
                <ClientHeaderWrapper currentUser={currentUser} />

              <UploadModal />
              <UploadVideoModal />
              <UploadMusicModal />
              <LoginModal />
              <RegisterModal />

              {/* 主要內容區 */}
              <div className="relative z-0 min-h-screen pt-[80px] px-4 pb-[120px]">
                {children}
              </div>

              <FeedbackButton />
              <ClientToaster />
              <AdFooterPlaceholder />

              {/* 全域通知管理器 */}
              <GlobalNotificationManager />

              {/* 存储管理器初始化 */}
              <StorageManagerInit />

              {/* 條件性播放器組件 */}
              <ConditionalPlayer />

              </PlayerProvider>
            </FilterProvider>
          </CurrentUserProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
