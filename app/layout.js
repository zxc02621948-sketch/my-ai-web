import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import FeedbackButton from "@/components/common/FeedbackButton";

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

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-white`}
      >
        <main className="min-h-screen pt-[80px] px-4 pb-[120px]">
          {children}

          <div className="text-center text-sm text-gray-500 mt-10">
            版本 v0.7.3（2025-08-02）｜
            <a href="/changelog" className="underline hover:text-white">查看更新內容</a>
          </div>
        </main>

        {/* 🟡 固定右下角的回報按鈕 */}
        <FeedbackButton />

        {/* 🟡 固定底部廣告區（模擬寬高 & 空間） */}
        <div className="fixed bottom-0 left-0 w-full h-[90px] bg-zinc-900 text-white text-center border-t border-zinc-700 z-50 flex items-center justify-center text-sm">
          📢 廣告區｜這邊可以放 Google AdSense 或橫幅合作
        </div>
      </body>
    </html>
  );
}
