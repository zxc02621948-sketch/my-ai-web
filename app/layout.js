// app/layout.js
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import FeedbackButton from "@/components/common/FeedbackButton";
import ClientHeaderWrapper from "@/components/common/ClientHeaderWrapper";
import { CurrentUserProvider } from "@/contexts/CurrentUserContext";
import { getCurrentUser } from "@/lib/serverAuth";
import UploadModal from "@/components/upload/UploadModal";
import LoginModal from "@/components/auth/LoginModal";
import RegisterModal from "@/components/auth/RegisterModal";
import { FilterProvider } from "@/components/context/FilterContext";
import ClientToaster from "@/components/common/ClientToaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
        {/* 只在「重新整理」時，最早期就把頁面捲到最頂；不影響返回上一頁 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  try {
    var nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || null;
    var isReload = nav ? (nav.type === 'reload')
      : (performance.navigation && performance.navigation.type === 1);
    if (!('scrollRestoration' in history) || !isReload) return;

    // 限定首頁才生效（如不需要可移除此判斷）
    if (location.pathname !== '/') return;

    history.scrollRestoration = 'manual';
    var toTop = function(){ try { window.scrollTo(0, 0); } catch(e){} };

    // 立刻一次，避免瀏覽器先把位置還原到半腰
    toTop();

    // DOM 準備好再補一次
    document.addEventListener('DOMContentLoaded', function(){ toTop(); }, { once: true });

    // 資源載完後再補幾次，覆蓋圖片/重排造成的位移
    window.addEventListener('load', function(){
      requestAnimationFrame(toTop);
      setTimeout(toTop, 50);
      setTimeout(toTop, 200);
      // 全部穩定後再還原為 auto（保留返回上一頁會回到原位的體驗）
      setTimeout(function(){ try { history.scrollRestoration = 'auto'; } catch(e){} }, 300);
    }, { once: true });
  } catch (e) {}
})();
            `,
          }}
        />
      </head>

      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-zinc-950 text-white`}
      >
        <CurrentUserProvider>
          <FilterProvider>
            <ClientHeaderWrapper currentUser={currentUser} />

            <UploadModal />
            <LoginModal />
            <RegisterModal />

            {/* 主要內容區 */}
            <div className="relative z-0 min-h-screen pt-[80px] px-4 pb-[120px]">
              {children}

              <div className="text-center text-sm text-gray-500 mt-10">
                版本 v0.7.3（2025-08-02）｜
                <a href="/changelog" className="underline hover:text-white">
                  查看更新內容
                </a>
              </div>
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
