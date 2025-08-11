// models/Image.js
import mongoose from "mongoose";

const ImageSchema = new mongoose.Schema(
  {
    title: String,
    platform: String,
    positivePrompt: String,
    negativePrompt: String,
    rating: { type: String, enum: ["all", "15", "18"], default: "all" },
    category: String,
    description: String,
    author: { type: String, default: "" },

    // 模型相關
    modelName: String,
    loraName: String,
    modelLink: { type: String, default: "" },
    loraLink: { type: String, default: "" },

    tags: [String],
    imageId: String,
    imageUrl: String,
    variant: String,

    // 使用者關聯
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userId: { type: String, required: true },

    // 互動
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    likesCount: { type: Number, default: 0 },   // ✅ 快取愛心數
    clicks: { type: Number, default: 0 },
    completenessScore: { type: Number, default: 0 },

    // ✅ 預算分（popular 直接用它排序）
    popScore: { type: Number, default: 0 },

    // 生成參數
    steps: { type: Number, default: null },
    sampler: { type: String, default: "" },
    cfgScale: { type: Number, default: null },
    seed: { type: String, default: "" },
    clipSkip: { type: Number, default: null },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    modelHash: { type: String, default: "" },

    createdAt: { type: Date, default: Date.now },
  },
  { collection: "images" }
);

// ========= 索引 =========
ImageSchema.index({ createdAt: -1 });
ImageSchema.index({ rating: 1, createdAt: -1 });
ImageSchema.index({ category: 1, createdAt: -1 });
ImageSchema.index({ rating: 1, category: 1, createdAt: -1 });
ImageSchema.index({ user: 1 });
ImageSchema.index({ tags: 1 });
ImageSchema.index({ imageId: 1 });
ImageSchema.index({ userId: 1 });

// ✅ popular 快速排序用
ImageSchema.index({ popScore: -1, createdAt: -1 });

export default mongoose.models.Image || mongoose.model("Image", ImageSchema);
