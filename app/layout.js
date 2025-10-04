// app/layout.js
import "./globals.css";
import FeedbackButton from "../components/common/FeedbackButton";
import ClientHeaderWrapper from "@/components/common/ClientHeaderWrapper";
import { CurrentUserProvider } from "@/contexts/CurrentUserContext";
import { getCurrentUser } from "@/lib/serverAuth";
import UploadModal from "@/components/upload/UploadModal";
import LoginModal from "@/components/auth/LoginModal";
import RegisterModal from "@/components/auth/RegisterModal";
import { FilterProvider } from "@/components/context/FilterContext";
import ClientToaster from "@/components/common/ClientToaster";
import { PlayerProvider } from "@/components/context/PlayerContext";
import MiniPlayer from "@/components/common/MiniPlayer";
import GlobalYouTubeBridge from "@/components/player/GlobalYouTubeBridge";
import AdFooterPlaceholder from "@/components/common/AdFooterPlaceholder";
// 移除全域 MiniPlayer / YouTubeBridge 與字型變數，恢復到較乾淨的版型

export const metadata = {
  title: "AI 創界",
  description: "一個為創作者與生成愛好者打造的分享平台",
  icons: { icon: "/ai_logo_icon.png?v=2" },
};

export default async function RootLayout({ children }) {
  const currentUser = await getCurrentUser();

  return (
    <html lang="zh-TW">
      <head />

      <body className={`antialiased min-h-screen bg-zinc-950 text-white`}>
        <CurrentUserProvider>
          <FilterProvider>
            <PlayerProvider defaultShareMode="global" defaultMiniPlayerEnabled={true} defaultSeekable={false} tabBehavior="pause_only">
              <ClientHeaderWrapper currentUser={currentUser} />

              <UploadModal />
              <LoginModal />
              <RegisterModal />

              {/* 主要內容區 */}
              <div className="relative z-0 min-h-screen pt-[80px] px-4 pb-[120px]">
                {children}
              </div>

              <FeedbackButton />
              <ClientToaster />
              <AdFooterPlaceholder />

              {/* 全域迷你播放器與 YouTube 橋接 */}
              <MiniPlayer />
              <GlobalYouTubeBridge />

            </PlayerProvider>
          </FilterProvider>
        </CurrentUserProvider>
      </body>
    </html>
  );
}
