// components/image/PowerBuffBadge.jsx
"use client";

export default function PowerBuffBadge({ animated = false, type = "normal" }) {
  const getBadgeText = () => {
    return "BUFF"; // 統一顯示 "BUFF"
  };

  const getBadgeColor = () => {
    switch (type) {
      case "7day":
        return "from-blue-500 to-cyan-400";
      case "30day":
        return "from-purple-500 to-pink-400";
      case "rare":
        return "from-yellow-400 to-orange-500";
      default:
        return "from-green-500 to-emerald-400";
    }
  };

  const getGradientStyle = () => {
    // 統一使用金色漸變，營造高價值感
    return {
      background: "linear-gradient(90deg, #fbbf24, #f59e0b, #d97706)",
      backgroundClip: "text",
      WebkitBackgroundClip: "text",
      color: "#fbbf24" // 改為金色，不要透明
    };
  };

  return (
    <span 
      className={`pointer-events-none text-[11px] font-bold px-3 py-1.5 ${animated ? "animate-pulse" : ""}`}
      style={{
        ...getGradientStyle(),
        textShadow: "1px 1px 0px rgba(0,0,0,0.9), -1px -1px 0px rgba(0,0,0,0.9), 1px -1px 0px rgba(0,0,0,0.9), -1px 1px 0px rgba(0,0,0,0.9), 0 0 4px rgba(251, 191, 36, 0.6)",
        fontWeight: "700",
        letterSpacing: "0.3px",
        filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.2))"
      }}
    >
      {getBadgeText()}
    </span>
  );
}
