// models/Image.js
import mongoose from "mongoose";
import { computePopScore, ensureLikesCount, POP_NEW_BASE_RATIO } from "@/utils/score";

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

    modelName: String,
    loraName: String,
    modelLink: { type: String, default: "" },
    loraLink: { type: String, default: "" },

    tags: [String],
    imageId: String,
    imageUrl: String,
    variant: String,

    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userId: { type: String, required: true },

    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    likesCount: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    completenessScore: { type: Number, default: 0 },

    // ✅ 新增：時間加成基礎值（由新圖決定），之後每小時衰減
    initialBoost: { type: Number, default: 0 },

    // 總分（popular 用它排序）
    popScore: { type: Number, default: 0 },

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

// 索引
ImageSchema.index({ createdAt: -1 });
ImageSchema.index({ rating: 1, createdAt: -1 });
ImageSchema.index({ category: 1, createdAt: -1 });
ImageSchema.index({ rating: 1, category: 1, createdAt: -1 });
ImageSchema.index({ user: 1 });
ImageSchema.index({ tags: 1 });
ImageSchema.index({ imageId: 1 });
ImageSchema.index({ userId: 1 });
ImageSchema.index({ popScore: -1, createdAt: -1 });

// 取目前最高分（只取 popScore 欄位）
async function fetchCurrentMaxPopScore(model) {
  const top = await model.findOne({}, { popScore: 1 }).sort({ popScore: -1 }).lean();
  return Number.isFinite(top?.popScore) ? Number(top.popScore) : 0;
}

// 初始化：新文件在存檔前，抓目前最高分的 80% 當 initialBoost，並算出 popScore
ImageSchema.pre("save", async function (next) {
  try {
    if (this.isNew) {
      this.likesCount = ensureLikesCount(this);
      // 目前最高分 * 比例（可由環境變數調整 POP_NEW_BASE_RATIO）
      const max = await fetchCurrentMaxPopScore(this.constructor);
      this.initialBoost = Math.max(0, Math.floor(max * POP_NEW_BASE_RATIO));
      this.popScore = computePopScore(this);
    }
    next();
  } catch (e) {
    next(e);
  }
});

// insertMany 也補：用建立時刻的「全站最高分」作為基準
ImageSchema.pre("insertMany", async function (next, docs) {
  try {
    if (!Array.isArray(docs) || docs.length === 0) return next();
    const model = mongoose.models.Image || this.model || mongoose.model("Image");
    const max = await fetchCurrentMaxPopScore(model);

    for (const d of docs) {
      d.likesCount = ensureLikesCount(d);
      d.initialBoost = Math.max(0, Math.floor(max * POP_NEW_BASE_RATIO));
      d.popScore = computePopScore(d);
    }
    next();
  } catch (e) {
    next(e);
  }
});

export default mongoose.models.Image || mongoose.model("Image", ImageSchema);
