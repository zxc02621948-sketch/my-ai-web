// constants/musicCategories.js
// 音樂風格映射表（英文儲存，中文顯示）
export const GENRE_MAP = {
  pop: "流行 Pop",
  rock: "搖滾 Rock",
  electronic: "電子 Electronic",
  classical: "古典 Classical",
  jazz: "爵士 Jazz",
  folk: "民謠 Folk",
  hiphop: "嘻哈 Hip-Hop",
  ambient: "氛圍 Ambient",
  acg: "動漫 / ACG",
  other: "其他 Others",
};

// ✅ 曲風符號對應表（用於卡片顯示）
export const GENRE_ICONS = {
  pop: "🎤", // 麥克風
  rock: "🎸", // 吉他
  electronic: "🎹", // 鍵盤/電子音樂
  classical: "🎻", // 小提琴
  jazz: "🎺", // 小號
  folk: "🪕", // 班卓琴
  hiphop: "🎧", // 耳機
  ambient: "🌊", // 波浪（氛圍感）
  acg: "🎮", // 遊戲手把
  other: "🎵", // 音符
};

// 風格選項清單（英文值）
export const MUSIC_GENRES = Object.keys(GENRE_MAP);

// 語言選項
export const MUSIC_LANGUAGES = ["chinese", "english", "japanese"];

// 語言映射表（英文儲存，中文顯示）
export const LANGUAGE_MAP = {
  chinese: "中文",
  english: "English",
  japanese: "日本語",
};

// 音樂類型（BGM/歌曲）
export const MUSIC_TYPE_MAP = {
  bgm: "BGM（純音樂）",
  song: "歌曲（有詞）",
};

// 向後相容：保留原來的 MUSIC_CATEGORIES
const MUSIC_CATEGORIES = Object.values(GENRE_MAP);

export default MUSIC_CATEGORIES;
