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
  // 顏色編輯選項
  frameColor = "#ffffff", // 頭像框顏色
  frameOpacity = 1, // 頭像框透明度
  // 新增：層級和透明度控制
  layerOrder = "frame-on-top", // 層級順序：frame-on-top 或 avatar-on-top
  frameTransparency = 1, // 頭像框透明度
}) {
  const fallback =
    "https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/b479a9e9-6c1a-4c6a-94ff-283541062d00/public";

  const clickable = !!userId || !!onClick; // 判斷是否可點

  // 頭像框路徑映射
  const frameFileMap = {
    "default": null, // 預設無頭像框
    "ai-generated": "/frames/ai-generated-7899315_1280.png",
    "animals": "/frames/animals-5985896_1280.png",
    "leaves": "/frames/leaves-6649803_1280.png",
    "magic-circle": "/frames/魔法陣1.png",
    "magic-circle-2": "/frames/魔法陣2.png",
    "military": "/frames/avatar-frame-military-01.png",
    "nature": "/frames/avatar-frame-nature-01.png"
  };

  const framePath = frameFileMap[frameId];

  // 顏色轉換函數
  const getHueFromColor = (color) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    
    if (diff === 0) return 0;
    
    let hue = 0;
    if (max === r) {
      hue = ((g - b) / diff) % 6;
    } else if (max === g) {
      hue = (b - r) / diff + 2;
    } else {
      hue = (r - g) / diff + 4;
    }
    
    return Math.round(hue * 60);
  };

  const getSaturationFromColor = (color) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    
    return Math.round((diff / 255) * 100);
  };

  const getBrightnessFromColor = (color) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    return Math.round(((r + g + b) / 3 / 255) * 100);
  };

  // 計算實際容器大小 - 如果有頭像框，容器需要更大
  const hasFrame = showFrame && frameId !== "default" && framePath;
  
  const frameScale = 1.2; // 頭像框擴展比例，減少到1.2
  const containerSize = hasFrame ? size * frameScale : size;
  const avatarSize = size; // 頭像本身保持原始大小
  const frameOffset = hasFrame ? ((containerSize - avatarSize) / 2) : 0;


  const avatar = (
    <div
      onClick={onClick}
      className={`relative shrink-0 ${clickable ? "cursor-pointer" : ""} ${className}`}
      style={{ 
        width: containerSize,
        height: containerSize
      }}
      role={clickable ? "button" : undefined}
    >
      {/* 頭像框 - 根據層級順序設置 z-index */}
      {hasFrame && (
        <div className="absolute pointer-events-none" 
             style={{ 
               zIndex: layerOrder === "frame-on-top" ? 10 : 0,
               opacity: frameTransparency,
               top: frameOffset - (avatarSize * (
                 frameId === 'magic-circle' ? 0.28 : 
                 frameId === 'magic-circle-2' ? 0.25 : 
                 frameId === 'military' ? 0.20 :
                 frameId === 'nature' ? 0.18 :
                 0.08
               )),
               left: frameOffset - (avatarSize * (
                 frameId === 'magic-circle' ? 0.30 : 
                 frameId === 'magic-circle-2' ? 0.25 : 
                 frameId === 'military' ? 0.20 :
                 frameId === 'nature' ? 0.18 :
                 0.08
               )),
               width: avatarSize + (avatarSize * (
                 frameId === 'magic-circle' ? 0.60 : 
                 frameId === 'magic-circle-2' ? 0.50 : 
                 frameId === 'military' ? 0.40 :
                 frameId === 'nature' ? 0.36 :
                 0.16
               )), 
               height: avatarSize + (avatarSize * (
                 frameId === 'magic-circle' ? 0.60 : 
                 frameId === 'magic-circle-2' ? 0.50 : 
                 frameId === 'military' ? 0.40 :
                 frameId === 'nature' ? 0.36 :
                 0.16
               ))
             }}>
          {/* 原始頭像框圖片 */}
          <img
            src={framePath}
            alt="Avatar frame"
            className="w-full h-full object-contain"
            draggable={false}
            onLoad={() => {}}
            onError={() => {}}
          />
          {/* 顏色疊加層 - 只影響頭像框區域 */}
          {frameColor && frameColor !== "#ffffff" && (
            <div 
              className="absolute inset-0 w-full h-full"
              style={{
                backgroundColor: frameColor,
                mixBlendMode: 'hue',
                opacity: frameOpacity,
                maskImage: `url(${framePath})`,
                maskSize: 'contain',
                maskPosition: 'center',
                maskRepeat: 'no-repeat'
              }}
            />
          )}
        </div>
      )}

      {/* 頭像內容 - 根據層級順序設置 z-index */}
      <div
        className={`absolute rounded-full ${ring ? "p-[2px]" : ""}`}
        style={{
          zIndex: layerOrder === "avatar-on-top" ? 10 : 0,
          ...(ring
            ? {
                backgroundImage: `linear-gradient(135deg, ${ringFrom}, ${ringVia}, ${ringTo})`,
                width: avatarSize,
                height: avatarSize,
                top: frameOffset,
                left: frameOffset,
              }
            : { 
                width: avatarSize, 
                height: avatarSize,
                top: frameOffset,
                left: frameOffset,
              })
        }}
      >
        <div className="w-full h-full rounded-full">
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

      {/* 狀態指示器 */}
      {status && (
        <div
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
            status === "online"
              ? "bg-green-500"
              : status === "away"
              ? "bg-yellow-500"
              : status === "busy"
              ? "bg-red-500"
              : "bg-gray-400"
          }`}
        />
      )}
    </div>
  );

  // 如果有 userId，包裝成 Link
  if (userId) {
    return (
      <Link href={`/user/${userId}`} className="block">
        {avatar}
      </Link>
    );
  }

  return avatar;
}