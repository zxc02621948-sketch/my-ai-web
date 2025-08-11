// models/Image.js
import mongoose from "mongoose";

const ImageSchema = new mongoose.Schema(
  {
    title: String,
    platform: String,
    positivePrompt: String,
    negativePrompt: String,
    rating: {
      type: String,
      enum: ["all", "15", "18"],
      default: "all",
    },
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
    clicks: { type: Number, default: 0 },               // 👈 熱門度需要
    completenessScore: { type: Number, default: 0 },    // 👈 熱門度需要

    // 生成參數
    steps: { type: Number, default: null },
    sampler: { type: String, default: "" },
    cfgScale: { type: Number, default: null },
    seed: { type: String, default: "" }, // 用字串避免大數字精度問題
    clipSkip: { type: Number, default: null },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    modelHash: { type: String, default: "" },

    // 時間
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "images" }
);

// 可選：幫常用排序加索引（加快 newest/oldest）
ImageSchema.index({ createdAt: -1 });

export default mongoose.models.Image || mongoose.model("Image", ImageSchema);
