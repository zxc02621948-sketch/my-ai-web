// app/layout.js
import { Geist, Geist_Mono } from "next/font/google";
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

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata = {
  title: "AI 創界",
  description: "一個為創作者與生成愛好者打造的分享平台",
  icons: { icon: "/ai_logo_icon.png?v=2" },
};

export default async function RootLayout({ children }) {
  const currentUser = await getCurrentUser();

  return (
    <html lang="zh-TW">
      <head>
        {/* 全站：只在「重新整理」時最早期置頂；不影響返回/前進 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  try {
    var nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || null;
    var isReload = nav ? (nav.type === 'reload')
      : (performance.navigation && performance.navigation.type === 1);
    if (!('scrollRestoration' in history) || !isReload) return;

    history.scrollRestoration = 'manual';
    var toTop = function(){ try { window.scrollTo(0, 0); } catch(e){} };

    // 立刻頂一次避免瀏覽器先還原到半腰
    toTop();
    // DOM 準備好再補一次
    document.addEventListener('DOMContentLoaded', function(){ toTop(); }, { once: true });
    // 資源載完後補幾次覆蓋重排位移，最後還原為 auto
    window.addEventListener('load', function(){
      requestAnimationFrame(toTop);
      setTimeout(toTop, 50);
      setTimeout(toTop, 200);
      setTimeout(function(){ try { history.scrollRestoration = 'auto'; } catch(e){} }, 300);
    }, { once: true });
  } catch (e) {}
})();
            `,
          }}
        />
      </head>

      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-zinc-950 text-white`}>
        <CurrentUserProvider>
          <FilterProvider>
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

            {/* 固定底欄（廣告/合作位） */}
            <div className="fixed bottom-0 left-0 w-full h-[90px] bg-zinc-900 text-white text-center border-t border-zinc-700 z-50 flex items-center justify-center text-sm">
              📢 廣告區｜這邊可以放 Google AdSense 或橫幅合作
            </div>
          </FilterProvider>
        </CurrentUserProvider>
      </body>
    </html>
  );
}
