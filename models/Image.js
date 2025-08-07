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
    author: { type: String, default: "" }, // ✅ 新增這行

    // ✅ 新增欄位
    modelName: String,
    loraName: String,
    modelLink: { type: String, default: "" },
    loraLink: { type: String, default: "" },

    tags: [String],
    imageId: String,
    imageUrl: String,
    variant: String,

    // ✅ 關聯 user
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // ✅ 保留 userId 用於刪除等功能
    userId: {
      type: String,
      required: true,
    },

    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "images",
  }
);

export default mongoose.models.Image || mongoose.model("Image", ImageSchema);
