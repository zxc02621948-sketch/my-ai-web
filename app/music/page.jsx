// app/music/page.jsx - 服務端包裝器，讓 /music 正常渲染 ClientMusicPage
import ClientMusicPage from "./ClientMusicPage";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.aicreateaworld.com";

export async function generateMetadata() {
  return {
    title: "AI 音樂專區 | AI 創界",
    description:
      "探索 AI 生成的音樂創作，包含 Suno、Udio、MusicGen 等平台的精彩作品。瀏覽各種風格的 AI BGM、歌曲，加入 AI 音樂創作社群。",
    keywords: [
      "AI 音樂",
      "AI BGM",
      "Suno",
      "Udio",
      "MusicGen",
      "AI 生成音樂",
      "AI 作曲",
      "AI 歌曲",
      "AI 創作",
    ],
    openGraph: {
      title: "AI 音樂專區 | AI 創界",
      description:
        "探索 AI 生成的音樂創作，包含 Suno、Udio、MusicGen 等平台的精彩作品。",
      type: "website",
      url: `${BASE_URL}/music`,
    },
    alternates: {
      canonical: `${BASE_URL}/music`,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default function MusicPage() {
  return <ClientMusicPage />;
}


