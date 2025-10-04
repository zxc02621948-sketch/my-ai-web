"use client";

export default function MiniPlayerArt({ isPlaying, palette }) {
  // 參考圖風格配色：米色底盤、黑膠、橘色標籤
  const p = palette || {
    bg: "#F8F1E4", // 米白（內層）
    border: "#F8F1E4", // 同色米白（外框）
    accent1: "#E67E22",
    accent2: "#D35400",
  };

  // 旋轉中心（黑膠唱片中心，置中）
  const cx = 100;
  const cy = 92; // 唱片往上移一點，為下方進度條留空間

  return (
    <div className="relative w-full h-full">
      <svg
        className="w-full h-full"
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 光圈與剪裁定義：移除標記，只保留旋轉光圈效果 */}
        <defs>
          {/* 外框描邊漸層（保留立體層次） */}
          <linearGradient id="frameStrokeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(0,0,0,0.18)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.32)" />
          </linearGradient>
          {/* 外框高光描邊（頂部更亮，底部漸淡） */}
          <linearGradient id="frameHighlightGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.42" />
            <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
          {/* 外框暗角（四周輕微暗化，避免純色過於平） */}
          <radialGradient id="frameVignette" cx="50%" cy="50%" r="75%">
            <stop offset="60%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.2" />
          </radialGradient>
          <clipPath id="clipDisc" clipPathUnits="userSpaceOnUse">
            <circle cx={cx} cy={cy} r="60" />
          </clipPath>
          {/* 本地座標剪裁：與光圈群組同座標系，避免因 translate 產生偏移 */}
          <clipPath id="clipDiscLocal" clipPathUnits="userSpaceOnUse">
            <circle cx="0" cy="0" r="60" />
          </clipPath>
          {/* 柔化光圈的輕微模糊濾鏡（稍微提高模糊） */}
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%" filterUnits="userSpaceOnUse">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.4" />
          </filter>
          {/* 內層面板綜合效果：金屬拉絲 + 高光（減少純色的平面感） */}
          <filter id="innerPanelFX" x="-50%" y="-50%" width="200%" height="200%" filterUnits="userSpaceOnUse">
            {/* 拉絲金屬紋理：沿水平方向形成細緻線條 */}
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.45" numOctaves="2" seed="3" stitchTiles="stitch" result="noise" />
            <feColorMatrix in="noise" type="saturate" values="0" result="mono" />
            <feGaussianBlur in="mono" stdDeviation="0.6" result="brushed" />
            {/* 金屬高光：使用遠光源形成方向性高光 */}
            <feSpecularLighting in="brushed" surfaceScale="2" specularConstant="0.6" specularExponent="18" lightingColor="#ffffff" result="spec">
              <feDistantLight azimuth="135" elevation="55" />
            </feSpecularLighting>
            <feComposite in="spec" in2="brushed" operator="in" result="metalShade" />
            {/* 疊乘到原始內層面板顏色，呈現金屬質地 */}
            <feBlend in="SourceGraphic" in2="metalShade" mode="multiply" result="final" />
          </filter>
          {/* 鏡面高光用模糊濾鏡與線性漸層（高光固定、唱片旋轉） */}
          <filter id="specBlur" x="-60%" y="-60%" width="220%" height="220%" filterUnits="userSpaceOnUse">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" />
          </filter>
          <linearGradient id="glintLinear" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
        
        </defs>
        {/* 外框：整塊紅木色（含高光與暗角），提升古典質感 */}
        <rect x="0" y="0" width="200" height="200" rx="20" fill={p.bg} stroke="none" />
        {/* 內圈邊緣（羊皮紙＋紙紋與微內陰影） */}
        <rect x="10" y="10" width="180" height="180" rx="18" fill={p.bg} stroke="none" />

        {/* 黑膠唱片與同心環溝槽（外層僅置中，內層自轉，避免繞圈） */}
        <g transform={`translate(${cx} ${cy})`}>
          <g>
            <circle cx="0" cy="0" r="60" fill="#262626" stroke="#151515" strokeWidth="2" />
            {[52, 44, 36, 28, 22, 16].map((r, i) => (
              <circle key={i} cx="0" cy="0" r={r} fill="none" stroke="#3a3a3a" strokeWidth="1" opacity="0.6" />
            ))}
            <circle cx="0" cy="0" r="18" fill={p.accent1} stroke="#8C6A2F" strokeWidth="0.8" />
            <circle cx="0" cy="0" r="3" fill="#F9EFE4" />
            {isPlaying && (
              <animateTransform
                attributeName="transform"
                attributeType="XML"
                type="rotate"
                from="0 0 0"
                to="360 0 0"
                dur="3.6s"
                repeatCount="indefinite"
              />
            )}
          </g>
        </g>
        {/* 光效果：唱片鏡面高光（固定方向），播放時高光繞盤旋轉形成掃光（CSS 控制可暫停保留位置） */}
        <g clipPath="url(#clipDiscLocal)" transform={`translate(${cx} ${cy})`}>
          <g
            opacity="1"
            filter="url(#specBlur)"
            style={{
              mixBlendMode: 'screen',
              transformOrigin: 'center',
              transformBox: 'fill-box',
              animation: 'glintRotate 6s linear infinite',
              animationPlayState: isPlaying ? 'running' : 'paused',
            }}
          >
            {/* 主高光：細長橢圓，固定方向，唱片旋轉時呈現掃光感 */}
            <ellipse
              cx="0" cy="0" rx="48" ry="10"
              fill="url(#glintLinear)"
              opacity="0.28"
              transform="rotate(-22)"
              style={{
                animation: 'glintPulseOpacity 8s ease-in-out -1.0s infinite',
                animationPlayState: isPlaying ? 'running' : 'paused',
              }}
            />
            {/* 次高光：更窄更淡，增加層次感 */}
            <ellipse
              cx="0" cy="0" rx="36" ry="6"
              fill="url(#glintLinear)"
              opacity="0.18"
              transform="rotate(18)"
              style={{
                animation: 'glintPulseOpacity 9s ease-in-out -0.6s infinite',
                animationPlayState: isPlaying ? 'running' : 'paused',
              }}
            />
          </g>
        </g>

        {/* 全域 CSS 動畫（使用 styled-jsx global）：高光旋轉＋輕微呼吸（透明度） */}
        <style jsx global>{`
          @keyframes glintRotate {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes glintPulseOpacity {
            0% { opacity: 0.22; }
            50% { opacity: 0.34; }
            100% { opacity: 0.22; }
          }
        `}</style>

        {/* 唱臂（樞紐＋臂＋唱頭；座標右6上6） */}
        <g>
          <circle cx="166" cy="46" r="10" fill="#A8B5B8" stroke="#8FA0A6" strokeWidth="2" />
          <path d="M166 46 L124 76" stroke="#BFC7CA" strokeWidth="8" strokeLinecap="round" />
          <rect x="116" y="72" width="16" height="10" rx="3" fill="#D0D6D8" stroke="#9FAEB4" strokeWidth="1" />
        </g>
      </svg>
    </div>
  );
}
