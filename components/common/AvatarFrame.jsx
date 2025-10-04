import Link from "next/link";

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
  userId, // 使用者 ID 或 username
  frameId = "default", // 頭像框 ID
  showFrame = true, // 是否顯示頭像框
}) {
  const fallback =
    "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/b479a9e9-6c1a-4c6a-94ff-283541062d00/public";

  const clickable = !!userId || !!onClick; // 判斷是否可點

  // 頭像框路徑映射
  const frameFileMap = {
    "default": null,
    "cat-ears": { svg: "/frames/cat-ears.svg", png: null },
    "flame-ring": { svg: "/frames/flame-ring.svg", png: null },
    "flower-wreath": { svg: "/frames/flower-wreath.svg", png: null },
    "ai-generated": { svg: null, png: "/frames/ai-generated-7899315_1280.png" },
    "animals": { svg: null, png: "/frames/animals-5985896_1280.png" },
    "flowers": { svg: null, png: "/frames/flowers-1973874_1280.png" },
    "leaves": { svg: null, png: "/frames/leaves-6649803_1280.png" }
  };

  const frameInfo = frameFileMap[frameId];
  const framePath = frameInfo?.svg || null;
  const frameImagePath = frameInfo?.png || null;

  const avatar = (
    <div
      onClick={onClick}
      className={`relative shrink-0 ${clickable ? "cursor-pointer" : ""} ${className}`}
      style={{ width: size, height: size }}
      role={clickable ? "button" : undefined}
    >
      {/* 頭像內容 - 放在底層 */}
      <div
        className={`rounded-full ${ring ? "p-[2px]" : ""} relative z-0`}
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

      {/* 頭像框 - 放在最上層，比頭像更大 */}
      {showFrame && frameId !== "default" && (
        <div className="absolute pointer-events-none z-30" 
             style={{ 
               top: frameId === "flowers" ? '-10%' : '-10%', 
               left: frameId === "flowers" ? '-10%' : '-10%', 
               width: frameId === "flowers" ? '130%' : '120%', 
               height: frameId === "flowers" ? '130%' : '120%' 
             }}>
          <img
            src={framePath || frameImagePath}
            alt="Avatar frame"
            className="w-full h-full object-cover"
            draggable={false}
            onError={(e) => {
              // 如果 SVG 載入失敗，嘗試 PNG
              if (framePath && !e.currentTarget.src.includes('.png')) {
                e.currentTarget.src = frameImagePath;
              }
            }}
          />
        </div>
      )}

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

  return userId ? (
    <Link href={`/user/${userId}`} passHref>
      {avatar}
    </Link>
  ) : (
    avatar
  );
}
