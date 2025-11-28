// models/Image.js
import mongoose from "mongoose";
import { computePopScore, ensureLikesCount, POP_NEW_BASE_RATIO } from "@/utils/score";

const ImageSchema = new mongoose.Schema(
  {
    title: String,
    platform: String,
    positivePrompt: String,
    negativePrompt: String,
    rating: { type: String, enum: ["sfw", "15", "18"], default: "sfw" },
    category: String,
    categories: [String],
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
    originalImageId: { type: String, default: "" },
    originalImageUrl: { type: String, default: "" },
    variant: String,

    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userId: { type: String, required: true },

    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    likesCount: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },  // ✅ 新增：留言數量
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

    // ✅ 是否包含元數據（用於「作品展示」vs「創作參考」篩選）
    hasMetadata: { type: Boolean, default: false, index: true },

    // ===== 內容生命週期管理（預留欄位） =====
    status: {
      type: String,
      enum: ['active', 'cold', 'archived', 'deleted'],
      default: 'active',
      index: true,
      comment: 'active=正常, cold=冷藏, archived=歸檔, deleted=已刪除'
    },

    // ===== 互動數據 =====
    viewCount: {
      type: Number,
      default: 0,
      index: true,
      comment: '觀看次數'
    },

    lastViewedAt: {
      type: Date,
      default: null,
      comment: '最後觀看時間'
    },

    lastInteractionAt: {
      type: Date,
      default: null,
      index: true,
      comment: '最後互動時間（點讚/評論/觀看）'
    },

    // ===== 冷藏/歸檔時間戳 =====
    coldAt: {
      type: Date,
      default: null,
      index: true,
      comment: '進入冷藏狀態的時間'
    },

    archivedAt: {
      type: Date,
      default: null,
      comment: '進入歸檔狀態的時間'
    },

    // ===== 保護標記 =====
    isPinned: {
      type: Boolean,
      default: false,
      index: true,
      comment: '用戶釘選的重要作品，永不冷藏'
    },

    pinnedAt: {
      type: Date,
      default: null,
      comment: '釘選時間'
    },

    isHighQuality: {
      type: Boolean,
      default: false,
      index: true,
      comment: '高質量內容標記（管理員或演算法判定），永不冷藏'
    },

    qualityScore: {
      type: Number,
      default: 0,
      comment: '質量評分（用於自動判定 isHighQuality）'
    },

    // ===== 管理員功能 =====
    adminNotes: {
      type: String,
      default: '',
      comment: '管理員備註'
    },

    forceActive: {
      type: Boolean,
      default: false,
      comment: '管理員強制保持活躍（永不冷藏）'
    },

    createdAt: { type: Date, default: Date.now },
  },
  { collection: "images" }
);

// 索引
ImageSchema.index({ createdAt: -1 });
ImageSchema.index({ rating: 1, createdAt: -1 });
ImageSchema.index({ category: 1, createdAt: -1 });
ImageSchema.index({ categories: 1, createdAt: -1 });
ImageSchema.index({ rating: 1, category: 1, createdAt: -1 });
ImageSchema.index({ rating: 1, categories: 1, createdAt: -1 });
ImageSchema.index({ user: 1 });
ImageSchema.index({ tags: 1 });
ImageSchema.index({ imageId: 1 });
ImageSchema.index({ userId: 1 });
ImageSchema.index({ popScore: -1, createdAt: -1 });
ImageSchema.index({ modelHash: 1 });
ImageSchema.index({ 'loraRefs.hash': 1 });

// ===== 內容生命週期管理索引（預留） =====
ImageSchema.index({ status: 1, popScore: -1 });
ImageSchema.index({ lastInteractionAt: -1 });
ImageSchema.index({ isPinned: 1, user: 1 });

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
