import mongoose from "mongoose";

const MusicSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    musicUrl: {
      type: String,
      required: true,
    },
    coverImageUrl: {
      type: String,
      default: "",
    },
    duration: {
      type: Number,
      default: 0, // 秒數
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    authorName: {
      type: String,
      required: true,
    },
    authorAvatar: {
      type: String,
      default: "",
    },

    // ✅ 互動數據
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    likesCount: {
      type: Number,
      default: 0,
    },
    plays: {
      type: Number,
      default: 0,
    },
    clicks: {
      type: Number,
      default: 0,
    },

    // ✅ AI 生成元數據
    platform: {
      type: String,
      default: "", // e.g., 'Suno', 'Udio', 'MusicGen', 'Stable Audio'
    },
    prompt: {
      type: String,
      default: "",
    },
    modelName: {
      type: String,
      default: "",
    },
    modelLink: {
      type: String,
      default: "",
    },

    // ✅ 音樂屬性
    genre: {
      type: [String],
      default: [], // e.g., ['pop', 'rock', 'electronic']
    },
    language: {
      type: String,
      default: "", // 'chinese', 'english', 'japanese'
    },
    mood: {
      type: String,
      default: "", // e.g., 'Happy', 'Sad', 'Energetic', 'Calm'
    },
    tempo: {
      type: Number,
      default: null, // BPM
    },
    key: {
      type: String,
      default: "", // e.g., 'C Major', 'A Minor'
    },

    // ✅ 歌曲專用屬性
    lyrics: {
      type: String,
      default: "", // 歌詞
    },
    singerGender: {
      type: String,
      enum: ["", "male", "female", "mixed", "n/a"],
      default: "", // 歌手性別
    },

    // ✅ 生成參數
    seed: {
      type: String,
      default: "",
    },
    temperature: {
      type: Number,
      default: null,
    },
    topK: {
      type: Number,
      default: null,
    },
    topP: {
      type: Number,
      default: null,
    },

    // ✅ Suno 專用參數
    excludeStyles: {
      type: String,
      default: "", // 排除的風格
    },
    styleInfluence: {
      type: Number,
      default: null, // 風格影響力 (0-100)
    },
    weirdness: {
      type: Number,
      default: null, // 怪異度 (0-100)
    },

    // ✅ 音頻參數
    sampleRate: {
      type: Number,
      default: null, // e.g., 44100, 48000
    },
    bitrate: {
      type: Number,
      default: null, // e.g., 320, 192
    },
    format: {
      type: String,
      default: "", // e.g., 'mp3', 'wav', 'flac'
    },

    // ✅ 分級與分類
    rating: {
      type: String,
      enum: ["all", "15", "18"],
      default: "all",
    },
    category: {
      type: String,
      default: "",
    },

    // ✅ 完整度與分數
    completenessScore: {
      type: Number,
      default: 0,
    },
    hasMetadata: {
      type: Boolean,
      default: false,
    },
    popScore: {
      type: Number,
      default: 0,
    },
    initialBoost: {
      type: Number,
      default: 0,
    },

    uploadDate: {
      type: Date,
      default: Date.now,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// 建立索引
MusicSchema.index({ author: 1 });
MusicSchema.index({ uploadDate: -1 });
MusicSchema.index({ likesCount: -1 });
MusicSchema.index({ plays: -1 });
MusicSchema.index({ tags: 1 });
MusicSchema.index({ genre: 1 });
MusicSchema.index({ language: 1 });
MusicSchema.index({ mood: 1 });
MusicSchema.index({ singerGender: 1 });
MusicSchema.index({ rating: 1, uploadDate: -1 });
MusicSchema.index({ hasMetadata: 1 });
MusicSchema.index({ popScore: -1 });

// 強制刪除舊模型並重建（避免 schema 快取問題）
if (mongoose.models.Music) {
  delete mongoose.models.Music;
}

const Music = mongoose.model("Music", MusicSchema);

export default Music;
