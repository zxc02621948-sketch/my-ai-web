"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function StructuredData() {
  const searchParams = useSearchParams();
  const imageId = searchParams?.get("image");
  const videoId = searchParams?.get("video");
  const musicId = searchParams?.get("music");

  useEffect(() => {
    // 移除旧的structured data
    const existingScript = document.getElementById("structured-data");
    if (existingScript) {
      existingScript.remove();
    }

    // 如果有内容ID，获取内容信息生成结构化数据
    if (imageId || videoId || musicId) {
      const fetchAndAddStructuredData = async () => {
        try {
          let data = null;
          let type = "";

          if (imageId) {
            const res = await fetch(`/api/images/${imageId}`);
            const json = await res.json();
            const image = json.image;
            if (image) {
              type = "ImageObject";
              data = {
                "@context": "https://schema.org",
                "@type": "ImageObject",
                name: image.title || "AI 圖像創作",
                description: image.description || image.positivePrompt || "AI 生成的圖像創作",
                image: image.imageId
                  ? `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${image.imageId}/public`
                  : image.imageUrl,
                creator: {
                  "@type": "Person",
                  name: image.username || image.author || "AI 創界用戶",
                },
                keywords: Array.isArray(image.tags) ? image.tags.join(", ") : "",
                datePublished: image.createdAt,
                dateModified: image.updatedAt || image.createdAt,
              };
            }
          } else if (videoId) {
            const res = await fetch(`/api/videos/${videoId}`);
            const json = await res.json();
            const video = json.video;
            if (video) {
              type = "VideoObject";
              data = {
                "@context": "https://schema.org",
                "@type": "VideoObject",
                name: video.title || "AI 影片創作",
                description: video.description || "AI 生成的影片創作",
                thumbnailUrl: video.thumbnailUrl || video.previewUrl,
                contentUrl: video.videoUrl,
                uploadDate: video.createdAt,
                duration: video.duration ? `PT${video.duration}S` : undefined,
                creator: {
                  "@type": "Person",
                  name: video.authorName || "AI 創界用戶",
                },
                keywords: Array.isArray(video.tags) ? video.tags.join(", ") : "",
              };
            }
          } else if (musicId) {
            const res = await fetch(`/api/music/${musicId}`);
            const json = await res.json();
            const music = json.music;
            if (music) {
              type = "MusicComposition";
              data = {
                "@context": "https://schema.org",
                "@type": "MusicComposition",
                name: music.title || "AI 音樂創作",
                description: music.description || "AI 生成的音樂創作",
                composer: {
                  "@type": "Person",
                  name: music.authorName || "AI 創界用戶",
                },
                genre: Array.isArray(music.genre) ? music.genre.join(", ") : music.genre || "",
                keywords: Array.isArray(music.tags) ? music.tags.join(", ") : "",
                datePublished: music.createdAt,
              };
            }
          }

          if (data) {
            const script = document.createElement("script");
            script.id = "structured-data";
            script.type = "application/ld+json";
            script.text = JSON.stringify(data);
            document.head.appendChild(script);
          }
        } catch (error) {
          console.error("Error adding structured data:", error);
        }
      };

      fetchAndAddStructuredData();
    }

    return () => {
      const script = document.getElementById("structured-data");
      if (script) {
        script.remove();
      }
    };
  }, [imageId, videoId, musicId]);

  return null;
}

