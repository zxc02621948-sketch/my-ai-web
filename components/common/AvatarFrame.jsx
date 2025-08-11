"use client";

/**
 * AvatarFrame - 可重用頭相框
 *
 * Props
 * - src: 圖片 URL
 * - size: 邊長（px），預設 48
 * - alt: 圖片替代文字
 * - onClick: 點擊事件
 * - className: 外層額外樣式
 * - ring: 是否顯示漸層外環（預設 true）
 * - ringFrom, ringVia, ringTo: 自定義漸層色
 * - status: "online" | "offline" | undefined（右下狀態點）
 */
export default function AvatarFrame({
  src,
  size = 48,
  alt = "User Avatar",
  onClick,
  className = "",
  ring = true,
  ringFrom = "#79FFE1",
  ringVia = "#A78BFA",
  ringTo = "#FF80BF",
  status,
}) {
  const fallback =
    "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/b479a9e9-6c1a-4c6a-94ff-283541062d00/public";

  return (
    <div
      onClick={onClick}
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
      role={onClick ? "button" : undefined}
    >
      <div
        className={`rounded-full ${ring ? "p-[2px]" : ""}`}
        style={
          ring
            ? {
                backgroundImage: `linear-gradient(135deg, ${ringFrom}, ${ringVia}, ${ringTo})`,
                width: "100%",
                height: "100%",
              }
            : { width: "100%", height: "100%" }
        }
      >
        <div className="w-full h-full rounded-full bg-black p-[2px]">
          <img
            src={src || fallback}
            alt={alt}
            className="w-full h-full rounded-full object-cover shadow-[0_4px_18px_rgba(0,0,0,0.35)]"
            draggable={false}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = fallback;
            }}
          />
        </div>
      </div>

      {status && (
        <span
          aria-label={status === "online" ? "online" : "offline"}
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-black ${
            status === "online" ? "bg-emerald-400" : "bg-zinc-500"
          }`}
        />
      )}
    </div>
  );
}
