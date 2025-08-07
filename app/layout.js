import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import FeedbackButton from "@/components/common/FeedbackButton";
import ClientHeaderWrapper from "@/components/common/ClientHeaderWrapper";
import { CurrentUserProvider } from "@/contexts/CurrentUserContext";
import { getCurrentUser } from "@/lib/serverAuth";
import UploadModal from "@/components/upload/UploadModal";
import LoginModal from "@/components/auth/LoginModal";
import RegisterModal from "@/components/auth/RegisterModal";
import { FilterProvider } from "@/components/context/FilterContext"; // ✅ 新增這行
import ClientToaster from "@/components/common/ClientToaster"; // ✅ 新增

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
  icons: {
    icon: "/ai_logo_icon.png?v=2",
  },
};

export default async function RootLayout({ children }) {
  const currentUser = await getCurrentUser();

  return (
    <html lang="zh-TW">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-zinc-950 text-white`}
      >
        <CurrentUserProvider>
          <FilterProvider> {/* ✅ 把整體頁面包起來 */}
            <ClientHeaderWrapper currentUser={currentUser} />

            <UploadModal />
            <LoginModal />
            <RegisterModal />

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

            <ClientToaster /> {/* ✅ 放在這裡，全站 toast 生效 */}

            <div className="fixed bottom-0 left-0 w-full h-[90px] bg-zinc-900 text-white text-center border-t border-zinc-700 z-50 flex items-center justify-center text-sm">
              📢 廣告區｜這邊可以放 Google AdSense 或橫幅合作
            </div>
          </FilterProvider>
        </CurrentUserProvider>
      </body>
    </html>
  );
}
