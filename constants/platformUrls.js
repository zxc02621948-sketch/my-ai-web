// 平台官網 URL 映射
export const PLATFORM_URLS = {
  // 圖片生成平台
  "Stable Diffusion WebUI": "/install-guide#sdwebui",
  "ComfyUI": "/install-guide#comfyui",
  "SeaArt.ai": "https://www.seaart.ai",
  
  // 音樂生成平台
  "Suno": "https://suno.com",
  "TopMediai": "https://topmediai.com",
  "Mureka.ai": "https://mureka.ai",
  
  // 視頻生成平台
  "deevid.ai": "https://deevid.ai",
  "Stable Video Diffusion": "https://github.com/Stability-AI/generative-models",
  "SORA": "https://openai.com/sora",
  "OiiOii": "https://www.oiioii.ai",
  "Runway": "https://runwayml.com",
  "Pika Labs": "https://pika.art",
  // 即夢AI 沒有官方網站
};

// 檢查平台是否有官方網站連結
export function getPlatformUrl(platform) {
  if (!platform) return null;
  
  // 排除本地生成和其他
  if (platform === "本地生成" || platform === "其他") {
    return null;
  }
  
  return PLATFORM_URLS[platform] || null;
}

