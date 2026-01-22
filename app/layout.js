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
import { PlayerProvider } from "@/components/context/PlayerContext";
import ConditionalPlayer from "@/components/common/ConditionalPlayer";
import ClientOnlyComponents from "@/components/common/ClientOnlyComponents";
import GlobalNotificationManager from "@/components/common/GlobalNotificationManager";
import StorageManagerInit from "@/components/common/StorageManagerInit";
// 移除全域 MiniPlayer / YouTubeBridge 與字型變數，恢復到較乾淨的版型

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://www.aicreateaworld.com'),
  title: {
    default: "AI 創界 - AI 創作分享平台",
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
    title: "AI 創界 - AI 創作分享平台",
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
    title: "AI 創界 - AI 創作分享平台",
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
        {/* ✅ 網站結構化數據 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "AI 創界",
              url: process.env.NEXT_PUBLIC_BASE_URL || "https://www.aicreateaworld.com",
              description: "探索 AI 生成藝術的無限可能。分享你的 Stable Diffusion、ComfyUI 創作，學習 Prompt 技巧，獲取模型參數，加入創作者社群。",
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: `${process.env.NEXT_PUBLIC_BASE_URL || "https://www.aicreateaworld.com"}/?search={search_term_string}`,
                },
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
      </head>

      <body className={`antialiased min-h-screen bg-zinc-950 text-white`}>
        {/* ✅ 全局清理脚本：確保頁面加載時移除所有殘留的遮罩 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // ✅ 激進清理函數：移除所有可能的遮罩和阻止交互的元素
                function aggressiveCleanup() {
                  console.log('🧹 開始清理遮罩...');
                  
                  // 1. 重置 body 樣式
                  document.body.style.overflow = "";
                  document.body.style.pointerEvents = "";
                  document.body.style.position = "";
                  document.documentElement.style.overflow = "";
                  document.documentElement.style.pointerEvents = "";
                  
                  // 2. 移除所有固定定位的遮罩層（更激進）
                  const allFixedElements = document.querySelectorAll('*');
                  allFixedElements.forEach(el => {
                    const style = window.getComputedStyle(el);
                    if (style.position === 'fixed' && 
                        (el.classList.contains('inset-0') || 
                         el.classList.contains('backdrop-blur-sm') ||
                         el.classList.contains('bg-black') ||
                         (el.getAttribute('class') && el.getAttribute('class').includes('bg-black')) ||
                         (el.getAttribute('class') && el.getAttribute('class').includes('backdrop')))) {
                      // 檢查是否是遮罩層（通常是固定定位 + 全屏 + 半透明背景）
                      const rect = el.getBoundingClientRect();
                      const isFullScreen = rect.width >= window.innerWidth * 0.9 && 
                                         rect.height >= window.innerHeight * 0.9;
                      if (isFullScreen && el !== document.body && el !== document.documentElement) {
                        console.log('🗑️ 移除遮罩元素:', el);
                        if (el.parentNode) {
                          el.parentNode.removeChild(el);
                        }
                      }
                    }
                  });
                  
                  // 3. 移除所有 Dialog 相關的元素（Headless UI）
                  const dialogs = document.querySelectorAll('[role="dialog"]');
                  dialogs.forEach(dialog => {
                    // 檢查 Dialog 是否應該被關閉（沒有 data-keep 屬性）
                    if (!dialog.hasAttribute('data-keep')) {
                      const backdrop = dialog.querySelector('[class*="backdrop"], [class*="bg-black"]');
                      if (backdrop) {
                        console.log('🗑️ 移除 Dialog 遮罩:', backdrop);
                        if (backdrop.parentNode) {
                          backdrop.parentNode.removeChild(backdrop);
                        }
                      }
                      // 如果 Dialog 本身是遮罩層，也移除
                      const dialogStyle = window.getComputedStyle(dialog);
                      if (dialogStyle.position === 'fixed' && dialog.classList.contains('inset-0')) {
                        console.log('🗑️ 移除 Dialog 本身:', dialog);
                        if (dialog.parentNode) {
                          dialog.parentNode.removeChild(dialog);
                        }
                      }
                    }
                  });
                  
                  // 4. 移除所有阻止交互的樣式（但只針對 body 和 html，避免影響其他元素）
                  // ✅ 注意：不要移除其他元素的 pointerEvents，因為某些元素可能需要它
                  if (document.body.style.pointerEvents === 'none') {
                    document.body.style.pointerEvents = "";
                  }
                  if (document.documentElement.style.pointerEvents === 'none') {
                    document.documentElement.style.pointerEvents = "";
                  }
                  
                  // 5. 強制移除所有 z-index 很高的固定元素（可能是殘留的遮罩）
                  const highZElements = document.querySelectorAll('*');
                  highZElements.forEach(el => {
                    const style = window.getComputedStyle(el);
                    const zIndex = parseInt(style.zIndex);
                    if (zIndex >= 50 && style.position === 'fixed' && 
                        el.classList.contains('inset-0') &&
                        !el.hasAttribute('data-keep')) {
                      const rect = el.getBoundingClientRect();
                      if (rect.width >= window.innerWidth * 0.9 && 
                          rect.height >= window.innerHeight * 0.9) {
                        console.log('🗑️ 移除高 z-index 遮罩:', el);
                        if (el.parentNode) {
                          el.parentNode.removeChild(el);
                        }
                      }
                    }
                  });
                  
                  console.log('✅ 清理完成');
                }
                
                // ✅ 檢查 URL 參數，如果有 ?forceCleanup=true，立即執行激進清理
                if (typeof window !== 'undefined' && window.location.search.includes('forceCleanup=true')) {
                  aggressiveCleanup();
                  // 移除 URL 參數
                  const url = new URL(window.location);
                  url.searchParams.delete('forceCleanup');
                  window.history.replaceState({}, '', url);
                }
                
                // 頁面加載時立即執行
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', aggressiveCleanup);
                } else {
                  aggressiveCleanup();
                }
                
                // ✅ 頁面可見時檢查是否有殘留遮罩（但不激進清理，避免影響正常交互）
                document.addEventListener('visibilitychange', function() {
                  if (!document.hidden) {
                    // ✅ 修復：當頁面重新可見時（切換標籤頁回來），檢查並恢復 body 狀態
                    // 但必須非常保守，避免誤判導致彈窗被關閉
                    
                    // ✅ 檢查 body.overflow 狀態（如果被設置為 hidden，通常意味著有 Modal 打開）
                    const bodyOverflow = window.getComputedStyle(document.body).overflow;
                    const bodyOverflowStyle = document.body.style.overflow;
                    const isBodyLocked = bodyOverflow === 'hidden' || bodyOverflowStyle === 'hidden';
                    
                    // ✅ 如果 body 被鎖定，保守起見不恢復（避免誤判導致彈窗被關閉）
                    // 只有在 body 沒有被鎖定時，才進行清理
                    if (!isBodyLocked) {
                      // ✅ 檢查是否有打開的 Modal（通過檢查 Dialog 或 Modal 組件）
                      // 1. 檢查 Headless UI Dialog
                      const hasHeadlessDialog = document.querySelector('[role="dialog"]:not([aria-hidden="true"])') !== null;
                      
                      // 2. 檢查自定義 Modal（MusicModal 使用 createPortal，有 fixed inset-0 容器）
                      // MusicModal 的容器是: fixed inset-0 bg-black/90 backdrop-blur-sm z-[1200]
                      // 更簡單的檢測：如果有一個 fixed inset-0 容器，z-index >= 1000，且有 backdrop-blur，就認為是 Modal
                      const modalContainers = document.querySelectorAll('.fixed.inset-0');
                      let hasCustomModal = false;
                      modalContainers.forEach(container => {
                        const style = window.getComputedStyle(container);
                        // ✅ 檢查容器是否可見（不是 display: none 或 visibility: hidden）
                        if (style.display !== 'none' && style.visibility !== 'hidden') {
                          const zIndex = parseInt(style.zIndex) || 0;
                          const hasBackdrop = container.classList.contains('backdrop-blur-sm') || 
                                             container.classList.contains('backdrop-blur') ||
                                             (container.getAttribute('class') && container.getAttribute('class').includes('backdrop-blur'));
                          const hasBgBlack = container.classList.contains('bg-black') ||
                                           (container.getAttribute('class') && container.getAttribute('class').includes('bg-black'));
                          
                          // ✅ 簡化檢測：如果 z-index >= 1000 且有 backdrop 或 bg-black，就認為是 Modal
                          // 這樣可以避免因為內容檢測失敗而誤判
                          if (zIndex >= 1000 && (hasBackdrop || hasBgBlack)) {
                            hasCustomModal = true;
                            return; // 找到一個就足夠了
                          }
                        }
                      });
                      
                      const hasOpenModal = hasHeadlessDialog || hasCustomModal;
                      
                      // ✅ 如果沒有打開的 Modal 且 body 沒有被鎖定，才恢復 body 狀態
                      if (!hasOpenModal) {
                        document.body.style.overflow = "";
                        document.body.style.position = "";
                        document.body.style.width = "";
                        document.body.style.height = "";
                        document.body.style.pointerEvents = "";
                        document.documentElement.style.overflow = "";
                        document.documentElement.style.pointerEvents = "";
                      }
                    } else {
                      // ✅ 如果 body 被鎖定，完全跳過後續的清理邏輯（包括移除殘留遮罩）
                      // 這樣可以避免誤刪正在打開的彈窗
                      return;
                    }
                    // ✅ 如果 body 被鎖定，即使沒有檢測到 Modal，也不恢復（避免誤判）
                    // 這樣可以避免在 Modal 打開時誤清理 body 狀態，導致彈窗被關閉
                    
                    // ✅ 只有在 body 沒有被鎖定時，才執行後續的清理邏輯
                    // ✅ 檢查是否有打開的 Modal（通過檢查 Dialog 或 Modal 組件）
                    // 1. Headless UI Dialog 打開時會有特定的結構
                    const dialogs = document.querySelectorAll('[role="dialog"]');
                    const openDialogs = new Set(); // 記錄所有打開的 Dialog 及其父元素
                    
                    dialogs.forEach(dialog => {
                      // ✅ 檢查 Dialog 是否打開（Headless UI 的 Dialog 打開時 aria-hidden 為 false 或不存在）
                      const ariaHidden = dialog.getAttribute('aria-hidden');
                      if (ariaHidden !== 'true') {
                        // ✅ 檢查 Dialog 是否有可見的內容（不是隱藏的）
                        const style = window.getComputedStyle(dialog);
                        if (style.display !== 'none' && style.visibility !== 'hidden') {
                          // ✅ 記錄這個 Dialog 及其所有父元素（包括遮罩層）
                          let parent = dialog.parentNode;
                          while (parent && parent !== document.body) {
                            openDialogs.add(parent);
                            parent = parent.parentNode;
                          }
                          openDialogs.add(dialog);
                        }
                      }
                    });
                    
                    // 2. ✅ 檢測自定義 Modal 組件（使用 createPortal，有 fixed inset-0 容器 + bg-zinc-900 內容）
                    // 注意：這裡使用不同的選擇器，因為有些 Modal 可能沒有 overflow-hidden 類
                    const overflowHiddenContainers = document.querySelectorAll('.fixed.inset-0.overflow-hidden');
                    overflowHiddenContainers.forEach(container => {
                      const style = window.getComputedStyle(container);
                      // ✅ 檢查容器是否可見
                      if (style.display !== 'none' && style.visibility !== 'hidden') {
                        // ✅ 檢查內部是否有 Modal 內容（bg-zinc-900 或其他 Modal 特徵）
                        const hasModalContent = container.querySelector('.bg-zinc-900, .bg-neutral-900, [class*="rounded-2xl"], [class*="rounded-xl"]');
                        if (hasModalContent) {
                          // ✅ 記錄這個 Modal 容器及其所有子元素（包括遮罩層）
                          openDialogs.add(container);
                          const allChildren = container.querySelectorAll('*');
                          allChildren.forEach(child => openDialogs.add(child));
                        }
                      }
                    });
                    
                    // ✅ 只移除明顯是殘留的遮罩（全屏 + 固定定位 + 半透明 + 沒有關聯的 Dialog）
                    // ✅ 重要：只有在 body 沒有被鎖定時才執行此邏輯
                    const allFixedElements = document.querySelectorAll('*');
                    allFixedElements.forEach(el => {
                      // ✅ 如果這個元素是打開的 Dialog 的一部分，跳過
                      if (openDialogs.has(el)) {
                        return;
                      }
                      
                      const style = window.getComputedStyle(el);
                      if (style.position === 'fixed') {
                        const rect = el.getBoundingClientRect();
                        const isFullScreen = rect.width >= window.innerWidth * 0.95 && 
                                           rect.height >= window.innerHeight * 0.95;
                        // ✅ 只移除明顯是遮罩的元素（全屏 + 半透明背景）
                        if (isFullScreen && 
                            el !== document.body && 
                            el !== document.documentElement &&
                            (el.classList.contains('backdrop-blur-sm') || 
                             (el.getAttribute('class') && el.getAttribute('class').includes('bg-black')))) {
                          // ✅ 檢查是否有關聯的 Dialog（在同一個父元素中或父元素的父元素中）
                          let parent = el.parentNode;
                          let hasDialog = false;
                          while (parent && parent !== document.body) {
                            if (parent.querySelector('[role="dialog"]')) {
                              hasDialog = true;
                              break;
                            }
                            parent = parent.parentNode;
                          }
                          
                          // ✅ 如果沒有關聯的 Dialog，才移除（可能是殘留的遮罩）
                          if (!hasDialog) {
                            const childCount = el.children.length;
                            // ✅ 如果只有遮罩層本身，沒有實際內容，才移除
                            if (childCount === 0 || (childCount === 1 && el.querySelector('[role="dialog"]') === null)) {
                              console.log('🗑️ 移除殘留遮罩:', el);
                              if (el.parentNode) {
                                el.parentNode.removeChild(el);
                              }
                            }
                          }
                        }
                      }
                    });
                  }
                });
                
                // ✅ 暴露全局清理函數，方便在控制台調用
                window.forceCleanup = aggressiveCleanup;
              })();
            `,
          }}
        />
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
              <ClientOnlyComponents />

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
