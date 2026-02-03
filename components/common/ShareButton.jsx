"use client";

import { useState } from "react";
import { Share2, Check, Copy } from "lucide-react";
import { notify } from "./GlobalNotificationManager";

export default function ShareButton({ 
  url, 
  title = "分享作品",
  className = "",
  variant = "default" // "default" | "icon" | "text"
}) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");
    
    // 优先使用 Web Share API（移动设备）
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          url: shareUrl,
        });
        return;
      } catch (err) {
        // 用户取消分享，不显示错误
        if (err.name === "AbortError") return;
      }
    }

    // 回退到复制链接
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      notify.success("已複製", "分享連結已複製到剪貼簿");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // 如果 clipboard API 失败，使用传统方法
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        notify.success("已複製", "分享連結已複製到剪貼簿");
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        notify.error("複製失敗", "請手動複製連結");
      } finally {
        document.body.removeChild(textArea);
      }
    }
  };

  if (variant === "icon") {
    return (
      <button
        onClick={handleShare}
        className={`inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white transition ${className}`}
        title="分享"
        aria-label="分享作品"
      >
        {copied ? (
          <Check className="w-5 h-5 text-emerald-400" />
        ) : (
          <Share2 className="w-5 h-5" />
        )}
      </button>
    );
  }

  if (variant === "text") {
    return (
      <button
        onClick={handleShare}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition ${className}`}
        title="分享"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 text-emerald-400" />
            <span>已複製</span>
          </>
        ) : (
          <>
            <Share2 className="w-4 h-4" />
            <span>分享</span>
          </>
        )}
      </button>
    );
  }

  // default variant
  return (
    <button
      onClick={handleShare}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
        copied
          ? "bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
          : "bg-white/10 text-white hover:bg-white/20"
      } ${className}`}
      title="分享作品"
    >
      {copied ? (
        <>
          <Check className="w-4 h-4" />
          <span>已複製</span>
        </>
      ) : (
        <>
          <Share2 className="w-4 h-4" />
          <span>分享</span>
        </>
      )}
    </button>
  );
}

