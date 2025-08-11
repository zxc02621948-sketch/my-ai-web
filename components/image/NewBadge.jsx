// components/image/NewBadge.jsx
"use client";

export default function NewBadge({ animated = false }) {
  return (
    <span className="pointer-events-none absolute top-2 left-2 z-10 rounded-full bg-black/50 backdrop-blur-sm text-[10px] font-extrabold px-2 py-1 shadow-md ring-1 ring-white/10">
      <span className={`rainbow-text ${animated ? "animated" : ""}`}>NEW</span>

      <style jsx>{`
        .rainbow-text {
          background: linear-gradient(
            90deg,
            #f472b6,
            #fb923c,
            #facc15,
            #34d399,
            #38bdf8,
            #a78bfa,
            #f472b6
          );
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent;
          background-size: 200% auto; /* 讓動畫更順暢 */
          letter-spacing: 0.05em;
        }
        .animated {
          animation: rainbow-move 3s linear infinite;
        }
        @keyframes rainbow-move {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 200% 50%;
          }
        }
      `}</style>
    </span>
  );
}
