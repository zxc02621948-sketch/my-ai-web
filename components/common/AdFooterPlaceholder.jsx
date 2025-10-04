"use client";

export default function AdFooterPlaceholder() {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 h-[80px] bg-black/70 border-t border-white/10 backdrop-blur-sm"
      aria-label="廣告預留區"
    >
      <div className="max-w-6xl mx-auto h-full px-4 flex items-center justify-center text-sm text-gray-300">
        <span className="mr-2">🔖</span>
        <span>這裡是廣告預留區（模擬實際廣告高度與位置）。</span>
      </div>
    </div>
  );
}