// models/ModerationAction.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const ModerationActionSchema = new Schema(
  {
    // 你可以視需求使用其中一個或兩個欄位：
    imageId: { type: Schema.Types.ObjectId, ref: "Image", index: true },
    targetType: { type: String, enum: ["image", "user", "comment"], default: "image" },
    targetId: { type: Schema.Types.ObjectId, index: true },

    action: {
      type: String,
      enum: ["recategorize", "remove", "restore", "flag", "ban", "unban", "warn"],
      required: true,
    },

    // recategorize 會用到
    oldCategory: { type: String },
    newCategory: { type: String },

    reason: { type: String, default: "" },                 // 管理員填寫原因
    performedBy: { type: Schema.Types.ObjectId, ref: "User", required: true }, // 執行者
  },
  { timestamps: true }
);

// 避免 dev/hot-reload 重複註冊 model
export default mongoose.models.ModerationAction
  || mongoose.model("ModerationAction", ModerationActionSchema);
