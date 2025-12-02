 "use client";
 
 import { useEffect } from "react";
 import { useSearchParams, usePathname } from "next/navigation";
 
 export default function StructuredData() {
   const searchParams = useSearchParams();
   const pathname = usePathname();
 
   const imageIdFromQuery = searchParams?.get("image");
   const videoIdFromQuery = searchParams?.get("video");
   const musicIdFromQuery = searchParams?.get("music");
 
  let imageIdFromPath = null;
  let videoIdFromPath = null;
  let musicIdFromPath = null;
  let discussionIdFromPath = null;
 
   if (pathname) {
     const parts = pathname.split("/").filter(Boolean);
    if (parts[0] === "images" && parts[1]) {
      imageIdFromPath = parts[1];
    } else if (parts[0] === "videos" && parts[1]) {
      videoIdFromPath = parts[1];
    } else if (parts[0] === "music" && parts[1]) {
      musicIdFromPath = parts[1];
    } else if (parts[0] === "discussion" && parts[1] && parts.length === 2) {
      // /discussion/[id] 詳細頁（排除 /edit 等子路徑）
      discussionIdFromPath = parts[1];
    }
   }
 
   const imageId = imageIdFromQuery || imageIdFromPath;
   const videoId = videoIdFromQuery || videoIdFromPath;
  const musicId = musicIdFromQuery || musicIdFromPath;
  const discussionId = discussionIdFromPath;
 
   useEffect(() => {
     const existingScript = document.getElementById("structured-data");
     if (existingScript) {
       existingScript.remove();
     }
 
    if (imageId || videoId || musicId || discussionId) {
       const fetchAndAddStructuredData = async () => {
         try {
           let data = null;
 
           if (imageId) {
             const res = await fetch(`/api/images/${imageId}`);
             const json = await res.json();
             const image = json.image;
             if (image) {
               data = {
                 "@context": "https://schema.org",
                 "@type": "ImageObject",
                 name: image.title || "AI 圖像創作",
                 description:
                   image.description ||
                   image.positivePrompt ||
                   "AI 生成的圖像創作",
                 image: image.imageId
                   ? `https://imagedelivery.net/qQdazZfBAN4654_waTSV7A/${image.imageId}/public`
                   : image.imageUrl,
                 creator: {
                   "@type": "Person",
                   name: image.username || image.author || "AI 創界用戶",
                 },
                 keywords: Array.isArray(image.tags)
                   ? image.tags.join(", ")
                   : "",
                 datePublished: image.createdAt,
                 dateModified: image.updatedAt || image.createdAt,
               };
             }
           } else if (videoId) {
             const res = await fetch(`/api/videos/${videoId}`);
             const json = await res.json();
             const video = json.video;
             if (video) {
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
                 keywords: Array.isArray(video.tags)
                   ? video.tags.join(", ")
                   : "",
               };
             }
          } else if (musicId) {
             const res = await fetch(`/api/music/${musicId}`);
             const json = await res.json();
             const music = json.music;
             if (music) {
               data = {
                 "@context": "https://schema.org",
                 "@type": "MusicComposition",
                 name: music.title || "AI 音樂創作",
                 description: music.description || "AI 生成的音樂創作",
                 composer: {
                   "@type": "Person",
                   name: music.authorName || "AI 創界用戶",
                 },
                 genre: Array.isArray(music.genre)
                   ? music.genre.join(", ")
                   : music.genre || "",
                 keywords: Array.isArray(music.tags)
                   ? music.tags.join(", ")
                   : "",
                datePublished: music.createdAt,
              };
            }
          } else if (discussionId) {
            const res = await fetch(`/api/discussion/posts/${discussionId}`);
            const json = await res.json();
            const post = json.data;
            if (post) {
              const categoryNames = {
                announcement: "官方公告",
                technical: "技術討論",
                showcase: "作品展示",
                question: "問題求助",
                tutorial: "教學分享",
                general: "閒聊",
              };

              const contentText = (post.content || "")
                .replace(/[#*`_~\[\]()]/g, "")
                .replace(/\n/g, " ")
                .trim();

              data = {
                "@context": "https://schema.org",
                "@type": "DiscussionForumPosting",
                headline: post.title,
                articleBody: contentText,
                datePublished: post.createdAt,
                dateModified: post.updatedAt || post.createdAt,
                author: {
                  "@type": "Person",
                  name: post.authorName || post.author?.username || "論壇用戶",
                },
                interactionStatistic: [
                  {
                    "@type": "InteractionCounter",
                    interactionType: "https://schema.org/LikeAction",
                    userInteractionCount: post.likesCount || 0,
                  },
                  {
                    "@type": "InteractionCounter",
                    interactionType: "https://schema.org/CommentAction",
                    userInteractionCount: post.commentsCount || 0,
                  },
                ],
                keywords: [
                  "討論區",
                  categoryNames[post.category] || post.category,
                ],
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
  }, [imageId, videoId, musicId, discussionId]);
 
   return null;
 }

