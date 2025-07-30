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
    tags: [String],
    imageId: String,
    imageUrl: String,
    variant: String,

    // ✅ 新增欄位：關聯 user 物件（populate 用）
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // ✅ 保留欄位：原本的 userId 字串（刪除圖片等比對用）
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
