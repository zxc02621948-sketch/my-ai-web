// ❌ 移除這一行！不要寫 "use client"
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/common/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "AI 創界所",
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
        <Header /> {/* ✅ 把登入邏輯搬到這裡處理 */}
        <main className="min-h-screen pt-[80px] px-4">
          {children}
          <div className="h-20" />
        </main>
        <div className="fixed bottom-0 left-0 w-full bg-zinc-800 text-white text-center py-3 border-t border-zinc-700 z-50">
          📢 廣告區｜這邊可以放 Google AdSense 或橫幅合作
        </div>
      </body>
    </html>
  );
}
