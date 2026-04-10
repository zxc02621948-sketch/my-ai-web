// app/images/page.jsx - 服務端包裝器，用於生成 SEO metadata
import ClientImagesPage from "./ClientImagesPage";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.aicreateaworld.com";

export async function generateMetadata() {
  return {
    title: "AI 圖片專區 | AI 創界",
    description:
      "探索 AI 生成的視覺藝術創作，包含 Stable Diffusion、ComfyUI、Midjourney 等平台的精彩圖片作品。瀏覽 Prompt 技巧、模型參數，加入 AI 創作社群。",
    keywords: [
      "AI 圖片",
      "AI 繪圖",
      "Stable Diffusion",
      "ComfyUI",
      "Midjourney",
      "AI 藝術",
      "Prompt",
      "LoRA",
      "AI 生成圖像",
      "AI 創作",
    ],
    openGraph: {
      title: "AI 圖片專區 | AI 創界",
      description:
        "探索 AI 生成的視覺藝術創作，包含 Stable Diffusion、ComfyUI、Midjourney 等平台的精彩圖片作品。",
      type: "website",
      url: `${BASE_URL}/images`,
    },
    alternates: {
      canonical: `${BASE_URL}/images`,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default function ImagesPage() {
  return <ClientImagesPage />;
}
