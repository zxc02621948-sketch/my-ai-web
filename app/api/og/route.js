import { ImageResponse } from "next/og";

export const runtime = "edge";

const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 20% 20%, rgba(99, 102, 241, 0.5), transparent 45%), radial-gradient(circle at 80% 30%, rgba(14, 165, 233, 0.4), transparent 50%), #05060a",
          color: "#ffffff",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          AI 創界
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 36,
            fontWeight: 400,
            opacity: 0.82,
          }}
        >
          AI 圖像・音樂創作分享平台
        </div>
      </div>
    ),
    size,
  );
}

