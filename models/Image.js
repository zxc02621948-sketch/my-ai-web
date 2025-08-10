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

    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdAt: { type: Date, default: Date.now },

    // 🔽 新增生成參數欄位
    steps: { type: Number, default: null },
    sampler: { type: String, default: "" },
    cfgScale: { type: Number, default: null },
    seed: { type: String, default: "" },   // 用字串避免大數字精度問題
    clipSkip: { type: Number, default: null },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    modelHash: { type: String, default: "" },
  },
  { collection: "images" }
);


export default mongoose.models.Image || mongoose.model("Image", ImageSchema);
