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
    username: { type: String, default: "" },

    modelName: String,
    loraName: String,
    modelLink: { type: String, default: "" },
    loraLink: { type: String, default: "" },

    // ✅ 結構化紀錄（主模型 / LoRA）
    modelRef: {
      modelId: Number,
      versionId: Number,
      modelName: String,
      modelType: String,      // 'CHECKPOINT' / 'LORA' / 'EMBEDDING'...
      modelLink: String,      // https://civitai.com/models/:id?modelVersionId=:vid
      versionLink: String,    // https://civitai.com/model-versions/:vid
    },
    loraHashes: [String],
    loraRefs: [{
      hash: String,
      modelId: Number,
      versionId: Number,
      name: String,
      modelLink: String,
      versionLink: String,
    }],

    // ✅ ComfyUI 原始 JSON（新欄位）
    comfy: {
      workflowRaw: { type: String, default: "" }, // 上傳頁/PNG 解析得到的 workflow.json 原文
      promptRaw:   { type: String, default: "" }, // 若 PNG 的 prompt 是 Comfy JSON，就放這
      allowShare:  { type: Boolean, default: false },
    },

    // ✅ 相容舊欄位（讀舊資料時的 fallback）
    raw: {
      comfyWorkflowJson: { type: String, default: "" },
    },

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

    // ✅ 新圖時間加成
    initialBoost: { type: Number, default: 0 },

    // ✅ 權力券系統
    powerUsed: { type: Boolean, default: false },
    powerUsedAt: { type: Date, default: null },
    powerExpiry: { type: Date, default: null },
    powerType: { type: String, enum: ['7day', '30day', 'rare'], default: null },

    // 排序用總分
    popScore: { type: Number, default: 0 },

    // 進階參數
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
ImageSchema.index({ modelHash: 1 });
ImageSchema.index({ 'loraRefs.hash': 1 });

// 目前最高分（取 popScore）
async function fetchCurrentMaxPopScore(model) {
  const top = await model.findOne({}, { popScore: 1 }).sort({ popScore: -1 }).lean();
  return Number.isFinite(top?.popScore) ? Number(top.popScore) : 0;
}

// 新圖：建立 initialBoost 與 popScore
ImageSchema.pre("save", async function (next) {
  try {
    if (this.isNew) {
      this.likesCount = ensureLikesCount(this);
      const max = await fetchCurrentMaxPopScore(this.constructor);
      this.initialBoost = Math.max(0, Math.floor(max * POP_NEW_BASE_RATIO));
      this.popScore = computePopScore(this);
    }
    next();
  } catch (e) {
    next(e);
  }
});

// insertMany 也補
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
