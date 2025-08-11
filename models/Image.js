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
    clicks: { type: Number, default: 0 },
    completenessScore: { type: Number, default: 0 },

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

/** ========= 索引（重點） =========
 * 你 /api/images 的查詢大量使用：
 * - createdAt 排序（newest/oldest/popular/hybrid 的置頂段）
 * - rating / category 的篩選
 * - user 關聯（populate 與作者頁）
 * - tags/關鍵字（regex 幫助有限，但 tags 多鍵索引仍有幫助）
 */

// 時間排序
ImageSchema.index({ createdAt: -1 });

// 分級 + 時間（最常見的「排除 18」或只看 15/18 再排序）
ImageSchema.index({ rating: 1, createdAt: -1 });

// 分類 + 時間（按分類看最新/最舊）
ImageSchema.index({ category: 1, createdAt: -1 });

// 分級 + 分類 + 時間（複合條件時更快）
ImageSchema.index({ rating: 1, category: 1, createdAt: -1 });

// 作者查詢 / populate 快速命中
ImageSchema.index({ user: 1 });

// 標籤（多鍵索引）：雖然 regex 命中幫助有限，但精確/前綴查詢有幫助
ImageSchema.index({ tags: 1 });

// 常用查找欄位（避免偶發查找）
ImageSchema.index({ imageId: 1 });
ImageSchema.index({ userId: 1 });

export default mongoose.models.Image || mongoose.model("Image", ImageSchema);
